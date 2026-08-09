import { useCallback, useEffect, useState } from "react";
import { Plus, Edit2, Award, Zap, Check, Lock, ArrowLeft } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card, Avatar } from "../ui";
import { FLabel } from "../ui";
import { fmtDate, cn } from "../../lib/utils";
import type { Batch, Material, Role } from "../../lib/types";
import {
  getAllPapers,
  createPaper,
  createMark,
  updateMarkApi,
  getMarksByPaper,
  togglePublishMark,
  getAllStudents,
  getAllBatches,
  getAllMaterials,
} from "../../api/apiCalls";
import Pagination from "../ui/Pagination";

// ── Local paper shape (mapped from API) ────────────────────────────────────
interface PaperRow {
  id: string;
  paper_name: string;
  paper_date: string;
  batch_id: string;
  batchName: string;
  material_id: string;
  materialName: string;
  marksCount: number;
  avgMarks: number | null;
  is_mark_released: boolean;
}

// ── Local mark shape (mapped from API) ─────────────────────────────────────
interface MarkRow {
  id: string;
  call_up_no: string;
  paper_id: string;
  marks: number;
  comments: string | null;
}

interface MarksPageProps {
  role: Role;
}

export function MarksPage({ role }: MarksPageProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [view, setView] = useState<"papers" | "enter" | "rank">("papers");
  const [selectedPaper, setSelectedPaper] = useState<PaperRow | null>(null);
  const [papers, setPapers] = useState<PaperRow[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, pageSize: 12, totalRecords: 0 });
  const [batchFilter, setBatchFilter] = useState("all");
  const [paperModal, setPaperModal] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // Marks entry
  const [marksForm, setMarksForm] = useState<Record<string, string>>({});
  const [lockedFields, setLockedFields] = useState<Record<string, boolean>>({});
  const [existingMarks, setExistingMarks] = useState<MarkRow[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  // Rank list
  const [rankList, setRankList] = useState<{ student: any; marks: number | null }[]>([]);

  // Student counts per batch (for "Entered" column)
  const [batchStudentCounts, setBatchStudentCounts] = useState<Record<string, number>>({});

  const isAdmin = role === "admin";

  // ── Initial load: batches & materials for dropdowns ───────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [batchRes, matRes] = await Promise.all([
          getAllBatches(1, 100, ""),
          getAllMaterials(1, 100, ""),
        ]);
        const bData = batchRes?.data?.data ?? [];
        setBatches(bData.map((b: any) => ({
          id: b.id, name: b.name, fee: b.class_fee ?? b.fee ?? 0,
          startTime: b.start_time ?? "", endTime: b.end_time ?? "",
          examDate: b.exam_date ?? "", active: b.is_active ?? true, day: b.day ?? "",
        })));
        const mData = matRes?.data?.data ?? [];
        setMaterials(mData.map((m: any) => ({
          id: m.id, title: m.title, description: m.description ?? "",
          type: m.type ?? "DOCUMENT", url: m.url ?? m.material_url ?? "",
          batchIds: [], batchNames: [], lessonId: m.lesson_id ?? "", lessonName: m.lesson?.title ?? "",
          lessonType: m.lesson?.type ?? "", uploadDate: m.upload_date ?? m.created_at ?? "",
          expiryDate: null, accessCount: m.access_count ?? 0,
        })));
      } catch (err) { console.error("Failed to load batches/materials:", err); }

      // Fetch all students to build per-batch counts
      try {
        const sRes = await getAllStudents(1, 9999, "");
        const allStudents = sRes?.data?.data ?? [];
        const counts: Record<string, number> = {};
        allStudents.forEach((s: any) => {
          if (s.is_active === false) return;
          const bid = s.batch_id ?? s.batchId;
          if (bid) counts[bid] = (counts[bid] || 0) + 1;
        });
        setBatchStudentCounts(counts);
      } catch (err) { console.error("Failed to load student counts:", err); }
    })();
  }, []);

  // ── Fetch papers ───────────────────────────────────────────────────────────
  const fetchPapers = useCallback(async () => {
    try {
      const res = await getAllPapers(pagination.page, pagination.pageSize, batchFilter !== "all" ? batchFilter : "");
      const data = res?.data?.data ?? [];
      const meta = res?.data?.meta ?? {};
      setPagination((prev) => ({
        page: meta.page ?? prev.page,
        totalPages: meta.pages ?? prev.totalPages,
        pageSize: meta.limit ?? prev.pageSize,
        totalRecords: meta.total ?? prev.totalRecords,
      }));
      setPapers(data.map((p: any) => ({
        id: p.id,
        paper_name: p.paper_name,
        paper_date: p.paper_date,
        batch_id: p.batch_id,
        batchName: p.batch?.name ?? "Unknown",
        material_id: p.material_id,
        materialName: p.material?.title ?? "—",
        marksCount: p.marksCount ?? 0,
        avgMarks: p.avgMarks ?? null,
        is_mark_released: p.is_mark_released ?? false,
      })));
    } catch (err) { console.error("Failed to fetch papers:", err); }
  }, [pagination.page, pagination.pageSize, batchFilter]);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  // ── Open enter-marks view ─────────────────────────────────────────────────
  const openEnter = async (paper: PaperRow) => {
    setSelectedPaper(paper);
    try {
      // Fetch students for this batch
      const sRes = await getAllStudents(1, 500, "", paper.batch_id);
      const sData = sRes?.data?.data ?? [];
      const activeStudents = sData.filter((s: any) => s.is_active !== false);
      setStudents(activeStudents);

      // Fetch existing marks for this paper
      const mRes = await getMarksByPaper(paper.id);
      const mData = mRes?.data ?? [];
      setExistingMarks(mData);

      // Init form: pre-fill existing marks, blank for others
      const initForm: Record<string, string> = {};
      const initLocked: Record<string, boolean> = {};
      activeStudents.forEach((s: any) => {
        const existing = mData.find((m: any) => m.call_up_no === s.call_up_no);
        initForm[s.call_up_no] = existing ? String(existing.marks) : "";
        // Lock fields that already have marks, unlock empty ones
        initLocked[s.call_up_no] = !!existing;
      });
      setMarksForm(initForm);
      setLockedFields(initLocked);
    } catch (err) { console.error("Failed to load students/marks:", err); }
    setView("enter");
  };

  // ── Open rank view ────────────────────────────────────────────────────────
  const openRank = async (paper: PaperRow) => {
    setSelectedPaper(paper);
    try {
      const sRes = await getAllStudents(1, 500, "", paper.batch_id);
      const sData = sRes?.data?.data ?? [];
      const activeStudents = sData.filter((s: any) => s.is_active !== false);
      const mRes = await getMarksByPaper(paper.id);
      const mData = mRes?.data ?? [];

      const ranked = activeStudents
        .map((s: any) => {
          const m = mData.find((mk: any) => mk.call_up_no === s.call_up_no);
          return {
            student: s,
            marks: m ? m.marks : null,
          };
        })
        .sort((a: any, b: any) => (b.marks ?? -1) - (a.marks ?? -1));
      setRankList(ranked);
    } catch (err) { console.error("Failed to load rank list:", err); }
    setView("rank");
  };

  // ── Lock / unlock helpers ──────────────────────────────────────────────────
  const handleMarkChange = (callUpNo: string, value: string) => {
    setMarksForm((prev) => ({ ...prev, [callUpNo]: value }));
  };

  const handleMarkBlur = (callUpNo: string) => {
    // Lock on blur if value is non-empty
    if (marksForm[callUpNo]?.trim()) {
      setLockedFields((prev) => ({ ...prev, [callUpNo]: true }));
    }
  };

  const handleMarkDoubleClick = (callUpNo: string) => {
    setLockedFields((prev) => ({ ...prev, [callUpNo]: false }));
  };

  // ── Save all marks ────────────────────────────────────────────────────────
  const saveMarks = async () => {
    if (!selectedPaper) return;
    setSaving(true);
    try {
      const entries = Object.entries(marksForm).filter(([, val]) => val !== "");
      const promises = entries.map(([callUpNo, val]) => {
        const existing = existingMarks.find((m) => m.call_up_no === callUpNo);
        const markVal = parseFloat(val);
        if (existing) {
          // Update
          return updateMarkApi({ call_up_no: callUpNo, paper_id: selectedPaper.id, mark: markVal, comment: "none" });
        } else {
          // Create
          return createMark({ call_up_no: callUpNo, paper_id: selectedPaper.id, mark: markVal, comment: "none" });
        }
      });
      await Promise.all(promises);
      setView("papers");
      fetchPapers();
    } catch (err: any) {
      console.error("Failed to save marks:", err);
      alert("Failed to save marks: " + (err?.response?.data?.msg ?? err?.message ?? "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Create paper ───────────────────────────────────────────────────────────
  const savePaper = async () => {
    if (!form.paper_name?.trim()) { alert("Paper name is required."); return; }
    if (!form.batch_id) { alert("Please select a batch."); return; }
    setSaving(true);
    try {
      await createPaper({
        paper_name: form.paper_name,
        paper_date: form.paper_date || new Date().toISOString(),
        batch_id: form.batch_id,
        material_id: form.material_id || "",
      });
      setPaperModal(false);
      setForm({});
      fetchPapers();
    } catch (err: any) {
      console.error("Failed to create paper:", err);
      alert("Failed to create paper: " + (err?.response?.data?.msg ?? err?.message ?? "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle publish ─────────────────────────────────────────────────────────
  const handleTogglePublish = async (paperId: string) => {
    try {
      await togglePublishMark(paperId);
      fetchPapers();
    } catch (err: any) {
      console.error("Failed to toggle publish:", err);
      alert("Failed to toggle publish: " + (err?.response?.data?.msg ?? err?.message ?? "Unknown error"));
    }
  };

  // ── Find batch / material names ────────────────────────────────────────────
  const batchName = (batchId: string) => batches.find((b) => b.id === batchId)?.name ?? "Unknown";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Marks</h1>
          <p className="text-sm text-muted-foreground">
            {view === "papers"
              ? "Manage papers and examinations"
              : view === "enter"
                ? `Entering marks — ${selectedPaper?.paper_name}`
                : `Rank List — ${selectedPaper?.paper_name}`}
          </p>
        </div>
        <div className="flex gap-2">
          {view !== "papers" && (
            <Btn v="outline" sz="sm" onClick={() => { setView("papers"); fetchPapers(); }}>
              <ArrowLeft className="w-4 h-4" />Back to Papers
            </Btn>
          )}
          {view === "papers" && isAdmin && (
            <Btn sz="sm" onClick={() => { setForm({}); setPaperModal(true); }}>
              <Plus className="w-4 h-4" />New Paper
            </Btn>
          )}
          {view === "enter" && (
            <Btn sz="sm" onClick={saveMarks} disabled={saving}>
              <Check className="w-4 h-4" />{saving ? "Saving…" : "Save All Marks"}
            </Btn>
          )}
        </div>
      </div>

      {/* ── Papers List View ────────────────────────────────────────────────── */}
      {view === "papers" && (
        <>
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Sel className="w-48" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setPagination((p) => ({ ...p, page: 1 })); }}>
                <option value="all">All Batches</option>
                {batches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Sel>
              <span className="text-xs text-muted-foreground">{pagination.totalRecords} paper{pagination.totalRecords !== 1 ? "s" : ""} total</span>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Paper", "Batch", "Material", "Date", "Entered", "Avg", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {papers.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">No papers found.</td></tr>
                  ) : papers.map((p) => {
                    const bCount = batchStudentCounts[p.batch_id] || 0;
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground cursor-pointer hover:text-primary" onClick={() => openEnter(p)}>
                          {p.paper_name}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.batchName}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{p.materialName}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(p.paper_date)}</td>
                        <td className="px-4 py-3 font-mono text-center text-xs">{p.marksCount}/{bCount}</td>
                        <td className="px-4 py-3 font-mono text-center text-xs">
                          {p.avgMarks !== null ? p.avgMarks : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge v={p.is_mark_released ? "success" : "warning"}>
                            {p.is_mark_released ? "Published" : "Draft"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {/* Enter marks */}
                            <button onClick={() => openEnter(p)} className="p-1.5 hover:bg-muted rounded-lg" title="Enter Marks">
                              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            {/* Rank list */}
                            <button onClick={() => openRank(p)} className="p-1.5 hover:bg-muted rounded-lg" title="Rank List">
                              <Award className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            {/* Toggle publish */}
                            {isAdmin && (
                              <button
                                onClick={() => handleTogglePublish(p.id)}
                                className="p-1.5 hover:bg-muted rounded-lg"
                                title={p.is_mark_released ? "Unpublish" : "Publish"}
                              >
                                <Zap className={cn("w-3.5 h-3.5", p.is_mark_released ? "text-amber-500" : "text-muted-foreground")} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalRecords={pagination.totalRecords}
            setPagination={setPagination}
          />
        </>
      )}

      {/* ── Enter Marks View ────────────────────────────────────────────────── */}
      {view === "enter" && selectedPaper && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{selectedPaper.paper_name}</p>
              <p className="text-xs text-muted-foreground">
                {selectedPaper.batchName}
                {" · "}{students.length} student{students.length !== 1 ? "s" : ""}
                {" · "}{existingMarks.length} already entered
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              <Lock className="w-3 h-3 inline mr-1" />Double-click a locked field to edit
            </p>
          </div>
          <div className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
            {students.map((s: any) => {
              const isLocked = lockedFields[s.call_up_no] ?? false;

              return (
                <div key={s.call_up_no} className="flex items-center gap-4 px-4 py-3">
                  <Avatar name={`${s.user?.first_name ?? s.first_name ?? ""} ${s.user?.last_name ?? s.last_name ?? ""}`.trim() || s.call_up_no} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {s.user?.first_name ?? s.first_name ?? ""} {s.user?.last_name ?? s.last_name ?? ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.call_up_no}</p>
                  </div>
                  <div className="flex items-center gap-2 w-32">
                    <Input
                      type="number"
                      className={cn(
                        "text-center font-mono text-sm transition-all",
                        isLocked && "bg-muted/50 text-muted-foreground cursor-default border-dashed"
                      )}
                      min={0}
                      value={marksForm[s.call_up_no] || ""}
                      onChange={(e) => handleMarkChange(s.call_up_no, e.target.value)}
                      onBlur={() => handleMarkBlur(s.call_up_no)}
                      onDoubleClick={() => handleMarkDoubleClick(s.call_up_no)}
                      readOnly={isLocked}
                      placeholder="—"
                      title={isLocked ? "Double-click to unlock" : "Enter marks"}
                    />
                  </div>
                  {isLocked && (
                    <Lock className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  )}
                </div>
              );
            })}
            {students.length === 0 && (
              <div className="py-12 text-center text-muted-foreground text-sm">No students found for this batch.</div>
            )}
          </div>
        </Card>
      )}

      {/* ── Rank List View ──────────────────────────────────────────────────── */}
      {view === "rank" && selectedPaper && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">{selectedPaper.paper_name} — Rank List</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {selectedPaper.batchName} · {fmtDate(selectedPaper.paper_date)}
            </p>
          </div>
          <div className="divide-y divide-border/50">
            {rankList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground text-sm">No marks entered yet.</div>
            ) : rankList.map(({ student: s, marks: m }, i) => (
              <div
                key={s.call_up_no}
                className={cn(
                  "flex items-center gap-4 px-4 py-3",
                  i === 0 ? "bg-amber-50/50 dark:bg-amber-950/20"
                    : i === 1 ? "bg-gray-50/50 dark:bg-gray-950/20"
                      : i === 2 ? "bg-orange-50/30 dark:bg-orange-950/10" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                    : i === 1 ? "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      : i === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"
                        : "bg-muted text-muted-foreground"
                )}>{i + 1}</div>
                <Avatar name={`${s.user?.first_name ?? s.first_name ?? ""} ${s.user?.last_name ?? s.last_name ?? ""}`.trim() || s.call_up_no} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {s.user?.first_name ?? s.first_name ?? ""} {s.user?.last_name ?? s.last_name ?? ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{s.call_up_no}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold font-mono text-foreground">
                    {m ?? "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Create Paper Modal ───────────────────────────────────────────────── */}
      <Modal open={paperModal} onClose={() => setPaperModal(false)} title="Create New Paper">
        <div className="space-y-4">
          <div>
            <FLabel>Paper Name</FLabel>
            <Input value={form.paper_name || ""} onChange={(e) => setForm((f) => ({ ...f, paper_name: e.target.value }))} placeholder="e.g. Term Test 2 — Pure Mathematics" />
          </div>
          <div>
            <FLabel>Batch</FLabel>
            <Sel value={form.batch_id || ""} onChange={(e) => setForm((f) => ({ ...f, batch_id: e.target.value }))}>
              <option value="">Select batch</option>
              {batches.filter((b) => b.active).map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
            </Sel>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FLabel>Material</FLabel>
              <Sel value={form.material_id || ""} onChange={(e) => setForm((f) => ({ ...f, material_id: e.target.value }))}>
                <option value="">Select material</option>
                {materials.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
              </Sel>
            </div>
            <div><FLabel>Date</FLabel><Input type="date" value={form.paper_date || ""} onChange={(e) => setForm((f) => ({ ...f, paper_date: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn v="outline" onClick={() => setPaperModal(false)} disabled={saving}>Cancel</Btn>
            <Btn onClick={savePaper} disabled={saving}>{saving ? "Creating…" : "Create Paper"}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
