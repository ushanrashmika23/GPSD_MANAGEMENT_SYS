import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, Video, Upload, Pen, Trash2, BookMarked, Search, X, Play, Eye, BookOpen, User, CheckCircle, AlertCircle, Calendar, ShieldOff, ShieldCheck, Clock, ChevronDown } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card } from "../ui";
import { EmptyState } from "../ui";
import { FLabel } from "../ui";
import { fmtDate } from "../../lib/utils";
import type { Material, Batch, Role } from "../../lib/types";
import type { Lesson } from "./LessonsPage";
import { getAllMaterials, addMaterial, updateMaterial, deleteMaterial, getAllLessons, getAllBatches, getMaterialAccesses, grantBatchAccess, revokeBatchAccess } from "../../api/apiCalls";
import Pagination from "../ui/Pagination";

interface MaterialsPageProps {
  role: Role;
}

// ── Upload task tracked in background ──────────────────────────────────────
interface UploadTask {
  id: string;
  fileName: string;
  progress: number; // 0–100
  status: "uploading" | "complete" | "error";
  errorMsg?: string;
}

// ── Material access record from backend ─────────────────────────────────────
interface MaterialAccessRecord {
  id: string;          // access record id (for revoke)
  batch_id: string;
  batchName: string;   // from batch.name
  material_id: string;
  expiry_date: string | null;
}

// ── Default expiry: now + 7 days (YYYY-MM-DD) ──────────────────────────────
const defaultExpiryDate = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().split("T")[0];
};

