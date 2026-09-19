import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  initUpload,
  signUploadParts,
  listUploadParts,
  completeUpload,
  abortUpload,
  registerMaterialsBulk,
} from "../api/apiCalls";
import { validateFile, type MaterialType } from "./fileValidation";

// ── Bulk upload manager ───────────────────────────────────────────────────────
// A queue that uploads files straight to Cloudflare R2 with presigned multipart
// URLs, so the API never proxies file bytes.
//
// Multipart is also what makes an interrupted upload cheap to restart: each part
// is an independent request, so a file that fails (or a page that is reloaded)
// keeps whatever parts already landed in R2. Continuing asks R2 itself (ListParts
// — not local state) which parts it holds and uploads only the rest. A reload
// loses the File handles, so those rows wait for the file to be re-added before
// they can continue.
//
// The queue lives above the page switch (see App/Shell), so uploads keep running
// while the user works anywhere else in the app.

const STORAGE_KEY = "gpsd.bulkUploads.v1";

const PART_CONCURRENCY = 3;   // parts in flight per file
const MAX_ACTIVE_FILES = 3;   // files uploading at once
const SIGN_BATCH = 100;       // max part URLs per signing request (server cap)
const PART_RETRIES = 2;       // extra attempts per part
const PROGRESS_INTERVAL = 250; // ms between progress-driven re-renders

export type UploadStatus =
  | "queued"      // waiting for a free upload slot
  | "uploading"
  | "needs-file"  // interrupted (page reload / file handle lost); re-add the file
  | "finalizing"  // all parts sent, assembling + registering the material
  | "done"
  | "error";

export interface UploadItem {
  id: string;
  fileName: string;
  size: number;
  mimeType: string;
  type: MaterialType;
  lessonId: string;
  title: string;
  description: string;
  status: UploadStatus;
  progress: number;        // 0-100
  uploadedBytes: number;
  error?: string;
  key?: string;            // R2 object key (server-minted)
  uploadId?: string;       // R2 multipart upload id
  partSize?: number;
  assembled?: boolean;     // parts are combined in R2 — only the DB row is missing
  materialId?: string;     // set once the material row is registered
  speed: number;           // bytes/sec (live only)
  addedAt: number;
  finishedAt?: number;
}

export interface AddFilesResult {
  added: number;
  resumed: number;
  skipped: { fileName: string; reason: string }[];
}

interface UploadManagerValue {
  items: UploadItem[];
  addFiles: (
    files: File[],
    opts?: { lessonId?: string; type?: MaterialType }
  ) => AddFilesResult;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  retry: (id: string) => void;
  updateItem: (id: string, updates: Partial<UploadItem>) => void;
  retryFailed: () => void;
  clearFinished: () => void;
  /** Set when storage is refusing requests (CORS/offline) — uploads are held. */
  blocked: string | null;
  /** Re-arm after fixing the cause; queued files start again. */
  clearBlock: () => void;
  counts: {
    total: number;
    active: number;
    queued: number;
    needsFile: number;
    error: number;
    done: number;
    bytesTotal: number;
    bytesUploaded: number;
    progress: number;
  };
}

const UploadManagerContext = createContext<UploadManagerValue | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const titleFromFileName = (name: string) =>
  name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || name;

const isAbort = (e: any) => e?.name === "AbortError" || e?.name === "CanceledError";

// Where this page is served from — the value the bucket's CORS policy has to
// allow. Named in the error so the fix is copy-pasteable.
const ORIGIN =
  typeof window !== "undefined" && window.location?.origin
    ? window.location.origin
    : "this origin";

// A failed CORS preflight is indistinguishable from an unreachable host when
// read from XHR: onerror fires, status is 0, and the real reason is only in the
// browser's own console. Both are treated as "blocked" because neither is worth
// retrying on a timer — so the queue fails fast and explains, instead of
// re-sending (and re-preflighting) parts that cannot succeed.
const blockedError = (): Error => {
  const e = new Error(
    `Storage refused the connection from ${ORIGIN}. This is almost always the R2 ` +
      `bucket's CORS policy: it must list "${ORIGIN}" under AllowedOrigins with PUT, ` +
      `AllowedHeaders ["*"] and ExposeHeaders ["ETag"] — see backend/docs/r2-cors.md. ` +
      `If the policy already allows it, check this machine's network/VPN reaches R2.`
  ) as Error & { blocked?: boolean };
  e.blocked = true;
  return e;
};

const formatBytes = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

