import { useState } from "react";
import { Plus, Edit2, Award, Zap, Check } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card, Avatar } from "../ui";
import { FLabel } from "../ui";
import { fmtDate } from "../../lib/utils";
import { cn } from "../../lib/utils";
import type { Paper, Mark, Student, Batch, Role } from "../../lib/types";

interface MarksPageProps {
  papers: Paper[];
  setPapers: React.Dispatch<React.SetStateAction<Paper[]>>;
  marks: Mark[];
  setMarks: React.Dispatch<React.SetStateAction<Mark[]>>;
  students: Student[];
  batches: Batch[];
  role: Role;
}

export function MarksPage({ papers, setPapers, marks, setMarks, students, batches, role }: MarksPageProps) {
  const [view, setView] = useState<"papers" | "enter" | "rank">("papers");
  const [selectedPaper, setSelectedPaper] = useState<Paper | null>(null);
  const [batchFilter, setBatchFilter] = useState("all");
  const [paperModal, setPaperModal] = useState(false);
  const [form, setForm] = useState<Partial<Paper>>({});
  const [marksForm, setMarksForm] = useState<Record<string, string>>({});

  const filtPapers = papers.filter((p) => batchFilter === "all" || p.batchId === batchFilter);

  const openEnter = (paper: Paper) => {
    setSelectedPaper(paper);
    const init: Record<string, string> = {};
    students.filter((s) => s.batchIds.includes(paper.batchId) && s.active).forEach((s) => {
      const existing = marks.find((m) => m.paperId === paper.id && m.studentId === s.id);
      init[s.id] = existing ? String(existing.marks) : "";
    });
    setMarksForm(init);
    setView("enter");
  };

  const openRank = (paper: Paper) => { setSelectedPaper(paper); setView("rank"); };

  const saveMarks = () => {
    const updates: Mark[] = [];
    Object.entries(marksForm).forEach(([sid, val]) => {
      if (val === "") return;
      const existing = marks.find((m) => m.paperId === selectedPaper!.id && m.studentId === sid);
      if (existing) updates.push({ ...existing, marks: +val });
      else updates.push({ id: `mk${Date.now()}_${sid}`, paperId: selectedPaper!.id, studentId: sid, marks: +val });
    });
    setMarks((prev) => [
      ...prev.filter((m) => {
        if (m.paperId !== selectedPaper!.id) return true;
        return !updates.some((u) => u.studentId === m.studentId);
      }),
      ...updates,
    ]);
    setView("papers");
  };

  const getRankList = (paper: Paper) =>
    students
      .filter((s) => s.batchIds.includes(paper.batchId) && s.active)
      .map((s) => {
        const m = marks.find((mk) => mk.paperId === paper.id && mk.studentId === s.id);
        return { student: s, marks: m?.marks ?? null, pct: m ? Math.round((m.marks / paper.totalMarks) * 100) : null };
      })
      .sort((a, b) => (b.marks ?? -1) - (a.marks ?? -1));

  const savePaper = () => {
    setPapers((p) => [...p, { id: `p${Date.now()}`, ...form, published: false } as Paper]);
    setPaperModal(false);
    setForm({});
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Marks</h1>
          <p className="text-sm text-muted-foreground">
            {view === "papers" ? "Manage papers and examinations" : view === "enter" ? `Entering marks — ${selectedPaper?.name}` : `Rank List — ${selectedPaper?.name}`}
          </p>
        </div>
        <div className="flex gap-2">
          {view !== "papers" && <Btn v="outline" sz="sm" onClick={() => setView("papers")}>← Back to Papers</Btn>}
          {view === "papers" && role === "admin" && (
            <Btn sz="sm" onClick={() => { setForm({}); setPaperModal(true); }}><Plus className="w-4 h-4" />New Paper</Btn>
          )}
          {view === "enter" && <Btn sz="sm" onClick={saveMarks}><Check className="w-4 h-4" />Save Marks</Btn>}
        </div>
      </div>

      {view === "papers" && (
        <>
          <Card className="p-4">
            <Sel className="w-48" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
              <option value="all">All Batches</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Sel>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Paper", "Batch", "Date", "Total", "Entered", "Avg", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtPapers.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">No papers found.</td></tr>
                  ) : filtPapers.map((p) => {
                    const bt = batches.find((b) => b.id === p.batchId);
                    const pMarks = marks.filter((m) => m.paperId === p.id);
                    const avg = pMarks.length > 0 ? Math.round(pMarks.reduce((s, m) => s + m.marks, 0) / pMarks.length) : null;
                    const bCount = students.filter((s) => s.batchIds.includes(p.batchId) && s.active).length;
                    return (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{bt?.name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(p.date)}</td>
                        <td className="px-4 py-3 font-mono text-center">{p.totalMarks}</td>
                        <td className="px-4 py-3 font-mono text-center">{pMarks.length}/{bCount}</td>
                        <td className="px-4 py-3 font-mono text-center">
                          {avg !== null ? (
                            <span className={cn(avg / p.totalMarks >= 0.7 ? "text-emerald-600" : avg / p.totalMarks >= 0.5 ? "text-amber-600" : "text-red-500")}>
                              {avg}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3"><Badge v={p.published ? "success" : "warning"}>{p.published ? "Published" : "Draft"}</Badge></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEnter(p)} className="p-1.5 hover:bg-muted rounded-lg" title="Enter Marks"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                            <button onClick={() => openRank(p)} className="p-1.5 hover:bg-muted rounded-lg" title="Rank List"><Award className="w-3.5 h-3.5 text-muted-foreground" /></button>
                            {role === "admin" && (
                              <button
                                onClick={() => setPapers((prev) => prev.map((x) => x.id === p.id ? { ...x, published: !x.published } : x))}
                                className="p-1.5 hover:bg-muted rounded-lg"
                                title={p.published ? "Unpublish" : "Publish"}
                              >
                                <Zap className={cn("w-3.5 h-3.5", p.published ? "text-amber-500" : "text-muted-foreground")} />
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
        </>
      )}

      {view === "enter" && selectedPaper && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <p className="text-sm text-muted-foreground">Total Marks: <strong>{selectedPaper.totalMarks}</strong> · Enter marks for each student</p>
          </div>
          <div className="divide-y divide-border/50">
            {students.filter((s) => s.batchIds.includes(selectedPaper.batchId) && s.active).map((s) => (
              <div key={s.id} className="flex items-center gap-4 px-4 py-3">
                <Avatar name={s.fullName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.fullName}</p>
                  <p className="text-xs text-muted-foreground">{s.callupNo}</p>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <Input
                    type="number"
                    className="text-center font-mono"
                    min={0}
                    max={selectedPaper.totalMarks}
                    value={marksForm[s.id] || ""}
                    onChange={(e) => setMarksForm((f) => ({ ...f, [s.id]: e.target.value }))}
                    placeholder="—"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">/{selectedPaper.totalMarks}</span>
                </div>
                {marksForm[s.id] && (
                  <Badge v={
                    +marksForm[s.id] / selectedPaper.totalMarks >= 0.7 ? "success"
                    : +marksForm[s.id] / selectedPaper.totalMarks >= 0.5 ? "warning"
                    : "danger"
                  }>
                    {Math.round(+marksForm[s.id] / selectedPaper.totalMarks * 100)}%
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {view === "rank" && selectedPaper && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border">
            <p className="text-sm font-semibold text-foreground">{selectedPaper.name} — Rank List</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {batches.find((b) => b.id === selectedPaper.batchId)?.name} · {fmtDate(selectedPaper.date)}
            </p>
          </div>
          <div className="divide-y divide-border/50">
            {getRankList(selectedPaper).map(({ student: s, marks: m, pct }, i) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-4 px-4 py-3",
                  i === 0 ? "bg-amber-50/50" : i === 1 ? "bg-gray-50/50" : i === 2 ? "bg-orange-50/30" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0",
                  i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-200 text-gray-700" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                )}>{i + 1}</div>
                <Avatar name={s.fullName} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{s.fullName}</p>
                  <p className="text-xs text-muted-foreground">{s.callupNo}</p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold font-mono text-foreground">
                    {m ?? "—"}<span className="text-xs text-muted-foreground font-normal">/{selectedPaper.totalMarks}</span>
                  </p>
                  {pct !== null && (
                    <p className={cn("text-xs font-medium", pct >= 70 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-500")}>{pct}%</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={paperModal} onClose={() => setPaperModal(false)} title="Create New Paper">
        <div className="space-y-4">
          <div>
            <FLabel>Paper Name</FLabel>
            <Input value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Term Test 2 — Pure Mathematics" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FLabel>Batch</FLabel>
              <Sel value={form.batchId || ""} onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}>
                <option value="">Select batch</option>
                {batches.filter((b) => b.active).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Sel>
            </div>
            <div><FLabel>Date</FLabel><Input type="date" value={form.date || ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
            <div><FLabel>Total Marks</FLabel><Input type="number" value={form.totalMarks || ""} onChange={(e) => setForm((f) => ({ ...f, totalMarks: +e.target.value }))} placeholder="100" /></div>
          </div>
          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setPaperModal(false)}>Cancel</Btn>
            <Btn onClick={savePaper}>Create Paper</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
