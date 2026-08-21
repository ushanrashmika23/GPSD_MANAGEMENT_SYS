import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Plus, Edit2, Eye, Trash2, KeyRound, CalendarCheck, Wallet, FileText, Info } from "lucide-react";
import { Badge, Btn, Input, Modal, Card, Avatar, FLabel, BatchDropdown, ConfirmDialog, StatCard } from "../ui";
import { fmtDate, cn } from "../../lib/utils";
import type { Student, Batch, AttendanceRecord, Payment, Mark, Role } from "../../lib/types";
import { getAllStudents, getStudentById, addStudent, updateStudent, deleteStudent, resetStudentPassword, getAllBatches } from "../../api/apiCalls";
import Pagination from "../ui/Pagination";

// ── HighlightText ──────────────────────────────────────────────────────────────
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

// ── AddStudentForm ─────────────────────────────────────────────────────────────
function AddStudentForm({
  form, setForm, batches, onSave, onCancel, saving,
}: {
  form: Record<string, any>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  batches: Batch[];
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <FLabel>First Name</FLabel>
          <Input value={form.firstName || ""} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="First name" required />
        </div>
        <div>
          <FLabel>Last Name</FLabel>
          <Input value={form.lastName || ""} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Last name" required />
        </div>
        <div>
          <FLabel>Email</FLabel>
          <Input type="email" value={form.email || ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="student@email.com" required />
        </div>
        <div>
          <FLabel>Password</FLabel>
          <Input type="password" value={form.password || ""} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" required />
        </div>
        <div>
          <FLabel>Call-up No.</FLabel>
          <Input value={form.callupNo || ""} onChange={(e) => setForm((f) => ({ ...f, callupNo: e.target.value }))} placeholder="MA001" required />
        </div>
        <div>
          <FLabel>Mobile</FLabel>
          <Input value={form.mobile || ""} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} placeholder="07X XXXXXXX" required />
        </div>
        <div className="col-span-2">
          <FLabel>School</FLabel>
          <Input value={form.school || ""} onChange={(e) => setForm((f) => ({ ...f, school: e.target.value }))} placeholder="School name" />
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
          <FLabel>Batch</FLabel>
          <BatchDropdown
            batches={batches}
            value={form.batchId ?? form.batchIds?.[0] ?? ""}
            onChange={(id) => setForm((f) => ({ ...f, batchId: id, batchIds: [id] }))}
            placeholder="Select batch"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Btn v="outline" onClick={onCancel} disabled={saving}>Cancel</Btn>
        <Btn onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Add Student"}
        </Btn>
      </div>
    </div>
  );
}