// ── Persistence (metadata only — File handles can't be serialized) ─────────────

const loadPersisted = (): UploadItem[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((i: any): UploadItem => {
      // Anything that was mid-flight when the app closed has lost its File
      // handle, so it comes back waiting for the file to be re-added.
      const status: UploadStatus =
        i.status === "done" || i.status === "error" ? i.status : "needs-file";
      return {
        id: i.id ?? newId(),
        fileName: i.fileName ?? "Unknown file",
        size: Number(i.size) || 0,
        mimeType: i.mimeType ?? "application/octet-stream",
        type: i.type === "VIDEO" ? "VIDEO" : "DOCUMENT",
        lessonId: i.lessonId ?? "",
        title: i.title ?? titleFromFileName(i.fileName ?? "Untitled"),
        description: i.description ?? "",
        status,
        progress: Number(i.progress) || 0,
        uploadedBytes: Number(i.uploadedBytes) || 0,
        error: i.error,
        key: i.key,
        uploadId: i.uploadId,
        partSize: i.partSize,
        assembled: !!i.assembled,
        materialId: i.materialId,
        speed: 0,
        addedAt: i.addedAt ?? Date.now(),
        finishedAt: i.finishedAt,
      };
    });
  } catch {
    return [];
  }
};

const persist = (items: UploadItem[]) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(items.map(({ speed, ...rest }) => rest))
    );
  } catch {
    // Quota/private-mode failures are not worth interrupting an upload for
  }
};

// ── One part → R2 with a presigned URL (raw XHR: no auth header, ETag access) ──
const putPart = (
  url: string,
  blob: Blob,
  onProgress: (loaded: number) => void,
  signal: AbortSignal
): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Deliberately no request headers: the presigned URL signs a fixed set of
    // headers, so anything we add ourselves risks a signature mismatch. The
    // JWT is never attached either — R2 must not receive app credentials, and
    // withCredentials stays off so no cookies follow the request to the bucket.
    xhr.open("PUT", url, true);

    xhr.upload.onprogress = (e) => onProgress(e.loaded);

    xhr.onload = () => {
      // Status 0 on a completed request means the response was opaque — the
      // same blocked case onerror covers, so report it the same actionable way.
      if (xhr.status === 0) {
        reject(blockedError());
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`R2 rejected the part (HTTP ${xhr.status})`));
        return;
      }
      // Needs ExposeHeaders: ["ETag"] on the bucket CORS policy — the browser
      // hides response headers from JS otherwise, and the upload can't complete.
      const etag = xhr.getResponseHeader("ETag");
      if (!etag) {
        reject(new Error(
          "R2 returned no ETag. Add \"ETag\" to the bucket's CORS ExposeHeaders (see backend/docs/r2-cors.md)."
        ));
        return;
      }
      resolve(etag);
    };
    xhr.onerror = () => reject(blockedError()); // CORS preflight rejection or unreachable host
    xhr.ontimeout = () => reject(new Error("Timed out while uploading a part"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

    signal.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.send(blob);
  });

// ── Register the material row for a file that is already assembled in R2 ──────
const registerItem = async (
  item: UploadItem,
  id: string,
  patch: (id: string, updates: Partial<UploadItem>) => void
) => {
  const registered = await registerMaterialsBulk([{
    title: item.title,
    description: item.description,
    type: item.type,
    lesson_id: item.lessonId,
    key: item.key!,
    size: item.size,
  }]);

  const failed = registered?.data?.failed?.[0];
  if (!registered?.success || failed) {
    throw new Error(failed?.error || registered?.msg || "Could not register the material");
  }

  patch(id, {
    status: "done",
    progress: 100,
    uploadedBytes: item.size,
    speed: 0,
    assembled: true,
    materialId: registered.data?.created?.[0]?.id,
    finishedAt: Date.now(),
  });
};

// Surface the most specific message a failed request offers — the per-file
// reason the bulk endpoint reports beats a generic "request failed".
const describeError = (e: any): string => {
  const body = e?.response?.data;
  return (
    body?.error?.failed?.[0]?.error ||
    body?.data?.failed?.[0]?.error ||
    body?.msg ||
    e?.message ||
    "Upload failed"
  );
};

// ── Provider ──────────────────────────────────────────────────────────────────

