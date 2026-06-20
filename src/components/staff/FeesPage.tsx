import { useState, useMemo } from "react";
import { Search, Plus, CheckCircle, DollarSign } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card, Avatar } from "../ui";
import { FLabel } from "../ui";
import { fmtCur, fmtMonth, fmtDate } from "../../lib/utils";
import type { Payment, Student, Batch, Role } from "../../lib/types";

interface FeesPageProps {
  payments: Payment[];
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  students: Student[];
  batches: Batch[];
  role: Role;
}

const MONTHS = ["2025-02", "2025-03", "2025-04", "2025-05", "2025-06"];

export function FeesPage({ payments, setPayments, students, batches, role }: FeesPageProps) {
  const [view, setView] = useState<"history" | "unpaid" | "report">("history");
  const [modal, setModal] = useState(false);
  const [batchFilter, setBatchFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("2025-05");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    studentId: "", batchId: "", month: "2025-05", amount: "", receiptNo: "", date: new Date().toISOString().split("T")[0],
  });

  const savePayment = () => {
    setPayments((p) => [...p, { id: `pay${Date.now()}`, ...form, amount: +form.amount } as Payment]);
    setModal(false);
    setForm({ studentId: "", batchId: "", month: "2025-05", amount: "", receiptNo: "", date: new Date().toISOString().split("T")[0] });
  };

  const filtPays = useMemo(() => payments.filter((p) => {
    const matchBatch = batchFilter === "all" || p.batchId === batchFilter;
    const matchMonth = p.month === monthFilter;
    const st = students.find((s) => s.id === p.studentId);
    const q = search.toLowerCase();
    const matchSearch = !q || st?.fullName.toLowerCase().includes(q) || st?.callupNo.toLowerCase().includes(q);
    return matchBatch && matchMonth && matchSearch;
  }), [payments, batchFilter, monthFilter, search, students]);

  const unpaidStudents = useMemo(() => {
    const paid = new Set(
      payments.filter((p) => p.month === monthFilter && (batchFilter === "all" || p.batchId === batchFilter))
        .map((p) => `${p.studentId}_${p.batchId}`)
    );
    return students.filter((s) => s.active).flatMap((s) =>
      s.batchIds
        .filter((bid) => batchFilter === "all" || bid === batchFilter)
        .map((bid) => (paid.has(`${s.id}_${bid}`) ? null : { student: s, batchId: bid }))
        .filter(Boolean) as { student: Student; batchId: string }[]
    );
  }, [payments, students, monthFilter, batchFilter]);

  const monthlyIncome = filtPays.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Fees</h1>
          <p className="text-sm text-muted-foreground">Manage class fee payments</p>
        </div>
        {role === "admin" && <Btn onClick={() => setModal(true)}><Plus className="w-4 h-4" />Record Payment</Btn>}
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["history", "unpaid", "report"] as const).map((v) => (
          <Btn key={v} v={view === v ? "primary" : "outline"} sz="sm" onClick={() => setView(v)}>
            {v === "history" ? "Payment History" : v === "unpaid" ? `Unpaid (${unpaidStudents.length})` : "Monthly Report"}
          </Btn>
        ))}
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3">
          <Sel className="w-48" value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            <option value="all">All Batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Sel>
          <Sel className="w-44" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
            {MONTHS.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}
          </Sel>
          {view === "history" && (
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          )}
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-semibold text-emerald-700">{fmtCur(monthlyIncome)}</span>
          </div>
        </div>
      </Card>

      {view === "history" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Student", "Batch", "Month", "Receipt No.", "Amount", "Date"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtPays.length === 0 ? (
                  <tr><td colSpan={6} className="py-12 text-center text-muted-foreground text-sm">No payments found.</td></tr>
                ) : filtPays.map((p) => {
                  const st = students.find((s) => s.id === p.studentId);
                  const bt = batches.find((b) => b.id === p.batchId);
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {st && <Avatar name={st.fullName} size="sm" />}
                          <div>
                            <p className="font-medium text-foreground">{st?.fullName}</p>
                            <p className="text-xs text-muted-foreground font-mono">{st?.callupNo}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{bt?.name}</td>
                      <td className="px-4 py-3 text-xs">{fmtMonth(p.month)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-primary">{p.receiptNo}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-600">{fmtCur(p.amount)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{fmtDate(p.date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {view === "unpaid" && (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">{unpaidStudents.length} students have not paid for {fmtMonth(monthFilter)}</h3>
            <Badge v="warning">{unpaidStudents.length} unpaid</Badge>
          </div>
          <div className="divide-y divide-border/50">
            {unpaidStudents.length === 0 ? (
              <div className="py-12 text-center text-sm text-emerald-600 flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
                All students have paid for {fmtMonth(monthFilter)}!
              </div>
            ) : unpaidStudents.map(({ student: s, batchId: bid }) => {
              const bt = batches.find((b) => b.id === bid);
              return (
                <div key={`${s.id}_${bid}`} className="flex items-center gap-3 px-4 py-3">
                  <Avatar name={s.fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.fullName}</p>
                    <p className="text-xs text-muted-foreground">{s.callupNo} · {bt?.name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-red-600 font-mono">{fmtCur(bt?.fee || 0)}</span>
                    <Badge v="danger">Unpaid</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {view === "report" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {batches.filter((b) => b.active).map((b) => {
            const bPays = payments.filter((p) => p.batchId === b.id && p.month === monthFilter);
            const income = bPays.reduce((s, p) => s + p.amount, 0);
            const bStudents = students.filter((s) => s.batchIds.includes(b.id) && s.active);
            return (
              <Card key={b.id} className="p-5">
                <h3 className="font-semibold text-foreground mb-3">{b.name}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Students</span><span className="font-mono">{bStudents.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Paid</span><span className="font-mono text-emerald-600">{bPays.length}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Unpaid</span><span className="font-mono text-red-500">{bStudents.length - bPays.length}</span></div>
                  <div className="flex justify-between pt-2 border-t border-border"><span className="text-muted-foreground font-medium">Income</span><span className="font-mono font-semibold">{fmtCur(income)}</span></div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Record Payment">
        <div className="space-y-4">
          <div>
            <FLabel>Student</FLabel>
            <Sel
              value={form.studentId}
              onChange={(e) => {
                const s = students.find((x) => x.id === e.target.value);
                setForm((f) => ({
                  ...f,
                  studentId: e.target.value,
                  batchId: s?.batchIds[0] || "",
                  amount: String(batches.find((b) => b.id === s?.batchIds[0])?.fee || ""),
                }));
              }}
            >
              <option value="">Select student</option>
              {students.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>{s.fullName} ({s.callupNo})</option>
              ))}
            </Sel>
          </div>
          {form.studentId && (
            <div>
              <FLabel>Batch</FLabel>
              <Sel
                value={form.batchId}
                onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value, amount: String(batches.find((b) => b.id === e.target.value)?.fee || "") }))}
              >
                {students.find((s) => s.id === form.studentId)?.batchIds.map((bid) => {
                  const b = batches.find((x) => x.id === bid);
                  return b ? <option key={bid} value={bid}>{b.name}</option> : null;
                })}
              </Sel>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><FLabel>Month</FLabel><Sel value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}>{MONTHS.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</Sel></div>
            <div><FLabel>Amount (LKR)</FLabel><Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} /></div>
            <div><FLabel>Receipt No.</FLabel><Input value={form.receiptNo} onChange={(e) => setForm((f) => ({ ...f, receiptNo: e.target.value }))} placeholder="RCP0001" /></div>
            <div><FLabel>Payment Date</FLabel><Input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Btn v="outline" onClick={() => setModal(false)}>Cancel</Btn>
            <Btn onClick={savePayment} disabled={!form.studentId || !form.batchId || !form.amount}>Record Payment</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
