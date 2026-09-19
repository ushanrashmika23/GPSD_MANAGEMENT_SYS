import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Upload, FileText, Video, Play, X, RotateCcw, CheckCircle, AlertCircle,
  Loader, Clock, Layers, Trash2, Search, ArrowRight, FileWarning, Ban, ShieldAlert,
} from "lucide-react";
import { Badge, Btn, Input, Sel, Textarea, Card, EmptyState, FLabel } from "../ui";
import { cn } from "../../lib/utils";
import { getAllLessons } from "../../api/apiCalls";
import type { Lesson, Role } from "../../lib/types";
import {
  useUploadManager, formatBytes,
  type UploadItem, type UploadStatus,
} from "../../lib/uploadManager";
import {
  acceptFor, extensionsFor, maxLabelFor, validateFile, type MaterialType,
} from "../../lib/fileValidation";

interface BulkUploadPageProps {
  role: Role;
}

const statusMeta: Record<UploadStatus, { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "muted" | "accent" }> = {
  queued:     { label: "Queued",     variant: "muted" },
  uploading:  { label: "Uploading",  variant: "info" },
  "needs-file": { label: "Needs file", variant: "warning" },
  finalizing: { label: "Finishing",  variant: "accent" },
  done:       { label: "Uploaded",   variant: "success" },
  error:      { label: "Failed",     variant: "danger" },
};

// ── Double-click to edit ──────────────────────────────────────────────────────
// A queue of files is read far more often than it is renamed, so the name and
// description sit as plain text until asked for. Double-click opens the field,
// Enter (or blur) saves, Escape abandons the edit.
function EditableText({
  value,
  onCommit,
  disabled,
  placeholder,
  multiline,
  textClassName,
  fieldClassName,
}: {
  value: string;
  onCommit: (next: string) => void;
  disabled?: boolean;
  placeholder: string;
  multiline?: boolean;
  textClassName?: string;
  fieldClassName?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  // Enter commits and then unmounts the field, which can also fire blur — the
  // flag stops the same edit from being saved twice.
  const settled = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const open = () => {
    settled.current = false;
    setDraft(value);
    setEditing(true);
  };

  const commit = () => {
    if (settled.current) return;
    settled.current = true;
    setEditing(false);
    const next = draft.trim();
    if (next !== value) onCommit(next);
  };

  const abandon = () => {
    settled.current = true;
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    const shared = {
      autoFocus: true,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        // Enter saves; in the description Shift+Enter starts a new line.
        if (e.key === "Enter" && (!multiline || !e.shiftKey)) {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          e.preventDefault();
          abandon();
        }
      },
      className: fieldClassName,
    };
    return multiline ? <Textarea rows={2} {...shared} /> : <Input {...shared} />;
  }

  return (
    <span
      onDoubleClick={disabled ? undefined : open}
      title={disabled ? undefined : "Double-click to edit"}
      className={cn(
        "block rounded-md -mx-1 px-1 transition-colors",
        !disabled && "cursor-text hover:bg-muted/60",
        !value && "italic text-muted-foreground/70",
        textClassName
      )}
    >
      {value || placeholder}
    </span>
  );
}

