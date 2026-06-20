import { useState } from "react";
import { Plus, BookOpen, FileText, Video } from "lucide-react";
import { Link as LinkIcon } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card } from "../ui";
import { FLabel } from "../ui";
import { fmtDate } from "../../lib/utils";
import type { Lesson, Material, Batch, Role } from "../../lib/types";

interface LessonsPageProps {
  lessons: Lesson[];
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  materials: Material[];
  batches: Batch[];
  role: Role;
}

export function LessonsPage({ lessons, setLessons, materials, batches, role }: LessonsPageProps) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Lesson>>({ batchIds: [] });

  const save = () => {
    setLessons((p) => [
      ...p,
      { id: `l${Date.now()}`, ...form, date: form.date || new Date().toISOString().split("T")[0] } as Lesson,
    ]);
    setModal(false);
    setForm({ batchIds: [] });
  };

  const matIcon = (t: string) =>
    t === "pdf" ? <FileText className="w-3 h-3 text-red-400" />
    : t === "video" ? <Video className="w-3 h-3 text-blue-400" />
    : <LinkIcon className="w-3 h-3 text-emerald-400" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lessons</h1>
          <p className="text-sm text-muted-foreground">{lessons.length} lessons</p>
        </div>
        {role === "admin" && (
          <Btn onClick={() => setModal(true)}><Plus className="w-4 h-4" />New Lesson</Btn>
        )}
      </div>

      <div className="space-y-3">
        {lessons.map((l) => {
          const lMats = materials.filter((m) => m.lessonId === l.id);
          return (
            <Card key={l.id} className="p-4">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{l.title}</h3>
                    <Badge v="accent">{l.topic}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(l.date)}</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {l.batchIds.map((bid) => {
                      const b = batches.find((x) => x.id === bid);
                      return b ? <Badge key={bid} v="default">{b.name.split(" ")[0]} {b.name.split(" ")[1]}</Badge> : null;
                    })}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-mono text-foreground">{lMats.length}</p>
                  <p className="text-xs text-muted-foreground">materials</p>
                </div>
              </div>
              {lMats.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                  {lMats.map((m) => (
                    <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg text-xs text-muted-foreground">
                      {matIcon(m.type)}
                      {m.title.slice(0, 40)}{m.title.length > 40 ? "…" : ""}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add New Lesson">
        <div className="space-y-4">
          <div><FLabel>Title</FLabel><Input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Complex Numbers" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><FLabel>Topic</FLabel><Input value={form.topic || ""} onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))} placeholder="Pure / Applied Mathematics" /></div>
            <div><FLabel>Date</FLabel><Input type="date" value={form.date || ""} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
          </div>
          <div>
            <FLabel>Batches</FLabel>
            <div className="flex flex-wrap gap-2">
              {batches.filter((b) => b.active).map((b) => (
                <label key={b.id} className="flex items-center gap-1.5 cursor-pointer">
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
          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={save}>Add Lesson</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
