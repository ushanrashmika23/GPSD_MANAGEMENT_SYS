import { useState, useMemo } from "react";
import { Search, CheckCircle, XCircle, Clock, Check, X, BarChart2, CalendarCheck, Users, PlusCircle, QrCodeIcon } from "lucide-react";
import { Btn, Sel, Input, Card, Badge, Avatar, EmptyState } from "../ui";
import { fmtDate } from "../../lib/utils";
import { cn } from "../../lib/utils";
import { QrScanner } from "../../lib/QrScanner";
import type { AttendanceRecord, Student, Batch, Role } from "../../lib/types";

interface AttendancePageProps {
  attendance: AttendanceRecord[];
  setAttendance: React.Dispatch<React.SetStateAction<AttendanceRecord[]>>;
  students: Student[];
  batches: Batch[];
  role: Role;
}

export function AttendancePage({ attendance, setAttendance, students, batches, role }: AttendancePageProps) {
  const [view, setView] = useState<"mark" | "report">("mark");
  const [batchId, setBatchId] = useState(batches.find((b) => b.active)?.id || "");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [search, setSearch] = useState("");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const [lastScannedAt, setLastScannedAt] = useState<string | null>(null);
  const [scanMessage, setScanMessage] = useState("No QR code scanned yet");

  const bStudents = useMemo(
    () => students.filter((s) => s.batchIds.includes(batchId) && s.active),
    [students, batchId]
  );

  const filtered = useMemo(
    () =>
      bStudents.filter((s) => {
        const q = search.toLowerCase();
        return !q || s.fullName.toLowerCase().includes(q) || s.callupNo.toLowerCase().includes(q) || s.mobile.includes(q);
      }),
    [bStudents, search]
  );

  const getStatus = (studentId: string) => {
    const r = attendance.find((a) => a.studentId === studentId && a.batchId === batchId && a.date === date);
    return r ? r.present : null;
  };

  const markAtt = (studentId: string, present: boolean) => {
    setAttendance((prev) => {
      const idx = prev.findIndex((a) => a.studentId === studentId && a.batchId === batchId && a.date === date);
      if (idx >= 0) return prev.map((a, i) => (i === idx ? { ...a, present } : a));
      return [...prev, { id: `att${Date.now()}_${studentId}`, studentId, batchId, date, present }];
    });
  };

  const markAll = (present: boolean) => filtered.forEach((s) => markAtt(s.id, present));

  const handleQrScan = (value: string) => {
    const normalized = value.trim();
    setScannedCode(normalized);
    setLastScannedAt(
      new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    );

    const matchedStudent = bStudents.find(
      (student) => student.id.toLowerCase() === normalized.toLowerCase() || student.callupNo.toLowerCase() === normalized.toLowerCase()
    );

    if (matchedStudent) {
      markAtt(matchedStudent.id, true);
      setScanMessage(`Matched ${matchedStudent.fullName} and marked present.`);
      return;
    }

    setScanMessage("QR detected, but no matching active student was found in the selected batch.");
  };

  const presentCount = filtered.filter((s) => getStatus(s.id) === true).length;
  const absentCount = filtered.filter((s) => getStatus(s.id) === false).length;
  const unmarkedCount = filtered.filter((s) => getStatus(s.id) === null).length;

  const reportDates = useMemo(
    () => [...new Set(attendance.filter((a) => a.batchId === batchId).map((a) => a.date))].sort().reverse(),
    [attendance, batchId]
  );



  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark and track today attendance</p>
        </div>
        <div className="flex gap-2">
          <Btn v={view === "mark" ? "primary" : "outline"} sz="sm" onClick={() => setView("mark")}><CalendarCheck className="w-3.5 h-3.5" />Mark</Btn>
          <Btn v={view === "report" ? "primary" : "outline"} sz="sm" onClick={() => setView("report")}><BarChart2 className="w-3.5 h-3.5" />Report</Btn>
        </div>
      </div>

      {
        view === "mark" && (
          <div className="flex flex-wrap gap-3">
            {batches.map((b) => (
              <Card
                key={b.id}
                className="flex min-w-[220px] min-h-[110px] p-4 cursor-pointer"
              >
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{b.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.day} · {b.startTime} - {b.endTime}
                    </p>
                  </div>

                  <div className="flex gap-6 text-sm">
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                      {presentCount} Present
                    </span>

                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {unmarkedCount} Unmarked
                    </span>
                  </div>
                </div>
              </Card>
            ))}

            <Card className="min-w-[220px] p-2 bg-transparent cursor-pointer border-none group">
              <div className="h-full min-h-[110px] flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted transition-all duration-200 hover:border-primary/50">
                <PlusCircle className="w-5 h-5 text-muted-foreground/30 transition-all group-hover:scale-110 group-hover:text-primary/80" />
                <p className="font-semibold text-sm text-muted-foreground/50 group-hover:text-primary/80">
                  NEW DAY
                </p>
              </div>
            </Card>
          </div>
        )
      }

      {view === "mark" && (
        <Card className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search student…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Btn sz="sm" onClick={() => setScannerOpen((prev) => !prev)}>
              <QrCodeIcon className="w-3.5 h-3.5" />
              {scannerOpen ? "Close Scanner" : "Scan Student ID"}
            </Btn>
          </div>

          {scannerOpen && (
            <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/30 p-3">
              <div className="max-w-3xl mx-auto">
                <QrScanner active={scannerOpen} onScan={handleQrScan} />
              </div>
              <p className="mt-3 text-xs text-center text-muted-foreground">
                Live camera is on. Hold the student QR inside the frame to scan automatically and keep the camera open for the next student.
              </p>
            </div>
          )}

          <div className="mt-3 rounded-lg border p-3 bg-muted/40">
            <p className="text-sm text-muted-foreground">Scanned content:</p>
            <p className="mt-1 font-medium break-all">{scannedCode || "No QR code scanned yet"}</p>
            <p className="mt-1 text-xs text-muted-foreground">{scanMessage}</p>
            {lastScannedAt && (
              <p className="mt-1 text-xs text-muted-foreground">Last scanned at {lastScannedAt}</p>
            )}
          </div>
        </Card>
      )}

      {view === "mark" && (
        <>
          {/* <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-600"><CheckCircle className="w-4 h-4" />{presentCount} Present</span>
              <span className="flex items-center gap-1.5 text-red-600"><XCircle className="w-4 h-4" />{absentCount} Absent</span>
              <span className="flex items-center gap-1.5 text-muted-foreground"><Clock className="w-4 h-4" />{unmarkedCount} Unmarked</span>
            </div>
            <div className="flex gap-2">
              <Btn v="outline" sz="sm" onClick={() => markAll(true)}><Check className="w-3.5 h-3.5" />All Present</Btn>
              <Btn v="outline" sz="sm" onClick={() => markAll(false)}><X className="w-3.5 h-3.5" />All Absent</Btn>
            </div>
          </div> */}

          <Card className="overflow-hidden">
            <div className="divide-y divide-border/50">
              {filtered.length === 0 ? (
                <EmptyState icon={Users} title="No students" desc="No active students in this batch." />
              ) : filtered.map((s) => {
                const status = getStatus(s.id);
                return (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 transition-colors",
                      status === true ? "bg-emerald-50/50" : status === false ? "bg-red-50/50" : ""
                    )}
                  >
                    <Avatar name={s.fullName} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{s.fullName}</p>
                      <p className="text-xs text-muted-foreground">{s.callupNo} · {s.mobile}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => markAtt(s.id, true)}
                        className={cn(
                          "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          status === true
                            ? "bg-emerald-100 text-emerald-700"
                            : "hover:bg-emerald-50 text-muted-foreground border border-border"
                        )}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />Present
                      </button>
                      {/* <button
                        onClick={() => markAtt(s.id, false)}
                        className={cn(
                          "flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          status === false
                            ? "bg-red-100 text-red-700"
                            : "hover:bg-red-50 text-muted-foreground border border-border"
                        )}
                      >
                        <XCircle className="w-3.5 h-3.5" />Absent
                      </button> */}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {view === "report" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {bStudents.map((s) => {
              const sAtt = attendance.filter((a) => a.studentId === s.id && a.batchId === batchId);
              const pct = sAtt.length > 0 ? Math.round((sAtt.filter((a) => a.present).length / sAtt.length) * 100) : 0;
              return (
                <Card key={s.id} className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar name={s.fullName} size="sm" />
                    <p className="text-xs font-medium text-foreground truncate">{s.fullName.split(" ")[0]}</p>
                  </div>
                  <div className="flex items-end justify-between">
                    <p className={cn("text-2xl font-bold font-mono", pct >= 80 ? "text-emerald-600" : pct >= 60 ? "text-amber-600" : "text-red-600")}>{pct}%</p>
                    <p className="text-xs text-muted-foreground">{sAtt.filter((a) => a.present).length}/{sAtt.length}</p>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full mt-2 overflow-hidden">
                    <div className={cn("h-full rounded-full", pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${pct}%` }} />
                  </div>
                </Card>
              );
            })}
          </div>

          <Card>
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold">Attendance by Date</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide">Student</th>
                    {reportDates.slice(0, 8).map((d) => (
                      <th key={d} className="px-3 py-2.5 font-semibold text-muted-foreground">
                        {fmtDate(d).split(" ").slice(0, 2).join(" ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bStudents.map((s) => (
                    <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium text-foreground">{s.fullName}</td>
                      {reportDates.slice(0, 8).map((d) => {
                        const r = attendance.find((a) => a.studentId === s.id && a.batchId === batchId && a.date === d);
                        return (
                          <td key={d} className="px-3 py-2.5 text-center">
                            {r ? (
                              r.present
                                ? <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                                : <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

