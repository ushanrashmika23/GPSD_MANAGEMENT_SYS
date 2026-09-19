import { useState } from "react";
import {
  ChevronUp, X, AlertCircle, CheckCircle,
  FileWarning, ArrowUpRight, ShieldAlert,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Btn } from "../ui";
import { useUploadManager, formatBytes } from "../../lib/uploadManager";

interface UploadDockProps {
  /** Jump to the Bulk Upload section. */
  onOpen: () => void;
  /** Hidden while the user is already on the Bulk Upload page. */
  hidden?: boolean;
}

const ACTIVE = new Set(["uploading", "finalizing", "queued"]);

/**
 * Floating progress widget shown on every section while the upload queue has
 * work in it — uploads run in the background, so this is how the user keeps an
 * eye on them without leaving the page they are on.
 */
export function UploadDock({ onOpen, hidden }: UploadDockProps) {
  const { items, counts, blocked } = useUploadManager();
  const [open, setOpen] = useState(false);

  if (hidden || items.length === 0) return null;
  if (counts.done === counts.total && counts.total > 0 && counts.error === 0) {
    // Everything finished — keep the dock out of the way, the page has the list.
    return null;
  }

  const working = counts.active + counts.queued;
  const pct = Math.round(counts.progress);

  const inFlight = items
    .filter((i) => i.status !== "done")
    .sort((a, b) => (ACTIVE.has(a.status) ? 0 : 1) - (ACTIVE.has(b.status) ? 0 : 1))
    .slice(0, 4);

  // ── Collapsed pill ─────────────────────────────────────────────────────────
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={blocked ? `Uploads blocked: ${blocked}` : "Show upload progress"}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-2xl border bg-card/95 backdrop-blur px-3.5 py-2.5 shadow-lg hover:shadow-xl transition-shadow",
          blocked ? "border-destructive/40" : "border-border"
        )}
      >
        <ProgressRing pct={pct} blocked={!!blocked} />
        <span className="text-left leading-tight">
          <span className={cn("block text-xs font-semibold", blocked ? "text-destructive" : "text-foreground")}>
            {blocked
              ? "Uploads blocked"
              : working > 0
                ? `Uploading ${counts.active || counts.queued}`
                : counts.error > 0
                  ? `${counts.error} failed`
                  : counts.needsFile > 0
                    ? `${counts.needsFile} need the file`
                    : "Uploads"}
          </span>
          <span className="block text-[11px] text-muted-foreground">
            {counts.done}/{counts.total} · {formatBytes(counts.bytesUploaded)}
          </span>
        </span>
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      </button>
    );
  }

  // ── Expanded panel ─────────────────────────────────────────────────────────
  return (
    <div className="fixed bottom-5 right-5 z-40 w-[340px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <ProgressRing pct={pct} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Uploads</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {counts.done}/{counts.total} done · {formatBytes(counts.bytesUploaded)} / {formatBytes(counts.bytesTotal)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          title="Collapse"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {blocked && (
        <div className="px-4 py-2.5 bg-destructive/5 border-b border-destructive/20 flex items-start gap-2">
          <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0 mt-px" />
          <p className="text-[11px] text-muted-foreground leading-snug">
            Storage blocked the request from{" "}
            <code className="font-mono">
              {typeof window !== "undefined" ? window.location.origin : "this origin"}
            </code>
            . Allow it in the bucket's CORS policy, then retry from the manager.
          </p>
        </div>
      )}

      <div className="max-h-56 overflow-y-auto divide-y divide-border">
        {inFlight.map((item) => (
          <div key={item.id} className="px-4 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 text-xs font-medium text-foreground truncate" title={item.title}>
                {item.title}
              </span>
              {item.status === "error" ? (
                <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
              ) : item.status === "needs-file" ? (
                <FileWarning className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
              )}
            </div>
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full",
                  item.status === "error" ? "bg-destructive"
                    : item.status === "needs-file" ? "bg-amber-500"
                      : "bg-primary"
                )}
                style={{ width: `${Math.min(100, item.progress)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {item.status === "uploading" && item.speed > 0
                ? `${formatBytes(item.speed)}/s`
                : item.status === "queued" ? "Waiting…"
                  : item.status === "needs-file" ? "File needed"
                    : item.status === "finalizing" ? "Finishing…"
                      : item.status}{" "}
              · {formatBytes(item.uploadedBytes)} / {formatBytes(item.size)}
            </p>
          </div>
        ))}
        {items.length > inFlight.length && (
          <p className="px-4 py-2 text-[11px] text-muted-foreground">
            +{items.length - inFlight.length} more in the queue
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-3 border-t border-border bg-muted/30">
        <Btn v="ghost" sz="xs" className="ml-auto" onClick={onOpen}>
          Open manager<ArrowUpRight className="w-3.5 h-3.5" />
        </Btn>
      </div>
    </div>
  );
}

/** Small circular progress indicator used by both dock states. */
function ProgressRing({ pct, blocked }: { pct: number; blocked?: boolean }) {
  const r = 12;
  const c = 2 * Math.PI * r;
  return (
    <span className="relative w-7 h-7 shrink-0 grid place-items-center">
      <svg viewBox="0 0 32 32" className="w-7 h-7 -rotate-90">
        <circle cx="16" cy="16" r={r} fill="none" strokeWidth="4" className="stroke-muted" />
        <circle
          cx="16" cy="16" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          className={cn(
            "transition-[stroke-dashoffset] duration-300",
            blocked ? "stroke-destructive" : "stroke-primary"
          )}
          strokeDasharray={c}
          strokeDashoffset={c - (Math.min(100, Math.max(0, pct)) / 100) * c}
        />
      </svg>
    </span>
  );
}
