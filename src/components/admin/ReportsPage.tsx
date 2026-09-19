import { useEffect, useState } from "react";
import {
  Download, AlertTriangle, RefreshCw, Wallet, GraduationCap,
  CalendarCheck, BarChart3,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Card, Badge, EmptyState, Btn, Sel } from "../ui";
import { cn, fmtCur, fmtDate } from "../../lib/utils";
import {
  getFinanceStats, getPerformanceStats, getAttendanceStats, getAllBatches,
} from "../../api/apiCalls";
import { toCsv, downloadCsv, todayStamp } from "../../lib/csv";

// Palette from src/styles/theme.css (--chart-1..5).
const CHART = ["#1B3A6B", "#C05621", "#2D7A4F", "#7C3AED", "#0891B2"];

const RANGES = [
  { v: "1", label: "This month" },
  { v: "3", label: "Last 3 months" },
  { v: "6", label: "Last 6 months" },
  { v: "12", label: "Last 12 months" },
  { v: "year", label: "This year" },
];

const TH = "text-left pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide";
const TD = "py-2.5 pr-4 text-sm";

/** Section heading with its own CSV button — each export matches what is shown. */
function SectionHeader({ title, desc, onExport }: { title: string; desc?: string; onExport?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      {onExport && (
        <Btn v="outline" sz="xs" onClick={onExport} className="shrink-0">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </Btn>
      )}
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: "good" | "bad" }) {
  return (
    <div className="p-3 rounded-xl bg-muted/40">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "text-lg font-bold font-mono",
          tone === "bad" ? "text-red-600" : tone === "good" ? "text-emerald-600" : "text-foreground"
        )}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="py-8 text-center text-sm text-muted-foreground">
        {text}
      </td>
    </tr>
  );
}

