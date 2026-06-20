import { useState } from "react";
import { Send, Smartphone, Mail, MessageCircle } from "lucide-react";
import { Badge, Btn, Input, Sel, Textarea, Modal, Card, StatCard } from "../ui";
import { FLabel } from "../ui";
import type { CMessage, Batch, Student } from "../../lib/types";

interface CommunicationPageProps {
  messages: CMessage[];
  setMessages: React.Dispatch<React.SetStateAction<CMessage[]>>;
  batches: Batch[];
  students: Student[];
}

const TEMPLATES = [
  { name: "Fee Reminder",    content: "Dear Students, your class fee for {month} is due. Please pay by {date}. Receipt required at next class." },
  { name: "Class Cancellation", content: "Dear Students, this {day}'s class is cancelled due to {reason}. We apologise for the inconvenience. It will be rescheduled." },
  { name: "Result Published", content: "Dear Students, the results for {paper} have been published. Please log in to view your results and rank." },
  { name: "Material Uploaded", content: "New materials have been uploaded: {title}. Please check the student portal." },
  { name: "Exam Reminder",   content: "Reminder: {paper} is scheduled for {date}. Please bring your student ID card and stationery." },
];

export function CommunicationPage({ messages, setMessages, batches, students }: CommunicationPageProps) {
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({
    type: "whatsapp" as "whatsapp" | "email" | "sms",
    subject: "",
    content: "",
    batchIds: [] as string[],
    scheduled: false,
    schedDate: "",
  });

  const send = () => {
    setMessages((p) => [
      ...p,
      {
        id: `msg${Date.now()}`,
        type: form.type,
        subject: form.subject,
        content: form.content,
        batchIds: form.batchIds,
        sentDate: form.scheduled ? `${form.schedDate} 09:00` : new Date().toLocaleString("en-GB"),
        status: form.scheduled ? "scheduled" : "sent",
      },
    ]);
    setModal(false);
    setForm({ type: "whatsapp", subject: "", content: "", batchIds: [], scheduled: false, schedDate: "" });
  };

  const typeIcon = (t: string) =>
    t === "whatsapp" ? <Smartphone className="w-4 h-4 text-emerald-500" />
    : t === "email"  ? <Mail className="w-4 h-4 text-blue-500" />
    : <MessageCircle className="w-4 h-4 text-amber-500" />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Communication</h1>
          <p className="text-sm text-muted-foreground">Send messages to students and parents</p>
        </div>
        <Btn onClick={() => setModal(true)}><Send className="w-4 h-4" />Compose</Btn>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="WhatsApp Sent" value={messages.filter((m) => m.type === "whatsapp" && m.status === "sent").length} icon={Smartphone} color="emerald" />
        <StatCard label="Emails Sent"   value={messages.filter((m) => m.type === "email"    && m.status === "sent").length} icon={Mail}       color="blue" />
        <StatCard label="SMS Sent"      value={messages.filter((m) => m.type === "sms"      && m.status === "sent").length} icon={MessageCircle} color="amber" />
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-border"><h3 className="text-sm font-semibold">Message History</h3></div>
        <div className="divide-y divide-border/50">
          {messages.map((m) => (
            <div key={m.id} className="flex items-start gap-3 px-4 py-4">
              <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                {typeIcon(m.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-foreground">{m.subject}</p>
                  <Badge v={m.status === "sent" ? "success" : m.status === "scheduled" ? "warning" : "danger"}>{m.status}</Badge>
                  <Badge v="muted">{m.type.toUpperCase()}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.content}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground">{m.sentDate}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.batchIds.map((bid) => batches.find((b) => b.id === bid)?.name.split(" ")[0]).filter(Boolean).join(", ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title="Compose Message" wide>
        <div className="space-y-4">
          <div>
            <FLabel>Templates</FLabel>
            <div className="flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setForm((f) => ({ ...f, subject: t.name, content: t.content }))}
                  className="text-xs px-2.5 py-1 rounded-lg bg-muted hover:bg-secondary border border-border transition-colors"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FLabel>Channel</FLabel>
              <Sel value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as "whatsapp" | "email" | "sms" }))}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </Sel>
            </div>
            <div>
              <FLabel>Subject</FLabel>
              <Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Message subject" />
            </div>
          </div>
          <div>
            <FLabel>Recipients (Batches)</FLabel>
            <div className="flex flex-wrap gap-2">
              {batches.filter((b) => b.active).map((b) => (
                <label key={b.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.batchIds.includes(b.id)}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        batchIds: e.target.checked ? [...f.batchIds, b.id] : f.batchIds.filter((x) => x !== b.id),
                      }))
                    }
                  />
                  <span className="text-sm">{b.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <FLabel>Message Content</FLabel>
            <Textarea value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} rows={5} placeholder="Write your message here…" />
          </div>
          <div className="flex items-center gap-3">
            <input type="checkbox" id="sched" checked={form.scheduled} onChange={(e) => setForm((f) => ({ ...f, scheduled: e.target.checked }))} />
            <label htmlFor="sched" className="text-sm font-medium">Schedule for later</label>
            {form.scheduled && (
              <Input type="datetime-local" className="flex-1" value={form.schedDate} onChange={(e) => setForm((f) => ({ ...f, schedDate: e.target.value }))} />
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={send} disabled={!form.subject || !form.content || form.batchIds.length === 0}>
              <Send className="w-4 h-4" />{form.scheduled ? "Schedule" : "Send Now"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
