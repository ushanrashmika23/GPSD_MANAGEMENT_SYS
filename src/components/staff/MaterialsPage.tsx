import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Video, Upload, Pen, Trash2, BookMarked, Search, X, Play, Eye, BookOpen, User } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card } from "../ui";
import { EmptyState } from "../ui";
import { FLabel } from "../ui";
import { fmtDate } from "../../lib/utils";
import type { Material, Batch, Role } from "../../lib/types";
import type { Lesson } from "./LessonsPage";
import { getAllMaterials, addMaterial, updateMaterial, deleteMaterial, getAllLessons, getAllBatches } from "../../api/apiCalls";
import Pagination from "../ui/Pagination";

interface MaterialsPageProps {
  role: Role;
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const contentTypes = [
    { value: "DOCUMENT", label: "Document", icon: FileText },
    { value: "VIDEO", label: "Video", icon: Video },
  ];

  const isAdmin = role === "admin";

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
    setModal("add");
  };

  const openEdit = (mat: Material) => {
    setSelected(mat);
    setForm({ ...mat });
    setFile(null);
    setModal("edit");
  };

  // ── Save: Add ──────────────────────────────────────────────────────────────
  const saveAdd = async () => {
    if (!form.title?.trim()) {
      alert("Title is required.");
      return;
    }
    setSaving(true);
    try {
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
      await addMaterial(fd);
      setModal(null);
      fetchMaterials();
    } catch (error: any) {
      console.error("Failed to add material:", error);
      const msg = error?.response?.data?.msg ?? error?.message ?? "An error occurred";
      alert("Failed to upload material: " + msg);
    } finally {
      setSaving(false);
    }
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

      {/* ── Material Cards Grid ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.length === 0 ? (
          <div className="col-span-full">
            <EmptyState icon={BookMarked} title="No materials" desc="Upload documents or video recordings to get started." />
          </div>
        ) : filtered.map((mat) => {
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
              {/* ── Thumbnail (16:9) ──────────────────────────────────────────── */}
              <div className={`relative w-full aspect-video overflow-hidden ${thumbnailPlaceholder(mat.type)}`}>
                {/* Type badge — top-left */}
                <Badge v={typeBadgeV(mat.type)} className="absolute top-3 left-3 z-10 shadow-sm">
                  {typeLabel(mat.type)}
                </Badge>

                {/* Action icon — top-right */}
                <div className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
                  {typeActionIcon(mat.type)}
                </div>

                {/* Center icon — large placeholder */}
                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                  {mat.type === "DOCUMENT"
                    ? <FileText className="w-20 h-20 text-white" />
                    : <Play className="w-20 h-20 text-white" />
                  }
                </div>

                {/* Hover zoom layer */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />
              </div>

              {/* ── Card Body ─────────────────────────────────────────────────── */}
              <div className="p-4 space-y-3">
                {/* Title */}
                <h3 className="text-[15px] font-bold text-foreground leading-snug line-clamp-2" title={mat.title}>
                  {mat.title}
                </h3>

                {/* Lesson info */}
                <p className="text-xs text-muted-foreground">
                  {lessonLabel}
                  {lessonTypeLabel && (
                    <span className="ml-1 text-[11px] text-muted-foreground/70">· {lessonTypeLabel}</span>
                  )}
                </p>

                {/* Metadata row */}
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

                {/* Divider */}
                <hr className="border-border/60" />

                {/* Accessed Batches */}
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

                {/* Footer */}
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
          <div>
            <FLabel>File Upload</FLabel>
            <Input
              type="file"
              onChange={(e) => {
                const f = (e.target as HTMLInputElement).files?.[0];
                if (f) setFile(f);
              }}
            />
          </div>
          {/* <div><FLabel>URL (optional)</FLabel><Input value={form.url || ""} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://…" /></div> */}

          <div className="flex justify-end gap-2 pt-2">
            <Btn v="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Btn>
            <Btn onClick={saveAdd} disabled={saving}>
              <Upload className="w-4 h-4" />{saving ? "Uploading…" : "Upload"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Update Modal ─────────────────────────────────────────────────────── */}
      <Modal open={modal === "edit"} onClose={() => setModal(null)} title="Update Material">
        <div className="space-y-4">
          {/* Content type selector */}
          <div className="mt-2 flex overflow-hidden rounded-2xl gap-3 border border-outline/20 bg-surface-container p-1">
            {contentTypes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                // onClick={() => setForm((f) => ({ ...f, type: value as Material["type"] }))}
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
          {/* <div>
            <FLabel>URL / File Path</FLabel>
            <Input value={form.url || ""} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://… or file path" />
          </div> */}

          {/* Batch access */}
          <div>
            <FLabel>Grant Access</FLabel>
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {batches.map((b) => (
                <label key={b.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                    checked={(form.batchIds ?? []).includes(b.id)}
                    onChange={() => toggleBatch(b.id)}
                  />
                  <span className="text-sm text-foreground">{b.name}</span>
                </label>
              ))}
              {batches.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-full">No batches available.</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Btn v="outline" onClick={() => setModal(null)} disabled={saving}>Cancel</Btn>
            <Btn v="danger" onClick={handleDelete} disabled={saving}>
              <Trash2 className="w-4 h-4" />Delete
            </Btn>
            <Btn onClick={saveUpdate} disabled={saving}>
              <Pen className="w-4 h-4" />{saving ? "Saving…" : "Update"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
