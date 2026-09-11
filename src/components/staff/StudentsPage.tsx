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

// ── Validation helpers ─────────────────────────────────────────────────────────
type FieldErrors = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MOBILE_RE = /^[0-9+\-()\s]{7,20}$/;
const PASSWORD_MIN = 6;
// Max-length rules — mirror backend/src/services/student.service.js
const NAME_MAX = 100; // first/last name, parent name
const TEXT_MAX = 255; // address
const SCHOOL_MAX = 150;
const CALL_UP_NO_MAX = 50;

// validateStudentForm(form) → per-field error messages. All fields are required
// (mirrors backend rules). includePassword/includeEmail default to true.
function validateStudentForm(
  form: Record<string, any>,
  { includePassword = true, includeEmail = true }: { includePassword?: boolean; includeEmail?: boolean } = {},
): FieldErrors {
  const errs: FieldErrors = {};
  const required: Array<[string, string]> = [
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["callupNo", "Call-up No."],
    ["mobile", "Mobile"],
    ["school", "School"],
    ["address", "Address"],
    ["parentName", "Parent name"],
    ["parentMobile", "Parent mobile"],
    ["batchId", "Batch"],
  ];
  if (includePassword) required.push(["password", "Password"]);
  if (includeEmail) required.push(["email", "Email"]);

  for (const [key, label] of required) {
    if (!String(form[key] ?? "").trim()) errs[key] = `${label} is required.`;
  }

  const email = String(form.email ?? "").trim();
  if (includeEmail && email && !EMAIL_RE.test(email)) {
    errs.email = "Enter a valid email address.";
  }

  const mobile = String(form.mobile ?? "").trim();
  if (mobile && !MOBILE_RE.test(mobile)) {
    errs.mobile = "Enter a valid mobile number.";
  }

  const parentMobile = String(form.parentMobile ?? "").trim();
  if (parentMobile && !MOBILE_RE.test(parentMobile)) {
    errs.parentMobile = "Enter a valid mobile number.";
  }

  const password = String(form.password ?? "");
  if (includePassword && password && password.length < PASSWORD_MIN) {
    errs.password = `Password must be at least ${PASSWORD_MIN} characters.`;
  }

  // Max lengths — must match the backend, which 400s on oversized fields
  const maxLengths: Array<[string, string, number]> = [
    ["firstName", "First name", NAME_MAX],
    ["lastName", "Last name", NAME_MAX],
    ["callupNo", "Call-up No.", CALL_UP_NO_MAX],
    ["school", "School", SCHOOL_MAX],
    ["address", "Address", TEXT_MAX],
    ["parentName", "Parent name", NAME_MAX],
  ];
  for (const [key, label, max] of maxLengths) {
    const val = String(form[key] ?? "").trim();
    if (val.length > max) errs[key] = `${label} must be at most ${max} characters.`;
  }

  return errs;
}

