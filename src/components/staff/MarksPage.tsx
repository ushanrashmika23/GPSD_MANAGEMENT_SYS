import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Award, Zap, Check, Lock, ArrowLeft, Pencil, Users } from "lucide-react";
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
  updatePaperApi,
  deletePaperApi,
} from "../../api/apiCalls";
import Pagination from "../ui/Pagination";

// ── One DB paper record (a paper × one batch, FK-safe) ──────────────────────
interface PaperRecord {
  id: string;
  batch_id: string;
  batchName: string;
  material_id: string;
  materialName: string;
  marksCount: number;
  avgMarks: number | null;
  is_mark_released: boolean;
}

// ── Logical paper group: records sharing paper_name + paper_date ─────────────
interface PaperGroup {
  key: string;                 // `${paper_name}::${paper_date}`
  paper_name: string;
  paper_date: string;
  records: PaperRecord[];      // one record per batch
  batchIds: string[];
  batchNames: string[];
  material_id: string;         // from the first record (same for all)
  materialName: string;
  marksCount: number;          // summed across records
  avgMarks: number | null;     // weighted avg across records
  is_mark_released: boolean;   // true when ALL records released
  anyReleased: boolean;        // true when ANY record released
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

// ── Group raw paper rows into logical papers ────────────────────────────────
function groupPapers(rows: any[]): PaperGroup[] {
  const map = new Map<string, PaperGroup>();
  rows.forEach((p: any) => {
    const key = `${p.paper_name}::${p.paper_date}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        paper_name: p.paper_name,
        paper_date: p.paper_date,
        records: [],
        batchIds: [],
        batchNames: [],
        material_id: p.material_id,
        materialName: p.material?.title ?? "—",
        marksCount: 0,
        avgMarks: null,
        is_mark_released: true,
        anyReleased: false,
      });
    }
    const g = map.get(key)!;
    g.records.push({
      id: p.id,
      batch_id: p.batch_id,
      batchName: p.batch?.name ?? "Unknown",
      material_id: p.material_id,
      materialName: p.material?.title ?? "—",
      marksCount: p.marksCount ?? 0,
      avgMarks: p.avgMarks ?? null,
      is_mark_released: p.is_mark_released ?? false,
    });
    g.batchIds.push(p.batch_id);
    g.batchNames.push(p.batch?.name ?? "Unknown");
    g.marksCount += p.marksCount ?? 0;
    g.is_mark_released = g.is_mark_released && (p.is_mark_released ?? false);
    g.anyReleased = g.anyReleased || (p.is_mark_released ?? false);
  });

  // Compute weighted average across the group's records
  map.forEach((g) => {
    const totalMarks = g.records.reduce((s, r) => s + (r.avgMarks ?? 0) * r.marksCount, 0);
    g.avgMarks = g.marksCount > 0 ? Math.round(totalMarks / g.marksCount) : null;
  });

  // Sort: latest date first
  return Array.from(map.values()).sort((a, b) =>
    (b.paper_date || "").localeCompare(a.paper_date || "")
  );
}

export function MarksPage({ role }: MarksPageProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [view, setView] = useState<"papers" | "enter" | "rank">("papers");
  const [selectedGroup, setSelectedGroup] = useState<PaperGroup | null>(null);
  const [allGroups, setAllGroups] = useState<PaperGroup[]>([]);
  const [pageGroups, setPageGroups] = useState<PaperGroup[]>([]); // client-side page slice
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, pageSize: 12, totalRecords: 0 });
  const [batchFilter, setBatchFilter] = useState("all");
  const [paperModal, setPaperModal] = useState<"add" | "edit" | null>(null);
  const [editingGroup, setEditingGroup] = useState<PaperGroup | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // Marks entry
  const [marksForm, setMarksForm] = useState<Record<string, string>>({});
  const [lockedFields, setLockedFields] = useState<Record<string, boolean>>({});
  const [existingMarks, setExistingMarks] = useState<MarkRow[]>([]);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [marksBatchTab, setMarksBatchTab] = useState<string>("all");

  // Rank list
  const [rankList, setRankList] = useState<{ student: any; marks: number | null }[]>([]);
  const [rankAllData, setRankAllData] = useState<any[]>([]);
  const [rankBatchTab, setRankBatchTab] = useState<string>("all");

  // Student counts per batch (for "Entered" column)
  const [batchStudentCounts, setBatchStudentCounts] = useState<Record<string, number>>({});

  const isAdmin = role === "admin";

  // ── Initial load: batches & materials for dropdowns ───────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [batchRes, matRes] = await Promise.all([
          getAllBatches(1, 200, ""),
          getAllMaterials(1, 200, ""),
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
        const allSt = sRes?.data?.data ?? [];
        const counts: Record<string, number> = {};
        allSt.forEach((s: any) => {
          if (s.is_active === false) return;
          const bid = s.batch_id ?? s.batchId;
          if (bid) counts[bid] = (counts[bid] || 0) + 1;
        });
        setBatchStudentCounts(counts);
      } catch (err) { console.error("Failed to load student counts:", err); }
    })();
  }, []);

  // ── Fetch all papers and group them ───────────────────────────────────────
  const fetchPapers = useCallback(async () => {
    try {
      const res = await getAllPapers(1, 500, "");
      const data = res?.data?.data ?? [];
      setAllGroups(groupPapers(data));
    } catch (err) { console.error("Failed to fetch papers:", err); }
  }, []);

  useEffect(() => { fetchPapers(); }, [fetchPapers]);

  // ── Client-side pagination over grouped papers ────────────────────────────
  useEffect(() => {
    const filtered = batchFilter === "all"
      ? allGroups
      : allGroups.filter((g) => g.batchIds.includes(batchFilter));
    const totalPages = Math.max(1, Math.ceil(filtered.length / pagination.pageSize));
    const start = (pagination.page - 1) * pagination.pageSize;
    setPageGroups(filtered.slice(start, start + pagination.pageSize));
    setPagination((prev) => ({
      ...prev,
      totalPages,
      totalRecords: filtered.length,
      page: Math.min(prev.page, totalPages),
    }));
  }, [allGroups, batchFilter, pagination.page, pagination.pageSize]);

  // ── Fetch students for a group (across all its batches) ───────────────────
  const fetchStudentsForGroup = async (group: PaperGroup): Promise<any[]> => {
    const allSt: any[] = [];
    for (const bid of group.batchIds) {
      try {
        const sRes = await getAllStudents(1, 500, "", bid);
        const sData = sRes?.data?.data ?? [];
        allSt.push(...sData.filter((s: any) => s.is_active !== false));
      } catch { /* skip failed batch fetch */ }
    }
    const seen = new Set<string>();
    return allSt.filter((s) => {
      const key = s.call_up_no ?? s.callUpNo;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  // ── Fetch all marks across all records of a group ─────────────────────────
  const fetchMarksForGroup = async (group: PaperGroup): Promise<MarkRow[]> => {
    const all: MarkRow[] = [];
    for (const rec of group.records) {
      try {
        const mRes = await getMarksByPaper(rec.id);
        const mData = mRes?.data ?? [];
        all.push(...mData);
      } catch { /* skip */ }
    }
    return all;
  };

  // ── Open enter-marks view ─────────────────────────────────────────────────
  const openEnter = async (group: PaperGroup) => {
    setSelectedGroup(group);
    setMarksBatchTab("all");
    try {
      const [students, marks] = await Promise.all([
        fetchStudentsForGroup(group),
        fetchMarksForGroup(group),
      ]);
      setAllStudents(students);
      setExistingMarks(marks);

      // Init form: pre-fill existing marks, blank for others
      const initForm: Record<string, string> = {};
      const initLocked: Record<string, boolean> = {};
      students.forEach((s: any) => {
        const key = s.call_up_no ?? s.callUpNo;
        const existing = marks.find((m: any) => m.call_up_no === key);
        initForm[key] = existing ? String(existing.marks) : "";
        initLocked[key] = !!existing;
      });
      setMarksForm(initForm);
      setLockedFields(initLocked);
    } catch (err) { console.error("Failed to load students/marks:", err); }
    setView("enter");
  };

  // ── Open rank view ────────────────────────────────────────────────────────
  const openRank = async (group: PaperGroup) => {
    setSelectedGroup(group);
    setRankBatchTab("all");
    try {
      const [students, marks] = await Promise.all([
        fetchStudentsForGroup(group),
        fetchMarksForGroup(group),
      ]);

      const ranked = students
        .map((s: any) => {
          const key = s.call_up_no ?? s.callUpNo;
          const m = marks.find((mk: any) => mk.call_up_no === key);
          return {
            student: s,
            marks: m ? m.marks : null,
            batchId: s.batch_id ?? s.batchId ?? "",
          };
        })
        .sort((a: any, b: any) => (b.marks ?? -1) - (a.marks ?? -1));
      setRankAllData(ranked);
      setRankList(ranked); // default: all
    } catch (err) { console.error("Failed to load rank list:", err); }
    setView("rank");
  };

  // ── Rank filter by tab ────────────────────────────────────────────────────
  useEffect(() => {
    if (rankBatchTab === "all") {
      setRankList(rankAllData);
    } else {
      setRankList(rankAllData.filter((r: any) => r.batchId === rankBatchTab));
    }
  }, [rankBatchTab, rankAllData]);

  // ── Students filtered by marks batch tab ──────────────────────────────────
  const marksTabStudents = useMemo(() => {
    if (marksBatchTab === "all") return allStudents;
    return allStudents.filter((s: any) => {
      const bid = s.batch_id ?? s.batchId ?? "";
      return bid === marksBatchTab;
    });
  }, [allStudents, marksBatchTab]);

  // ── Lock / unlock helpers ──────────────────────────────────────────────────
  const handleMarkChange = (callUpNo: string, value: string) => {
    setMarksForm((prev) => ({ ...prev, [callUpNo]: value }));
  };

  const handleMarkBlur = (callUpNo: string) => {
    if (marksForm[callUpNo]?.trim()) {
      setLockedFields((prev) => ({ ...prev, [callUpNo]: true }));
    }
  };

  const handleMarkDoubleClick = (callUpNo: string) => {
    setLockedFields((prev) => ({ ...prev, [callUpNo]: false }));
  };

  // ── Save all marks (each entry → its batch's paper record) ────────────────
  const saveMarks = async () => {
    if (!selectedGroup) return;
    setSaving(true);
    try {
      const entries = Object.entries(marksForm).filter(([, val]) => val !== "");
      const promises = entries.map(([callUpNo, val]) => {
        // Find the student's batch → find that batch's paper record
        const student = allStudents.find((s: any) => (s.call_up_no ?? s.callUpNo) === callUpNo);
        const studentBatchId = student ? (student.batch_id ?? student.batchId ?? "") : "";
        const record = selectedGroup.records.find((r) => r.batch_id === studentBatchId);
        if (!record) return Promise.resolve(); // no matching record → skip

        const existing = existingMarks.find((m) => m.call_up_no === callUpNo && m.paper_id === record.id);
        const markVal = parseFloat(val);
        if (existing) {
          return updateMarkApi({ call_up_no: callUpNo, paper_id: record.id, mark: markVal, comment: "none" });
        } else {
          return createMark({ call_up_no: callUpNo, paper_id: record.id, mark: markVal, comment: "none" });
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

  // ── Create paper: one record per selected batch ───────────────────────────
  const savePaper = async () => {
    if (!form.paper_name?.trim()) { alert("Paper name is required."); return; }
    if (form.batchIds.length === 0) { alert("Please select at least one batch."); return; }
    setSaving(true);
    try {
      // Create one paper record per selected batch (FK-safe)
      const promises = form.batchIds.map((bid: string) =>
        createPaper({
          paper_name: form.paper_name,
          paper_date: form.paper_date || new Date().toISOString(),
          batch_id: bid,
          material_id: form.material_id || "",
        })
      );
      await Promise.all(promises);
      setPaperModal(null);
      setForm({});
      fetchPapers();
    } catch (err: any) {
      console.error("Failed to create paper:", err);
      alert("Failed to create paper: " + (err?.response?.data?.msg ?? err?.message ?? "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Update paper: reconcile batches (delete removed, create new, update kept) ──
  const savePaperEdit = async () => {
    if (!editingGroup) return;
    if (!form.paper_name?.trim()) { alert("Paper name is required."); return; }
    if (form.batchIds.length === 0) { alert("Please select at least one batch."); return; }
    setSaving(true);
    try {
      const newBatchIds: string[] = form.batchIds;
      const oldBatchIds: string[] = editingGroup.batchIds;

      const removedRecords = editingGroup.records.filter((r) => !newBatchIds.includes(r.batch_id));
      const addedBatchIds = newBatchIds.filter((bid) => !oldBatchIds.includes(bid));
      const keptRecords = editingGroup.records.filter((r) => newBatchIds.includes(r.batch_id));

      const tasks: Promise<any>[] = [];

      // Delete records for batches removed from the paper
      removedRecords.forEach((r) => tasks.push(deletePaperApi(r.id)));

      // Create new records for newly added batches
      addedBatchIds.forEach((bid) => tasks.push(
        createPaper({
          paper_name: form.paper_name,
          paper_date: form.paper_date,
          batch_id: bid,
          material_id: form.material_id || "",
        })
      ));

      // Update shared fields on kept records (batch_id untouched — FK-safe)
      keptRecords.forEach((r) => tasks.push(
        updatePaperApi(r.id, {
          paper_name: form.paper_name,
          paper_date: form.paper_date,
          material_id: form.material_id || "",
        })
      ));

      await Promise.all(tasks);
      setPaperModal(null);
      setEditingGroup(null);
      setForm({});
      fetchPapers();
    } catch (err: any) {
      console.error("Failed to update paper:", err);
      alert("Failed to update paper: " + (err?.response?.data?.msg ?? err?.message ?? "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle publish across the whole group ─────────────────────────────────
  const handleTogglePublish = async (group: PaperGroup) => {
    const allReleased = group.records.every((r) => r.is_mark_released);
    const targets = allReleased
      ? group.records.filter((r) => r.is_mark_released)   // unpublish all
      : group.records.filter((r) => !r.is_mark_released); // publish pending
    try {
      await Promise.all(targets.map((r) => togglePublishMark(r.id)));
      fetchPapers();
    } catch (err: any) {
      console.error("Failed to toggle publish:", err);
      alert("Failed to toggle publish: " + (err?.response?.data?.msg ?? err?.message ?? "Unknown error"));
    }
  };

  // ── Open add modal ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingGroup(null);
    setForm({ paper_name: "", batchIds: [], material_id: "", paper_date: new Date().toISOString().split("T")[0] });
    setPaperModal("add");
  };

  // ── Open edit modal ────────────────────────────────────────────────────────
  const openEdit = (group: PaperGroup) => {
    setEditingGroup(group);
    setForm({
      paper_name: group.paper_name,
      batchIds: group.batchIds,
      material_id: group.material_id,
      paper_date: group.paper_date ? group.paper_date.split("T")[0] : "",
    });
    setPaperModal("edit");
  };

  // ── Toggle batch checkbox in form ─────────────────────────────────────────
  const toggleBatchCheck = (batchId: string) => {
    setForm((f) => {
      const current: string[] = f.batchIds ?? [];
      return {
        ...f,
        batchIds: current.includes(batchId)
          ? current.filter((id) => id !== batchId)
          : [...current, batchId],
      };
    });
  };

  // ── Batch tab label helper ─────────────────────────────────────────────────
  const batchTabLabel = (batchId: string) => {
    if (batchId === "all") return "All Batches";
    return batches.find((b) => b.id === batchId)?.name ?? batchId;
  };

  // ── Active batches only ────────────────────────────────────────────────────
  const activeBatches = useMemo(() => batches.filter((b) => b.active), [batches]);

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
                ? `Entering marks — ${selectedGroup?.paper_name}`
                : `Rank List — ${selectedGroup?.paper_name}`}
          </p>
        </div>
        <div className="flex gap-2">
          {view !== "papers" && (
            <Btn v="outline" sz="sm" onClick={() => { setView("papers"); fetchPapers(); }}>
              <ArrowLeft className="w-4 h-4" />Back to Papers
            </Btn>
          )}
          {view === "papers" && isAdmin && (
            <Btn sz="sm" onClick={openAdd}>
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
                {activeBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Sel>
              <span className="text-xs text-muted-foreground">{pagination.totalRecords} paper{pagination.totalRecords !== 1 ? "s" : ""} total</span>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Paper", "Batches", "Material", "Date", "Entered", "Avg", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageGroups.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">No papers found.</td></tr>
                  ) : pageGroups.map((g) => {
                    const bCount = g.batchIds.reduce((sum, bid) => sum + (batchStudentCounts[bid] || 0), 0);
                    const visibleBatches = g.batchNames.slice(0, 2);
                    const overflow = g.batchNames.length - 2;
                    return (
                      <tr key={g.key} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground cursor-pointer hover:text-primary" onClick={() => openEnter(g)}>
                          {g.paper_name}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {g.batchNames.length === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <>
                                {visibleBatches.map((name) => (
                                  <Badge key={name} v="muted" className="text-[10px]">{name}</Badge>
                                ))}
                                {overflow > 0 && (
                                  <Badge v="accent" className="text-[10px]">+{overflow}</Badge>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{g.materialName}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(g.paper_date)}</td>
                        <td className="px-4 py-3 font-mono text-center text-xs">{g.marksCount}/{bCount}</td>
                        <td className="px-4 py-3 font-mono text-center text-xs">
                          {g.avgMarks !== null ? g.avgMarks : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge v={g.is_mark_released ? "success" : "warning"}>
                            {g.is_mark_released ? "Published" : "Draft"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEnter(g)} className="p-1.5 hover:bg-muted rounded-lg" title="Enter Marks">
                              <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            <button onClick={() => openRank(g)} className="p-1.5 hover:bg-muted rounded-lg" title="Rank List">
                              <Award className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                            {isAdmin && (
                              <>
                                <button onClick={() => openEdit(g)} className="p-1.5 hover:bg-muted rounded-lg" title="Edit Paper">
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                </button>
                                <button
                                  onClick={() => handleTogglePublish(g)}
                                  className="p-1.5 hover:bg-muted rounded-lg"
                                  title={g.is_mark_released ? "Unpublish" : "Publish"}
                                >
                                  <Zap className={cn("w-3.5 h-3.5", g.anyReleased ? "text-amber-500" : "text-muted-foreground")} />
                                </button>
                              </>
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
      {view === "enter" && selectedGroup && (
        <div className="space-y-4">
          {/* Batch tabs */}
          {selectedGroup.batchIds.length > 1 && (
            <Card className="p-1.5">
              <div className="flex flex-wrap gap-1">
                <TabBtn active={marksBatchTab === "all"} onClick={() => setMarksBatchTab("all")}>
                  <Users className="w-3.5 h-3.5" />All ({allStudents.length})
                </TabBtn>
                {selectedGroup.batchIds.map((bid) => {
                  const count = allStudents.filter((s: any) => (s.batch_id ?? s.batchId ?? "") === bid).length;
                  return (
                    <TabBtn key={bid} active={marksBatchTab === bid} onClick={() => setMarksBatchTab(bid)}>
                      {batchTabLabel(bid)} ({count})
                    </TabBtn>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="p-4 border-b border-border bg-muted/30 flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{selectedGroup.paper_name}</p>
                <p className="text-xs text-muted-foreground">
                  {batchTabLabel(marksBatchTab)}
                  {" · "}{marksTabStudents.length} student{marksTabStudents.length !== 1 ? "s" : ""}
                  {" · "}{existingMarks.length} already entered
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                <Lock className="w-3 h-3 inline mr-1" />Double-click a locked field to edit
              </p>
            </div>
            <div className="divide-y divide-border/50 max-h-[60vh] overflow-y-auto">
              {marksTabStudents.map((s: any) => {
                const key = s.call_up_no ?? s.callUpNo;
                const isLocked = lockedFields[key] ?? false;

                return (
                  <div key={key} className="flex items-center gap-4 px-4 py-3">
                    <Avatar name={`${s.user?.first_name ?? s.first_name ?? s.firstName ?? ""} ${s.user?.last_name ?? s.last_name ?? s.lastName ?? ""}`.trim() || key} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {s.user?.first_name ?? s.first_name ?? s.firstName ?? ""} {s.user?.last_name ?? s.last_name ?? s.lastName ?? ""}
                      </p>
                      <p className="text-xs text-muted-foreground">{key}</p>
                    </div>
                    <div className="flex items-center gap-2 w-32">
                      <Input
                        type="number"
                        className={cn(
                          "text-center font-mono text-sm transition-all",
                          isLocked && "bg-muted/50 text-muted-foreground cursor-default border-dashed"
                        )}
                        min={0}
                        value={marksForm[key] || ""}
                        onChange={(e) => handleMarkChange(key, e.target.value)}
                        onBlur={() => handleMarkBlur(key)}
                        onDoubleClick={() => handleMarkDoubleClick(key)}
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
              {marksTabStudents.length === 0 && (
                <div className="py-12 text-center text-muted-foreground text-sm">No students found for this batch.</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ── Rank List View ──────────────────────────────────────────────────── */}
      {view === "rank" && selectedGroup && (
        <div className="space-y-4">
          {/* Batch tabs for rank */}
          {selectedGroup.batchIds.length > 1 && (
            <Card className="p-1.5">
              <div className="flex flex-wrap gap-1">
                <TabBtn active={rankBatchTab === "all"} onClick={() => setRankBatchTab("all")}>
                  <Users className="w-3.5 h-3.5" />All Batches ({rankAllData.length})
                </TabBtn>
                {selectedGroup.batchIds.map((bid) => {
                  const count = rankAllData.filter((r: any) => r.batchId === bid).length;
                  return (
                    <TabBtn key={bid} active={rankBatchTab === bid} onClick={() => setRankBatchTab(bid)}>
                      {batchTabLabel(bid)} ({count})
                    </TabBtn>
                  );
                })}
              </div>
            </Card>
          )}

          <Card className="overflow-hidden">
            <div className="p-4 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{selectedGroup.paper_name} — Rank List</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {batchTabLabel(rankBatchTab)} · {fmtDate(selectedGroup.paper_date)}
              </p>
            </div>
            <div className="divide-y divide-border/50">
              {rankList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">No marks entered yet.</div>
              ) : rankList.map(({ student: s, marks: m }: any, i: number) => (
                <div
                  key={s.call_up_no ?? s.callUpNo}
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
                  <Avatar name={`${s.user?.first_name ?? s.first_name ?? s.firstName ?? ""} ${s.user?.last_name ?? s.last_name ?? s.lastName ?? ""}`.trim() || s.call_up_no || s.callUpNo} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {s.user?.first_name ?? s.first_name ?? s.firstName ?? ""} {s.user?.last_name ?? s.last_name ?? s.lastName ?? ""}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.call_up_no ?? s.callUpNo}</p>
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
        </div>
      )}

      {/* ── Create / Edit Paper Modal ────────────────────────────────────────── */}
      <Modal
        open={paperModal !== null}
        onClose={() => { setPaperModal(null); setEditingGroup(null); }}
        title={paperModal === "edit" ? "Edit Paper" : "Create New Paper"}
      >
        <div className="space-y-4">
          <div>
            <FLabel>Paper Name</FLabel>
            <Input
              value={form.paper_name || ""}
              onChange={(e) => setForm((f) => ({ ...f, paper_name: e.target.value }))}
              placeholder="e.g. Term Test 2 — Pure Mathematics"
            />
          </div>

          {/* ── Batch checkboxes ────────────────────────────────────────────── */}
          <div>
            <FLabel>Batches (select all that apply)</FLabel>
            <p className="text-xs text-muted-foreground mt-1 mb-2">
              Select which batches wrote this paper. A separate paper record is kept per batch.
            </p>
            {activeBatches.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2">No active batches available.</p>
            ) : (
              <div className="border border-border rounded-xl overflow-hidden divide-y divide-border/50 max-h-48 overflow-y-auto">
                {activeBatches.map((b) => {
                  const checked = (form.batchIds ?? []).includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-muted/30",
                        checked && "bg-primary/5"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleBatchCheck(b.id)}
                        className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-ring accent-primary"
                      />
                      <span className="text-sm text-foreground">{b.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            {(form.batchIds ?? []).length > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {form.batchIds.length} batch{form.batchIds.length !== 1 ? "es" : ""} selected
              </p>
            )}
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
            <Btn v="outline" onClick={() => { setPaperModal(null); setEditingGroup(null); }} disabled={saving}>Cancel</Btn>
            <Btn onClick={paperModal === "edit" ? savePaperEdit : savePaper} disabled={saving}>
              {saving ? "Saving…" : paperModal === "edit" ? "Update Paper" : "Create Paper"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Tab button for batch switching ───────────────────────────────────────────
function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
      )}
    >
      {children}
    </button>
  );
}