// ── ProfileModal ───────────────────────────────────────────────────────────────
function ProfileModal({
  open, student, batches, role, editing, setEditing,
  onClose, onSaved, onDeleted,
}: {
  open: boolean;
  student: Student | null;
  batches: Batch[];
  role: Role;
  editing: boolean;
  setEditing: React.Dispatch<React.SetStateAction<boolean>>;
  onClose: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  // ── Profile fetch ──────────────────────────────────────────────────────────
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Confirmations
  const [saveConfirm, setSaveConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Reset password
  const [resetOpen, setResetOpen] = useState(false);
  const [resetForm, setResetForm] = useState({ password: "", confirm: "" });
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Fetch profile whenever student or open changes
  useEffect(() => {
    if (!open || !student) return;
    let cancelled = false;
    setLoading(true);
    setEditing(false);
    setMsg(null);
    setResetOpen(false);
    setResetMsg(null);
    setResetForm({ password: "", confirm: "" });
    (async () => {
      try {
        const res = await getStudentById(student.callupNo);
        const data = res?.data?.data ?? res?.data ?? null;
        if (!cancelled && data) {
          setProfile(data);
          setForm({
            firstName: data.user?.first_name ?? "",
            lastName: data.user?.last_name ?? "",
            callupNo: data.call_up_no ?? "",
            email: data.user?.email ?? "",
            mobile: data.user?.mobile ?? "",
            school: data.school ?? "",
            address: data.user?.address ?? "",
            parentName: data.parent_name ?? "",
            parentMobile: data.parent_mobile ?? "",
            batchId: data.batch_id ?? "",
            active: data.user?.is_active ?? true,
          });
        }
      } catch (err) {
        console.error("Failed to load student profile:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, student?.callupNo]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!student || !profile) return;
    setSaving(true);
    setMsg(null);
    try {
      const payload: Record<string, any> = {
        firstName: form.firstName,
        lastName: form.lastName,
        mobile: form.mobile,
        address: form.address,
        callupNo: form.callupNo,
        school: form.school,
        parentName: form.parentName,
        parentMobile: form.parentMobile,
        batchId: form.batchId,
        batchIds: [form.batchId],
      };
      // Only send isActive if explicitly boolean
      if (typeof form.active === "boolean") {
        payload.isActive = form.active;
      }
      const result = await updateStudent(student.callupNo, payload);
      if (result?.success) {
        setMsg({ ok: true, text: "Profile updated successfully." });
        setEditing(false);
        // Re-fetch profile to refresh stats / batch name
        const res = await getStudentById(student.callupNo);
        const fresh = res?.data?.data ?? res?.data ?? null;
        if (fresh) setProfile(fresh);
        onSaved();
      } else {
        setMsg({ ok: false, text: result?.msg || "Failed to update profile." });
      }
    } catch (err: any) {
      const text = err?.response?.data?.msg ?? err?.message ?? "Failed to update profile.";
      setMsg({ ok: false, text });
    } finally {
      setSaving(false);
      setSaveConfirm(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!student) return;
    setDeleting(true);
    try {
      await deleteStudent(student.callupNo);
      onDeleted();
      onClose();
    } catch (err: any) {
      const text = err?.response?.data?.msg ?? err?.message ?? "Failed to delete student.";
      setMsg({ ok: false, text });
    } finally {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  };

  // ── Reset password ─────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (!student) return;
    if (resetForm.password.length < 6) {
      setResetMsg({ ok: false, text: "Password must be at least 6 characters." });
      return;
    }
    if (resetForm.password !== resetForm.confirm) {
      setResetMsg({ ok: false, text: "Passwords do not match." });
      return;
    }
    setResetting(true);
    setResetMsg(null);
    try {
      const result = await resetStudentPassword(student.callupNo, resetForm.password);
      if (result?.success) {
        setResetMsg({ ok: true, text: "Password reset successfully." });
        setResetForm({ password: "", confirm: "" });
      } else {
        setResetMsg({ ok: false, text: result?.msg || "Failed to reset password." });
      }
    } catch (err: any) {
      const text = err?.response?.data?.msg ?? err?.message ?? "Failed to reset password.";
      setResetMsg({ ok: false, text });
    } finally {
      setResetting(false);
    }
  };

  // ── Derived counts ─────────────────────────────────────────────────────────
  const attendCount = profile?.attendance?.length ?? 0;
  const paymentCount = profile?.payment?.length ?? 0;
  const marksCount = profile?.student_marks?.length ?? 0;

  // ── Helper: read-only field with double-click ──────────────────────────────
  const Field = ({ label, keyName, placeholder = "", readOnlyAlways = false }: {
    label: string; keyName: string; placeholder?: string; readOnlyAlways?: boolean;
  }) => (
    <div onDoubleClick={() => { if (!readOnlyAlways) setEditing(true); }}>
      <FLabel>{label}</FLabel>
      <Input
        value={(form as any)[keyName] ?? ""}
        readOnly={!editing || readOnlyAlways}
        onChange={(e) => setForm((f) => ({ ...f, [keyName]: e.target.value }))}
        placeholder={placeholder}
        className={(!editing || readOnlyAlways) ? "opacity-70 cursor-default" : ""}
      />
    </div>
  );

  // ── Activation depends on the selected batch ─────────────────────────────
  // A student can only be active while their batch is active.
  const selectedBatch = batches.find((b) => b.id === (form.batchId || profile?.batch_id));
  const batchActive = selectedBatch ? selectedBatch.active : false;

  if (!student) return null;

  return (
    <>
      <div className="space-y-6">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading profile…</p>
        ) : (
          <>
            {/* ── Header ── */}
            <div className="flex items-start gap-5">
              <Avatar name={student.fullName} size="xl" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-foreground">
                    {profile?.user?.first_name} {profile?.user?.last_name}
                  </h3>
                  <Badge v={form.active ? "success" : "danger"}>
                    {form.active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {profile?.school ?? student.school}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {profile?.call_up_no ?? student.callupNo}
                  {profile?.user?.email ? ` · ${profile.user.email}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Registered {fmtDate(profile?.user?.createdAt ?? student.registrationDate)}
                </p>
              </div>

              {/* Action buttons (view mode) */}
              {role === "admin" && !editing && (
                <div className="flex items-center gap-2 shrink-0">
                  <Btn v="outline" sz="sm" onClick={() => setEditing(true)}>
                    <Edit2 className="w-3.5 h-3.5" />Edit
                  </Btn>
                  <Btn v="ghost" sz="sm" onClick={() => { setResetOpen((p) => !p); setResetMsg(null); }} className="text-muted-foreground">
                    <KeyRound className="w-3.5 h-3.5" />Reset Password
                  </Btn>
                  <Btn v="ghost" sz="sm" onClick={() => setDeleteConfirm(true)} className="text-red-500 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />Delete
                  </Btn>
                </div>
              )}

              {/* Cancel button (edit mode) */}
              {editing && (
                <Btn v="outline" sz="sm" onClick={() => setEditing(false)} className="shrink-0">
                  Cancel
                </Btn>
              )}
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="Classes Attended" value={attendCount} icon={CalendarCheck} color="navy" />
              <StatCard label="Payments Made" value={paymentCount} icon={Wallet} color="emerald" />
              <StatCard label="Papers Taken" value={marksCount} icon={FileText} color="blue" />
            </div>

            {/* ── Status toggle (edit mode only) ── */}
            {editing && (
              <div className="flex items-center gap-3">
                <label className={cn(
                  "relative inline-flex items-center",
                  batchActive ? "cursor-pointer" : "cursor-not-allowed opacity-60",
                )}>
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={batchActive && (form.active ?? true)}
                    disabled={!batchActive}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  <div className="w-9 h-5 bg-muted-foreground/30 peer-checked:bg-emerald-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
                </label>
                <span className="text-sm font-medium">
                  {batchActive && form.active ? "Active" : "Inactive"}
                </span>
                {!batchActive && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Activation requires an active batch
                  </span>
                )}
              </div>
            )}

            {/* ── Details grid ── */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="First Name" keyName="firstName" />
              <Field label="Last Name" keyName="lastName" />
              <Field label="Call-up No." keyName="callupNo" />
              <Field label="Mobile" keyName="mobile" />
              <div>
                <FLabel>Email</FLabel>
                <Input value={form.email ?? ""} readOnly className="opacity-70 cursor-default" title="Email cannot be changed" />
              </div>
              <div>
                <FLabel>Batch</FLabel>
                {editing ? (
                  <BatchDropdown
                    batches={batches}
                    value={form.batchId ?? ""}
                    onChange={(id) =>
                      setForm((f) => {
                        const b = batches.find((x) => x.id === id);
                        // Moving to an inactive batch forces the student inactive
                        return { ...f, batchId: id, ...(b && !b.active ? { active: false } : {}) };
                      })
                    }
                    placeholder="Select batch"
                  />
                ) : (
                  <div className="px-3 py-2 text-sm border border-border rounded-lg bg-muted/30 text-foreground">
                    {profile?.batch?.name ?? "—"}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <Field label="School" keyName="school" />
              </div>
              <div className="col-span-2">
                <Field label="Address" keyName="address" />
              </div>
              <Field label="Parent Name" keyName="parentName" />
              <Field label="Parent Mobile" keyName="parentMobile" />
            </div>

            {/* ── Hint ── */}
            {!editing && role === "admin" && (
              <p className="text-center text-xs text-muted-foreground">
                Double-click any field or click <strong>Edit</strong> to start editing
              </p>
            )}

            {/* ── Inline status message ── */}
            {msg && (
              <div className={`text-sm p-3 rounded-lg ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                {msg.text}
              </div>
            )}

            {/* ── Reset password inline form ── */}
            {resetOpen && (
              <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
                <h4 className="text-sm font-semibold text-foreground">Reset Password</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FLabel>New Password</FLabel>
                    <Input
                      type="password"
                      value={resetForm.password}
                      onChange={(e) => setResetForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 6 characters"
                    />
                  </div>
                  <div>
                    <FLabel>Confirm Password</FLabel>
                    <Input
                      type="password"
                      value={resetForm.confirm}
                      onChange={(e) => setResetForm((f) => ({ ...f, confirm: e.target.value }))}
                      placeholder="Re-enter password"
                    />
                  </div>
                </div>
                {resetMsg && (
                  <p className={`text-xs ${resetMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                    {resetMsg.text}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <Btn v="outline" sz="sm" onClick={() => { setResetOpen(false); setResetMsg(null); }}>Cancel</Btn>
                  <Btn sz="sm" onClick={handleResetPassword} disabled={resetting}>
                    {resetting ? "Resetting…" : "Reset Password"}
                  </Btn>
                </div>
              </div>
            )}

            {/* ── Save button (edit mode) ── */}
            {editing && (
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Btn v="outline" onClick={() => setEditing(false)} disabled={saving}>Cancel</Btn>
                <Btn onClick={() => setSaveConfirm(true)} disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </Btn>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Save confirmation dialog ── */}
      <ConfirmDialog
        open={saveConfirm}
        title="Confirm Changes"
        message={`Save the updated details for ${student.fullName}?`}
        confirmLabel="Yes, Save"
        busy={saving}
        onConfirm={handleSave}
        onCancel={() => setSaveConfirm(false)}
      />

      {/* ── Delete confirmation dialog ── */}
      <ConfirmDialog
        open={deleteConfirm}
        danger
        title="Delete Student"
        message={
          <div className="space-y-1">
            <p><strong>{student.fullName}</strong> ({student.callupNo})</p>
            <p className="text-muted-foreground">All attendance, payment, and mark records will be permanently removed. This cannot be undone.</p>
          </div>
        }
        confirmLabel="Delete Student"
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(false)}
      />
    </>
  );
}

// ── StudentsPage ───────────────────────────────────────────────────────────────
interface StudentsPageProps {
  batches: Batch[];
  attendance: AttendanceRecord[];
  payments: Payment[];
  marks: Mark[];
  role: Role;
}

export function StudentsPage({ batches: _batches, attendance, payments, marks, role }: StudentsPageProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, pageSize: 12, totalRecords: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<"add" | "profile" | null>(null);
  const [selected, setSelected] = useState<Student | null>(null);
  const [profileEditing, setProfileEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [allBatches, setAllBatches] = useState<Batch[]>(_batches);

  // ── Fetch all batches (active + inactive) for dropdowns ────────────────────
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
          examDate: b.exam_date ?? b.examDate ?? "",
          active: b.is_active ?? b.active ?? true,
          day: b.day ?? "",
        }));
        setAllBatches(mapped);
      } catch (err) {
        console.error("Failed to fetch batches:", err);
      }
    })();
  }, []);

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

  // ── Fetch students from API ───────────────────────────────────────────────
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

  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  // ── Client-side batch + status filters ────────────────────────────────────
  const filtered = useMemo(() => students.filter((s) => {
    const matchBatch = batchFilter === "all" || s.batchIds.includes(batchFilter);
    const matchStatus = statusFilter === "all" || (statusFilter === "active" ? s.active : !s.active);
    return matchBatch && matchStatus;
  }), [students, batchFilter, statusFilter]);

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm({ active: true, registrationDate: new Date().toISOString().split("T")[0] });
    setModal("add");
  };
  const openProfile = (s: Student, startInEdit = false) => {
    setSelected(s);
    setProfileEditing(startInEdit);
    setModal("profile");
  };

  // ── Add Student save ──────────────────────────────────────────────────────
  const saveAdd = async () => {
    setSaving(true);
    try {
      if (!(form as any).firstName?.trim() || !(form as any).lastName?.trim()) {
        alert("First name and last name are required.");
        setSaving(false);
        return;
      }
      if (!(form as any).email?.trim()) { alert("Email is required."); setSaving(false); return; }
      if (!(form as any).password || (form as any).password.length < 6) {
        alert("Password must be at least 6 characters.");
        setSaving(false);
        return;
      }
      await addStudent(form);
      setModal(null);
      fetchStudents();
    } catch (error: any) {
      const msg = error?.response?.data?.msg ?? error?.message ?? "An error occurred";
      alert("Failed to save student: " + msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
          <BatchDropdown
            className="sm:w-44"
            batches={allBatches}
            value={batchFilter}
            onChange={setBatchFilter}
            includeAll
            placeholder="All Batches"
          />
          <select
            className="sm:w-36 px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
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
                        const b = allBatches.find((x) => x.id === bid);
                        return b ? <Badge key={bid} v="default">{b.name}</Badge> : null;
                      })}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge v={s.active ? "success" : "danger"}>{s.active ? "Active" : "Inactive"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {/* <button onClick={() => openProfile(s, false)} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="View Profile">
                        <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                      </button> */}
                      {role === "admin" && (
                        <>
                          <button onClick={() => openProfile(s, true)} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="Edit">
                            <Info className="w-3.5 h-3.5 text-muted-foreground" />
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm(`Delete ${s.fullName} (${s.callupNo})? This cannot be undone.`)) return;
                            try {
                              await deleteStudent(s.callupNo);
                              fetchStudents();
                            } catch (err: any) {
                              alert("Failed to delete: " + (err?.response?.data?.msg ?? err?.message));
                            }
                          }} className="p-1.5 hover:bg-muted rounded-lg transition-colors" title="Delete">
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
        <AddStudentForm
          form={form}
          setForm={setForm}
          batches={allBatches}
          onSave={saveAdd}
          onCancel={() => setModal(null)}
          saving={saving}
        />
      </Modal>

      {/* ── Unified Profile Modal ── */}
      <Modal open={modal === "profile" && !!selected} onClose={() => setModal(null)} title="Student Profile" wide>
        {selected && (
          <ProfileModal
            open={modal === "profile"}
            student={selected}
            batches={allBatches}
            role={role}
            editing={profileEditing}
            setEditing={setProfileEditing}
            onClose={() => setModal(null)}
            onSaved={fetchStudents}
            onDeleted={fetchStudents}
          />
        )}
      </Modal>
    </div>
  );
}