export function ReportsPage() {
  const [range, setRange] = useState("6");
  const [batchId, setBatchId] = useState("");
  const [batches, setBatches] = useState<{ id: string; name: string }[]>([]);

  const [finance, setFinance] = useState<any>(null);
  const [performance, setPerformance] = useState<any>(null);
  const [attendance, setAttendance] = useState<any>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const months = range === "year" ? new Date().getMonth() + 1 : Number(range);

  // Batch list for the filter — fetched once, independent of the filters.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await getAllBatches(1, 100);
        if (cancelled) return;
        setBatches((res?.data?.data ?? []).map((b: any) => ({ id: b.id, name: b.name })));
      } catch (error) {
        // A missing batch list degrades the filter to "All batches"; it must
        // not blank the whole page.
        console.error("Error fetching batches for the reports filter:", error);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setDataLoading(true);
      setDataError(null);
      try {
        const [finRes, perfRes, attRes] = await Promise.all([
          getFinanceStats(months, batchId),
          getPerformanceStats(batchId),
          getAttendanceStats(months, batchId),
        ]);
        if (cancelled) return;
        setFinance(finRes?.data ?? null);
        setPerformance(perfRes?.data ?? null);
        setAttendance(attRes?.data ?? null);
      } catch (error) {
        if (cancelled) return;
        console.error("Error loading reports:", error);
        setDataError("Could not load report data. Please try again.");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [months, batchId, reloadKey]);

  const batchLabel = batches.find((b) => b.id === batchId)?.name ?? "All batches";
  const scope = `${batchLabel.replace(/\s+/g, "-").toLowerCase()}`;

  const fin = finance?.totals;
  const perf = performance?.totals;
  const att = attendance?.totals;

  const perBatch: any[] = finance?.per_batch ?? [];
  const defaulters: any[] = finance?.defaulters ?? [];
  const perSubject: any[] = performance?.per_subject ?? [];
  const perPaper: any[] = performance?.per_paper ?? [];
  const ranked: any[] = performance?.students ?? [];
  const distribution: any[] = performance?.distribution ?? [];
  const attPerBatch: any[] = attendance?.per_batch ?? [];
  const attByMonth: any[] = attendance?.by_month ?? [];
  const recentDays: any[] = attendance?.recent_days ?? [];
  const incomeTrend: any[] = finance?.income_trend ?? [];

  const incomeData = incomeTrend.map((t) => ({ label: t.label, income: (t.collected ?? 0) / 1000 }));

  // ── Exports — one per section, mirroring the rows rendered above ─────────
  const exportIncome = () =>
    downloadCsv(`reports-income-trend-${scope}-${todayStamp()}`, toCsv(incomeTrend, [
      { header: "Month", value: (r) => r.month },
      { header: "Label", value: (r) => r.label },
      { header: "Collected (LKR)", value: (r) => r.collected },
    ]));

  const exportPerBatch = () =>
    downloadCsv(`reports-batch-collection-${scope}-${todayStamp()}`, toCsv(perBatch, [
      { header: "Batch", value: (r) => r.batch_name },
      { header: "Students", value: (r) => r.students },
      { header: "Monthly Fee (LKR)", value: (r) => r.monthly_fee },
      { header: "Expected This Month (LKR)", value: (r) => r.expected_this_month },
      { header: "Collected This Month (LKR)", value: (r) => r.collected_this_month },
      { header: "Collection Rate (%)", value: (r) => r.collection_rate },
      { header: "Outstanding (LKR)", value: (r) => r.outstanding },
      { header: "Defaulters", value: (r) => r.defaulters },
    ]));

  const exportDefaulters = () =>
    downloadCsv(`reports-defaulters-${scope}-${todayStamp()}`, toCsv(defaulters, [
      { header: "Call-up No", value: (r) => r.call_up_no },
      { header: "Name", value: (r) => r.name },
      { header: "Batch", value: (r) => r.batch_name },
      { header: "Monthly Fee (LKR)", value: (r) => r.monthly_fee },
      { header: "Unpaid Months", value: (r) => r.months },
      { header: "Paid To Date (LKR)", value: (r) => r.paid_total },
      { header: "Outstanding (LKR)", value: (r) => r.outstanding },
    ]));

  const exportSubjects = () =>
    downloadCsv(`reports-subject-averages-${scope}-${todayStamp()}`, toCsv(perSubject, [
      { header: "Subject", value: (r) => r.subject },
      { header: "Type", value: (r) => r.subject_type },
      { header: "Papers", value: (r) => r.papers },
      { header: "Marks Recorded", value: (r) => r.entries },
      { header: "Average (%)", value: (r) => r.average },
    ]));

  const exportPapers = () =>
    downloadCsv(`reports-paper-averages-${scope}-${todayStamp()}`, toCsv(perPaper, [
      { header: "Paper", value: (r) => r.paper_name },
      { header: "Batch", value: (r) => r.batch_name },
      { header: "Subject", value: (r) => r.subject },
      { header: "Date", value: (r) => (r.paper_date ? String(r.paper_date).slice(0, 10) : "") },
      { header: "Marks Recorded", value: (r) => r.entries },
      { header: "Average (%)", value: (r) => r.average },
      { header: "Highest", value: (r) => r.highest },
      { header: "Lowest", value: (r) => r.lowest },
      { header: "Released", value: (r) => (r.is_mark_released ? "Yes" : "No") },
    ]));

  const exportStudents = () =>
    downloadCsv(`reports-student-performance-${scope}-${todayStamp()}`, toCsv(ranked, [
      { header: "Rank", value: (r) => r.rank },
      { header: "Call-up No", value: (r) => r.call_up_no },
      { header: "Name", value: (r) => r.name },
      { header: "Batch", value: (r) => r.batch_name },
      { header: "School", value: (r) => r.school },
      { header: "Papers Sat", value: (r) => r.papers },
      { header: "Average (%)", value: (r) => r.average },
      { header: "Best (%)", value: (r) => r.best },
    ]));

  const exportDistribution = () =>
    downloadCsv(`reports-grade-distribution-${scope}-${todayStamp()}`, toCsv(distribution, [
      { header: "Band (%)", value: (r) => r.band },
      { header: "Marks", value: (r) => r.count },
      { header: "Share (%)", value: (r) => r.share },
    ]));

  const exportAttendanceByMonth = () =>
    downloadCsv(`reports-attendance-by-month-${scope}-${todayStamp()}`, toCsv(attByMonth, [
      { header: "Month", value: (r) => r.month },
      { header: "Label", value: (r) => r.label },
      { header: "Class Days", value: (r) => r.class_days },
      { header: "Present", value: (r) => r.present },
      { header: "Expected", value: (r) => r.expected },
      { header: "Attendance Rate (%)", value: (r) => r.attendance_rate },
    ]));

  const exportAttendanceByBatch = () =>
    downloadCsv(`reports-attendance-by-batch-${scope}-${todayStamp()}`, toCsv(attPerBatch, [
      { header: "Batch", value: (r) => r.batch_name },
      { header: "Class Days", value: (r) => r.class_days },
      { header: "Present", value: (r) => r.present },
      { header: "Expected", value: (r) => r.expected },
      { header: "Attendance Rate (%)", value: (r) => r.attendance_rate },
    ]));

  const exportRecentDays = () =>
    downloadCsv(`reports-class-days-${scope}-${todayStamp()}`, toCsv(recentDays, [
      { header: "Date", value: (r) => (r.date ? String(r.date).slice(0, 10) : "") },
      { header: "Batch", value: (r) => r.batch_name },
      { header: "Present", value: (r) => r.present },
      { header: "Expected", value: (r) => r.expected },
      { header: "Attendance Rate (%)", value: (r) => r.attendance_rate },
    ]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Aggregate analytics — finance, student performance and class work
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Sel value={range} onChange={(e) => setRange(e.target.value)} className="w-40">
            {RANGES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
          </Sel>
          <Sel value={batchId} onChange={(e) => setBatchId(e.target.value)} className="w-48">
            <option value="">All batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Sel>
        </div>
      </div>

      {dataLoading ? (
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Loading report data…</p>
        </Card>
      ) : dataError ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-red-100 shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{dataError}</p>
              <Btn v="outline" sz="sm" className="mt-3" onClick={() => setReloadKey((k) => k + 1)}>
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </Btn>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* ── Finance ─────────────────────────────────────────────────── */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Finance</h2>
              <Badge v="muted">{batchLabel}</Badge>
            </div>

            <Card className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Kpi label="Collected this month" value={fmtCur(fin?.collected_this_month ?? 0)} />
                <Kpi label="Expected this month" value={fmtCur(fin?.expected_this_month ?? 0)} />
                <Kpi
                  label="Collection rate"
                  value={`${fin?.collection_rate ?? 0}%`}
                  tone={(fin?.collection_rate ?? 0) >= 80 ? "good" : "bad"}
                />
                <Kpi label="Outstanding" value={fmtCur(fin?.outstanding ?? 0)} tone={(fin?.outstanding ?? 0) > 0 ? "bad" : "good"} />
                <Kpi label="Defaulters" value={fin?.defaulters ?? 0} tone={(fin?.defaulters ?? 0) > 0 ? "bad" : "good"} />
                <Kpi label="Collected all time" value={fmtCur(fin?.collected_all_time ?? 0)} />
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader
                title="Income Trend"
                desc={`Collected per month over the last ${months} month${months === 1 ? "" : "s"}`}
                onExport={incomeData.length ? exportIncome : undefined}
              />
              {incomeData.length === 0 ? (
                <EmptyState icon={BarChart3} title="No payment history" desc="No payments recorded in this period." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={incomeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(v: number) => [`LKR ${(v * 1000).toLocaleString()}`, "Collected"]}
                      contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                    />
                    <Line type="monotone" dataKey="income" stroke={CHART[0]} strokeWidth={2.5} dot={{ fill: CHART[0], r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card className="p-5">
              <SectionHeader
                title="Collection by Batch"
                desc="Expected is the current month's billing for active students; outstanding is every unpaid month since the batch started"
                onExport={perBatch.length ? exportPerBatch : undefined}
              />
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      {["Batch", "Students", "Fee/mo", "Expected", "Collected", "Rate", "Outstanding", "Defaulters"].map((h) => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perBatch.length === 0 ? (
                      <EmptyRow cols={8} text="No batches in scope." />
                    ) : perBatch.map((b) => (
                      <tr key={b.batch_id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className={cn(TD, "font-medium text-foreground")}>{b.batch_name}</td>
                        <td className={cn(TD, "font-mono")}>{b.students}</td>
                        <td className={cn(TD, "font-mono")}>{fmtCur(b.monthly_fee)}</td>
                        <td className={cn(TD, "font-mono")}>{fmtCur(b.expected_this_month)}</td>
                        <td className={cn(TD, "font-mono")}>{fmtCur(b.collected_this_month)}</td>
                        <td className={cn(TD, "font-mono", b.collection_rate >= 80 ? "text-emerald-600" : b.collection_rate > 0 ? "text-amber-600" : "text-muted-foreground")}>
                          {b.collection_rate}%
                        </td>
                        <td className={cn(TD, "font-mono", b.outstanding > 0 ? "text-red-600" : "text-muted-foreground")}>
                          {fmtCur(b.outstanding)}
                        </td>
                        <td className={cn(TD, "font-mono")}>{b.defaulters}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader
                title="Outstanding Balances"
                desc={`${defaulters.length} student${defaulters.length === 1 ? "" : "s"} with at least one unpaid month — worst first`}
                onExport={defaulters.length ? exportDefaulters : undefined}
              />
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      {["Call-up No", "Name", "Batch", "Unpaid", "Fee/mo", "Paid to date", "Outstanding"].map((h) => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {defaulters.length === 0 ? (
                      <EmptyRow cols={7} text="Every student in scope is paid up." />
                    ) : defaulters.map((d) => (
                      <tr key={d.call_up_no} className="border-b border-border/50 hover:bg-muted/20">
                        <td className={cn(TD, "font-mono text-xs")}>{d.call_up_no}</td>
                        <td className={cn(TD, "font-medium text-foreground")}>{d.name}</td>
                        <td className={cn(TD, "text-xs text-muted-foreground")}>{d.batch_name}</td>
                        <td className={cn(TD, "font-mono")}>
                          {d.months} mo{d.months === 1 ? "" : "s"}
                        </td>
                        <td className={cn(TD, "font-mono")}>{fmtCur(d.monthly_fee)}</td>
                        <td className={cn(TD, "font-mono text-muted-foreground")}>{fmtCur(d.paid_total)}</td>
                        <td className={cn(TD, "font-mono font-semibold text-red-600")}>{fmtCur(d.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* ── Student performance ─────────────────────────────────────── */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Student Performance</h2>
              <Badge v="muted">{batchLabel}</Badge>
              <Badge v="muted">all time</Badge>
            </div>

            <Card className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Kpi label="Papers" value={perf?.papers ?? 0} />
                <Kpi label="Graded papers" value={perf?.graded_papers ?? 0} />
                <Kpi label="Marks recorded" value={perf?.marks_recorded ?? 0} />
                <Kpi label="Average mark" value={perf?.average_mark == null ? "—" : `${perf.average_mark}%`} />
                <Kpi label="Subjects" value={perf?.subjects ?? 0} />
                <Kpi label="Students assessed" value={perf?.students_assessed ?? 0} />
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5">
                <SectionHeader
                  title="Grade Distribution"
                  desc="Every recorded mark in scope"
                  onExport={distribution.some((d) => d.count > 0) ? exportDistribution : undefined}
                />
                {distribution.length === 0 ? (
                  <EmptyState icon={GraduationCap} title="No marks" desc="No marks have been recorded for this selection." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={distribution} barSize={40}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="band" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        formatter={(v: number, _n, p: any) => [`${v} mark${v === 1 ? "" : "s"} (${p?.payload?.share ?? 0}%)`, "Students"]}
                        contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                      />
                      <Bar dataKey="count" name="Marks" radius={[4, 4, 0, 0]}>
                        {distribution.map((_, i) => <Cell key={i} fill={CHART[i % CHART.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card className="p-5">
                <SectionHeader
                  title="Average by Subject"
                  desc="Weighted by marks recorded, not by paper"
                  onExport={perSubject.length ? exportSubjects : undefined}
                />
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {["Subject", "Type", "Papers", "Marks", "Average"].map((h) => (
                          <th key={h} className={TH}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {perSubject.length === 0 ? (
                        <EmptyRow cols={5} text="No graded subjects in scope." />
                      ) : perSubject.map((s) => (
                        <tr key={s.subject} className="border-b border-border/50 hover:bg-muted/20">
                          <td className={cn(TD, "font-medium text-foreground")}>{s.subject}</td>
                          <td className={TD}><Badge v="muted">{s.subject_type ?? "—"}</Badge></td>
                          <td className={cn(TD, "font-mono")}>{s.papers}</td>
                          <td className={cn(TD, "font-mono")}>{s.entries}</td>
                          <td className={cn(TD, "font-mono font-semibold", (s.average ?? 0) >= 70 ? "text-emerald-600" : (s.average ?? 0) >= 50 ? "text-amber-600" : "text-red-500")}>
                            {s.average == null ? "—" : `${s.average}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <SectionHeader
                title="Paper Averages"
                desc="Computed live from recorded marks — paper.avg_marks is not maintained"
                onExport={perPaper.length ? exportPapers : undefined}
              />
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      {["Paper", "Batch", "Subject", "Date", "Marks", "Average", "High", "Low", "Released"].map((h) => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perPaper.length === 0 ? (
                      <EmptyRow cols={9} text="No papers in scope." />
                    ) : perPaper.map((p) => (
                      <tr key={p.paper_id} className="border-b border-border/50 hover:bg-muted/20">
                        <td className={cn(TD, "font-medium text-foreground")}>{p.paper_name}</td>
                        <td className={cn(TD, "text-xs text-muted-foreground")}>{p.batch_name}</td>
                        <td className={cn(TD, "text-xs text-muted-foreground")}>{p.subject}</td>
                        <td className={cn(TD, "text-xs text-muted-foreground")}>{p.paper_date ? fmtDate(p.paper_date) : "—"}</td>
                        <td className={cn(TD, "font-mono")}>{p.entries}</td>
                        <td className={cn(TD, "font-mono font-semibold")}>{p.average == null ? "—" : `${p.average}%`}</td>
                        <td className={cn(TD, "font-mono text-emerald-600")}>{p.highest ?? "—"}</td>
                        <td className={cn(TD, "font-mono text-red-500")}>{p.lowest ?? "—"}</td>
                        <td className={TD}>
                          <Badge v={p.is_mark_released ? "success" : "muted"}>
                            {p.is_mark_released ? "Released" : "Draft"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-5">
              <SectionHeader
                title="Student Ranking"
                desc="Mean of every recorded mark — marks are scored 0–100, so the mean is already a percentage"
                onExport={ranked.length ? exportStudents : undefined}
              />
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      {["Rank", "Student", "Batch", "School", "Papers", "Average", "Best"].map((h) => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ranked.length === 0 ? (
                      <EmptyRow cols={7} text="No student has recorded marks in scope." />
                    ) : ranked.map((s) => (
                      <tr key={s.call_up_no} className="border-b border-border/50 hover:bg-muted/20">
                        <td className={cn(TD, "font-mono text-muted-foreground")}>{s.rank}</td>
                        <td className={cn(TD, "font-medium text-foreground")}>{s.name}</td>
                        <td className={cn(TD, "text-xs text-muted-foreground")}>{s.batch_name}</td>
                        <td className={cn(TD, "text-xs text-muted-foreground")}>{s.school}</td>
                        <td className={cn(TD, "font-mono")}>{s.papers}</td>
                        <td className={cn(TD, "font-mono font-semibold", s.average >= 70 ? "text-emerald-600" : s.average >= 50 ? "text-amber-600" : "text-red-500")}>
                          {s.average}%
                        </td>
                        <td className={cn(TD, "font-mono")}>{s.best}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* ── Class work ──────────────────────────────────────────────── */}
          <section className="space-y-6">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-base font-semibold text-foreground">Class Work</h2>
              <Badge v="muted">{batchLabel}</Badge>
            </div>

            <Card className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Kpi label="Class days" value={att?.class_days ?? 0} />
                <Kpi label="Attendance rate" value={`${att?.attendance_rate ?? 0}%`} />
                <Kpi label="Present" value={att?.present ?? 0} />
                <Kpi label="Lessons" value={att?.lessons ?? 0} />
                <Kpi label="Materials" value={att?.materials ?? 0} />
                <Kpi label="Active access grants" value={att?.active_access_grants ?? 0} />
              </div>
              {att?.materials_by_type && Object.keys(att.materials_by_type).length > 0 && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">Materials by type:</span>
                  {Object.entries(att.materials_by_type).map(([type, n]) => (
                    <Badge key={type} v="muted">{type}: {n as number}</Badge>
                  ))}
                </div>
              )}
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-5">
                <SectionHeader
                  title="Attendance Rate by Month"
                  desc="Present rows over the roster expected on each class day"
                  onExport={attByMonth.length ? exportAttendanceByMonth : undefined}
                />
                {attByMonth.length === 0 ? (
                  <EmptyState icon={CalendarCheck} title="No class days" desc="No classes were held in this period." />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={attByMonth} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                      <Tooltip
                        formatter={(v: number, _n, p: any) => [
                          `${v}%  (${p?.payload?.present ?? 0}/${p?.payload?.expected ?? 0} over ${p?.payload?.class_days ?? 0} day(s))`,
                          "Attendance",
                        ]}
                        contentStyle={{ borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 }}
                      />
                      <Bar dataKey="attendance_rate" name="Attendance" fill={CHART[2]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Card>

              <Card className="p-5">
                <SectionHeader
                  title="Attendance by Batch"
                  desc="Across the selected period"
                  onExport={attPerBatch.length ? exportAttendanceByBatch : undefined}
                />
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        {["Batch", "Days", "Present", "Expected", "Rate"].map((h) => (
                          <th key={h} className={TH}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {attPerBatch.length === 0 ? (
                        <EmptyRow cols={5} text="No class days in scope." />
                      ) : attPerBatch.map((b) => (
                        <tr key={b.batch_id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className={cn(TD, "font-medium text-foreground")}>{b.batch_name}</td>
                          <td className={cn(TD, "font-mono")}>{b.class_days}</td>
                          <td className={cn(TD, "font-mono")}>{b.present}</td>
                          <td className={cn(TD, "font-mono text-muted-foreground")}>{b.expected}</td>
                          <td className={cn(TD, "font-mono font-semibold", b.attendance_rate >= 80 ? "text-emerald-600" : b.attendance_rate >= 60 ? "text-amber-600" : "text-red-500")}>
                            {b.attendance_rate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <SectionHeader
                title="Recent Class Days"
                desc="The 15 most recent days in the selected period"
                onExport={recentDays.length ? exportRecentDays : undefined}
              />
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      {["Date", "Batch", "Present", "Expected", "Rate"].map((h) => (
                        <th key={h} className={TH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {recentDays.length === 0 ? (
                      <EmptyRow cols={5} text="No class days in scope." />
                    ) : recentDays.map((d, i) => (
                      <tr key={`${d.date}-${d.batch_name}-${i}`} className="border-b border-border/50 hover:bg-muted/20">
                        <td className={cn(TD, "text-xs text-muted-foreground")}>{d.date ? fmtDate(d.date) : "—"}</td>
                        <td className={cn(TD, "font-medium text-foreground")}>{d.batch_name}</td>
                        <td className={cn(TD, "font-mono")}>{d.present}</td>
                        <td className={cn(TD, "font-mono text-muted-foreground")}>{d.expected}</td>
                        <td className={cn(TD, "font-mono font-semibold", d.attendance_rate >= 80 ? "text-emerald-600" : d.attendance_rate >= 60 ? "text-amber-600" : "text-red-500")}>
                          {d.attendance_rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
