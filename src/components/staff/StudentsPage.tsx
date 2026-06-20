import { useState, useMemo } from "react";
import { Search, Plus, Edit2, Eye, CheckCircle, XCircle } from "lucide-react";
import { Badge, Btn, Input, Sel, Textarea, Modal, Card, Avatar, EmptyState } from "../ui";
import { FLabel } from "../ui";
import { fmtDate } from "../../lib/utils";
import { cn } from "../../lib/utils";
import type { Student, Batch, AttendanceRecord, Payment, Mark, Role } from "../../lib/types";
import { Users } from "lucide-react";

interface StudentsPageProps {
  students: Student[];
  batches: Batch[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  attendance: AttendanceRecord[];
  payments: Payment[];
  marks: Mark[];
  role: Role;
}

export function StudentsPage({ students, batches, setStudents, attendance, payments, marks, role }: StudentsPageProps) {
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<"add" | "edit" | "view" | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [form, setForm] = useState<Partial<Student>>({});

  const filtered = useMemo(() => students.filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      s.fullName.toLowerCase().includes(q) ||
      s.callupNo.toLowerCase().includes(q) ||
      s.mobile.includes(q) ||
      s.school.toLowerCase().includes(q);
    const matchBatch = batchFilter === "all" || s.batchIds.includes(batchFilter);
    const matchStatus =
      statusFilter === "all" ||
      (statusFilter === "active" ? s.active : !s.active);
    return matchSearch && matchBatch && matchStatus;
  }), [students, search, batchFilter, statusFilter]);

  const openAdd = () => {
    setForm({ active: true, registrationDate: new Date().toISOString().split("T")[0], batchIds: [] });
    setModal("add");
  };
  const openEdit = (s: Student) => { setSelected(s); setForm({ ...s }); setModal("edit"); };
  const openView = (s: Student) => { setSelected(s); setModal("view"); };

  const save = () => {
    if (modal === "add") {
      const newS: Student = {
        id: `s${Date.now()}`,
        callupNo: `MA${String(students.length + 1).padStart(3, "0")}`,
        ...form,
      } as Student;
      setStudents((p) => [...p, newS]);
    } else if (modal === "edit" && selected) {
      setStudents((p) => p.map((s) => (s.id === selected.id ? { ...s, ...form } as Student : s)));
    }
    setModal(null);
  };

  const toggleActive = (s: Student) =>
    setStudents((p) => p.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)));

  const StudentForm = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FLabel>Full Name</FLabel>
          <Input value={form.fullName || ""} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} placeholder="Student's full name" />
        </div>
        <div>
          <FLabel>School</FLabel>
          <Input value={form.school || ""} onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))} placeholder="School name" />
        </div>
        <div>
          <FLabel>Mobile</FLabel>
          <Input value={form.mobile || ""} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="07X XXXXXXX" />
        </div>
        <div>
          <FLabel>NIC</FLabel>
          <Input value={form.nic || ""} onChange={(e) => setForm((f) => ({ ...f, nic: e.target.value }))} placeholder="NIC number" />
        </div>
        <div>
          <FLabel>Registration Date</FLabel>
          <Input type="date" value={form.registrationDate || ""} onChange={(e) => setForm((f) => ({ ...f, registrationDate: e.target.value }))} />
        </div>
        <div className="col-span-2">
          <FLabel>Address</FLabel>
          <Input value={form.address || ""} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} placeholder="Full address" />
        </div>
        <div>
          <FLabel>Parent Name</FLabel>
          <Input value={form.parentName || ""} onChange={(e) => setForm((f) => ({ ...f, parentName: e.target.value }))} placeholder="Parent/guardian name" />
        </div>
        <div>
          <FLabel>Parent Mobile</FLabel>
          <Input value={form.parentMobile || ""} onChange={(e) => setForm((f) => ({ ...f, parentMobile: e.target.value }))} placeholder="07X XXXXXXX" />
        </div>
        <div className="col-span-2">
          <FLabel>Batches</FLabel>
          <div className="flex flex-wrap gap-2">
            {batches.filter((b) => b.active).map((b) => (
              <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={(form.batchIds || []).includes(b.id)}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      batchIds: e.target.checked
                        ? [...(f.batchIds || []), b.id]
                        : (f.batchIds || []).filter((x) => x !== b.id),
                    }))
                  }
                />
                <span className="text-sm">{b.name}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="col-span-2">
          <FLabel>Notes</FLabel>
          <Textarea value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Any additional notes" />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" id="active" checked={form.active || false} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
          <label htmlFor="active" className="text-sm font-medium">Active Student</label>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Btn v="outline" onClick={() => setModal(null)}>Cancel</Btn>
        <Btn onClick={save}>{modal === "add" ? "Add Student" : "Save Changes"}</Btn>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {students.length} students</p>
        </div>
        {role === "admin" && (
          <Btn onClick={openAdd}><Plus className="w-4 h-4" />Add Student</Btn>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search by name, call-up no., mobile, school…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Sel className="sm:w-44" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            <option value="all">All Batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Sel>
          <Sel className="sm:w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Sel>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Student", "Call-up No.", "School", "Mobile", "Batches", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground text-sm">No students found.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.fullName} size="sm" />
                      <div>
                        <p className="font-medium text-foreground">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(s.registrationDate)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground">{s.callupNo}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate">{s.school}</td>
                  <td className="px-4 py-3 font-mono text-xs">{s.mobile}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.batchIds.map((bid) => {
                        const b = batches.find((x) => x.id === bid);
                        return b ? <Badge key={bid} v="default">{b.name.split(" ")[0]} {b.name.split(" ")[1]}</Badge> : null;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge v={s.active ? "success" : "danger"}>{s.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openView(s)} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="View Profile"><Eye className="w-3.5 h-3.5 text-muted-foreground" /></button>
                      {role === "admin" && (
                        <>
                          <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="Edit"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                          <button onClick={() => toggleActive(s)} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title={s.active ? "Deactivate" : "Activate"}>
                            {s.active ? <XCircle className="w-3.5 h-3.5 text-amber-500" /> : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={modal === "add"} onClose={() => setModal(null)} title="Add New Student"><StudentForm /></Modal>
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Edit Student"><StudentForm /></Modal>

      <Modal open={modal === "view" && !!selected} onClose={() => setModal(null)} title="Student Profile" wide>
        {selected && (
          <div className="space-y-6">
            <div className="flex items-start gap-5">
              <Avatar name={selected.fullName} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-foreground">{selected.fullName}</h3>
                  <Badge v={selected.active ? "success" : "danger"}>{selected.active ? "Active" : "Inactive"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{selected.school}</p>
                <p className="text-xs text-muted-foreground mt-1">Registered {fmtDate(selected.registrationDate)} · {selected.callupNo}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Mobile</p><p className="font-mono">{selected.mobile}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">NIC</p><p className="font-mono">{selected.nic}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Address</p><p>{selected.address}</p></div>
              </div>
              <div className="space-y-3">
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Parent</p><p>{selected.parentName}</p></div>
                <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Parent Mobile</p><p className="font-mono">{selected.parentMobile}</p></div>
                {selected.notes && <div><p className="text-xs text-muted-foreground uppercase tracking-wide">Notes</p><p className="text-amber-700 bg-amber-50 px-2 py-1 rounded text-xs">{selected.notes}</p></div>}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Classes Attended", value: attendance.filter((a) => a.studentId === selected.id && a.present).length },
                { label: "Payments Made", value: payments.filter((p) => p.studentId === selected.id).length },
                { label: "Papers Taken", value: marks.filter((m) => m.studentId === selected.id).length },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold font-mono text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
