import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  MoveHorizontal,
  RefreshCw,
  Video,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { Badge, Btn, Card } from "../ui";
import { cn, fmtDate } from "../../lib/utils";
import { getMaterialFileBlobUrl, getMaterialSignedUrl } from "../../api/apiCalls";
import type { Material } from "../../lib/types";

// pdf.js worker — bundled by Vite as an asset (same wiring as student_client).
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;
const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

// Material preview for the management system — staff/admin can open the file a
// student would see, without leaving the materials page.
//
//   DOCUMENT → GET /api/materials/:id/file   (bytes proxied through the backend,
//              so R2 needs no CORS for pdf.js) rendered with react-pdf
//   VIDEO    → GET /api/materials/:id/signed-url (short-lived R2 URL) in a
//              plain <video>
//
// requireMaterialAccess lets admin/staff through to both endpoints, so no
// extra backend work is needed here.
export function MaterialViewer({
  material,
  onBack,
}: {
  material: Material;
  onBack: () => void;
}) {
  return (
    <div className="space-y-5">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Btn v="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
          Back
        </Btn>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate" title={material.title}>
            {material.title}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <Badge v={material.type === "DOCUMENT" ? "success" : "info"}>
              {material.type === "DOCUMENT" ? "Document" : "Video"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {material.lessonName || "No lesson"}
            </span>
            {material.uploadDate && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {fmtDate(material.uploadDate)}
              </span>
            )}
          </div>
        </div>
      </div>

      {material.type === "DOCUMENT" ? (
        <PdfPreview material={material} />
      ) : (
        <VideoPreview material={material} />
      )}
    </div>
  );
}

// ── Document preview ────────────────────────────────────────────────────────
function PdfPreview({ material }: { material: Material }) {
  const [fileUrl, setFileUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);
  const [pageWidth, setPageWidth] = useState(0); // PDF pts at scale 1
  const [containerW, setContainerW] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const fileUrlRef = useRef("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const url = await getMaterialFileBlobUrl(material.id);
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
      fileUrlRef.current = url;
      setFileUrl(url);
      setPageNumber(1);
      setNumPages(0);
    } catch (error: any) {
      console.error("PDF fetch failed:", error);
      setErr(
        error?.response?.data?.msg ?? error?.message ?? "Could not load this document.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [material.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Revoke the blob URL when the viewer unmounts
  useEffect(
    () => () => {
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    },
    [],
  );

  // Track the viewport width so "fit width" follows window resizes
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setContainerW(entries[0].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [loading, err]);

  // Keyboard: ← / → turn pages (unless typing in a field)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPageNumber((p) => Math.max(1, p - 1));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPageNumber((p) => Math.min(numPages || p, p + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [numPages]);

  const fitScale = pageWidth && containerW ? clampScale((containerW - 48) / pageWidth) : 1;
  const effectiveScale = fitWidth ? fitScale : scale;

  const zoom = (delta: number) => {
    setFitWidth(false);
    setScale((s) => clampScale(Math.round((s + delta) * 100) / 100));
  };

  const download = () => {
    if (!fileUrl) return;
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = `${material.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Card className="overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-2">
        <ToolBtn onClick={() => zoom(-0.1)} label="Zoom out">
          <ZoomOut className="w-4 h-4" />
        </ToolBtn>
        <button
          type="button"
          onClick={() => {
            setFitWidth(false);
            setScale(1);
          }}
          title="Reset zoom"
          className="min-w-14 rounded-md px-2 py-1.5 text-xs tabular-nums text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {Math.round(effectiveScale * 100)}%
        </button>
        <ToolBtn onClick={() => zoom(0.1)} label="Zoom in">
          <ZoomIn className="w-4 h-4" />
        </ToolBtn>
        <ToolBtn onClick={() => setFitWidth((f) => !f)} label="Fit width" active={fitWidth}>
          <MoveHorizontal className="w-4 h-4" />
        </ToolBtn>

        <div className="ml-auto flex items-center gap-1">
          <ToolBtn
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            label="Previous page"
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </ToolBtn>
          <span className="px-1.5 text-xs tabular-nums text-muted-foreground">
            {pageNumber} / {numPages || "…"}
          </span>
          <ToolBtn
            onClick={() => setPageNumber((p) => Math.min(numPages || p, p + 1))}
            label="Next page"
            disabled={!!numPages && pageNumber >= numPages}
          >
            <ChevronRight className="w-4 h-4" />
          </ToolBtn>
          <span className="mx-1 h-5 w-px bg-border" />
          <ToolBtn onClick={download} label="Download" disabled={!fileUrl}>
            <Download className="w-4 h-4" />
          </ToolBtn>
          <ToolBtn onClick={() => frameRef.current?.requestFullscreen?.()} label="Fullscreen">
            <Maximize2 className="w-4 h-4" />
          </ToolBtn>
        </div>
      </div>

      {/* Page area */}
      <div ref={frameRef} className="bg-muted/40">
        <div ref={viewportRef}>
          {loading ? (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading document…</p>
            </div>
          ) : err ? (
            <div className="flex h-[70vh] flex-col items-center justify-center gap-4 p-8 text-center">
              <p className="text-sm text-destructive">{err}</p>
              <Btn v="outline" onClick={load}>
                <RefreshCw className="w-4 h-4" />
                Try again
              </Btn>
            </div>
          ) : (
            <div className="h-[70vh] overflow-y-auto p-6">
              <Document
                file={fileUrl}
                onLoadSuccess={({ numPages: n }) => {
                  setNumPages(n);
                  setPageNumber((p) => Math.min(p, n));
                }}
                loading={
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                }
                error={
                  <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <p className="text-sm text-destructive">Could not render this document.</p>
                    <Btn v="outline" onClick={load}>
                      <RefreshCw className="w-4 h-4" />
                      Try again
                    </Btn>
                  </div>
                }
                className="mx-auto w-fit"
              >
                <div className="mx-auto w-fit overflow-hidden rounded-lg bg-white shadow-md">
                  <Page
                    key={`${material.id}-${pageNumber}`}
                    pageNumber={pageNumber}
                    scale={effectiveScale}
                    onLoadSuccess={(page) => setPageWidth(page.viewport.width)}
                    loading={
                      <div className="flex items-center justify-center py-16">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    }
                  />
                </div>
              </Document>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

// ── Video preview ───────────────────────────────────────────────────────────
function VideoPreview({ material }: { material: Material }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      // Short-lived signed R2 URL — the browser streams straight from it
      const res = await getMaterialSignedUrl(material.id);
      if (!res?.url) throw new Error("No signed URL returned for this video.");
      setUrl(res.url);
    } catch (error: any) {
      console.error("Video URL fetch failed:", error);
      setErr(
        error?.response?.data?.msg ?? error?.message ?? "Could not load this video.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [material.id]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-3 py-2">
        <Video className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Video preview</span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-70"
          >
            <Download className="w-3.5 h-3.5" />
            Open / download
          </a>
        )}
      </div>

      <div className="bg-slate-900">
        {loading ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            <p className="text-sm text-slate-400">Loading video…</p>
          </div>
        ) : err ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="text-sm text-red-400">{err}</p>
            <Btn v="outline" onClick={load}>
              <RefreshCw className="w-4 h-4" />
              Try again
            </Btn>
          </div>
        ) : (
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="mx-auto block max-h-[70vh] w-full"
          />
        )}
      </div>
    </Card>
  );
}

// Small icon button for the PDF toolbar
function ToolBtn({
  children,
  onClick,
  label,
  active = false,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      disabled={disabled}
      className={cn(
        "rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent",
        active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary",
      )}
    >
      {children}
    </button>
  );
}