// ── One queue row ─────────────────────────────────────────────────────────────
function UploadRow({
  item,
  lessons,
  onCancel,
  onRemove,
  onRetry,
  onUpdate,
}: {
  item: UploadItem;
  lessons: Lesson[];
  onCancel: () => void;
  onRemove: () => void;
  onRetry: () => void;
  onUpdate: (updates: Partial<UploadItem>) => void;
}) {
  const meta = statusMeta[item.status];
  // Name and description stay editable while the parts are still going up — the
  // row is registered with whatever they hold when the upload finishes.
  const canEditMeta = item.status !== "done";
  // Where and how the file is written, though, is fixed once it has started.
  const editable = item.status !== "done" && item.status !== "uploading" && item.status !== "finalizing";
  const lesson = lessons.find((l) => l.id === item.lessonId);

  return (
    <div className="px-4 py-3.5 flex flex-col gap-3 lg:flex-row lg:items-center">
      {/* Type icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
        item.type === "VIDEO"
          ? "bg-gradient-to-br from-blue-500 to-indigo-600"
          : "bg-gradient-to-br from-emerald-500 to-teal-600"
      }`}>
        {item.type === "VIDEO"
          ? <Play className="w-4 h-4 text-white" />
          : <FileText className="w-4 h-4 text-white" />}
      </div>

      {/* Name + description — double-click either to edit it in place */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <EditableText
          value={item.title}
          onCommit={(title) => onUpdate({ title })}
          disabled={!canEditMeta}
          placeholder="Material title"
          textClassName="text-sm font-semibold text-foreground truncate"
          fieldClassName="!py-1.5 text-sm font-medium"
        />

        <EditableText
          value={item.description}
          onCommit={(description) => onUpdate({ description })}
          disabled={!canEditMeta}
          placeholder="Add a description…"
          multiline
          textClassName="text-xs text-muted-foreground line-clamp-2"
          fieldClassName="!py-1.5 !text-xs"
        />

        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span className="truncate max-w-[240px]" title={item.fileName}>{item.fileName}</span>
          <span>·</span>
          <span className="shrink-0">{formatBytes(item.size)}</span>
          {item.status === "done" && lesson && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Layers className="w-3 h-3" />{lesson.title}
              </span>
            </>
          )}
        </div>

        {/* Target lesson + type — only while the row can still change */}
        {editable && (
          <div className="flex items-center gap-2 flex-wrap">
            <Sel
              value={item.lessonId}
              onChange={(e) => onUpdate({ lessonId: e.target.value })}
              className="!py-1 !text-xs max-w-[220px]"
            >
              <option value="">Select lesson…</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </Sel>
            <Sel
              value={item.type}
              onChange={(e) => onUpdate({ type: e.target.value as "DOCUMENT" | "VIDEO" })}
              className="!py-1 !text-xs max-w-[130px]"
            >
              <option value="DOCUMENT">Document</option>
              <option value="VIDEO">Video</option>
            </Sel>
          </div>
        )}

        {/* Progress */}
        {item.status !== "done" && (
          <div className="pt-1">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-[width] duration-200 ${
                  item.status === "error"
                    ? "bg-destructive"
                    : item.status === "needs-file"
                      ? "bg-amber-500"
                      : "bg-primary"
                }`}
                style={{ width: `${Math.min(100, item.progress)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
              <span>
                {item.status === "uploading" && item.speed > 0
                  ? `${formatBytes(item.speed)}/s`
                  : item.status === "needs-file"
                    ? "Waiting for the file"
                    : item.progress > 0
                      ? `${item.progress.toFixed(0)}%`
                      : "—"}
              </span>
              <span>
                {formatBytes(item.uploadedBytes)} / {formatBytes(item.size)}
              </span>
            </div>
          </div>
        )}

        {item.error && (
          <p className="text-xs text-destructive flex items-start gap-1.5 pt-0.5">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>{item.error}</span>
          </p>
        )}
      </div>

      {/* Status + actions */}
      <div className="flex items-center gap-2 shrink-0 lg:flex-col lg:items-end lg:gap-2">
        <Badge v={meta.variant} className="gap-1">
          {item.status === "uploading" || item.status === "finalizing"
            ? <Loader className="w-3 h-3 animate-spin" />
            : item.status === "done"
              ? <CheckCircle className="w-3 h-3" />
              : item.status === "error"
                ? <AlertCircle className="w-3 h-3" />
                : item.status === "needs-file"
                  ? <FileWarning className="w-3 h-3" />
                  : <Clock className="w-3 h-3" />}
          {meta.label}
        </Badge>

        <div className="flex items-center gap-1">
          {item.status === "error" && (
            <Btn v="outline" sz="xs" onClick={onRetry} title="Try again">
              <RotateCcw className="w-3.5 h-3.5" />Retry
            </Btn>
          )}
          {item.status === "done" ? (
            <Btn v="ghost" sz="xs" onClick={onRemove} title="Clear from the list">
              <Trash2 className="w-3.5 h-3.5" />
            </Btn>
          ) : (
            <Btn v="ghost" sz="xs" onClick={onCancel} className="text-destructive" title="Cancel and discard">
              <Ban className="w-3.5 h-3.5" />
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export function BulkUploadPage({ role }: BulkUploadPageProps) {
  const {
    items, addFiles, cancel, remove, retry, updateItem,
    retryFailed, clearFinished, counts,
    blocked, clearBlock,
  } = useUploadManager();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonId, setLessonId] = useState("");
  const [type, setType] = useState<MaterialType>("DOCUMENT");
  const [dragOver, setDragOver] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "finished">("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [rejected, setRejected] = useState<{ fileName: string; reason: string }[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(true);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const isAdmin = role === "admin";
  const selectedLesson = lessons.find((l) => l.id === lessonId);

  // ── Lessons (the queue targets lessons that already exist) ────────────────
  const fetchLessons = useCallback(async () => {
    try {
      const res = await getAllLessons(1, 500, "");
      const data = res?.data?.data ?? [];
      setLessons(data.map((l: any) => ({
        id: l.id,
        title: l.title,
        description: l.description ?? "",
        type: l.type ?? "",
        created_at: l.created_at ?? "",
        materialCount: l._count?.material ?? 0,
      })));
    } catch (err) {
      console.error("Failed to fetch lessons:", err);
    } finally {
      setLoadingLessons(false);
    }
  }, []);

  useEffect(() => { fetchLessons(); }, [fetchLessons]);

  // ── Adding files ──────────────────────────────────────────────────────────
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    const result = addFiles(files, { lessonId, type });

    const parts: string[] = [];
    if (result.added) parts.push(`${result.added} added`);
    if (result.resumed) parts.push(`${result.resumed} continued`);
    if (result.skipped.length) parts.push(`${result.skipped.length} not added`);
    setNotice(parts.join(" · ") || "Nothing to add");
    // Skipped files each carry their own reason (wrong format, too large, or
    // already queued), so they are listed rather than counted away.
    setRejected(result.skipped);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  // Switching a queued row's type has to clear the same rules the file cleared
  // when it was added — otherwise the row's dropdown is a way around them.
  const handleRowUpdate = (item: UploadItem, updates: Partial<UploadItem>) => {
    if (updates.type && updates.type !== item.type) {
      const valid = validateFile({ name: item.fileName, size: item.size }, updates.type);
      if (!valid.ok) {
        setRejected([{ fileName: item.fileName, reason: valid.reason }]);
        return;
      }
    }
    updateItem(item.id, updates);
  };

  const filtered = useMemo(() => {
    if (filter === "active") {
      return items.filter((i) => i.status !== "done");
    }
    if (filter === "finished") {
      return items.filter((i) => i.status === "done");
    }
    return items;
  }, [items, filter]);

  const canAdd = !!lessonId;

  if (!isAdmin) {
    return (
      <EmptyState
        icon={FileWarning}
        title="Admin only"
        desc="Bulk uploading materials is restricted to administrators."
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Bulk Upload</h1>
          <p className="text-sm text-muted-foreground">
            {counts.total === 0
              ? "Queue files to upload straight to storage"
              : `${counts.done}/${counts.total} uploaded · ${formatBytes(counts.bytesUploaded)} of ${formatBytes(counts.bytesTotal)}`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {counts.error > 0 && (
            <Btn v="outline" onClick={retryFailed}><RotateCcw className="w-4 h-4" />Retry failed</Btn>
          )}
          {counts.done > 0 && (
            <Btn v="ghost" onClick={clearFinished}><Trash2 className="w-4 h-4" />Clear uploaded</Btn>
          )}
        </div>
      </div>

      {/* Storage is refusing requests — say why, and how to clear it */}
      {blocked && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-4.5 h-4.5 text-destructive" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              Uploads are paused — storage blocked the request
            </p>
            <p className="text-xs text-muted-foreground mt-1 break-words">{blocked}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Queued files are held, not failed. Once the bucket policy allows{" "}
              <code className="px-1 py-0.5 rounded bg-muted font-mono text-[11px]">
                {typeof window !== "undefined" ? window.location.origin : "this origin"}
              </code>
              , retry — parts already uploaded are reused, so nothing restarts from zero.
            </p>
          </div>
          <Btn v="outline" onClick={clearBlock} className="shrink-0">
            <RotateCcw className="w-4 h-4" />Retry now
          </Btn>
        </div>
      )}

      {/* Uploads keep running while you work elsewhere in the app */}
      <Card className="p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <FLabel>Upload to lesson</FLabel>
              <Sel value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                <option value="">
                  {loadingLessons ? "Loading lessons…" : "Select a lesson…"}
                </option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}{l.materialCount ? ` (${l.materialCount} materials)` : ""}
                  </option>
                ))}
              </Sel>
            </div>

            <div>
              <FLabel>Material type</FLabel>
              <div className="flex overflow-hidden rounded-xl gap-1 border border-border bg-muted/40 p-0.5">
                {([
                  { value: "DOCUMENT", label: "Document", icon: FileText },
                  { value: "VIDEO", label: "Video", icon: Video },
                ] as const).map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      type === value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Drop zone */}
          <div
            ref={dropRef}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); if (canAdd) setDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 ${
              !canAdd
                ? "border-border bg-muted/20 opacity-70"
                : dragOver
                  ? "border-primary bg-primary/5 scale-[1.005]"
                  : "border-border hover:border-muted-foreground/40 hover:bg-muted/20"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={acceptFor(type)}
              disabled={!canAdd}
              onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
              aria-label="Choose files to upload"
            />
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                <Upload className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {canAdd
                    ? "Drag & drop files here, or browse"
                    : "Select a lesson above to start adding files"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedLesson
                    ? `Files are uploaded into “${selectedLesson.title}”.`
                    : "Materials are created inside an existing lesson."}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {type === "VIDEO"
                    ? `Video: ${extensionsFor("VIDEO").join(", ")} · up to ${maxLabelFor("VIDEO")} each.`
                    : `Document: PDF only · up to ${maxLabelFor("DOCUMENT")} each.`}
                </p>
              </div>
            </div>
          </div>

          {notice && (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />{notice}
            </p>
          )}

          {/* Files that failed the type/size rules — one line each, so it is
              clear which file was refused and why */}
          {rejected.length > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-px" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground">
                    {rejected.length === 1 ? "1 file was not added" : `${rejected.length} files were not added`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {rejected.map((r, i) => (
                      <li key={`${r.fileName}-${i}`} className="text-xs text-muted-foreground break-words">
                        {r.reason}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  type="button"
                  onClick={() => setRejected([])}
                  className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Files go straight to storage, not through the API. Uploads keep running while
            you move around the app, and an interrupted upload continues from where it stopped.
          </p>
        </div>
      </Card>

      {/* Queue */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex overflow-hidden rounded-xl border border-border bg-muted/40 p-0.5">
          {([
            { value: "all", label: `All (${items.length})` },
            { value: "active", label: `In progress (${items.length - counts.done})` },
            { value: "finished", label: `Uploaded (${counts.done})` },
          ] as const).map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                filter === value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {counts.needsFile > 0 && (
          <p className="text-xs text-amber-600 flex items-center gap-1.5">
            <FileWarning className="w-3.5 h-3.5" />
            {counts.needsFile} upload{counts.needsFile !== 1 ? "s" : ""} waiting for the file to be added again
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Upload}
          title="Nothing queued"
          desc="Add files above and they will upload in the background — you can retry or cancel each one."
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nothing here"
          desc={filter === "finished" ? "No uploads have finished yet." : "No uploads in this view."}
        />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {filtered.map((item) => (
            <UploadRow
              key={item.id}
              item={item}
              lessons={lessons}
              onCancel={() => cancel(item.id)}
              onRemove={() => remove(item.id)}
              onRetry={() => retry(item.id)}
              onUpdate={(updates) => handleRowUpdate(item, updates)}
            />
          ))}
        </Card>
      )}

      {counts.done > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <ArrowRight className="w-3.5 h-3.5" />
          Uploaded materials appear in Materials under their lesson — grant batch access there.
        </p>
      )}
    </div>
  );
}
