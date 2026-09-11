import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, Edit2, Search, Trash2 } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card, ConfirmDialog } from "../ui";
import { FLabel } from "../ui";
import { fmtCur, cn } from "../../lib/utils";
import type { Batch, Student, Role } from "../../lib/types";
import { getAllBatches, addBatch, updateBatch, deleteBatch } from "../../api/apiCalls";
import Pagination from "../ui/Pagination";

interface BatchesPageProps {
  students: Student[];
  role: Role;
}

/** Splits text by a search term and wraps matches in <mark> */
function HighlightText({ text, term }: { text: string; term: string }) {
  if (!term.trim()) return <>{text}</>;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === term.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-amber-200 px-0.5 text-inherit dark:bg-amber-800/60">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "14:30" / "14:30:00" / ISO datetime → "2:30 PM" (falls back to the raw value) */
function fmtTime(t?: string | null): string {
  if (!t) return "—";
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  if (!m) return t;
  const h24 = +m[1];
  const min = m[2];
  const ap = h24 >= 12 ? "PM" : "AM";
  const h = h24 % 12 || 12;
  return `${h}:${min} ${ap}`;
}

// Mirror of the backend validation (batch.service.js) — runs before submit
function validateForm(form: Partial<Batch>, isAdd: boolean): Record<string, string> {
  const errs: Record<string, string> = {};
  const has = (v: any) => v !== undefined && v !== null && v !== "";
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (!has(form.name) || !String(form.name).trim()) errs.name = "Batch name is required";
  else if (String(form.name).trim().length > 100) errs.name = "Must be at most 100 characters";
  if (!has(form.day)) errs.day = "Select a day";
  if (isAdd && !has(form.examDate)) errs.examDate = "Exam date is required";
  if (has(form.examDate) && isNaN(new Date(String(form.examDate)).getTime())) errs.examDate = "Enter a valid date";
  if (!has(form.startTime)) errs.startTime = "Start time is required";
  else if (has(form.startTime) && !TIME_RE.test(String(form.startTime))) errs.startTime = "Use HH:MM 24-hour format";
  if (!has(form.endTime)) errs.endTime = "End time is required";
  else if (has(form.endTime) && !TIME_RE.test(String(form.endTime))) errs.endTime = "Use HH:MM 24-hour format";
  else if (has(form.startTime) && has(form.endTime) && String(form.startTime) >= String(form.endTime))
    errs.endTime = "Must be after start time";
  if (!has(form.fee) || !(Number(form.fee) > 0)) errs.fee = "Must be a positive number";

  return errs;
}

function BatchForm({
  form,
  setForm,
  modal,
  onSave,
  onCancel,
  saving,
  errors,
  clearError,
  formError,
  onDelete,
}: {
  form: Partial<Batch>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Batch>>>;
  modal: "add" | "edit" | null;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  errors: Record<string, string>;
  clearError: (key: string) => void;
  formError: string | null;
  onDelete: (() => void) | null;
}) {
  const errCls = "border-red-500 focus:ring-red-500/40";
  const field = (key: string, el: React.ReactNode) => (
    <>
      {el}
      {errors[key] && <p className="mt-1 text-xs text-red-600">{errors[key]}</p>}
    </>
  );

  return (
    <div className="space-y-4">
      {formError && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{formError}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <FLabel>Batch Name</FLabel>
          {field("name",
            <Input
              value={form.name || ""}
              onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); clearError("name"); }}
              placeholder="e.g. Batch A — 2025"
              className={errors.name ? errCls : ""}
            />
          )}
        </div>
        <div>
          <FLabel>Day</FLabel>
          {field("day",
            <Sel
              value={form.day || ""}
              onChange={(e) => { setForm((f) => ({ ...f, day: e.target.value })); clearError("day"); }}
              className={errors.day ? errCls : ""}
            >
              <option value="">Select day</option>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </Sel>
          )}
        </div>
        <div>
          <FLabel>Exam Date</FLabel>
          {field("examDate",
            <Input
              type="date"
              value={form.examDate || ""}
              onChange={(e) => { setForm((f) => ({ ...f, examDate: e.target.value })); clearError("examDate"); }}
              className={errors.examDate ? errCls : ""}
            />
          )}
        </div>
        <div>
          <FLabel>Start Time</FLabel>
          {field("startTime",
            <Input
              type="time"
              value={form.startTime || ""}
              onChange={(e) => { setForm((f) => ({ ...f, startTime: e.target.value })); clearError("startTime"); }}
              className={errors.startTime ? errCls : ""}
            />
          )}
        </div>
        <div>
          <FLabel>End Time</FLabel>
          {field("endTime",
            <Input
              type="time"
              value={form.endTime || ""}
              onChange={(e) => { setForm((f) => ({ ...f, endTime: e.target.value })); clearError("endTime"); }}
              className={errors.endTime ? errCls : ""}
            />
          )}
        </div>
        <div>
          <FLabel>Monthly Fee (LKR)</FLabel>
          {field("fee",
            <Input
              type="number"
              value={form.fee || ""}
              onChange={(e) => { setForm((f) => ({ ...f, fee: +e.target.value })); clearError("fee"); }}
              placeholder="3500"
              className={errors.fee ? errCls : ""}
            />
          )}
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <button
              type="button"
              role="switch"
              aria-checked={form.active ?? true}
              onClick={() => setForm((f) => ({ ...f, active: !(f.active ?? true) }))}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                (form.active ?? true) ? "bg-emerald-500" : "bg-muted/60",
              )}
            >
              <span
                className={cn(
                  "pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform",
                  (form.active ?? true) ? "translate-x-5" : "translate-x-0",
                )}
              />
            </button>
            <span className="text-sm font-medium">Active Batch</span>
          </label>
        </div>
        <p className="col-span-2 -mt-1 text-xs text-muted-foreground">
          Deactivating a batch also deactivates all its students; activating it reactivates them.
        </p>
      </div>
      <div className="flex items-center gap-2 pt-2">
        {onDelete && (
          <Btn
            v="outline"
            onClick={onDelete}
            disabled={saving}
            className="justify-center text-red-600 hover:text-red-700 hover:border-red-300"
          >
            <Trash2 className="w-4 h-4" /> Delete Batch
          </Btn>
        )}
        <div className="flex justify-end gap-2 ml-auto">
          <Btn v="outline" onClick={onCancel} disabled={saving}>Cancel</Btn>
          <Btn onClick={onSave} disabled={saving}>
            {saving ? "Saving…" : modal === "add" ? "Create Batch" : "Save Changes"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

export function BatchesPage({ role }: BatchesPageProps) {
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<Batch | null>(null);
  const [form, setForm] = useState<Partial<Batch>>({});
  const [batches, setLocalBatches] = useState<Batch[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, pageSize: 12, totalRecords: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Batch | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const clearError = useCallback((key: string) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(v);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
  };

  const fetchBatches = useCallback(async () => {
    try {
      const result = await getAllBatches(pagination.page, pagination.pageSize, search);
      const backendBatches = result?.data?.data ?? [];
      const meta = result?.data?.meta ?? {};
      setPagination((prev) => ({
        page: meta.page ?? prev.page,
        totalPages: meta.pages ?? prev.totalPages,
        pageSize: meta.limit ?? prev.pageSize,
        totalRecords: meta.total ?? prev.totalRecords,
      }));
      const mapped: Batch[] = backendBatches.map((b: any) => ({
        id: b.id,
        name: b.name,
        fee: b.class_fee,
        startTime: b.start_time,
        endTime: b.end_time,
        examDate: b.exam_date ? (typeof b.exam_date === "string" ? b.exam_date : b.exam_date.split("T")[0]) : "",
        active: b.is_active,
        day: b.day,
        studentCount: b._count?.student ?? 0,
      }));
      setLocalBatches(mapped);
    } catch (error) {
      console.error("Error fetching batches:", error);
    }
  }, [pagination.page, pagination.pageSize, search]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const save = async () => {
    const errs = validateForm(form, modal === "add");
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    setFormError(null);
    try {
      const body = {
        name: form.name,
        examDate: form.examDate,
        fee: form.fee,
        startTime: form.startTime,
        endTime: form.endTime,
        active: form.active,
        day: form.day,
      };
      if (modal === "add") {
        await addBatch(body);
      } else if (modal === "edit" && selected) {
        await updateBatch(selected.id, body);
      }
      setModal(null);
      fetchBatches();
    } catch (error: any) {
      console.error("Failed to save batch:", error);
      setFormError(error?.response?.data?.msg ?? "Failed to save batch. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBatch(deleteTarget.id);
      setDeleteTarget(null);
      setModal(null);
      fetchBatches();
    } catch (error) {
      console.error("Failed to delete batch:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Batches</h1>
          <p className="text-sm text-muted-foreground">{batches.filter((b) => b.active).length} active batches</p>
        </div>
        {role === "admin" && (
          <Btn onClick={() => { setForm({ active: true }); setErrors({}); setFormError(null); setModal("add"); }}>
            <Plus className="w-4 h-4" />New Batch
          </Btn>
        )}
      </div>

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search batches…" value={searchInput} onChange={handleSearchChange} />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...batches].sort((a, b) => (a.active === b.active ? 0 : a.active ? -1 : 1)).map((b) => (
          <Card key={b.id} className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-foreground"><HighlightText text={b.name} term={search} /></h3>
                <p className="text-xs text-muted-foreground mt-0.5 truncate" title={`${b.day} · ${fmtTime(b.startTime)} – ${fmtTime(b.endTime)}`}>
                  {b.day} · {fmtTime(b.startTime)} – {fmtTime(b.endTime)}
                </p>
                {b.examDate && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">Exam: {b.examDate}</p>
                )}
              </div>
              <Badge v={b.active ? "success" : "muted"}>{b.active ? "Active" : "Inactive"}</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-lg font-bold font-mono text-foreground">{b.studentCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Students</p>
              </div>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-lg font-bold font-mono text-foreground">{fmtCur(b.fee)}</p>
                <p className="text-xs text-muted-foreground">Monthly Fee</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {role === "admin" && (
                <Btn v="outline" sz="sm" className="flex-1 justify-center" onClick={() => { setSelected(b); setForm({ ...b }); setErrors({}); setFormError(null); setModal("edit"); }}>
                  <Edit2 className="w-3.5 h-3.5" /> Edit
                </Btn>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Pagination page={pagination.page} totalPages={pagination.totalPages} pageSize={pagination.pageSize} totalRecords={pagination.totalRecords} setPagination={setPagination} />

      <Modal open={modal === "add"} onClose={() => setModal(null)} title="Create New Batch">
        <BatchForm form={form} setForm={setForm} modal={modal} onSave={save} onCancel={() => setModal(null)} saving={saving} errors={errors} clearError={clearError} formError={formError} onDelete={null} />
      </Modal>
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Edit Batch">
        <BatchForm form={form} setForm={setForm} modal={modal} onSave={save} onCancel={() => setModal(null)} saving={saving} errors={errors} clearError={clearError} formError={formError} onDelete={() => setDeleteTarget(selected)} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Batch"
        message={
          <span>
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </span>
        }
        confirmLabel="Delete"
        danger
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
