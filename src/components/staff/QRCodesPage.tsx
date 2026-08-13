import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download, QrCode, Search, X, Mail, Phone,
  School, Hash, CheckSquare, Square, Eye, Loader2, Users,
  IdCard, CheckCircle, Printer,
} from "lucide-react";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import { Btn, Sel, Card, Badge, Input, Modal, EmptyState } from "../ui";
import Pagination from "../ui/Pagination";
import { cn, fmtDate } from "../../lib/utils";
import type { Student, Batch } from "../../lib/types";
import { getAllStudents, getAllBatches } from "../../api/apiCalls";

interface QRCodesPageProps {
  students: Student[];
  batches: Batch[];
}

// ── ID Card dimensions for export (pixels) ──────────────────────────────────
const CARD_W = 420;
const CARD_H = 260;

export function QRCodesPage({ students: _s, batches: _b }: QRCodesPageProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, pageSize: 24, totalRecords: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [detailStudent, setDetailStudent] = useState<Student | null>(null);
  const [detailQrUrl, setDetailQrUrl] = useState<string>("");
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const exportContainerRef = useRef<HTMLDivElement>(null);

  // ── Derived: active / inactive batches ────────────────────────────────────
  const activeBatches = useMemo(() => batches.filter((b) => b.active), [batches]);
  const inactiveBatches = useMemo(() => batches.filter((b) => !b.active), [batches]);

  // ── Fetch batches ──────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await getAllBatches(1, 200, "");
        const data = res?.data?.data ?? res?.data ?? [];
        setBatches(data.map((b: any) => ({
          id: b.id,
          name: b.name,
          fee: b.class_fee ?? b.fee ?? 0,
          startTime: b.start_time ?? b.startTime ?? "",
          endTime: b.end_time ?? b.endTime ?? "",
          examDate: b.exam_date ?? b.examDate ?? "",
          active: b.is_active ?? b.active ?? true,
          day: b.day ?? "",
        })));
      } catch (err) { console.error("Failed to fetch batches:", err); }
    })();
  }, []);

  // ── Fetch students ────────────────────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const batchId = batchFilter !== "all" ? batchFilter : "";
      const result = await getAllStudents(pagination.page, pagination.pageSize, search, batchId);
      const backendData = result?.data?.data ?? result?.data ?? [];
      const meta = result?.data?.meta ?? {};

      setPagination((prev) => {
        const perPage = meta.limit ?? prev.pageSize;
        const lastPage = meta.pages ?? (meta.total != null ? Math.max(1, Math.ceil(meta.total / perPage)) : prev.totalPages);
        return { page: meta.page ?? prev.page, totalPages: lastPage, pageSize: perPage, totalRecords: meta.total ?? prev.totalRecords };
      });

      const mapped: Student[] = backendData.map((s: any) => ({
        id: s.id,
        callupNo: s.call_up_no ?? s.callupNo ?? "",
        fullName: s.full_name ?? s.fullName ?? `${s.first_name ?? s.firstName ?? ""} ${s.last_name ?? s.lastName ?? ""}`.trim(),
        email: s.email ?? "",
        school: s.school ?? "",
        address: s.address ?? "",
        nic: s.nic ?? "",
        mobile: s.mobile ?? "",
        parentName: s.parent_name ?? s.parentName ?? "",
        parentMobile: s.parent_mobile ?? s.parentMobile ?? "",
        notes: s.notes ?? "",
        active: s.is_active ?? s.active ?? true,
        registrationDate: s.registration_date ?? s.registrationDate ?? s.created_at ?? "",
        batchIds: s.batch_id ? [s.batch_id] : (s.batch_ids ?? s.batchIds ?? []),
      }));

      setStudents(mapped);
    } catch (err) { console.error("Failed to fetch students:", err); }
    finally { setLoading(false); }
  }, [pagination.page, pagination.pageSize, search, batchFilter]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // ── Client-side status filter ─────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (statusFilter === "all") return students;
    return students.filter((s) => s.active === (statusFilter === "active"));
  }, [students, statusFilter]);

  // ── Generate QR codes for students ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const generate = async () => {
      const newUrls: Record<string, string> = {};
      for (const s of students) {
        if (qrDataUrls[s.id]) continue;
        try {
          newUrls[s.id] = await QRCode.toDataURL(s.callupNo || s.id, {
            width: 200, margin: 1,
            color: { dark: "#000000", light: "#ffffff" },
          });
        } catch { /* skip */ }
      }
      if (!cancelled && Object.keys(newUrls).length > 0) {
        setQrDataUrls((prev) => ({ ...prev, ...newUrls }));
      }
    };
    generate();
    return () => { cancelled = true; };
  }, [students]);

  // ── Generate larger QR for detail modal ──────────────────────────────────
  useEffect(() => {
    if (!detailStudent) { setDetailQrUrl(""); return; }
    let cancelled = false;
    QRCode.toDataURL(detailStudent.callupNo || detailStudent.id, {
      width: 240, margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
    }).then((url) => { if (!cancelled) setDetailQrUrl(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [detailStudent]);

  // ── Debounced search ──────────────────────────────────────────────────────
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(v);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
  };

  // ── Clear all filters ─────────────────────────────────────────────────────
  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setBatchFilter("all");
    setStatusFilter("all");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = search !== "" || batchFilter !== "all" || statusFilter !== "all";

  // ── Selection ─────────────────────────────────────────────────────────────
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allIds = new Set(filtered.map((s) => s.id));
    if (selectedIds.size === allIds.size && allIds.size > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(allIds);
    }
  };

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  // ── Get batch names for a student ─────────────────────────────────────────
  const getBatchNames = (batchIds: string[]): string[] =>
    batchIds.map((id) => batches.find((b) => b.id === id)?.name ?? id).filter(Boolean);

  // ── Export selected as PNG ────────────────────────────────────────────────
  const exportSelected = async () => {
    const selectedStudents = students.filter((s) => selectedIds.has(s.id));
    if (selectedStudents.length === 0) { alert("No students selected."); return; }
    await exportCards(selectedStudents);
  };

  const exportAll = async () => {
    if (filtered.length === 0) { alert("No students to export."); return; }
    await exportCards(filtered);
  };

  const exportCards = async (list: Student[]) => {
    setExporting(true);
    try {
      // Build a temporary container
      const container = document.createElement("div");
      container.style.cssText = "position:fixed;left:-9999px;top:0;display:flex;flex-direction:column;gap:16px;padding:16px;background:#fff;";
      document.body.appendChild(container);

      // Pre-generate any missing QR codes
      const qrMap: Record<string, string> = { ...qrDataUrls };
      for (const s of list) {
        if (!qrMap[s.id]) {
          try {
            qrMap[s.id] = await QRCode.toDataURL(s.callupNo || s.id, {
              width: 180, margin: 1,
              color: { dark: "#000000", light: "#ffffff" },
            });
          } catch { qrMap[s.id] = ""; }
        }
      }
      setQrDataUrls((prev) => ({ ...prev, ...qrMap }));

      // Render each ID card
      for (const s of list) {
        const card = document.createElement("div");
        const batchNames = getBatchNames(s.batchIds);
        card.innerHTML = renderIdCardHTML(s, qrMap[s.id], batchNames);
        container.appendChild(card);
      }

      // Capture with html2canvas
      const canvas = await html2canvas(container, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
        allowTaint: true,
      });

      // Clean up
      document.body.removeChild(container);

      // Download
      const link = document.createElement("a");
      link.download = `student-id-cards-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export ID cards.");
    } finally {
      setExporting(false);
    }
  };

  // ── Export single card from modal ─────────────────────────────────────────
  const exportSingleCard = async () => {
    if (!detailStudent) return;
    await exportCards([detailStudent]);
  };

  // ── Render ID card as HTML string (for html2canvas) ───────────────────────
  const renderIdCardHTML = (s: Student, qrDataUrl: string, batchNames: string[]): string => `
    <div style="width:${CARD_W}px;height:${CARD_H}px;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12);display:flex;flex-direction:column;font-family:system-ui,-apple-system,sans-serif;background:#fff;flex-shrink:0;">
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#1a56db);padding:12px 20px;display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="width:32px;height:32px;border-radius:8px;background:rgba(255,255,255,0.15);display:flex;align-items:center;justify-content:center;">
            <span style="color:#fff;font-weight:700;font-size:16px;">K</span>
          </div>
          <div>
            <p style="color:#fff;font-weight:700;font-size:14px;margin:0;line-height:1.2;">KDU Academy</p>
            <p style="color:rgba(255,255,255,0.7);font-size:10px;margin:0;">Student Identity Card</p>
          </div>
        </div>
        <span style="display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:10px;font-weight:600;${s.active
          ? 'background:rgba(52,211,153,0.2);color:#34d399;'
          : 'background:rgba(248,113,113,0.2);color:#f87171;'
        }">${s.active ? "● Active" : "○ Inactive"}</span>
      </div>
      <!-- Body -->
      <div style="flex:1;display:flex;padding:16px 20px;gap:20px;">
        <!-- Left: details -->
        <div style="flex:1;display:flex;flex-direction:column;gap:8px;min-width:0;">
          <p style="font-size:18px;font-weight:700;color:#111827;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.fullName || "—"}</p>
          <div style="display:flex;flex-direction:column;gap:5px;">
            <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;">
              <span style="display:flex;align-items:center;">📋</span>
              <span style="font-weight:500;color:#374151;">Call-up:</span>
              <span style="font-family:monospace;color:#1a56db;font-weight:600;">${s.callupNo || "—"}</span>
            </div>
            ${s.email ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;">
              <span>✉️</span><span style="font-weight:500;color:#374151;">Email:</span><span>${s.email}</span>
            </div>` : ""}
            ${s.mobile ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;">
              <span>📱</span><span style="font-weight:500;color:#374151;">Mobile:</span><span>${s.mobile}</span>
            </div>` : ""}
            ${s.school ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;">
              <span>🏫</span><span style="font-weight:500;color:#374151;">School:</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.school}</span>
            </div>` : ""}
            ${batchNames.length > 0 ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;">
              <span>📚</span><span style="font-weight:500;color:#374151;">Batch:</span><span>${batchNames.join(", ")}</span>
            </div>` : ""}
            ${s.registrationDate ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:#6b7280;">
              <span>📅</span><span style="font-weight:500;color:#374151;">Registered:</span><span>${fmtDate(s.registrationDate) || s.registrationDate}</span>
            </div>` : ""}
          </div>
        </div>
        <!-- Right: QR code -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;shrink:0;">
          <div style="width:100px;height:100px;border-radius:10px;border:2px solid #e5e7eb;padding:4px;background:#fff;">
            ${qrDataUrl ? `<img src="${qrDataUrl}" width="100" height="100" style="display:block;" alt="QR" />` : '<div style="width:100px;height:100px;display:flex;align-items:center;justify-content:center;color:#d1d5db;font-size:10px;">QR</div>'}
          </div>
          <span style="font-size:9px;color:#9ca3af;font-family:monospace;">${s.callupNo || s.id}</span>
        </div>
      </div>
    </div>
  `;

  // ── Render ID card as JSX (for the detail modal) ──────────────────────────
  const renderIdCardJSX = (s: Student, qr240: string | undefined) => {
    const batchNames = getBatchNames(s.batchIds);
    const qrUrl = qr240 ?? qrDataUrls[s.id];
    return (
      <div
        className="rounded-2xl overflow-hidden shadow-lg border border-border bg-white dark:bg-card"
        style={{ width: CARD_W, maxWidth: "100%", margin: "0 auto" }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1e3a5f] to-[#1a56db] px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center text-white font-bold text-base">
              K
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">KDU Academy</p>
              <p className="text-white/70 text-[10px]">Student Identity Card</p>
            </div>
          </div>
          <Badge v={s.active ? "success" : "danger"} className="text-[10px]">
            {s.active ? "Active" : "Inactive"}
          </Badge>
        </div>

        {/* Body */}
        <div className="flex gap-5 px-5 py-4">
          {/* Left: details */}
          <div className="flex-1 min-w-0 space-y-2">
            <p className="text-lg font-bold text-foreground truncate">{s.fullName || "—"}</p>
            <div className="space-y-1.5">
              <DetailRow icon={Hash} label="Call-up" value={s.callupNo} mono accent />
              {s.email && <DetailRow icon={Mail} label="Email" value={s.email} />}
              {s.mobile && <DetailRow icon={Phone} label="Mobile" value={s.mobile} />}
              {s.school && <DetailRow icon={School} label="School" value={s.school} />}
              {batchNames.length > 0 && <DetailRow icon={Users} label="Batch" value={batchNames.join(", ")} />}
              {s.registrationDate && <DetailRow icon={CheckCircle} label="Registered" value={fmtDate(s.registrationDate) || s.registrationDate} />}
            </div>
          </div>

          {/* Right: QR code */}
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className="w-[110px] h-[110px] rounded-xl border-2 border-border p-1.5 bg-white">
              {qrUrl ? (
                <img src={qrUrl} width={110} height={110} alt="QR Code" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-lg">
                  <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                </div>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground font-mono">{s.callupNo || s.id}</span>
          </div>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">QR Code Manager</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} on this page{pagination.totalRecords > 0 && ` · ${pagination.totalRecords} total`}
            {selectedIds.size > 0 && ` · ${selectedIds.size} selected`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedIds.size > 0 && (
            <Btn onClick={exportSelected} disabled={exporting}>
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              Export Selected ({selectedIds.size})
            </Btn>
          )}
          <Btn v="outline" onClick={exportAll} disabled={exporting || filtered.length === 0}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export All
          </Btn>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search students…"
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>

          {/* Batch filter with optgroups */}
          <Sel
            className="w-48"
            value={batchFilter}
            onChange={(e) => { setBatchFilter(e.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }}
          >
            <option value="all">All Batches</option>
            {activeBatches.length > 0 && (
              <optgroup label="── Active Batches ──">
                {activeBatches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </optgroup>
            )}
            {inactiveBatches.length > 0 && (
              <optgroup label="── Inactive Batches ──">
                {inactiveBatches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name} (inactive)</option>
                ))}
              </optgroup>
            )}
          </Sel>

          {/* Status filter pills */}
          <div className="flex overflow-hidden rounded-xl border border-border bg-muted/40 p-0.5 shrink-0">
            {(["all", "active", "inactive"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setStatusFilter(opt)}
                className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors capitalize ${
                  statusFilter === opt
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Select All */}
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            {allSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
            {allSelected ? "Deselect All" : "Select Page"}
          </button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Btn v="ghost" sz="sm" onClick={clearFilters} className="text-muted-foreground shrink-0">
              <X className="w-3.5 h-3.5" />Clear
            </Btn>
          )}
        </div>
      </Card>

      {/* ── QR Code Grid ─────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={QrCode} title="No students found" desc="Try adjusting your filters or search query." />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {filtered.map((s) => {
            const qrUrl = qrDataUrls[s.id];
            const isSelected = selectedIds.has(s.id);
            const batchNames = getBatchNames(s.batchIds);

            return (
              <Card
                key={s.id}
                className={cn(
                  "p-3 text-center group relative transition-all duration-200",
                  isSelected
                    ? "ring-2 ring-primary shadow-md"
                    : "hover:shadow-md"
                )}
              >
                {/* Selection checkbox (top-right) */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(s.id); }}
                  className="absolute top-2.5 right-2.5 z-10 p-0.5 rounded-md hover:bg-muted transition-colors"
                  aria-label={isSelected ? "Deselect" : "Select"}
                >
                  {isSelected
                    ? <CheckSquare className="w-4 h-4 text-primary" />
                    : <Square className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground" />
                  }
                </button>

                {/* QR Code area — click to view detail */}
                <button
                  type="button"
                  onClick={() => setDetailStudent(s)}
                  className="w-full aspect-square bg-white rounded-xl mb-2.5 flex items-center justify-center relative overflow-hidden border border-border/60 hover:border-primary/40 transition-colors cursor-pointer"
                >
                  {qrUrl ? (
                    <img
                      src={qrUrl}
                      alt={`QR for ${s.callupNo}`}
                      className="w-[85%] h-[85%] object-contain p-2"
                    />
                  ) : (
                    <Loader2 className="w-6 h-6 text-muted-foreground animate-spin" />
                  )}
                  {/* Hover overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="bg-card/90 backdrop-blur-sm px-2.5 py-1 rounded-lg text-xs font-medium text-foreground shadow-sm flex items-center gap-1">
                      <Eye className="w-3 h-3" />View
                    </span>
                  </div>
                </button>

                {/* Student info */}
                <p className="text-xs font-semibold text-foreground truncate" title={s.fullName}>
                  {s.fullName || "—"}
                </p>
                <p className="text-[11px] text-muted-foreground font-mono truncate">{s.callupNo}</p>
                <div className="flex items-center justify-center gap-1 mt-1.5 flex-wrap">
                  <Badge v={s.active ? "success" : "danger"} className="text-[10px] px-1.5 py-0">
                    {s.active ? "Active" : "Inactive"}
                  </Badge>
                  {batchNames.slice(0, 1).map((name) => (
                    <Badge key={name} v="muted" className="text-[10px] px-1.5 py-0">{name}</Badge>
                  ))}
                  {batchNames.length > 1 && (
                    <span className="text-[10px] text-muted-foreground">+{batchNames.length - 1}</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        pageSize={pagination.pageSize}
        totalRecords={pagination.totalRecords}
        setPagination={setPagination}
      />

      {/* ── Student Detail Modal (ID Card) ──────────────────────────────────── */}
      <Modal
        open={detailStudent !== null}
        onClose={() => setDetailStudent(null)}
        title="Student Identity Card"
        wide
      >
        {detailStudent && (
          <div className="space-y-5">
            {/* ID Card render */}
            {renderIdCardJSX(detailStudent, detailQrUrl || undefined)}

            {/* Student details table */}
            <Card className="p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <IdCard className="w-4 h-4 text-primary" />
                Student Information
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                <InfoField label="Full Name" value={detailStudent.fullName} />
                <InfoField label="Call-up Number" value={detailStudent.callupNo} mono />
                <InfoField label="Email" value={detailStudent.email} />
                <InfoField label="Mobile" value={detailStudent.mobile} />
                <InfoField label="School" value={detailStudent.school} />
                <InfoField label="NIC" value={detailStudent.nic} />
                <InfoField label="Parent Name" value={detailStudent.parentName} />
                <InfoField label="Parent Mobile" value={detailStudent.parentMobile} />
                <InfoField label="Address" value={detailStudent.address} />
                <InfoField label="Registration Date" value={detailStudent.registrationDate ? (fmtDate(detailStudent.registrationDate) || detailStudent.registrationDate) : ""} />
                <InfoField label="Status" value={detailStudent.active ? "Active" : "Inactive"} badge={detailStudent.active ? "success" : "danger"} />
                <InfoField label="Batches" value={getBatchNames(detailStudent.batchIds).join(", ")} />
              </div>
            </Card>

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Btn v="outline" onClick={() => setDetailStudent(null)}>Close</Btn>
              <Btn onClick={exportSingleCard} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download ID Card
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Hidden export container (used by html2canvas during export) ──────── */}
      <div
        ref={exportContainerRef}
        className="fixed left-[-9999px] top-0 flex flex-col gap-4 p-4 bg-white"
        aria-hidden="true"
      />
    </div>
  );
}

// ── Helper: detail row in ID card ──────────────────────────────────────────
function DetailRow({ icon: Icon, label, value, mono, accent }: {
  icon: React.ElementType;
  label: string;
  value: string;
  mono?: boolean;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Icon className="w-3 h-3 shrink-0" />
      <span className="font-medium text-foreground/80">{label}:</span>
      <span className={cn("truncate", mono && "font-mono", accent && "text-primary font-semibold")}>
        {value}
      </span>
    </div>
  );
}

// ── Helper: info field in detail table ─────────────────────────────────────
function InfoField({ label, value, mono, badge }: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: "success" | "danger";
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}:</span>
      {badge ? (
        <Badge v={badge} className="text-[10px]">{value}</Badge>
      ) : (
        <span className={cn("text-xs text-foreground font-medium truncate", mono && "font-mono")}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}
