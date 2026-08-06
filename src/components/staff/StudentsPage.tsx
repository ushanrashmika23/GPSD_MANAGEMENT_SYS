import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Edit2, Eye, Trash2 } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card, Avatar } from "../ui";
import { FLabel } from "../ui";
import { fmtDate } from "../../lib/utils";
import type { Student, Batch, AttendanceRecord, Payment, Mark, Role } from "../../lib/types";
import { getAllStudents, getStudentById, addStudent, updateStudent, deleteStudent, getAllBatches } from "../../api/apiCalls";
import Pagination from "../ui/Pagination";

// ── HighlightText ────────────────────────────────────────────────────────────
function HighlightText({ text, term }: { text: string; term: string }) {
  if (!term.trim()) return <>{text}</>;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-amber-200 px-0.5 text-inherit dark:bg-amber-800/60">{p}</mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

// ── StudentForm ──────────────────────────────────────────────────────────────
function StudentForm({
  form, setForm, batches, modal, onSave, onCancel, saving,
}: {
  form: Partial<Student & { firstName?: string; lastName?: string; email?: string; password?: string }>;
  setForm: React.Dispatch<React.SetStateAction<Partial<any>>>;
  batches: Batch[];
  modal: "add" | "edit" | "view" | null;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const isAdd = modal === "add";
  const isEdit = modal === "edit";

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {/* ── Add-only fields ── */}
        {isAdd && (
          <>
            <div>
              <FLabel>First Name</FLabel>
              <Input
                value={(form as any).firstName || ""}
                onChange={(e) => setForm((f: any) => ({ ...f, firstName: e.target.value }))}
                placeholder="First name"
                required
              />
            </div>
            <div>
              <FLabel>Last Name</FLabel>
              <Input
                value={(form as any).lastName || ""}
                onChange={(e) => setForm((f: any) => ({ ...f, lastName: e.target.value }))}
                placeholder="Last name"
                required
              />
            </div>
            <div>
              <FLabel>Email</FLabel>
              <Input
                type="email"
                value={(form as any).email || ""}
                onChange={(e) => setForm((f: any) => ({ ...f, email: e.target.value }))}
                placeholder="student@email.com"
                required
              />
            </div>
            <div>
              <FLabel>Password</FLabel>
              <Input
                type="password"
                value={(form as any).password || ""}
                onChange={(e) => setForm((f: any) => ({ ...f, password: e.target.value }))}
                placeholder="Min. 6 characters"
                required
              />
            </div>
          </>
        )}

        {/* ── Edit: show read-only name ── */}
        {isEdit && (
          <>
            <div className="col-span-2">
              <FLabel>Full Name</FLabel>
              <Input
                value={form.fullName || ""}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="Student's full name"
              />
            </div>
            <div className="col-span-2 flex items-center gap-3 pt-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={form.active ?? true}
                  onChange={(e) => setForm((f: any) => ({ ...f, active: e.target.checked }))}
                />
                <div className="w-9 h-5 bg-muted-foreground/30 peer-checked:bg-emerald-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
              </label>
              <span className="text-sm font-medium text-foreground">
                {form.active ? "Active" : "Inactive"}
              </span>
            </div>
          </>
        )}

        <div>
          <FLabel>Call-up No.</FLabel>
          <Input
            value={form.callupNo || ""}
            onChange={(e) => setForm((f) => ({ ...f, callupNo: e.target.value }))}
            placeholder="MA001"
            required
          />
        </div>
        <div>
          <FLabel>Mobile</FLabel>
          <Input
            value={form.mobile || ""}
            onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
            placeholder="07X XXXXXXX"
            required
          />
        </div>
        <div className="col-span-2">
          <FLabel>School</FLabel>
          <Input
            value={form.school || ""}
            onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))}
            placeholder="School name"
          />
        </div>
        <div className="col-span-2">
          <FLabel>Address</FLabel>
          <Input
            value={form.address || ""}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Full address"
          />
        </div>
        <div>
          <FLabel>Parent Name</FLabel>
          <Input
            value={form.parentName || ""}
            onChange={(e) => setForm((f) => ({ ...f, parentName: e.target.value }))}
            placeholder="Parent/guardian name"
          />
        </div>
        <div>
          <FLabel>Parent Mobile</FLabel>
          <Input
            value={form.parentMobile || ""}
            onChange={(e) => setForm((f) => ({ ...f, parentMobile: e.target.value }))}
            placeholder="07X XXXXXXX"
          />
        </div>
        <div className="col-span-2">
          <FLabel>Batch</FLabel>
          <Sel
            value={(form as any).batchId || form.batchIds?.[0] || ""}
            onChange={(e) =>
              setForm((f: any) => ({ ...f, batchId: e.target.value, batchIds: [e.target.value] }))
            }
          >
            <option value="">Select batch</option>
            {batches.filter((b) => b.active).map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Sel>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Btn v="outline" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : isAdd ? "Add Student" : "Save Changes"}
        </Btn>
      </div>
    </div>
  );
}

