import { useState } from "react";
import { FileText, Video, Upload, ScrollText, Check, Pen } from "lucide-react";
import { Link as LinkIcon } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card } from "../ui";
import { EmptyState } from "../ui";
import { FLabel } from "../ui";
import { fmtDate } from "../../lib/utils";
import { BookMarked } from "lucide-react";
import type { Material, Lesson, Batch, Role } from "../../lib/types";


interface MaterialsPageProps {
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  lessons: Lesson[];
  batches: Batch[];
  role: Role;
}



export function MaterialsPage({ materials, setMaterials, lessons, batches, role }: MaterialsPageProps) {
  const [modal, setModal] = useState(false);
  const [updateModal, setUpdateModal] = useState(false);
  const [batchFilter, setBatchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [form, setForm] = useState<Partial<Material>>({ contentType: "pdf", batchIds: [], accessCount: 0 });
  const contentTypes = [
    { value: "recording", label: "Rec", icon: Video },
    { value: "note", label: "Note", icon: FileText },
    { value: "paper", label: "Paper", icon: ScrollText },
  ];
  const filtered = materials.filter((m) => {
    const matchBatch = batchFilter === "all" || m.batchIds.includes(batchFilter);
    const matchType = typeFilter === "all" || m.contentType === typeFilter;
    return matchBatch && matchType;
  });

  const save = () => {
    setMaterials((p) => [...p, { id: `mat${Date.now()}`, ...form, uploadDate: new Date().toISOString().split("T")[0] } as Material]);
    setModal(false);
    setForm({ contentType: "pdf", batchIds: [], accessCount: 0 });
  };

  const typeIcon = (t: string) =>
    t === "pdf" ? <FileText className="w-4 h-4 text-red-500" />
      : t === "video" ? <Video className="w-4 h-4 text-blue-500" />
        : <LinkIcon className="w-4 h-4 text-emerald-500" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Learning Materials</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} materials</p>
        </div>
        {role === "admin" && (
          <Btn onClick={() => setModal(true)}><Upload className="w-4 h-4" />Upload Material</Btn>
        )}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Sel className="w-48" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            <option value="all">All Batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Sel>
          <Sel className="w-36" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            <option value="pdf">PDF Notes</option>
            <option value="video">Video</option>
            <option value="link">Link</option>
          </Sel>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.length === 0 ? (
          <div className="col-span-2">
            <EmptyState icon={BookMarked} title="No materials" desc="Upload PDF notes, video recordings, or links." />
          </div>
        ) : filtered.map((mat) => {
          const lesson = lessons.find((l) => l.id === mat.lessonId);
          return (
            <Card key={mat.id} onClick={() => setUpdateModal(true)} className="p-4 hover:bg-muted transition-colors cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  {typeIcon(mat.contentType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{mat.title}</p>
                  {lesson && <p className="text-xs text-muted-foreground mt-0.5">{lesson.title} · {lesson.topic}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {mat.batchIds.map((bid) => {
                      const b = batches.find((x) => x.id === bid);
                      return b ? <Badge key={bid} v="default">{b.name.split(" ")[0]} {b.name.split(" ")[1]}</Badge> : null;
                    })}
                    <Badge v="muted">{mat.accessCount} views</Badge>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <Badge v={mat.contentType === "pdf" ? "danger" : mat.contentType === "video" ? "info" : "success"}>
                    {mat.contentType.toUpperCase()}
                  </Badge>
                  <p className="text-xs text-muted-foreground">{fmtDate(mat.uploadDate)}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Upload Material">
        <div className="space-y-4">
          <div className="mt-2 flex overflow-hidden rounded-2xl gap-3 border border-outline/20 bg-surface-container p-1">
            {contentTypes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    contentType: value as Material["contentType"],
                  }))
                }
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors
        ${form.contentType === value
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
          <div><FLabel>Description</FLabel><Input value={""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Material description" /></div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <FLabel>Lesson</FLabel>
              <Sel value={form.lessonId || ""} onChange={(e) => setForm((f) => ({ ...f, lessonId: e.target.value }))}>
                <option value="">Select lesson</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </Sel>
            </div>
          </div>
          <div><FLabel>URL / File Path</FLabel><Input type="file" value={form.url || ""} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} placeholder="https://… or file path" /></div>



          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save}><Upload className="w-4 h-4" />Upload</Btn>
          </div>
        </div>
      </Modal>


      <Modal open={updateModal} onClose={() => setUpdateModal(false)} title="Update Material">
        <div className="space-y-4">
          <div className="mt-2 flex overflow-hidden rounded-2xl gap-3 border border-outline/20 bg-surface-container p-1">
            {contentTypes.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    contentType: value as Material["contentType"],
                  }))
                }
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium transition-colors
        ${form.contentType === value
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
          <div><FLabel>Description</FLabel><Input value={""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Material description" /></div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <FLabel>Lesson</FLabel>
              <Sel value={form.lessonId || ""} onChange={(e) => setForm((f) => ({ ...f, lessonId: e.target.value }))}>
                <option value="">Select lesson</option>
                {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </Sel>
            </div>
          </div>

          <div>
            <FLabel>Grant Access</FLabel>

            <div className="mt-2 grid grid-cols-3 gap-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm">Batch 22</span>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm">Batch 23</span>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm">Batch 24</span>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm">Weekend Batch</span>
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" className="h-4 w-4" />
                <span className="text-sm">Online Batch</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-10">
            <Btn v="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn v="danger" onClick={() => setModal(false)}>Delete Material</Btn>
            <Btn onClick={save}><Pen className="w-4 h-4" />Update</Btn>
          </div>
        </div>
      </Modal>

    </div>
  );
}