// ── AddFormField ──────────────────────────────────────────────────────────────
// Module-level so the input is never remounted: a component defined INSIDE
// another component is a new type on every render, which makes React replace
// the input (and drop focus) after the first keystroke.
function AddFormField({
  label, type, placeholder, span, value, error, onChange,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  span?: boolean;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <FLabel>{label}</FLabel>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className={error ? "border-red-500 focus:ring-red-500/40" : ""}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── ProfileField ──────────────────────────────────────────────────────────────
// Read-only field by default; double-click (or the Edit button) starts editing.
// Module-level so the input is never remounted (see AddFormField note).
function ProfileField({
  label, value, placeholder = "", readOnly, error, onStartEdit, onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  readOnly?: boolean;
  error?: string;
  onStartEdit?: () => void;
  onChange?: (value: string) => void;
}) {
  return (
    <div onDoubleClick={onStartEdit}>
      <FLabel>{label}</FLabel>
      <Input
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className={cn(
          readOnly ? "opacity-70 cursor-default" : "",
          error ? "border-red-500 focus:ring-red-500/40" : "",
        )}
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── AddStudentForm ─────────────────────────────────────────────────────────────
function AddStudentForm({
  form, setForm, batches, errors, clearError, msg, onSave, onCancel, saving,
}: {
  form: Record<string, any>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  batches: Batch[];
  errors: FieldErrors;
  clearError: (key: string) => void;
  msg: { ok: boolean; text: string } | null;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <AddFormField
          label="First Name"
          value={String(form.firstName ?? "")}
          error={errors.firstName}
          onChange={(v) => { setForm((f) => ({ ...f, firstName: v })); clearError("firstName"); }}
          placeholder="First name"
        />
        <AddFormField
          label="Last Name"
          value={String(form.lastName ?? "")}
          error={errors.lastName}
          onChange={(v) => { setForm((f) => ({ ...f, lastName: v })); clearError("lastName"); }}
          placeholder="Last name"
        />
        <AddFormField
          label="Email"
          type="email"
          value={String(form.email ?? "")}
          error={errors.email}
          onChange={(v) => { setForm((f) => ({ ...f, email: v })); clearError("email"); }}
          placeholder="student@email.com"
        />
        <AddFormField
          label="Password"
          type="password"
          value={String(form.password ?? "")}
          error={errors.password}
          onChange={(v) => { setForm((f) => ({ ...f, password: v })); clearError("password"); }}
          placeholder="Min. 8 characters"
        />
        <AddFormField
          label="Call-up No."
          value={String(form.callupNo ?? "")}
          error={errors.callupNo}
          onChange={(v) => { setForm((f) => ({ ...f, callupNo: v })); clearError("callupNo"); }}
          placeholder="MA001"
        />
        <AddFormField
          label="Mobile"
          value={String(form.mobile ?? "")}
          error={errors.mobile}
          onChange={(v) => { setForm((f) => ({ ...f, mobile: v })); clearError("mobile"); }}
          placeholder="07X XXXXXXX"
        />
        <AddFormField
          label="School"
          span
          value={String(form.school ?? "")}
          error={errors.school}
          onChange={(v) => { setForm((f) => ({ ...f, school: v })); clearError("school"); }}
          placeholder="School name"
        />
        <AddFormField
          label="Address"
          span
          value={String(form.address ?? "")}
          error={errors.address}
          onChange={(v) => { setForm((f) => ({ ...f, address: v })); clearError("address"); }}
          placeholder="Full address"
        />
        <AddFormField
          label="Parent Name"
          value={String(form.parentName ?? "")}
          error={errors.parentName}
          onChange={(v) => { setForm((f) => ({ ...f, parentName: v })); clearError("parentName"); }}
          placeholder="Parent/guardian name"
        />
        <AddFormField
          label="Parent Mobile"
          value={String(form.parentMobile ?? "")}
          error={errors.parentMobile}
          onChange={(v) => { setForm((f) => ({ ...f, parentMobile: v })); clearError("parentMobile"); }}
          placeholder="07X XXXXXXX"
        />
        <div className="col-span-2">
          <FLabel>Batch</FLabel>
          <BatchDropdown
            batches={batches}
            value={form.batchId ?? form.batchIds?.[0] ?? ""}
            onChange={(id) => {
              setForm((f) => ({ ...f, batchId: id, batchIds: [id] }));
              clearError("batchId");
            }}
            placeholder="Select batch"
          />
          {errors.batchId && <p className="mt-1 text-xs text-red-600">{errors.batchId}</p>}
        </div>
      </div>

      {msg && (
        <div className={`text-sm p-3 rounded-lg ${msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {msg.text}
        </div>
      )}

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
  const [errors, setErrors] = useState<FieldErrors>({});

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
    setErrors({});
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

  // ── Helper: clear a single field error as the user types (edit mode) ──────
  const clearFieldError = (key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  // ── Validate before opening the save confirmation dialog ───────────────────
  const handleSaveClick = () => {
    // Email is read-only in edit mode — skip it; password is not part of editing
    const errs = validateStudentForm(form, { includePassword: false, includeEmail: false });
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setMsg({ ok: false, text: "Please fix the highlighted fields before saving." });
      return;
    }
    setMsg(null);
    setSaveConfirm(true);
  };

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
              <ProfileField
                label="First Name"
                value={String(form.firstName ?? "")}
                readOnly={!editing}
                error={errors.firstName}
                onStartEdit={() => setEditing(true)}
                onChange={(v) => { setForm((f) => ({ ...f, firstName: v })); clearFieldError("firstName"); }}
              />
              <ProfileField
                label="Last Name"
                value={String(form.lastName ?? "")}
                readOnly={!editing}
                error={errors.lastName}
                onStartEdit={() => setEditing(true)}
                onChange={(v) => { setForm((f) => ({ ...f, lastName: v })); clearFieldError("lastName"); }}
              />
              <ProfileField
                label="Call-up No."
                value={String(form.callupNo ?? "")}
                readOnly={!editing}
                error={errors.callupNo}
                onStartEdit={() => setEditing(true)}
                onChange={(v) => { setForm((f) => ({ ...f, callupNo: v })); clearFieldError("callupNo"); }}
              />
              <ProfileField
                label="Mobile"
                value={String(form.mobile ?? "")}
                readOnly={!editing}
                error={errors.mobile}
                onStartEdit={() => setEditing(true)}
                onChange={(v) => { setForm((f) => ({ ...f, mobile: v })); clearFieldError("mobile"); }}
              />
              <div>
                <FLabel>Email</FLabel>
                <Input value={form.email ?? ""} readOnly className="opacity-70 cursor-default" title="Email cannot be changed" />
              </div>
              <div>
                <FLabel>Batch</FLabel>
                {editing ? (
                  <>
                    <BatchDropdown
                      batches={batches}
                      value={form.batchId ?? ""}
                      onChange={(id) => {
                        setForm((f) => {
                          const b = batches.find((x) => x.id === id);
                          // Moving to an inactive batch forces the student inactive
                          return { ...f, batchId: id, ...(b && !b.active ? { active: false } : {}) };
                        });
                        setErrors((prev) => {
                          if (!prev.batchId) return prev;
                          const n = { ...prev };
                          delete n.batchId;
                          return n;
                        });
                      }}
                      placeholder="Select batch"
                    />
                    {errors.batchId && <p className="mt-1 text-xs text-red-600">{errors.batchId}</p>}
                  </>
                ) : (
                  <div className="px-3 py-2 text-sm border border-border rounded-lg bg-muted/30 text-foreground">
                    {profile?.batch?.name ?? "—"}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <ProfileField
                  label="School"
                  value={String(form.school ?? "")}
                  readOnly={!editing}
                  error={errors.school}
                  onStartEdit={() => setEditing(true)}
                  onChange={(v) => { setForm((f) => ({ ...f, school: v })); clearFieldError("school"); }}
                />
              </div>
              <div className="col-span-2">
                <ProfileField
                  label="Address"
                  value={String(form.address ?? "")}
                  readOnly={!editing}
                  error={errors.address}
                  onStartEdit={() => setEditing(true)}
                  onChange={(v) => { setForm((f) => ({ ...f, address: v })); clearFieldError("address"); }}
                />
              </div>
              <ProfileField
                label="Parent Name"
                value={String(form.parentName ?? "")}
                readOnly={!editing}
                error={errors.parentName}
                onStartEdit={() => setEditing(true)}
                onChange={(v) => { setForm((f) => ({ ...f, parentName: v })); clearFieldError("parentName"); }}
              />
              <ProfileField
                label="Parent Mobile"
                value={String(form.parentMobile ?? "")}
                readOnly={!editing}
                error={errors.parentMobile}
                onStartEdit={() => setEditing(true)}
                onChange={(v) => { setForm((f) => ({ ...f, parentMobile: v })); clearFieldError("parentMobile"); }}
              />
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
                <Btn onClick={handleSaveClick} disabled={saving}>
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
  const [addErrors, setAddErrors] = useState<FieldErrors>({});
  const [addMsg, setAddMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
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
    setAddErrors({});
    setAddMsg(null);
    setModal("add");
  };
  const openProfile = (s: Student, startInEdit = false) => {
    setSelected(s);
    setProfileEditing(startInEdit);
    setModal("profile");
  };

  // Clear a single add-form field error as the user types
  const clearAddError = (key: string) => {
    setAddErrors((prev) => {
      if (!prev[key]) return prev;
      const n = { ...prev };
      delete n[key];
      return n;
    });
  };

  // ── Add Student save ──────────────────────────────────────────────────────
  const saveAdd = async () => {
    const errs = validateStudentForm(form);
    setAddErrors(errs);
    if (Object.keys(errs).length > 0) {
      setAddMsg({ ok: false, text: "Please fix the highlighted fields before saving." });
      return;
    }
    setSaving(true);
    setAddMsg(null);
    try {
      await addStudent(form);
      setModal(null);
      setForm({});
      setAddErrors({});
      setAddMsg(null);
      fetchStudents();
    } catch (error: any) {
      setAddMsg({ ok: false, text: error?.response?.data?.msg ?? error?.message ?? "Failed to save student." });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete from table (with confirmation dialog) ──────────────────────────
  const handleDeleteRow = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      await deleteStudent(deleteTarget.callupNo);
      setDeleteTarget(null);
      fetchStudents();
    } catch (err: any) {
      setDeleteMsg(err?.response?.data?.msg ?? err?.message ?? "Failed to delete student.");
    } finally {
      setDeleting(false);
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
                          <button
                            onClick={() => { setDeleteMsg(null); setDeleteTarget(s); }}
                            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
                            title="Delete"
                          >
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
          errors={addErrors}
          clearError={clearAddError}
          msg={addMsg}
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

      {/* ── Delete confirmation dialog (table row) ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        danger
        title="Delete Student"
        message={
          <div className="space-y-1">
            <p>
              <strong>{deleteTarget?.fullName}</strong> ({deleteTarget?.callupNo})
            </p>
            <p className="text-muted-foreground">
              All attendance, payment, and mark records will be permanently removed. This cannot be undone.
            </p>
            {deleteMsg && <p className="pt-1 text-xs text-red-600">{deleteMsg}</p>}
          </div>
        }
        confirmLabel="Delete Student"
        busy={deleting}
        onConfirm={handleDeleteRow}
        onCancel={() => { setDeleteTarget(null); setDeleteMsg(null); }}
      />
    </div>
  );
}