// ── ViewProfile ──────────────────────────────────────────────────────────────
function ViewProfile({ student, onClose }: { student: Student; onClose: () => void }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getStudentById(student.callupNo);
        const data = res?.data?.data ?? res?.data ?? null;
        if (!cancelled) {
          setProfile(data);
        }
      } catch (err) {
        console.error("Failed to load student profile:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [student.callupNo]);

  const attendCount = profile?.attendance?.length ?? 0;
  const paymentCount = profile?.payment?.length ?? 0;
  const marksCount = profile?.student_marks?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-5">
        <Avatar name={student.fullName} size="lg" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-foreground">{student.fullName}</h3>
            <Badge v={student.active ? "success" : "danger"}>{student.active ? "Active" : "Inactive"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">{student.school}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Registered {fmtDate(student.registrationDate)} · {student.callupNo}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Loading profile…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Mobile</p>
                <p className="font-mono">{student.mobile || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">NIC</p>
                <p className="font-mono">{student.nic || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Address</p>
                <p>{student.address || "—"}</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Parent</p>
                <p>{student.parentName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Parent Mobile</p>
                <p className="font-mono">{student.parentMobile || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Batch</p>
                <p className="font-mono">
                  {profile?.batch?.name ?? "—"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Classes Attended", value: attendCount },
              { label: "Payments Made", value: paymentCount },
              { label: "Papers Taken", value: marksCount },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold font-mono text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── StudentsPage ─────────────────────────────────────────────────────────────
interface StudentsPageProps {
  batches: Batch[];
  attendance: AttendanceRecord[];
  payments: Payment[];
  marks: Mark[];
  role: Role;
}

export function StudentsPage({ batches, attendance, payments, marks, role }: StudentsPageProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, pageSize: 12, totalRecords: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<"add" | "edit" | "view" | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [form, setForm] = useState<Partial<any>>({});
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [activeBatches, setActiveBatches] = useState<Batch[]>(batches);

  // ── Fetch active batches for form dropdown ──────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const result = await getAllBatches(1, 100, "");
        const data = result?.data?.data ?? [];
        const mapped: Batch[] = data.map((b: any) => ({
          id: b.id,
          name: b.name,
          fee: b.class_fee ?? b.fee ?? 0,
          startTime: b.start_time ?? b.startTime ?? "",
          endTime: b.end_time ?? b.endTime ?? "",
          endYear: b.exam_date ?? b.examDate ?? "",
          active: b.is_active ?? b.active ?? true,
          day: b.day ?? "",
        }));
        setActiveBatches(mapped);
      } catch (err) {
        console.error("Failed to fetch batches for form:", err);
      }
    })();
  }, []);

  // ── Debounced search ────────────────────────────────────────────────────
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(v);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
  };

  // ── Fetch students from API ─────────────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    try {
      const result = await getAllStudents(pagination.page, pagination.pageSize, search);
      const backendStudents = result?.data?.data ?? [];
      const meta = result?.data?.meta ?? {};
      setPagination((prev) => {
        const perPage = meta.limit ?? prev.pageSize;
        const lastPage = meta.pages ?? (meta.total != null ? Math.max(1, Math.ceil(meta.total / perPage)) : prev.totalPages);
        return { page: meta.page ?? prev.page, totalPages: lastPage, pageSize: perPage, totalRecords: meta.total ?? prev.totalRecords };
      });
      const mapped: Student[] = backendStudents.map((s: any) => ({
        id: s.user?.id ?? "",
        callupNo: s.call_up_no,
        fullName: `${s.user?.first_name ?? ""} ${s.user?.last_name ?? ""}`.trim(),
        email: s.user?.email ?? "",
        school: s.school,
        address: s.user?.address ?? "",
        nic: "",
        mobile: s.user?.mobile ?? "",
        parentName: s.parent_name,
        parentMobile: s.parent_mobile,
        notes: s.notes ?? "",
        active: s.user?.is_active ?? true,
        registrationDate: s.user?.createdAt ?? "",
        batchIds: s.batch_id ? [s.batch_id] : [],
      }));
      setStudents(mapped);
    } catch (error) {
      console.error("Error fetching students:", error);
    }
  }, [pagination.page, pagination.pageSize, search]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ── Client-side batch + status filters (on current page) ────────────────
  const filtered = useMemo(() => students.filter((s) => {
    const matchBatch = batchFilter === "all" || s.batchIds.includes(batchFilter);
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? s.active : !s.active);
    return matchBatch && matchStatus;
  }), [students, batchFilter, statusFilter]);

  // ── Modal helpers ───────────────────────────────────────────────────────
  const openAdd = () => {
    setForm({ active: true, registrationDate: new Date().toISOString().split("T")[0] });
    setModal("add");
  };
  const openEdit = (s: Student) => {
    setSelected(s);
    setForm({
      ...s,
      batchId: s.batchIds?.[0] || "",
      firstName: s.fullName?.split(" ")[0] || "",
      lastName: s.fullName?.split(" ").slice(1).join(" ") || "",
    });
    setModal("edit");
  };
  const openView = (s: Student) => {
    setSelected(s);
    setModal("view");
  };

  // ── Save (API) ──────────────────────────────────────────────────────────
  const save = async () => {
    setSaving(true);
    try {
      if (modal === "add") {
        // Validate required add fields
        if (!(form as any).firstName?.trim() || !(form as any).lastName?.trim()) {
          alert("First name and last name are required.");
          setSaving(false);
          return;
        }
        if (!(form as any).email?.trim()) {
          alert("Email is required.");
          setSaving(false);
          return;
        }
        if (!(form as any).password || (form as any).password.length < 6) {
          alert("Password must be at least 6 characters.");
          setSaving(false);
          return;
        }
        await addStudent(form);
      } else if (modal === "edit" && selected) {
        await updateStudent(selected.callupNo, form);
      }
      setModal(null);
      setSaving(false);
      fetchStudents();
    } catch (error: any) {
      console.error("Failed to save student:", error);
      const msg = error?.response?.data?.msg ?? error?.message ?? "An error occurred";
      alert("Failed to save student: " + msg);
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (s: Student) => {
    if (!window.confirm(`Are you sure you want to delete ${s.fullName} (${s.callupNo})? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteStudent(s.callupNo);
      fetchStudents();
    } catch (error: any) {
      console.error("Failed to delete student:", error);
      const msg = error?.response?.data?.msg ?? error?.message ?? "An error occurred";
      alert("Failed to delete student: " + msg);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Students</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} on this page · {pagination.totalRecords} total
          </p>
        </div>
        {role === "admin" && (
          <Btn onClick={openAdd}><Plus className="w-4 h-4" />Add Student</Btn>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, call-up no., mobile, school…"
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>
          <Sel className="sm:w-44" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            <option value="all">All Batches</option>
            {activeBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Sel>
          <Sel className="sm:w-36" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Sel>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Student", "Email", "Call-up No.", "School", "Mobile", "Batches", "Status", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground text-sm">No students found.</td></tr>
              ) : filtered.map((s) => (
                <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={s.fullName} size="sm" />
                      <div>
                        <p className="font-medium text-foreground"><HighlightText text={s.fullName} term={search} /></p>
                        <p className="text-xs text-muted-foreground">{fmtDate(s.registrationDate)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground max-w-[180px] truncate"><HighlightText text={s.email} term={search} /></td>
                  <td className="px-4 py-3 font-mono text-xs text-foreground"><HighlightText text={s.callupNo} term={search} /></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs max-w-[160px] truncate"><HighlightText text={s.school} term={search} /></td>
                  <td className="px-4 py-3 font-mono text-xs"><HighlightText text={s.mobile} term={search} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {s.batchIds.map((bid) => {
                        const b = activeBatches.find((x) => x.id === bid);
                        return b ? <Badge key={bid} v="default">{b.name}</Badge> : null;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge v={s.active ? "success" : "danger"}>{s.active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => openView(s)} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="View Profile">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      {role === "admin" && (
                        <>
                          <button onClick={() => openEdit(s)} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="Edit">
                            <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={() => handleDelete(s)} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
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

      {/* Pagination */}
      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        pageSize={pagination.pageSize}
        totalRecords={pagination.totalRecords}
        setPagination={setPagination}
      />

      {/* ── Add Modal ── */}
      <Modal open={modal === "add"} onClose={() => setModal(null)} title="Add New Student">
        <StudentForm
          form={form}
          setForm={setForm}
          batches={activeBatches}
          modal={modal}
          onSave={save}
          onCancel={() => setModal(null)}
          saving={saving}
        />
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Edit Student">
        <StudentForm
          form={form}
          setForm={setForm}
          batches={activeBatches}
          modal={modal}
          onSave={save}
          onCancel={() => setModal(null)}
          saving={saving}
        />
      </Modal>

      {/* ── View Modal ── */}
      <Modal open={modal === "view" && !!selected} onClose={() => setModal(null)} title="Student Profile" wide>
        {selected && <ViewProfile student={selected} onClose={() => setModal(null)} />}
      </Modal>
    </div>
  );
}