export function UploadManagerProvider({ children }: { children: React.ReactNode }) {
  // The ref is the source of truth so the async engine always reads fresh state;
  // React state is a mirror that drives rendering.
  const itemsRef = useRef<UploadItem[]>(loadPersisted());
  const [items, setItems] = useState<UploadItem[]>(itemsRef.current);

  const files = useRef(new Map<string, File>());          // id → File (memory only)
  const running = useRef(new Set<string>());              // ids with a live runner
  const controllers = useRef(new Map<string, AbortController>());
  const partProgress = useRef(new Map<string, Map<number, number>>()); // id → part → bytes
  const lastTick = useRef(new Map<string, { bytes: number; at: number }>());
  const lastPaint = useRef(new Map<string, number>());

  // Circuit breaker: set when storage refuses a request (CORS/offline). While
  // it is set the scheduler starts nothing new, because every further file
  // would fail identically. Cleared by any deliberate retry from the user.
  const [blocked, setBlocked] = useState<string | null>(null);
  const blockedRef = useRef<string | null>(null);

  const clearBlock = useCallback(() => {
    blockedRef.current = null;
    setBlocked(null);
    setTimeout(() => pumpRef.current?.(), 0);
  }, []);

  const commit = useCallback(() => setItems([...itemsRef.current]), []);

  const getItem = useCallback(
    (id: string) => itemsRef.current.find((i) => i.id === id),
    []
  );

  const patch = useCallback(
    (id: string, updates: Partial<UploadItem>) => {
      itemsRef.current = itemsRef.current.map((i) =>
        i.id === id ? { ...i, ...updates } : i
      );
      commit();
    },
    [commit]
  );

  // Throttled progress paint — part-level events fire far too often to render
  const paintProgress = useCallback(
    (id: string) => {
      const item = getItem(id);
      if (!item) return;
      const now = Date.now();

      const inflight = partProgress.current.get(id);
      const inflightBytes = inflight
        ? [...inflight.values()].reduce((a, b) => a + b, 0)
        : 0;
      const uploadedBytes = Math.min(item.size, item.uploadedBytes + inflightBytes);
      const progress = item.size > 0 ? Math.min(100, (uploadedBytes / item.size) * 100) : 0;

      const tick = lastTick.current.get(id);
      let speed = item.speed;
      if (tick && now > tick.at) {
        const delta = uploadedBytes - tick.bytes;
        if (delta >= 0) speed = (delta / (now - tick.at)) * 1000;
      }
      lastTick.current.set(id, { bytes: uploadedBytes, at: now });

      if ((lastPaint.current.get(id) ?? 0) + PROGRESS_INTERVAL > now) return;
      lastPaint.current.set(id, now);

      patch(id, { uploadedBytes, progress, speed });
    },
    [getItem, patch]
  );

  // ── Runner ─────────────────────────────────────────────────────────────────
  // Uploads one queued item to completion. Safe to call for an item that is
  // already running (it returns immediately).
  const runItem = useCallback(
    async (id: string) => {
      if (running.current.has(id)) return;
      const file = files.current.get(id);
      let item = getItem(id);
      if (!item) return;

      if (!file) {
        patch(id, {
          status: "needs-file",
          error: "The file needs to be added again to continue this upload.",
        });
        return;
      }
      if (!item.lessonId) {
        patch(id, { status: "error", error: "Select a lesson for this file before uploading." });
        return;
      }

      const controller = new AbortController();
      controllers.current.set(id, controller);
      running.current.add(id);

      try {
        // 0. The file is already assembled in R2 and only the material row
        //    failed to register — re-running the upload would duplicate it, so
        //    skip straight to registration. (ListParts reports NoSuchUpload for
        //    an already-completed upload, which would otherwise restart it.)
        if (item.assembled && item.key) {
          await registerItem(getItem(id) ?? item, id, patch);
          return;
        }

        // 1. Open the multipart upload (or re-open it if R2 dropped it)
        if (!item.key || !item.uploadId || !item.partSize) {
          patch(id, { status: "uploading", error: undefined });
          const res = await initUpload({
            fileName: item.fileName,
            contentType: item.mimeType || "application/octet-stream",
            size: item.size,
            type: item.type,
          });
          if (!res?.success) throw new Error(res?.msg || "Could not start the upload");

          item = {
            ...item,
            key: res.data.key,
            uploadId: res.data.uploadId,
            partSize: res.data.partSize,
          };
          patch(id, {
            key: item.key,
            uploadId: item.uploadId,
            partSize: item.partSize,
            status: "uploading",
            error: undefined,
          });
        } else {
          patch(id, { status: "uploading", error: undefined });
        }

        const partSize = item.partSize!;
        const partCount = Math.max(1, Math.ceil(item.size / partSize));

        // 2. Ask R2 what it already holds — the source of truth when resuming
        const listed = await listUploadParts({ key: item.key!, uploadId: item.uploadId! });
        const doneParts = new Map<number, string>();

        if (listed?.success) {
          (listed.data?.parts ?? []).forEach((p: any) => doneParts.set(p.partNumber, p.etag));
        } else if (listed?.code === 404) {
          // Upload expired or was aborted server-side — start a fresh one
          patch(id, { key: undefined, uploadId: undefined, uploadedBytes: 0, progress: 0 });
          item = { ...item, key: undefined, uploadId: undefined, uploadedBytes: 0 };
          const res = await initUpload({
            fileName: item.fileName,
            contentType: item.mimeType || "application/octet-stream",
            size: item.size,
            type: item.type,
          });
          if (!res?.success) throw new Error(res?.msg || "Could not restart the upload");
          item = { ...item, key: res.data.key, uploadId: res.data.uploadId, partSize: res.data.partSize };
          patch(id, { key: item.key, uploadId: item.uploadId, partSize: item.partSize });
        } else {
          throw new Error(listed?.msg || "Could not check the upload state");
        }

        const doneBytes = [...doneParts.keys()].reduce(
          (acc, n) => acc + Math.min(partSize, Math.max(0, item!.size - (n - 1) * partSize)),
          0
        );
        patch(id, { uploadedBytes: doneBytes, progress: (doneBytes / item.size) * 100 });

        // 3. Upload whatever is missing
        const missing: number[] = [];
        for (let n = 1; n <= partCount; n++) if (!doneParts.has(n)) missing.push(n);

        if (missing.length > 0) {
          const urls = new Map<number, string>();
          for (let i = 0; i < missing.length; i += SIGN_BATCH) {
            const batch = missing.slice(i, i + SIGN_BATCH);
            const signed = await signUploadParts({
              key: item.key!,
              uploadId: item.uploadId!,
              partNumbers: batch,
            });
            if (!signed?.success) throw new Error(signed?.msg || "Could not sign part URLs");
            (signed.data?.urls ?? []).forEach((u: any) => urls.set(u.partNumber, u.url));
          }

          let next = 0;
          const worker = async () => {
            while (true) {
              if (controller.signal.aborted) return;
              const index = next++;
              if (index >= missing.length) return;
              const partNumber = missing[index];

              const start = (partNumber - 1) * partSize;
              const blob = file.slice(start, Math.min(start + partSize, item!.size));

              let attempt = 0;
              while (true) {
                try {
                  const url = urls.get(partNumber);
                  if (!url) throw new Error(`Missing upload URL for part ${partNumber}`);

                  const etag = await putPart(
                    url,
                    blob,
                    (loaded) => {
                      const inflight = partProgress.current.get(id) ?? new Map<number, number>();
                      inflight.set(partNumber, loaded);
                      partProgress.current.set(id, inflight);
                      paintProgress(id);
                    },
                    controller.signal
                  );

                  // Part landed: fold it into the completed total
                  partProgress.current.get(id)?.delete(partNumber);
                  doneParts.set(partNumber, etag);
                  const current = getItem(id);
                  patch(id, { uploadedBytes: (current?.uploadedBytes ?? 0) + blob.size });
                  return;
                } catch (e: any) {
                  if (isAbort(e) || controller.signal.aborted) return;
                  // A blocked request is deterministic — every retry fails the
                  // same way and costs another preflight, so give up on this
                  // file immediately rather than burning PART_RETRIES per part.
                  if (e?.blocked) throw e;
                  if (attempt++ >= PART_RETRIES) throw e;
                }
              }
            }
          };

          await Promise.all(
            Array.from({ length: Math.min(PART_CONCURRENCY, missing.length) }, worker)
          );

          if (controller.signal.aborted) return;
        }

        // 4. Assemble the object
        patch(id, { status: "finalizing", progress: 100, uploadedBytes: item.size, speed: 0 });
        const parts = [...doneParts.entries()]
          .map(([partNumber, etag]) => ({ partNumber, etag }))
          .sort((a, b) => a.partNumber - b.partNumber);

        const completed = await completeUpload({
          key: item.key!,
          uploadId: item.uploadId!,
          parts,
        });
        if (!completed?.success) throw new Error(completed?.msg || "Could not assemble the file");

        // 5. Register the material row. From here the object is final in R2, so
        //    a failure re-runs only this step on retry. The item is re-read
        //    because the user can retitle it from the queue while the parts are
        //    still going up, and the row should carry the name they last saw.
        patch(id, { assembled: true });
        await registerItem(getItem(id) ?? item, id, patch);
      } catch (e: any) {
        // A cancel deliberately aborts in-flight work — leave the row alone.
        // (Checked before the breaker so an abort we cause below isn't swallowed.)
        if (isAbort(e) || controller.signal.aborted) return;

        if (e?.blocked) {
          // Stop the sibling workers still pushing parts into the same wall,
          // and stop the scheduler handing out new files.
          controller.abort();
          blockedRef.current = e.message;
          setBlocked(e.message);
        }

        patch(id, {
          status: "error",
          error: describeError(e),
          speed: 0,
        });
      } finally {
        running.current.delete(id);
        controllers.current.delete(id);
        partProgress.current.delete(id);
        commit();
        // Free slot → let the scheduler pick up the next queued file
        setTimeout(() => pumpRef.current?.(), 0);
      }
    },
    [getItem, patch, paintProgress, commit]
  );

  // ── Scheduler ──────────────────────────────────────────────────────────────
  const pump = useCallback(() => {
    // Storage is refusing requests — starting another file just repeats the
    // failure. Items stay queued until the user retries after fixing it.
    if (blockedRef.current) return;
    let active = running.current.size;
    for (const item of itemsRef.current) {
      if (active >= MAX_ACTIVE_FILES) return;
      if (item.status === "queued" && files.current.has(item.id) && !running.current.has(item.id)) {
        active++;
        runItem(item.id);
      }
    }
  }, [runItem]);

  const pumpRef = useRef<() => void>();
  pumpRef.current = pump;

  // Restored items wait for their file; surface that on first load
  useEffect(() => {
    if (itemsRef.current.some((i) => i.status === "needs-file")) commit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    persist(items);
  }, [items]);

  // ── Warn before leaving with uploads in flight ─────────────────────────────
  const active = items.filter((i) => i.status === "uploading" || i.status === "finalizing").length;

  useEffect(() => {
    if (active === 0) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active]);

  // ── Public actions ─────────────────────────────────────────────────────────
  const addFiles = useCallback(
    (incoming: File[], opts?: { lessonId?: string; type?: MaterialType }) => {
      const result: AddFilesResult = { added: 0, resumed: 0, skipped: [] };
      const lessonId = opts?.lessonId ?? "";
      const type = opts?.type ?? "DOCUMENT";

      incoming.forEach((file) => {
        // Resuming: the same file re-added after a reload re-attaches to its
        // existing row so the parts already in R2 are reused. Deliberately
        // checked before validation — a row interrupted under an older rule set
        // should still be allowed to finish rather than stranded in R2.
        const match = itemsRef.current.find(
          (i) =>
            i.fileName === file.name &&
            i.size === file.size &&
            (i.status === "needs-file" || i.status === "error")
        );
        if (match) {
          files.current.set(match.id, file);
          if (opts?.lessonId) {
            itemsRef.current = itemsRef.current.map((i) =>
              i.id === match.id ? { ...i, lessonId, type, error: undefined, status: "queued" } : i
            );
          } else {
            itemsRef.current = itemsRef.current.map((i) =>
              i.id === match.id ? { ...i, type, error: undefined, status: "queued" } : i
            );
          }
          result.resumed++;
          return;
        }

        const duplicate = itemsRef.current.find(
          (i) =>
            i.fileName === file.name &&
            i.size === file.size &&
            i.status !== "error" &&
            i.status !== "needs-file"
        );
        if (duplicate) {
          result.skipped.push({ fileName: file.name, reason: "Already in the queue" });
          return;
        }

        // Type and size rules — the API applies the same ones, so rejecting
        // here only saves the round trip and the part URLs.
        const valid = validateFile(file, type);
        if (!valid.ok) {
          result.skipped.push({ fileName: file.name, reason: valid.reason });
          return;
        }

        const item: UploadItem = {
          id: newId(),
          fileName: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
          type,
          lessonId,
          title: titleFromFileName(file.name),
          description: "",
          // A row with no lesson yet queues anyway; the runner parks it as an
          // error naming what is missing, which is also what re-queues it once
          // the lesson is picked.
          status: "queued",
          progress: 0,
          uploadedBytes: 0,
          speed: 0,
          addedAt: Date.now(),
        };
        itemsRef.current = [...itemsRef.current, item];
        files.current.set(item.id, file);
        result.added++;
      });

      // Adding files is a fresh attempt — clear a tripped breaker so the queue
      // tries again. If storage is still refusing, it re-trips after at most
      // MAX_ACTIVE_FILES attempts rather than running through the whole queue.
      if (blockedRef.current) {
        blockedRef.current = null;
        setBlocked(null);
      }

      commit();
      // Let the new rows render before uploads begin
      setTimeout(() => pumpRef.current?.(), 0);
      return result;
    },
    [commit]
  );

  // Put an interrupted row back in the queue. Called by retry and retryFailed;
  // the parts already in R2 are reused, so this continues rather than restarts.
  const requeue = useCallback(
    (id: string) => {
      const item = getItem(id);
      if (!item || item.status === "done") return;
      // A deliberate retry is the user telling us to try storage again — give
      // the request a chance even if the breaker is currently tripped.
      blockedRef.current = null;
      setBlocked(null);
      if (!files.current.has(id)) {
        patch(id, {
          status: "needs-file",
          error: "Add this file again to continue — the browser no longer has access to it.",
        });
        return;
      }
      if (!item.lessonId) {
        patch(id, { status: "error", error: "Select a lesson for this file before uploading." });
        return;
      }
      patch(id, { status: "queued", error: undefined });
      setTimeout(() => pumpRef.current?.(), 0);
    },
    [getItem, patch]
  );

  const cancel = useCallback(
    (id: string) => {
      const item = getItem(id);
      controllers.current.get(id)?.abort();
      partProgress.current.delete(id);
      files.current.delete(id);

      // Release the parts R2 is holding (best effort — the row goes either way)
      if (item?.key && item?.uploadId) {
        abortUpload({ key: item.key, uploadId: item.uploadId }).catch(() => {});
      }
      itemsRef.current = itemsRef.current.filter((i) => i.id !== id);
      commit();
    },
    [getItem, commit]
  );

  const remove = useCallback(
    (id: string) => {
      const item = getItem(id);
      // Removing an unfinished row is a cancel; removing a finished one just
      // clears it from the list.
      if (item && item.status !== "done" && item.status !== "error") {
        cancel(id);
        return;
      }
      files.current.delete(id);
      itemsRef.current = itemsRef.current.filter((i) => i.id !== id);
      commit();
    },
    [getItem, cancel, commit]
  );

  const retry = useCallback(
    (id: string) => {
      requeue(id);
    },
    [requeue]
  );

  const updateItem = useCallback(
    (id: string, updates: Partial<UploadItem>) => {
      patch(id, updates);
    },
    [patch]
  );

  const retryFailed = useCallback(() => {
    itemsRef.current.filter((i) => i.status === "error").forEach((i) => requeue(i.id));
  }, [requeue]);

  const clearFinished = useCallback(() => {
    itemsRef.current.filter((i) => i.status === "done").forEach((i) => files.current.delete(i.id));
    itemsRef.current = itemsRef.current.filter((i) => i.status !== "done");
    commit();
  }, [commit]);

  const counts = useMemo(() => {
    const bytesTotal = items.reduce((a, i) => a + i.size, 0);
    const bytesUploaded = items.reduce(
      (a, i) => a + (i.status === "done" ? i.size : i.uploadedBytes),
      0
    );
    return {
      total: items.length,
      active: items.filter((i) => i.status === "uploading" || i.status === "finalizing").length,
      queued: items.filter((i) => i.status === "queued").length,
      needsFile: items.filter((i) => i.status === "needs-file").length,
      error: items.filter((i) => i.status === "error").length,
      done: items.filter((i) => i.status === "done").length,
      bytesTotal,
      bytesUploaded,
      progress: bytesTotal > 0 ? (bytesUploaded / bytesTotal) * 100 : 0,
    };
  }, [items]);

  const value: UploadManagerValue = {
    items,
    addFiles,
    cancel,
    remove,
    retry,
    updateItem,
    retryFailed,
    clearFinished,
    blocked,
    clearBlock,
    counts,
  };

  return (
    <UploadManagerContext.Provider value={value}>
      {children}
    </UploadManagerContext.Provider>
  );
}

export function useUploadManager() {
  const ctx = useContext(UploadManagerContext);
  if (!ctx) throw new Error("useUploadManager must be used inside UploadManagerProvider");
  return ctx;
}

export { formatBytes, titleFromFileName };
