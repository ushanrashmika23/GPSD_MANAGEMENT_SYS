import {
  Users, CheckCircle, Layers, DollarSign, CalendarCheck,
  FileText, Calendar, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, StatCard, Avatar, Badge } from "../ui";
import { EmptyState } from "../ui";
import { fmtCur, fmtDate, fmtMonth } from "../../lib/utils";
import type { Student, Batch, Payment, AttendanceRecord, Paper, Mark, Role } from "../../lib/types";

interface DashboardProps {
  students: Student[];
  batches: Batch[];
  payments: Payment[];
  attendance: AttendanceRecord[];
  papers: Paper[];
  marks: Mark[];
  role: Role;
}

const CHART_COLORS = ["#1B3A6B", "#C05621", "#2D7A4F", "#7C3AED"];

export function Dashboard({ students, batches, payments, attendance, papers, marks, role }: DashboardProps) {
  const activeStudents = students.filter((s) => s.active).length;
  const activeBatches = batches.filter((b) => b.active).length;
  const mayPays = payments.filter((p) => p.month === "2025-05");
  const monthlyIncome = mayPays.reduce((s, p) => s + p.amount, 0);
  const totalAtt = attendance.length;
  const presentAtt = attendance.filter((a) => a.present).length;
  const attRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;
  const publishedPapers = papers.filter((p) => p.published);

  const monthlyData = ["2025-02", "2025-03", "2025-04", "2025-05"].map((m) => ({
    month: fmtMonth(m).split(" ")[0],
    income: payments.filter((p) => p.month === m).reduce((s, p) => s + p.amount, 0) / 1000,
  }));

  const batchData = batches.filter((b) => b.active).map((b) => ({
    name: b.name.split(" ")[0] + " " + b.name.split(" ")[1],
    count: students.filter((s) => s.batchIds.includes(b.id) && s.active).length,
  }));

  const recentPays = [...payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  const upcomingDates = ["2025-06-21", "2025-06-22", "2025-06-28", "2025-06-29"];
  const upcomingClasses = batches
    .filter((b) => b.active)
    .flatMap((b) =>
      upcomingDates
        .filter((d) => new Date(d).toLocaleDateString("en-US", { weekday: "long" }) === b.day)
        .slice(0, 1)
        .map((d) => ({ batch: b, date: d }))
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const avgMarks = publishedPapers.map((p) => {
    const pMarks = marks.filter((m) => m.paperId === p.id);
    const avg = pMarks.length > 0 ? Math.round(pMarks.reduce((s, m) => s + m.marks, 0) / pMarks.length) : 0;
    return { name: p.name.split(" — ")[0].split(" ").slice(-2).join(" "), avg, total: p.totalMarks };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Overview of your institute — June 2025</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard label="Total Students" value={students.length} icon={Users} color="navy" />
        <StatCard label="Active Students" value={activeStudents} icon={CheckCircle} color="emerald" trend="+2 this month" />
        <StatCard label="Active Batches" value={activeBatches} icon={Layers} color="blue" />
        <StatCard label="May Income" value={`LKR ${(monthlyIncome / 1000).toFixed(1)}k`} icon={DollarSign} color="amber" trend="↑ 12% vs Apr" />
        <StatCard label="Attendance Rate" value={`${attRate}%`} icon={CalendarCheck} color="purple" sub="Overall all batches" />
        <StatCard label="Papers Published" value={publishedPapers.length} icon={FileText} color="rose" sub={`${papers.length - publishedPapers.length} unpublished`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Income (LKR thousands)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={monthlyData}>
              <defs>
                <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1B3A6B" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1B3A6B" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v: number) => [`LKR ${(v * 1000).toLocaleString()}`, "Income"]}
                contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
              />
              <Area type="monotone" dataKey="income" stroke="#1B3A6B" strokeWidth={2} fill="url(#incGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Students by Batch</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={batchData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count">
                {batchData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {batchData.map((b, i) => (
              <div key={b.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="text-muted-foreground">{b.name}</span>
                </div>
                <span className="font-medium">{b.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Upcoming + Recent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Classes</h3>
          {upcomingClasses.length === 0 ? (
            <EmptyState icon={Calendar} title="No upcoming classes" desc="No classes scheduled in the next two weeks." />
          ) : (
            <div className="space-y-3">
              {upcomingClasses.map(({ batch, date }) => (
                <div key={batch.id + date} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary">
                    <span className="text-xs font-bold">{new Date(date).toLocaleDateString("en-US", { day: "2-digit" })}</span>
                    <span className="text-[10px]">{new Date(date).toLocaleDateString("en-US", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{batch.name}</p>
                    <p className="text-xs text-muted-foreground">{batch.day} · {batch.startTime} – {batch.endTime}</p>
                  </div>
                  <Badge v="default">
                    {students.filter((s) => s.batchIds.includes(batch.id) && s.active).length} students
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent Payments</h3>
          <div className="space-y-2.5">
            {recentPays.map((p) => {
              const st = students.find((s) => s.id === p.studentId);
              const bt = batches.find((b) => b.id === p.batchId);
              if (!st || !bt) return null;
              return (
                <div key={p.id} className="flex items-center gap-3">
                  <Avatar name={st.fullName} size="sm" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{st.fullName}</p>
                    <p className="text-xs text-muted-foreground">{fmtMonth(p.month)} · {bt.name.split(" ")[0]} {bt.name.split(" ")[1]}</p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600 font-mono">{fmtCur(p.amount)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {role === "admin" && (
          <Card className="p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-foreground mb-4">Paper Performance Overview</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={avgMarks} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                <Bar dataKey="avg" name="Avg Marks" fill="#1B3A6B" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" name="Total Marks" fill="#E4E1D9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>
    </div>
  );
}
