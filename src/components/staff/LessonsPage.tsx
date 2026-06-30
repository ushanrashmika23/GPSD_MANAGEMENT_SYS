//TODO: add count of materials in each lesson card

import { useEffect, useState } from "react";
import { Plus, BookOpen, FileText, Video, Loader } from "lucide-react";
import { Link as LinkIcon } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card } from "../ui";
import { FLabel } from "../ui";
import { fmtDate } from "../../lib/utils";
import type { Material, Batch, Role } from "../../lib/types";
import { addLesson, deleteLesson, getAllLessons, updateLesson } from "../../api/apiCalls";

interface LessonsPageProps {
  setLessons: React.Dispatch<React.SetStateAction<Lesson[]>>;
  materials: Material[];
  batches: Batch[];
  role: Role;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  type: string;
  created_at: string;
}

export function LessonsPage({ materials, batches, role }: LessonsPageProps) {
  const [modal, setModal] = useState(false);
  const [updateModal, setUpdateModal] = useState(false);
  const [form, setForm] = useState<Partial<Lesson>>({});
  const [lessons, setLocalLessons] = useState<Lesson[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    fetchLessons();
  }, [])

  const fetchLessons = () => {
    getAllLessons().then((data) => {
      console.log(data);
      setLocalLessons(data.data.data);
    }).catch((error) => {
      console.error("Error fetching lessons:", error);
    });
  }

  const handleAddLesson = () => {
    addLesson(form as Lesson).then((data) => {
      console.log(data);
      fetchLessons();
      // setLocalLessons((prevLessons) => [...prevLessons, data]);
    }).catch((error) => {
      console.error("Error adding lesson:", error);
    });
    setModal(false);
    console.log(form);

  };

  const handleUpdateLesson = () => {
    console.log("Updating lesson with data:", form);
    updateLesson(form.id!, form as Lesson).then((data) => {
      console.log(data);
      setUpdateModal(false);
      //update the lessons state here if needed
      setLocalLessons((prevLessons) => prevLessons.map((lesson) => lesson.id === form.id ? { ...lesson, ...form } as Lesson : lesson));
    }).catch((error) => {
      console.error("Error updating lesson:", error);
    });
  }

  const handleDeleteLesson = () => {
    deleteLesson(form.id!).then((data) => {
      console.log(data);
      setUpdateModal(false);
      //update the lessons state here if needed
      setLocalLessons((prevLessons) => prevLessons.filter((lesson) => lesson.id !== form.id));
      setConfirmDelete(false);
    }).catch((error) => {
      console.error("Error deleting lesson:", error);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Lessons</h1>
          <p className="text-sm text-muted-foreground">{lessons.length} lessons</p>
        </div>
        {role === "admin" && (
          <Btn onClick={() => { setModal(true); setForm({ id: "", title: "", created_at: new Date().toISOString().split("T")[0], description: "", type: "PURE" }) }}><Plus className="w-4 h-4" />New Lesson</Btn>
        )}
      </div>

      <div className="space-y-3">
        {lessons.map((l) => {
          const lMats = materials.filter((m) => m.lessonId === l.id);
          return (
            <Card key={l.id} onClick={() => { setForm({ id: l.id, title: l.title, description: l.description, type: l.type, created_at: l.created_at.split("T")[0] }); setUpdateModal(true); setConfirmDelete(false) }} className="p-4 hover:bg-muted/10 transition-colors cursor-pointer">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-foreground">{l.title}</h3>
                    <Badge v={l.type == "PURE" ? "success" : l.type == "APPLIED" ? "info" : "danger"}>{l.type}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(l.created_at)}</p>
                  {/* <div className="flex flex-wrap gap-1 mt-2">
                    {l.batchIds.map((bid) => {
                      const b = batches.find((x) => x.id === bid);
                      return b ? <Badge key={bid} v="default">{b.name.split(" ")[0]} {b.name.split(" ")[1]}</Badge> : null;
                    })}
                  </div> */}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold font-mono text-foreground">{lMats.length}</p>
                  <p className="text-xs text-muted-foreground">materials</p>
                </div>
              </div>
              {/* {lMats.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border/50 flex flex-wrap gap-2">
                  {lMats.map((m) => (
                    <div key={m.id} className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded-lg text-xs text-muted-foreground">
                      {m.type === "pdf" ? <FileText className="w-3 h-3 text-red-400" />
                      : m.type === "video" ? <Video className="w-3 h-3 text-blue-400" />
                      : <LinkIcon className="w-3 h-3 text-emerald-400" />}
                      {m.title.slice(0, 40)}{m.title.length > 40 ? "…" : ""}
                    </div>
                  ))}
                </div>
              )} */}
            </Card>
          );
        })}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add New Lesson">
        <div className="space-y-4">
          <div><FLabel>Title</FLabel><Input value={form.title || ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Complex Numbers" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FLabel>Category</FLabel>
              <Sel value={form.type || ""} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="PURE">Pure Maths</option>
                <option value="APPLIED">Applied Maths</option>
                <option value="COMMON">COMMON</option>
              </Sel>
            </div>
            <div><FLabel>Date</FLabel><Input type="date" value={form.created_at || new Date().toISOString().split("T")[0]} onChange={(e) => setForm((f) => ({ ...f, created_at: e.target.value }))} /></div>
          </div>
          <div>
            <FLabel>Description</FLabel>
            <Input value={form.description || ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={() => handleAddLesson()}>Add Lesson</Btn>
          </div>
        </div>
      </Modal>



      <Modal open={updateModal} onClose={() => setUpdateModal(false)} title="Update Lesson">
        <div className="space-y-4">
          <div><FLabel>Title</FLabel><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Complex Numbers" /></div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <FLabel>Category</FLabel>
              <Sel value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="PURE">Pure Maths</option>
                <option value="APPLIED">Applied Maths</option>
                <option value="COMMON">COMMON</option>
              </Sel>
            </div>
            {/* <div><FLabel>Date</FLabel><Input type="date" value={form.created_at} onChange={(e) => setForm((f) => ({ ...f, created_at: e.target.value }))} /></div> */}
          </div>
          <div>
            <FLabel>Description</FLabel>
            <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setUpdateModal(false)}>Cancel</Btn>
            <Btn v="danger" onClick={() => { setConfirmDelete(true); if (confirmDelete) handleDeleteLesson() }}>{confirmDelete ? <Loader className="h-4 w-4 animate-spin" /> : null}{confirmDelete ? "Confirm Delete" : "Delete Lesson"}</Btn>
            <Btn onClick={() => handleUpdateLesson()}>Update Lesson</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
