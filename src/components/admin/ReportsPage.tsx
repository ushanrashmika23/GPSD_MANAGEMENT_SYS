import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, Avatar, Badge } from "../ui";
import { cn, fmtCur, fmtMonth } from "../../lib/utils";
import type { Student, Batch, Payment, AttendanceRecord, Mark, Paper } from "../../lib/types";

interface ReportsPageProps {
  students: Student[];
  batches: Batch[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  marks: Mark[];
  papers: Paper[];
}

export function ReportsPage({ students, batches, payments, attendance, marks, papers }: ReportsPageProps) {
  const months = ["2025-02", "2025-03", "2025-04", "2025-05"];

  const incomeData = months.map((m) => ({
    month: m.split("-")[1],
    income: payments.filter((p) => p.month === m).reduce((s, p) => s + p.amount, 0) / 1000,
    students: [...new Set(payments.filter((p) => p.month === m).map((p) => p.studentId))].length,
  }));

  const batchAtt = batches.filter((b) => b.active).map((b) => {
    const bAtt = attendance.filter((a) => a.batchId === b.id);
    const pct = bAtt.length > 0 ? Math.round((bAtt.filter((a) => a.present).length / bAtt.length) * 100) : 0;
    return { name: b.name.split(" ")[0] + b.name.split(" ")[1], pct };
  });

  const topStudents = students
    .filter((s) => s.active)
    .map((s) => {
      const sMarks = marks.filter((m) => m.studentId === s.id);
      const avg =
        sMarks.length > 0
          ? Math.round(
              sMarks.reduce((sum, m) => sum + (m.marks / (papers.find((p) => p.id === m.paperId)?.totalMarks || 100)) * 100, 0) /
                sMarks.length
            )
          : 0;
      const sAtt = attendance.filter((a) => a.studentId === s.id);
      const attPct = sAtt.length > 0 ? Math.round((sAtt.filter((a) => a.present).length / sAtt.length) * 100) : 0;
      return { student: s, avg, attPct };
    })
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 8);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground">Analytics and summaries</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income trend */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Income Trend (LKR thousands)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={incomeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`LKR ${(v * 1000).toLocaleString()}`, "Income"]}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="income" stroke="#1B3A6B" strokeWidth={2.5} dot={{ fill: "#1B3A6B", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Attendance by batch */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Attendance Rate by Batch</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={batchAtt} barSize={40}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
              <Tooltip
                formatter={(v: number) => [`${v}%`, "Attendance"]}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
              />
              <Bar dataKey="pct" name="Attendance %" fill="#2D7A4F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Top students */}
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold mb-4">Top Performing Students</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["Rank", "Student", "School", "Batches", "Avg. Score", "Attendance"].map((h) => (
                    <th key={h} className="text-left pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topStudents.map(({ student: s, avg, attPct }, i) => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-3 pr-4">
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                        i === 0 ? "bg-amber-100 text-amber-700" : i === 1 ? "bg-gray-200 text-gray-600" : i === 2 ? "bg-orange-100 text-orange-700" : "bg-muted text-muted-foreground"
                      )}>{i + 1}</div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <Avatar name={s.fullName} size="sm" />
                        <span className="font-medium text-foreground">{s.fullName}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{s.school}</td>
                    <td className="py-3 pr-4">
                      <div className="flex gap-1">
                        {s.batchIds.map((bid) => {
                          const b = batches.find((x) => x.id === bid);
                          return b ? <Badge key={bid} v="default">{b.name.split(" ")[0]}</Badge> : null;
                        })}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${avg}%` }} />
                        </div>
                        <span className={cn("text-sm font-mono font-semibold", avg >= 70 ? "text-emerald-600" : avg >= 50 ? "text-amber-600" : "text-red-500")}>{avg}%</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className={cn("text-sm font-mono", attPct >= 80 ? "text-emerald-600" : attPct >= 60 ? "text-amber-600" : "text-red-500")}>{attPct}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Payment rate */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Payment Rate by Month</h3>
          <div className="space-y-3">
            {months.map((m) => {
              const total = students.filter((s) => s.active).reduce((s, st) => s + st.batchIds.length, 0);
              const paid = payments.filter((p) => p.month === m).length;
              const pct = total > 0 ? Math.round((paid / total) * 100) : 0;
              return (
                <div key={m} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16">{fmtMonth(m).split(" ")[0]}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-mono font-medium w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Batch-wise summary */}
        <Card className="p-5">
          <h3 className="text-sm font-semibold mb-4">Batch-wise Summary</h3>
          <div className="space-y-3">
            {batches.filter((b) => b.active).map((b) => {
              const bStudents = students.filter((s) => s.batchIds.includes(b.id) && s.active);
              const bIncome = payments.filter((p) => p.batchId === b.id).reduce((s, p) => s + p.amount, 0);
              const bAtt = attendance.filter((a) => a.batchId === b.id);
              const attPct = bAtt.length > 0 ? Math.round((bAtt.filter((a) => a.present).length / bAtt.length) * 100) : 0;
              return (
                <div key={b.id} className="p-3 bg-muted/40 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{b.name}</span>
                    <Badge v="success">{bStudents.length} students</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Income</span><p className="font-mono font-medium">{fmtCur(bIncome)}</p></div>
                    <div><span className="text-muted-foreground">Attendance</span><p className="font-mono font-medium">{attPct}%</p></div>
                    <div><span className="text-muted-foreground">Fee</span><p className="font-mono font-medium">{fmtCur(b.fee)}/mo</p></div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
