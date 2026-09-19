import { useEffect, useState } from "react";
import {
  Users, CheckCircle, Layers, DollarSign, CalendarCheck,
  FileText, Calendar, BookOpen, AlertTriangle, RefreshCw, TrendingUp,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Card, StatCard, Badge, EmptyState, Btn } from "../ui";
import { cn, fmtCur } from "../../lib/utils";
import { getStatsOverview, getFinanceStats, getPerformanceStats } from "../../api/apiCalls";
import type { Role } from "../../lib/types";

// Palette from src/styles/theme.css (--chart-1..5).
const CHART = ["#1B3A6B", "#C05621", "#2D7A4F", "#7C3AED", "#0891B2"];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface BatchRow {
  id: string;
  name: string;
  is_active: boolean;
  day: string;
  start_time: string;
  end_time: string;
  students: number;
}

interface UpcomingClass {
  batch: BatchRow;
  date: Date;
  today: boolean;
}

/**
 * The next calendar date on which `day` falls.
 *
 * Today only counts while the class has not started yet — a class that began
 * two hours ago is not "upcoming", so those roll forward a week.
 */
function nextClassDate(batch: BatchRow, now: Date = new Date()): Date | null {
  const target = DAY_NAMES.indexOf(batch.day);
  if (target < 0) return null;

  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const delta = (target - at.getDay() + 7) % 7;
  at.setDate(at.getDate() + delta);

  if (delta === 0) {
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (batch.start_time && batch.start_time <= hhmm) at.setDate(at.getDate() + 7);
  }
  return at;
}

function upcomingClasses(batches: BatchRow[]): UpcomingClass[] {
  const now = new Date();
  return batches
    .filter((b) => b.is_active)
    .map((batch) => {
      const date = nextClassDate(batch, now);
      if (!date) return null;
      return { batch, date, today: date.toDateString() === now.toDateString() };
    })
    .filter((x): x is UpcomingClass => x !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 5);
}