// ── Circular progress ring (bottom-right floating widget) ──────────────────
function CircularProgress({ task, onDismiss }: { task: UploadTask; onDismiss: () => void }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (task.progress / 100) * circumference;
  const isDone = task.status === "complete";
  const isError = task.status === "error";

  return (
    <div className="fixed bottom-6 right-6 z-[60] animate-in slide-in-from-right-4 duration-300">
      <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex items-center gap-3 min-w-[240px]">
        {/* Ring */}
        <div className="relative w-[64px] h-[64px] shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
            {/* Background track */}
            <circle
              cx="32" cy="32" r={r}
              fill="none"
              strokeWidth="5"
              className="stroke-muted"
            />
            {/* Progress fill */}
            <circle
              cx="32" cy="32" r={r}
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={`transition-[stroke-dashoffset] duration-300 ease-out ${
                isError ? "stroke-destructive" : "stroke-primary"
              }`}
            />
          </svg>
          {/* Center icon or percentage */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isDone ? (
              <CheckCircle className="w-6 h-6 text-emerald-500" />
            ) : isError ? (
              <AlertCircle className="w-6 h-6 text-destructive" />
            ) : (
              <span className="text-xs font-bold text-foreground">{Math.round(task.progress)}%</span>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate" title={task.fileName}>
            {task.fileName}
          </p>
          <p className="text-xs text-muted-foreground">
            {isDone ? "Upload complete" : isError ? "Upload failed" : "Uploading…"}
          </p>
        </div>

        {/* Dismiss (only when done / error) */}
        {(isDone || isError) && (
          <button
            onClick={onDismiss}
            className="p-1 hover:bg-muted rounded-lg transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

export function MaterialsPage({ role }: MaterialsPageProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [materials, setMaterials] = useState<Material[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, pageSize: 12, totalRecords: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [batchFilter, setBatchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [accessFilter, setAccessFilter] = useState<"all" | "granted">("all");
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<Material | null>(null);
  const [form, setForm] = useState<Partial<Material>>({ type: "DOCUMENT", batchIds: [], batchNames: [], accessCount: 0 });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);
  const [completeNotify, setCompleteNotify] = useState<UploadTask | null>(null);
  const [materialAccesses, setMaterialAccesses] = useState<MaterialAccessRecord[]>([]);
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({});
  const [accessLoading, setAccessLoading] = useState<Record<string, boolean>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const dropRef = useRef<HTMLDivElement>(null);

  const contentTypes = [
    { value: "DOCUMENT", label: "Document", icon: FileText },
    { value: "VIDEO", label: "Video", icon: Video },
  ];

  const isAdmin = role === "admin";

  // ── Prevent tab close while any upload is in progress ─────────────────────
  const hasUploading = uploadTasks.some((t) => t.status === "uploading");

  useEffect(() => {
    if (!hasUploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ""; // Chrome requires this
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasUploading]);

  // ── Fetch batches & lessons for dropdowns ──────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [batchRes, lessonRes] = await Promise.all([
          getAllBatches(1, 100, ""),
          getAllLessons(1, 100, ""),
        ]);
        const batchData = batchRes?.data?.data ?? [];
        setBatches(batchData.map((b: any) => ({
          id: b.id,
          name: b.name,
          fee: b.class_fee ?? b.fee ?? 0,
          startTime: b.start_time ?? b.startTime ?? "",
          endTime: b.end_time ?? b.endTime ?? "",
          examDate: b.exam_date ?? b.examDate ?? "",
          active: b.is_active ?? b.active ?? true,
          day: b.day ?? "",
        })));
        const lessonData = lessonRes?.data?.data ?? [];
        setLessons(lessonData.map((l: any) => ({
          id: l.id,
          title: l.title,
          description: l.description ?? "",
          type: l.type ?? "",
          created_at: l.created_at ?? "",
        })));
      } catch (err) {
        console.error("Failed to fetch batches/lessons:", err);
      }
    })();
  }, []);

  // ── Debounced search ───────────────────────────────────────────────────────
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(v);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
  };

  // ── Fetch materials from API ───────────────────────────────────────────────
  const fetchMaterials = useCallback(async () => {
    try {
      const result = await getAllMaterials(
        pagination.page,
        pagination.pageSize,
        search,
        batchFilter !== "all" ? batchFilter : "",
        typeFilter !== "all" ? typeFilter : "",
      );
      const backendMaterials = result?.data?.data ?? [];
      const meta = result?.data?.meta ?? {};
      setPagination((prev) => {
        const perPage = meta.limit ?? prev.pageSize;
        const lastPage = meta.pages ?? (meta.total != null ? Math.max(1, Math.ceil(meta.total / perPage)) : prev.totalPages);
        return { page: meta.page ?? prev.page, totalPages: lastPage, pageSize: perPage, totalRecords: meta.total ?? prev.totalRecords };
      });
      const mapped: Material[] = backendMaterials.map((m: any) => ({
        id: m.id,
        title: m.title,
        description: m.description ?? "",
        type: m.type ?? "DOCUMENT",
        url: m.url ?? m.material_url ?? "",
        batchIds: m.material_access?.map((a: any) => a.batch_id) ?? m.batch_ids ?? [],
        batchNames: m.material_access?.map((a: any) => ({ id: a.batch_id, name: a.batch?.name ?? "Unknown" })) ?? [],
        lessonId: m.lesson_id ?? m.lessonId ?? "",
        lessonName: m.lesson?.title ?? "",
        lessonType: m.lesson?.type ?? "",
        uploadDate: m.upload_date ?? m.uploadDate ?? m.created_at ?? "",
        expiryDate: m.expiry_date ?? m.expiryDate ?? null,
        accessCount: m.access_count ?? m.accessCount ?? 0,
      }));
      setMaterials(mapped);
    } catch (error) {
      console.error("Error fetching materials:", error);
    }
  }, [pagination.page, pagination.pageSize, search, batchFilter, typeFilter]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  // ── Client-side access filter ──────────────────────────────────────────────
  const filtered = accessFilter === "granted"
    ? materials.filter((m) => m.batchIds.length > 0)
    : materials;

  // ── Group materials by lesson (for accordion) ────────────────────────────
  const lessonGroups = useMemo(() => {
    const map = new Map<string, { lessonName: string; materials: Material[] }>();
    filtered.forEach((mat) => {
      const key = mat.lessonId || "__uncategorized__";
      if (!map.has(key)) {
        map.set(key, {
          lessonName: key === "__uncategorized__" ? "Uncategorized" : (mat.lessonName || "Unknown Lesson"),
          materials: [],
        });
      }
      map.get(key)!.materials.push(mat);
    });
    const groups = Array.from(map.entries()).map(([lessonId, data]) => ({ lessonId, ...data }));
    // Sort alphabetically; "Uncategorized" always last
    groups.sort((a, b) => {
      if (a.lessonId === "__uncategorized__") return 1;
      if (b.lessonId === "__uncategorized__") return -1;
      return a.lessonName.localeCompare(b.lessonName);
    });
    return groups;
  }, [filtered]);

  // ── Accordion state ──────────────────────────────────────────────────────
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());

  // Auto-expand all groups when the grouping changes
  useEffect(() => {
    if (lessonGroups.length > 0) {
      setExpandedLessons(new Set(lessonGroups.map((g) => g.lessonId)));
    }
  }, [lessonGroups.length]);

  const toggleLesson = (lessonId: string) => {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  // ── Clear all filters ──────────────────────────────────────────────────────
  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setBatchFilter("all");
    setTypeFilter("all");
    setAccessFilter("all");
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const hasActiveFilters = search !== "" || batchFilter !== "all" || typeFilter !== "all" || accessFilter !== "all";

  // ── Card helpers ────────────────────────────────────────────────────────────
  const typeLabel = (t: string) => t === "DOCUMENT" ? "Document" : "Video";

  const typeBadgeV = (t: string): "success" | "info" =>
    t === "DOCUMENT" ? "success" : "info";

  const typeActionIcon = (t: string) =>
    t === "DOCUMENT"
      ? <FileText className="w-4 h-4 text-white" />
      : <Play className="w-4 h-4 text-white" />;

  const thumbnailPlaceholder = (t: string) =>
    t === "DOCUMENT"
      ? "bg-gradient-to-br from-emerald-500 to-teal-600"
      : "bg-gradient-to-br from-blue-500 to-indigo-600";

  // ── Modal helpers ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm({ type: "DOCUMENT", batchIds: [], batchNames: [], accessCount: 0 });
    setFile(null);
    setDragOver(false);
    setModal("add");
  };

  const openEdit = async (mat: Material) => {
    setSelected(mat);
    setForm({ ...mat });
    setFile(null);
    setMaterialAccesses([]);
    setExpiryDates({});
    setModal("edit");

    // Fetch existing access records for this material
    try {
      const res = await getMaterialAccesses(mat.id);
      const accesses = res?.data ?? [];
      const mapped: MaterialAccessRecord[] = accesses.map((a: any) => ({
        id: a.id,
        batch_id: a.batch_id,
        batchName: a.batch?.name ?? "Unknown",
        material_id: a.material_id,
        expiry_date: a.expiry_date ?? null,
      }));
      setMaterialAccesses(mapped);

      // Pre-fill expiry date pickers for active batches without access
      const dates: Record<string, string> = {};
      batches.filter((b) => b.active).forEach((b) => {
        if (!mapped.some((a) => a.batch_id === b.id)) {
          dates[b.id] = defaultExpiryDate();
        }
      });
      setExpiryDates(dates);
    } catch (err) {
      console.error("Failed to fetch material accesses:", err);
    }
  };

  // ── Drag-and-drop handlers ─────────────────────────────────────────────────
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set false if we're leaving the drop zone (not entering a child)
    if (dropRef.current && !dropRef.current.contains(e.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) setFile(droppedFile);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) setFile(selected);
  };

  const removeFile = () => setFile(null);

  // ── Background upload ──────────────────────────────────────────────────────
  const startUpload = async () => {
    if (!form.title?.trim()) {
      alert("Title is required.");
      return;
    }
    if (!file && !form.url) {
      alert("Please select a file to upload.");
      return;
    }

    const taskId = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const uploadFileName = file?.name ?? form.url ?? "Unknown file";

    // Create the task in "uploading" state
    const newTask: UploadTask = { id: taskId, fileName: uploadFileName, progress: 0, status: "uploading" };
    setUploadTasks((prev) => [...prev, newTask]);

    // Close the add modal immediately
    setModal(null);

    const fd = new FormData();
    fd.append("title", form.title || "");
    fd.append("description", form.description || "");
    fd.append("type", form.type || "DOCUMENT");
    fd.append("lesson", form.lessonId || "");
    if (file) {
      fd.append("file", file);
    } else if (form.url) {
      fd.append("url", form.url);
    }

    try {
      await addMaterial(fd, (progressEvent) => {
        if (progressEvent.total) {
          const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, progress: pct } : t))
          );
        }
      });

      // Mark complete
      setUploadTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: "complete" } : t))
      );

      // Show completion notification
      setCompleteNotify({ id: taskId, fileName: uploadFileName, progress: 100, status: "complete" });

      // Refresh the materials list
      fetchMaterials();
    } catch (error: any) {
      console.error("Failed to add material:", error);
      const msg = error?.response?.data?.msg ?? error?.message ?? "An error occurred";

      setUploadTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "error", errorMsg: msg } : t))
      );

      // Show error notification
      setCompleteNotify({ id: taskId, fileName: uploadFileName, progress: 0, status: "error", errorMsg: msg });
    }
  };

  // ── Dismiss a floating progress widget ─────────────────────────────────────
  const dismissTask = (taskId: string) => {
    setUploadTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  // ── Save: Add (modal inline — only used for validation; real upload via startUpload) ──
  const saveAdd = () => {
    startUpload();
  };

  // ── Save: Update ───────────────────────────────────────────────────────────
  const saveUpdate = async () => {
    if (!selected) return;
    if (!form.title?.trim()) {
      alert("Title is required.");
      return;
    }
    setSaving(true);
    try {
      await updateMaterial(selected.id, {
        title: form.title,
        description: form.description,
        type: form.type,
        lesson_id: form.lessonId,
        batch_ids: form.batchIds,
        url: form.url,
      });
      setModal(null);
      fetchMaterials();
    } catch (error: any) {
      console.error("Failed to update material:", error);
      const msg = error?.response?.data?.msg ?? error?.message ?? "An error occurred";
      alert("Failed to update material: " + msg);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!selected) return;
    if (!window.confirm(`Are you sure you want to delete "${selected.title}"? This action cannot be undone.`)) return;
    try {
      await deleteMaterial(selected.id);
      setModal(null);
      fetchMaterials();
    } catch (error: any) {
      console.error("Failed to delete material:", error);
      const msg = error?.response?.data?.msg ?? error?.message ?? "An error occurred";
      alert("Failed to delete material: " + msg);
    }
  };

  // ── Grant / Revoke access handlers ────────────────────────────────────────
  const handleGrantAccess = async (batchId: string) => {
    if (!selected) return;
    const key = batchId;
    setAccessLoading((prev) => ({ ...prev, [key]: true }));
    try {
      const expiry = expiryDates[batchId] ?? defaultExpiryDate();
      await grantBatchAccess(selected.id, batchId, expiry);
      // Refresh accesses
      const res = await getMaterialAccesses(selected.id);
      const accesses = res?.data ?? [];
      setMaterialAccesses(accesses.map((a: any) => ({
        id: a.id,
        batch_id: a.batch_id,
        batchName: a.batch?.name ?? "Unknown",
        material_id: a.material_id,
        expiry_date: a.expiry_date ?? null,
      })));
      // Clear the date picker for this batch
      setExpiryDates((prev) => { const next = { ...prev }; delete next[batchId]; return next; });
      // Refresh material list to update card badges
      fetchMaterials();
    } catch (error: any) {
      console.error("Failed to grant access:", error);
      const msg = error?.response?.data?.msg ?? error?.message ?? "An error occurred";
      alert("Failed to grant access: " + msg);
    } finally {
      setAccessLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleRevokeAccess = async (accessId: string) => {
    const key = accessId;
    setAccessLoading((prev) => ({ ...prev, [key]: true }));
    try {
      await revokeBatchAccess(accessId);
      // Remove from local state
      setMaterialAccesses((prev) => prev.filter((a) => a.id !== accessId));
      // Refresh material list
      fetchMaterials();
    } catch (error: any) {
      console.error("Failed to revoke access:", error);
      const msg = error?.response?.data?.msg ?? error?.message ?? "An error occurred";
      alert("Failed to revoke access: " + msg);
    } finally {
      setAccessLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  // ── Batch checkbox toggle ──────────────────────────────────────────────────
  const toggleBatch = (batchId: string) => {
    setForm((f) => {
      const current = f.batchIds ?? [];
      return {
        ...f,
        batchIds: current.includes(batchId)
          ? current.filter((id) => id !== batchId)
          : [...current, batchId],
      };
    });
  };

  // ── File icon helper for drop zone ─────────────────────────────────────────
  const FileIcon = file
    ? (form.type === "VIDEO" ? Video : FileText)
    : Upload;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Learning Materials</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} on this page{pagination.totalRecords > 0 && ` · ${pagination.totalRecords} total`}
          </p>
        </div>
        {isAdmin && (
          <Btn onClick={openAdd}><Upload className="w-4 h-4" />Upload Material</Btn>
        )}
      </div>

      {/* ── Filters ─────────────────────────────────────────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          {/* Search */}
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search materials…"
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>

          {/* Access filter pills */}
          <div className="flex overflow-hidden rounded-xl border border-border bg-muted/40 p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setAccessFilter("all")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                accessFilter === "all"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setAccessFilter("granted")}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                accessFilter === "granted"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Access Granted
            </button>
          </div>

          {/* Batch dropdown */}
          <Sel className="w-40" value={batchFilter} onChange={(e) => { setBatchFilter(e.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }}>
            <option value="all">Batch ▾</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Sel>

          {/* Type dropdown */}
          <Sel className="w-32" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPagination((prev) => ({ ...prev, page: 1 })); }}>
            <option value="all">Type ▾</option>
            <option value="DOCUMENT">Document</option>
            <option value="VIDEO">Video</option>
          </Sel>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Btn v="ghost" sz="sm" onClick={clearFilters} className="text-muted-foreground shrink-0">
              <X className="w-3.5 h-3.5" />Clear Filters
            </Btn>
          )}
        </div>
      </Card>

      {/* ── Material Cards by Lesson (Accordion) ──────────────────────────────── */}
      {filtered.length === 0 ? (
        <EmptyState icon={BookMarked} title="No materials" desc="Upload documents or video recordings to get started." />
      ) : (
        <div className="space-y-4">
          {lessonGroups.map((group) => {
            const isExpanded = expandedLessons.has(group.lessonId);
            const docCount = group.materials.filter((m) => m.type === "DOCUMENT").length;
            const vidCount = group.materials.filter((m) => m.type === "VIDEO").length;

            return (
              <Card key={group.lessonId} className="overflow-hidden">
                {/* ── Accordion Header ───────────────────────────────────────── */}
                <button
                  type="button"
                  onClick={() => toggleLesson(group.lessonId)}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-muted/30 transition-colors duration-150 text-left"
                >
                  {/* Lesson icon */}
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5 text-primary" />
                  </div>

                  {/* Lesson name + count */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[15px] font-semibold text-foreground truncate">
                        {group.lessonName}
                      </h3>
                      {group.lessonId !== "__uncategorized__" && group.materials[0]?.lessonType && (
                        <Badge v="muted" className="text-[10px] shrink-0">
                          {group.materials[0].lessonType.toUpperCase()}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {group.materials.length} material{group.materials.length !== 1 ? "s" : ""}
                      {docCount > 0 && ` · ${docCount} document${docCount !== 1 ? "s" : ""}`}
                      {vidCount > 0 && ` · ${vidCount} video${vidCount !== 1 ? "s" : ""}`}
                    </p>
                  </div>

                  {/* Material count badge */}
                  <span className="inline-flex items-center justify-center min-w-[28px] h-7 rounded-full bg-muted px-2 text-xs font-bold text-muted-foreground shrink-0">
                    {group.materials.length}
                  </span>

                  {/* Chevron */}
                  <ChevronDown
                    className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                      isExpanded ? "rotate-0" : "-rotate-90"
                    }`}
                  />
                </button>

                {/* ── Accordion Body ─────────────────────────────────────────── */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-1 border-t border-border/50">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                      {group.materials.map((mat) => {
                        const batchChips = mat.batchNames.length > 0 ? mat.batchNames : [];
                        const visibleBatches = batchChips.slice(0, 2);
                        const overflowCount = batchChips.length - 2;
                        const lessonLabel = mat.lessonName || "Unknown Lesson";
                        const lessonTypeLabel = mat.lessonType ? mat.lessonType.toUpperCase() : "";

                        return (
                          <div
                            key={mat.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`${mat.title}, ${typeLabel(mat.type)} material`}
                            onClick={() => isAdmin && openEdit(mat)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); isAdmin && openEdit(mat); } }}
                            className={`group rounded-[18px] border border-border bg-card shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 ease-out overflow-hidden cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isAdmin ? "" : "pointer-events-none"}`}
                          >
                            {/* ── Thumbnail (16:9) ────────────────────────────── */}
                            <div className={`relative w-full aspect-video overflow-hidden ${thumbnailPlaceholder(mat.type)}`}>
                              <Badge v={typeBadgeV(mat.type)} className="absolute top-3 left-3 z-10 shadow-sm">
                                {typeLabel(mat.type)}
                              </Badge>
                              <div className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                                {typeActionIcon(mat.type)}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                {mat.type === "DOCUMENT"
                                  ? <FileText className="w-20 h-20 text-white" />
                                  : <Play className="w-20 h-20 text-white" />
                                }
                              </div>
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
                            </div>

                            {/* ── Card Body ───────────────────────────────────── */}
                            <div className="p-4 space-y-3">
                              <h3 className="text-[15px] font-bold text-foreground leading-snug line-clamp-2" title={mat.title}>
                                {mat.title}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {lessonLabel}
                                {lessonTypeLabel && (
                                  <span className="ml-1 text-[11px] text-muted-foreground/70">· {lessonTypeLabel}</span>
                                )}
                              </p>
                              <div className="flex items-center justify-between text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3.5 h-3.5" />
                                  {mat.lessonName ? "1 Lesson" : "No Lesson"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" />
                                  {mat.accessCount} View{mat.accessCount !== 1 ? "s" : ""}
                                </span>
                              </div>
                              <hr className="border-border/60" />
                              <div>
                                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                  Accessed Batches
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {batchChips.length === 0 ? (
                                    <span className="text-xs text-muted-foreground/60 italic">No Access Assigned</span>
                                  ) : (
                                    <>
                                      {visibleBatches.map((b) => (
                                        <span
                                          key={b.id}
                                          className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-muted/60 text-muted-foreground border border-border/50"
                                        >
                                          {b.name}
                                        </span>
                                      ))}
                                      {overflowCount > 0 && (
                                        <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                                          +{overflowCount} More
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between pt-1 !mt-4">
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/80">
                                  <User className="w-3 h-3" />
                                  Uploaded by Unknown
                                </span>
                                <span className="text-[11px] text-muted-foreground/80">
                                  {fmtDate(mat.uploadDate) || "-"}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
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

      {/* ── Upload Modal ─────────────────────────────────────────────────────── */}
      <Modal open={modal === "add"} onClose={() => setModal(null)} title="Upload Material">
        <div className="space-y-4">
          {/* Content type selector */}
          <div className="mt-2 flex overflow-hidden rounded-2xl gap-3 border border-outline/20 bg-surface-container p-1">
            {contentTypes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, type: value as Material["type"] }))}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors
                  ${form.type === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-background"
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div><FLabel>Title</FLabel><Input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Material title" /></div>
          <div><FLabel>Description</FLabel><Input value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description" /></div>
          <div>
            <FLabel>Lesson</FLabel>
            <Sel value={form.lessonId || ""} onChange={(e) => setForm((f) => ({ ...f, lessonId: e.target.value }))}>
              <option value="">Select lesson</option>
              {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
            </Sel>
          </div>

          {/* ── Drag-and-drop file upload zone ──────────────────────────────── */}
          <div>
            <FLabel>File Upload</FLabel>
            <div
              ref={dropRef}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`relative mt-1.5 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer
                ${dragOver
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : file
                    ? "border-emerald-400/60 bg-emerald-50/40 dark:bg-emerald-950/20"
                    : "border-border hover:border-muted-foreground/40 hover:bg-muted/20"
                }
              `}
            >
              <input
                type="file"
                onChange={handleFileSelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                aria-label="Choose file to upload"
              />

              {file ? (
                /* File selected state */
                <div className="flex items-center gap-3 px-5 py-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    form.type === "VIDEO"
                      ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                  }`}>
                    <FileIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(); }}
                    className="p-1.5 hover:bg-muted rounded-lg transition-colors shrink-0 z-20"
                    aria-label="Remove file"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              ) : (
                /* Empty drop zone */
                <div className="flex flex-col items-center justify-center gap-2 px-5 py-8 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      Drag & drop your file here
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      or <span className="text-primary font-medium">browse</span> to choose a file
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn v="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Btn>
            <Btn onClick={saveAdd} disabled={saving}>
              <Upload className="w-4 h-4" />{saving ? "Uploading…" : "Upload"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Update Modal (wide, two-column) ────────────────────────────────── */}
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Update Material" wide>
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Left column: Form + Access ────────────────────────────────── */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* Content type selector */}
            <div className="flex overflow-hidden rounded-2xl gap-3 border border-outline/20 bg-surface-container p-1">
              {contentTypes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors
                    ${form.type === value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-background"
                    }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div><FLabel>Title</FLabel><Input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Material title" /></div>
            <div><FLabel>Description</FLabel><Input value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description" /></div>
            <div>
              <FLabel>Lesson</FLabel>
              <Sel value={form.lessonId || ""} onChange={(e) => setForm((f) => ({ ...f, lessonId: e.target.value }))}>
                <option value="">Select lesson</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </Sel>
            </div>

            {/* ── Batch Access Management ────────────────────────────────── */}
            <div>
              <FLabel>Batch Access</FLabel>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Grant or revoke access to active batches. Students in granted batches can view this material until the expiry date.
              </p>

              {batches.filter((b) => b.active).length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-3">No active batches available.</p>
              ) : (
                <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                  {batches.filter((b) => b.active).map((b) => {
                    const existingAccess = materialAccesses.find((a) => a.batch_id === b.id);
                    const isLoading = accessLoading[b.id] || accessLoading[existingAccess?.id ?? ""];
                    const isGranted = !!existingAccess;

                    return (
                      <div
                        key={b.id}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          isGranted ? "bg-emerald-50/40 dark:bg-emerald-950/20" : "bg-card"
                        }`}
                      >
                        {/* Batch name + status */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{b.name}</span>
                            {isGranted && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shrink-0">
                                <ShieldCheck className="w-3 h-3" />
                                Granted
                              </span>
                            )}
                          </div>
                          {isGranted && existingAccess.expiry_date && (
                            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expires: {fmtDate(existingAccess.expiry_date) || existingAccess.expiry_date.split("T")[0]}
                            </p>
                          )}
                        </div>

                        {/* Action: date picker + grant OR revoke */}
                        {isGranted ? (
                          <Btn
                            v="outline"
                            sz="sm"
                            onClick={() => handleRevokeAccess(existingAccess.id)}
                            disabled={isLoading}
                            className="text-destructive hover:bg-destructive/10 border-destructive/30 shrink-0"
                          >
                            <ShieldOff className="w-3.5 h-3.5" />
                            {isLoading ? "…" : "Revoke"}
                          </Btn>
                        ) : (
                          <div className="flex items-center gap-2 shrink-0">
                            <input
                              type="date"
                              value={expiryDates[b.id] ?? defaultExpiryDate()}
                              onChange={(e) => setExpiryDates((prev) => ({ ...prev, [b.id]: e.target.value }))}
                              className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            />
                            <Btn
                              sz="sm"
                              onClick={() => handleGrantAccess(b.id)}
                              disabled={isLoading}
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              {isLoading ? "…" : "Grant"}
                            </Btn>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Btn v="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Btn>
              <Btn v="danger" onClick={handleDelete} disabled={saving}>
                <Trash2 className="w-4 h-4" />Delete
              </Btn>
              <Btn onClick={saveUpdate} disabled={saving}>
                <Pen className="w-4 h-4" />{saving ? "Saving…" : "Update"}
              </Btn>
            </div>
          </div>

          {/* ── Right column: Material thumbnail preview ─────────────────── */}
          <div className="lg:w-56 shrink-0">
            <div className="sticky top-0 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
              <div className={`relative w-full aspect-video rounded-xl overflow-hidden ${thumbnailPlaceholder(form.type || "DOCUMENT")}`}>
                <Badge v={typeBadgeV(form.type || "DOCUMENT")} className="absolute top-3 left-3 z-10 shadow-sm text-[10px]">
                  {typeLabel(form.type || "DOCUMENT")}
                </Badge>
                <div className="absolute inset-0 flex items-center justify-center opacity-25">
                  {form.type === "VIDEO"
                    ? <Play className="w-16 h-16 text-white" />
                    : <FileText className="w-16 h-16 text-white" />
                  }
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/40 space-y-2">
                <p className="text-sm font-semibold text-foreground truncate" title={form.title}>
                  {form.title || "Untitled Material"}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3 h-3" />
                  <span>{selected?.uploadDate ? fmtDate(selected.uploadDate) : "—"}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Eye className="w-3 h-3" />
                  <span>{selected?.accessCount ?? 0} view{(selected?.accessCount ?? 0) !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <BookOpen className="w-3 h-3" />
                  <span>{selected?.lessonName || "No lesson"}</span>
                </div>
                {selected?.url && (
                  <p className="text-[11px] text-muted-foreground/70 truncate" title={selected.url}>
                    {selected.url}
                  </p>
                )}
              </div>
              {/* Granted batches summary */}
              {materialAccesses.length > 0 && (
                <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/15 space-y-1.5">
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                    Access Granted ({materialAccesses.length})
                  </p>
                  {materialAccesses.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate">{a.batchName}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">
                        {a.expiry_date ? fmtDate(a.expiry_date) : "No expiry"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Floating upload progress widgets (bottom-right) ─────────────────── */}
      {uploadTasks.map((task) => (
        <CircularProgress key={task.id} task={task} onDismiss={() => dismissTask(task.id)} />
      ))}

      {/* ── Upload complete / error notification modal ──────────────────────── */}
      <Modal
        open={completeNotify !== null}
        onClose={() => setCompleteNotify(null)}
        title={completeNotify?.status === "complete" ? "Upload Complete" : "Upload Failed"}
      >
        {completeNotify && (
          <div className="space-y-4 text-center">
            <div className="flex justify-center">
              {completeNotify.status === "complete" ? (
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {completeNotify.status === "complete" ? "Successfully uploaded!" : "Something went wrong"}
              </p>
              <p className="text-sm text-muted-foreground mt-1 break-all">
                {completeNotify.fileName}
              </p>
              {completeNotify.errorMsg && (
                <p className="text-xs text-destructive mt-2 bg-destructive/10 rounded-lg px-3 py-2">
                  {completeNotify.errorMsg}
                </p>
              )}
            </div>
            <div className="flex justify-center pt-1">
              <Btn onClick={() => { setCompleteNotify(null); dismissTask(completeNotify.id); }}>
                {completeNotify.status === "complete" ? "Done" : "Dismiss"}
              </Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
