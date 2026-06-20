import { useState } from "react";
import { Plus, Edit2, Eye } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card } from "../ui";
import { Avatar } from "../ui";
import { FLabel } from "../ui";
import { fmtCur } from "../../lib/utils";
import type { Batch, Student, Role } from "../../lib/types";

interface BatchesPageProps {
  batches: Batch[];
  setBatches: React.Dispatch<React.SetStateAction<Batch[]>>;
  students: Student[];
  role: Role;
}

export function BatchesPage({ batches, setBatches, students, role }: BatchesPageProps) {
  const [modal, setModal] = useState<"add" | "edit" | "view" | null>(null);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [form, setForm] = useState<Partial<Batch>>({});

  const save = () => {
    if (modal === "add") {
      setBatches((p) => [...p, { id: `b${Date.now()}`, ...form, active: form.active ?? true } as Batch]);
    } else if (selected) {
      setBatches((p) => p.map((b) => (b.id === selected.id ? { ...b, ...form } as Batch : b)));
    }
    setModal(null);
  };

  const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const BatchForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FLabel>Batch Name</FLabel>
          <Input value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Batch A — 2025" />
        </div>
        <div>
          <FLabel>Day</FLabel>
          <Sel value={form.day || ""} onChange={(e) => setForm((f) => ({ ...f, day: e.target.value }))}>
            <option value="">Select day</option>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Sel>
        </div>
        <div>
          <FLabel>End Year</FLabel>
          <Input type="number" value={form.endYear || ""} onChange={(e) => setForm((f) => ({ ...f, endYear: +e.target.value }))} placeholder="2025" />
        </div>
        <div>
          <FLabel>Start Time</FLabel>
          <Input type="time" value={form.startTime || ""} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
        </div>
        <div>
          <FLabel>End Time</FLabel>
          <Input type="time" value={form.endTime || ""} onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))} />
        </div>
        <div>
          <FLabel>Monthly Fee (LKR)</FLabel>
          <Input type="number" value={form.fee || ""} onChange={(e) => setForm((f) => ({ ...f, fee: +e.target.value }))} placeholder="3500" />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.active ?? true} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            <span className="text-sm font-medium">Active Batch</span>
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Btn v="outline" onClick={() => setModal(null)}>Cancel</Btn>
        <Btn onClick={save}>{modal === "add" ? "Create Batch" : "Save Changes"}</Btn>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Batches</h1>
          <p className="text-sm text-muted-foreground">{batches.filter((b) => b.active).length} active batches</p>
        </div>
        {role === "admin" && (
          <Btn onClick={() => { setForm({ active: true }); setModal("add"); }}>
            <Plus className="w-4 h-4" />New Batch
          </Btn>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {batches.map((b) => {
          const bStudents = students.filter((s) => s.batchIds.includes(b.id) && s.active);
          return (
            <Card key={b.id} className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-foreground">{b.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{b.day} · {b.startTime} – {b.endTime}</p>
                </div>
                <Badge v={b.active ? "success" : "muted"}>{b.active ? "Active" : "Inactive"}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-lg font-bold font-mono text-foreground">{bStudents.length}</p>
                  <p className="text-xs text-muted-foreground">Students</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-lg font-bold font-mono text-foreground">{fmtCur(b.fee)}</p>
                  <p className="text-xs text-muted-foreground">Monthly Fee</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Btn v="outline" sz="sm" className="flex-1 justify-center" onClick={() => { setSelected(b); setModal("view"); }}>
                  <Eye className="w-3.5 h-3.5" />Students
                </Btn>
                {role === "admin" && (
                  <Btn v="ghost" sz="sm" onClick={() => { setSelected(b); setForm({ ...b }); setModal("edit"); }}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Btn>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={modal === "add"} onClose={() => setModal(null)} title="Create New Batch"><BatchForm /></Modal>
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Edit Batch"><BatchForm /></Modal>

      <Modal open={modal === "view" && !!selected} onClose={() => setModal(null)} title={`${selected?.name} — Students`} wide>
        {selected && (
          <div>
            <p className="text-sm text-muted-foreground mb-4">
              {students.filter((s) => s.batchIds.includes(selected.id) && s.active).length} active students in this batch
            </p>
            <div className="space-y-2">
              {students.filter((s) => s.batchIds.includes(selected.id)).map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
                  <Avatar name={s.fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">{s.callupNo} · {s.school}</p>
                  </div>
                  <Badge v={s.active ? "success" : "danger"}>{s.active ? "Active" : "Inactive"}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