export function Dashboard({ role }: { role: Role }) {
  const [overview, setOverview] = useState<any>(null);
  const [finance, setFinance] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isAdmin = role === "admin";

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setDataLoading(true);
      setDataError(null);
      try {
        // Finance is only requested for an admin — the server would 403 a
        // staff token anyway, and the page must not depend on catching that.
        const [ovRes, perfRes, finRes] = await Promise.all([
          getStatsOverview(),
          getPerformanceStats(),
          isAdmin ? getFinanceStats(6) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setOverview(ovRes?.data ?? null);
        setPerformance(perfRes?.data ?? null);
        setFinance(finRes?.data ?? null);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading dashboard data:", error);
        setDataError("Could not load dashboard data. Please try again.");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isAdmin, reloadKey]);

  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Loading…</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-5 h-[104px] animate-pulse bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  if (dataError || !overview) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{dataError ?? "No data available."}</p>
              <p className="text-xs text-muted-foreground mt-1">
                The stats service may be unreachable. Check the backend is running, then retry.
              </p>
              <Btn v="outline" sz="sm" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Btn>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const students = overview.students ?? {};
  const batches = overview.batches ?? {};
  const classWork = overview.class_work ?? {};
  const perf = overview.performance ?? {};
  const fin = overview.finance; // null for staff

  const batchRows: BatchRow[] = batches.list ?? [];
  const classBatchRows = batchRows.filter((b) => b.is_active);
  const upcoming = upcomingClasses(batchRows);

  const incomeTrend = (finance?.income_trend ?? []).map((t: any) => ({
    label: t.label,
    income: (t.collected ?? 0) / 1000,
  }));

  const batchPie = classBatchRows
    .filter((b) => b.students > 0)
    .map((b) => ({ name: b.name, count: b.students }));

  const paperAverages = (performance?.per_paper ?? [])
    .filter((p: any) => p.average != null)
    .slice(0, 6)
    .map((p: any) => ({
      name: String(p.paper_name ?? "").length > 14 ? `${String(p.paper_name).slice(0, 13)}…` : p.paper_name,
      average: p.average,
      entries: p.entries,
    }));

  // Month-over-month movement on collections, shown only when there is a
  // previous month to compare against (a 0 → N jump is not a percentage).
  const incomeDelta =
    fin && fin.collected_prev_month > 0
      ? Math.round(((fin.collected_this_month - fin.collected_prev_month) / fin.collected_prev_month) * 100)
      : null;

  const cards: { label: string; value: string | number; icon: React.ElementType; color: any; sub?: string; trend?: string }[] = [
    { label: "Total Students", value: students.total ?? 0, icon: Users, color: "navy" },
    {
      label: "Active Students",
      value: students.active ?? 0,
      icon: CheckCircle,
      color: "emerald",
      sub: `${students.new_this_month ?? 0} joined this month`,
    },
    {
      label: "Active Batches",
      value: batches.active ?? 0,
      icon: Layers,
      color: "blue",
      sub: `${batches.total ?? 0} total`,
    },
    ...(isAdmin && fin
      ? [{
          label: `${overview.month_label ?? "This month"} Income`,
          value: fmtCur(fin.collected_this_month),
          icon: DollarSign,
          color: "amber" as const,
          sub: `${fin.collection_rate}% of ${fmtCur(fin.expected_this_month)} expected`,
          trend: incomeDelta == null ? undefined : `${incomeDelta >= 0 ? "↑" : "↓"} ${Math.abs(incomeDelta)}% vs last month`,
        }]
      : []),
    {
      label: "Attendance Rate",
      value: `${classWork.attendance_rate ?? 0}%`,
      icon: CalendarCheck,
      color: "purple",
      sub: `${classWork.attendance_present ?? 0} of ${classWork.attendance_expected ?? 0} this month`,
    },
    {
      label: "Papers Published",
      value: perf.published ?? 0,
      icon: FileText,
      color: "rose",
      sub: `${perf.unpublished ?? 0} unpublished · ${perf.marks_recorded ?? 0} marks`,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Overview of your institute — {overview.month_label ?? ""}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {cards.map((c) => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} color={c.color} sub={c.sub} trend={c.trend} />
        ))}
      </div>

      {/* Charts row — income is admin-only, so the pie takes the full width for staff */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {isAdmin && (
          <Card className="p-5 lg:col-span-2">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              Monthly Income (LKR thousands)
            </h3>
            {incomeTrend.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No payment history" desc="No payments recorded in the last six months." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={incomeTrend}>
                  <defs>
                    <linearGradient id="incGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART[0]} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={CHART[0]} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [`LKR ${(v * 1000).toLocaleString()}`, "Collected"]}
                    contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="income" stroke={CHART[0]} strokeWidth={2} fill="url(#incGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Card>
        )}

        <Card className={cn("p-5", !isAdmin && "lg:col-span-3")}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Students by Batch</h3>
          {batchPie.length === 0 ? (
            <EmptyState icon={Layers} title="No students enrolled" desc="Batches have no active students yet." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={batchPie} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="count">
                    {batchPie.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {batchPie.map((b, i) => (
                  <div key={b.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART[i % CHART.length] }} />
                      <span className="text-muted-foreground truncate">{b.name}</span>
                    </div>
                    <span className="font-medium font-mono">{b.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Class work + upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Class Work</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Class Days", value: classWork.class_days_this_month ?? 0, sub: "this month" },
              { label: "Attendance", value: `${classWork.attendance_rate ?? 0}%`, sub: "this month" },
              { label: "Lessons", value: classWork.lessons ?? 0, sub: "total" },
              { label: "Materials", value: classWork.materials ?? 0, sub: "total" },
            ].map((s) => (
              <div key={s.label} className="p-3 rounded-xl bg-muted/40">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-lg font-bold font-mono text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.sub}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Average mark (all papers)</span>
              <span className="font-mono font-semibold text-foreground">
                {perf.average_mark == null ? "—" : `${perf.average_mark}%`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Graded papers</span>
              <span className="font-mono font-semibold text-foreground">
                {performance?.totals?.graded_papers ?? 0} of {perf.papers ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Students assessed</span>
              <span className="font-mono font-semibold text-foreground">
                {performance?.totals?.students_assessed ?? 0}
              </span>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Upcoming Classes</h3>
          {upcoming.length === 0 ? (
            <EmptyState
              icon={Calendar}
              title="No upcoming classes"
              desc="No active batch has a scheduled class day in the coming week."
            />
          ) : (
            <div className="space-y-3">
              {upcoming.map(({ batch, date, today }) => (
                <div key={batch.id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center text-primary shrink-0">
                    <span className="text-xs font-bold">{date.toLocaleDateString("en-US", { day: "2-digit" })}</span>
                    <span className="text-[10px]">{date.toLocaleDateString("en-US", { month: "short" })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{batch.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {batch.day} · {batch.start_time} – {batch.end_time}
                    </p>
                  </div>
                  {today && <Badge v="accent">Today</Badge>}
                  <Badge v="default">{batch.students} students</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Performance + finance detail */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className={cn("p-5", !isAdmin && "lg:col-span-2")}>
          <h3 className="text-sm font-semibold text-foreground mb-4">Recent Paper Averages</h3>
          {paperAverages.length === 0 ? (
            <EmptyState icon={BookOpen} title="No graded papers" desc="Marks have not been entered for any paper yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={paperAverages} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                <Tooltip
                  formatter={(v: number, _n, p: any) => [`${v}%  (${p?.payload?.entries ?? 0} marks)`, "Average"]}
                  contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                />
                <Bar dataKey="average" name="Average" fill={CHART[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {isAdmin && fin && (
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Outstanding Fees</h3>
              <span className="text-sm font-mono font-bold text-red-600">{fmtCur(fin.outstanding)}</span>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-muted/40">
                <p className="text-xs text-muted-foreground">Defaulters</p>
                <p className="text-lg font-bold font-mono text-foreground">{fin.defaulters}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40">
                <p className="text-xs text-muted-foreground">Batches owing</p>
                <p className="text-lg font-bold font-mono text-foreground">{fin.batches_with_outstanding}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/40">
                <p className="text-xs text-muted-foreground">Collected</p>
                <p className="text-lg font-bold font-mono text-foreground">{fin.collection_rate}%</p>
              </div>
            </div>

            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Largest balances
            </p>
            {(fin.top_defaulters ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No outstanding balances.</p>
            ) : (
              <div className="space-y-2.5">
                {fin.top_defaulters.map((d: any) => (
                  <div key={d.call_up_no} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.call_up_no} · {d.batch_name} · {d.months} month{d.months === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-red-600 font-mono shrink-0">
                      {fmtCur(d.outstanding)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Collections detail — admin only */}
      {isAdmin && finance && (
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Collections</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-muted/40">
              <p className="text-xs text-muted-foreground">Collected this month</p>
              <p className="text-lg font-bold font-mono text-foreground">{fmtCur(finance.totals.collected_this_month)}</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/40">
              <p className="text-xs text-muted-foreground">Expected this month</p>
              <p className="text-lg font-bold font-mono text-foreground">{fmtCur(finance.totals.expected_this_month)}</p>
            </div>
            <div className="p-4 rounded-xl bg-muted/40">
              <p className="text-xs text-muted-foreground">Collected all time</p>
              <p className="text-lg font-bold font-mono text-foreground">{fmtCur(finance.totals.collected_all_time)}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Expected covers active students billed for the current month; outstanding covers every unpaid
            month since each batch started. Totals are the same figures the Fees page shows per student.
          </p>
        </Card>
      )}
    </div>
  );
}
