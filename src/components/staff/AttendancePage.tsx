import { useCallback, useEffect, useRef, useState } from "react";
import { Search, CheckCircle, Clock, PlusCircle, QrCodeIcon, Users } from "lucide-react";
import { Btn, Input, Card, Badge, Avatar, EmptyState, Modal, FLabel, Sel } from "../ui";
import { cn } from "../../lib/utils";
import { QrScanner } from "../../lib/QrScanner";
import type { Batch, Role, Student } from "../../lib/types";
import { getTodayClasses, createNewDay, markAttendance, getAllStudents, getStudentById, getAllBatches } from "../../api/apiCalls";
import Pagination from "../ui/Pagination";

interface AttendancePageProps {
  batches: Batch[];
  role: Role;
}

export function AttendancePage({ batches: _batches, role }: AttendancePageProps) {
  // ── Batches from API (real DB IDs) ───────────────────────────────────────
  const [activeBatches, setActiveBatches] = useState<Batch[]>([]);

  // ── Today's classes ──────────────────────────────────────────────────────
  const [todayClasses, setTodayClasses] = useState<any[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);

  // ── Selected class → student list ────────────────────────────────────────
  const [selectedClass, setSelectedClass] = useState<any | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, pageSize: 12, totalRecords: 0 });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [markedStudents, setMarkedStudents] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── QR scanner ───────────────────────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false);

  // ── Scan result modal ────────────────────────────────────────────────────
  const [scanModal, setScanModal] = useState<{
    open: boolean;
    student: any | null;
    marking: boolean;
    marked: boolean;
    error: string;
  }>({ open: false, student: null, marking: false, marked: false, error: "" });

  // ── New day modal ────────────────────────────────────────────────────────
  const [paperModal, setPaperModal] = useState(false);
  const [form, setForm] = useState({ batchId: "", date: new Date().toISOString().split("T")[0] });
  const [creating, setCreating] = useState(false);

  // ── Fetch batches from API ───────────────────────────────────────────────
  const fetchBatches = useCallback(async () => {
    try {
      const result = await getAllBatches(1, 100, "");
      const data = result?.data?.data ?? [];
      const mapped: Batch[] = data.map((b: any) => ({
        id: b.id,
        name: b.name,
        fee: b.class_fee ?? b.fee ?? 0,
        startTime: b.start_time ?? b.startTime ?? "",
        endTime: b.end_time ?? b.endTime ?? "",
        examDate: b.exam_date ?? b.examDate ?? "",
        active: b.is_active ?? b.active ?? true,
        day: b.day ?? "",
      }));
      setActiveBatches(mapped);
      // Set default batchId in form if not already set
      setForm((prev) => {
        if (prev.batchId) return prev;
        const active = mapped.find((b) => b.active);
        return { ...prev, batchId: active?.id ?? "" };
      });
    } catch (err) {
      console.error("Failed to fetch batches:", err);
    }
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // ── Fetch today's classes ────────────────────────────────────────────────
  const fetchTodayClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const result = await getTodayClasses(today);
      const data = result?.data ?? [];
      setTodayClasses(data);
    } catch (err) {
      console.error("Failed to fetch today classes:", err);
    } finally {
      setLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    fetchTodayClasses();
  }, [fetchTodayClasses]);

  // ── Debounced search ─────────────────────────────────────────────────────
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(v);
      setPagination((prev) => ({ ...prev, page: 1 }));
    }, 300);
  };

  // ── Fetch students for selected batch ────────────────────────────────────
  const fetchStudents = useCallback(async () => {
    if (!selectedClass) return;
    setLoadingStudents(true);
    try {
      const batchId = selectedClass.batch_id;
      const result = await getAllStudents(pagination.page, pagination.pageSize, search, batchId);
      const backendStudents = result?.data?.data ?? [];
      const meta = result?.data?.meta ?? {};
      setPagination((prev) => {
        const perPage = meta.limit ?? prev.pageSize;
        const lastPage = meta.pages ?? (meta.total != null ? Math.max(1, Math.ceil(meta.total / perPage)) : prev.totalPages);
        return { page: meta.page ?? prev.page, totalPages: lastPage, pageSize: perPage, totalRecords: meta.total ?? prev.totalRecords };
      });
      const mapped: Student[] = backendStudents.map((s: any) => ({
        id: s.user?.id ?? "",
        callupNo: s.call_up_no,
        fullName: `${s.user?.first_name ?? ""} ${s.user?.last_name ?? ""}`.trim(),
        email: s.user?.email ?? "",
        school: s.school,
        address: s.user?.address ?? "",
        nic: "",
        mobile: s.user?.mobile ?? "",
        parentName: s.parent_name,
        parentMobile: s.parent_mobile,
        notes: s.notes ?? "",
        active: s.user?.is_active ?? true,
        registrationDate: s.user?.createdAt ?? "",
        batchIds: s.batch_id ? [s.batch_id] : [],
      }));
      setStudents(mapped);
    } catch (err) {
      console.error("Failed to fetch students:", err);
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedClass, pagination.page, pagination.pageSize, search]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  // ── Click a class card ───────────────────────────────────────────────────
  const handleClassClick = (cls: any) => {
    if (selectedClass?.id === cls.id) return; // already selected
    setSelectedClass(cls);
    setSearchInput("");
    setSearch("");
    setMarkedStudents(new Set());
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // ── Mark present from student list ───────────────────────────────────────
  const handleMarkPresent = async (student: Student) => {
    try {
      const result = await markAttendance(student.callupNo);
      if (result?.success) {
        setMarkedStudents((prev) => new Set(prev).add(student.callupNo));
        // Refresh today's classes to update counts
        fetchTodayClasses();
      } else {
        alert(result?.msg || "Failed to mark attendance");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.msg ?? err?.message ?? "Failed to mark attendance";
      alert(msg);
    }
  };

  // ── QR scan handler ──────────────────────────────────────────────────────
  const handleQrScan = async (value: string) => {
    const callUpNo = value.trim();
    if (!callUpNo) return;

    setScanModal({ open: true, student: null, marking: false, marked: false, error: "" });

    try {
      const result = await getStudentById(callUpNo);
      const studentData = result?.data ?? null;
      if (studentData) {
        setScanModal({ open: true, student: studentData, marking: false, marked: false, error: "" });
      } else {
        setScanModal({ open: true, student: null, marking: false, marked: false, error: "No matching student found." });
      }
    } catch (err: any) {
      const msg = err?.response?.data?.msg ?? "Failed to find student";
      setScanModal({ open: true, student: null, marking: false, marked: false, error: msg });
    }
  };

  // ── Mark attendance from scan modal ──────────────────────────────────────
  const handleMarkFromScan = async () => {
    if (!scanModal.student) return;
    setScanModal((prev) => ({ ...prev, marking: true, error: "" }));
    try {
      const result = await markAttendance(scanModal.student.call_up_no);
      if (result?.success) {
        setScanModal((prev) => ({ ...prev, marking: false, marked: true }));
        fetchTodayClasses();
        // Also refresh student list if the scanned student is in the current batch
        if (selectedClass && scanModal.student.batch_id === selectedClass.batch_id) {
          setMarkedStudents((prev) => new Set(prev).add(scanModal.student.call_up_no));
        }
      } else {
        setScanModal((prev) => ({ ...prev, marking: false, error: result?.msg || "Failed to mark attendance" }));
      }
    } catch (err: any) {
      const msg = err?.response?.data?.msg ?? err?.message ?? "Failed to mark attendance";
      setScanModal((prev) => ({ ...prev, marking: false, error: msg }));
    }
  };

  const closeScanModal = () => {
    setScanModal({ open: false, student: null, marking: false, marked: false, error: "" });
  };

  // Auto-close scan modal after successful mark
  useEffect(() => {
    if (scanModal.marked) {
      const timer = setTimeout(() => {
        closeScanModal();
      }, 1800);
      return () => clearTimeout(timer);
    }
  }, [scanModal.marked]);

  // ── Create new day ───────────────────────────────────────────────────────
  const handleCreateDay = async () => {
    if (!form.batchId || !form.date) {
      alert("Please select a batch and date.");
      return;
    }
    setCreating(true);
    try {
      const result = await createNewDay(form.date, form.batchId);
      if (result?.success) {
        setPaperModal(false);
        setForm({ batchId: activeBatches.find((b) => b.active)?.id || "", date: new Date().toISOString().split("T")[0] });
        fetchTodayClasses();
      } else {
        alert(result?.msg || "Failed to create new day");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.msg ?? err?.message ?? "Failed to create new day";
      alert(msg);
    } finally {
      setCreating(false);
    }
  };

  // ── Derived counts ───────────────────────────────────────────────────────
  const presentCount = selectedClass?.presentCount ?? 0;
  const unmarkedCount = selectedClass?.unmarkedCount ?? 0;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Attendance</h1>
          <p className="text-sm text-muted-foreground">Mark and track today's attendance</p>
        </div>
        <Btn onClick={() => setPaperModal(true)}>
          <PlusCircle className="w-4 h-4" />New Day
        </Btn>
      </div>

      {/* ── Today's class cards ─────────────────────────────────────────── */}
      {loadingClasses ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Loading today's classes…</Card>
      ) : todayClasses.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground text-sm space-y-3">
          <p>No classes found for today.</p>
          <Btn onClick={() => setPaperModal(true)} sz="sm">
            <PlusCircle className="w-3.5 h-3.5" />Create New Day
          </Btn>
        </Card>
      ) : (
        <div className="flex flex-wrap gap-3">
          {todayClasses.map((cls: any) => {
            const isSelected = selectedClass?.id === cls.id;
            return (
              <Card
                key={cls.id}
                onClick={() => handleClassClick(cls)}
                className={cn(
                  "flex min-w-[220px] min-h-[110px] p-4 cursor-pointer transition-all duration-200",
                  isSelected
                    ? "ring-2 ring-primary border-primary shadow-md"
                    : "hover:shadow-md hover:border-primary/30"
                )}
              >
                <div className="flex flex-col gap-3 h-full">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cls.batch?.name ?? "Unknown Batch"}</p>
                    <p className="text-xs text-muted-foreground">
                      {cls.batch?.day ?? ""}{cls.batch?.start_time ? ` · ${cls.batch.start_time} - ${cls.batch.end_time}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-6 text-sm">
                    <span className="flex items-center gap-1.5 text-emerald-600">
                      <CheckCircle className="w-4 h-4" />
                      {cls.presentCount} Present
                    </span>
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {cls.unmarkedCount} Unmarked
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}

          {/* New Day card */}
          <Card
            onClick={() => setPaperModal(true)}
            className="min-w-[220px] p-2 bg-transparent cursor-pointer border-none group"
          >
            <div className="h-full min-h-[110px] flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted transition-all duration-200 hover:border-primary/50">
              <PlusCircle className="w-5 h-5 text-muted-foreground/30 transition-all group-hover:scale-110 group-hover:text-primary/80" />
              <p className="font-semibold text-sm text-muted-foreground/50 group-hover:text-primary/80">
                NEW CLASS
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* ── Selected class → student list ───────────────────────────────── */}
      {selectedClass && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search by name, call-up no, email…"
                  value={searchInput}
                  onChange={handleSearchChange}
                />
              </div>
              <Btn sz="sm" onClick={() => setScannerOpen((prev) => !prev)}>
                <QrCodeIcon className="w-3.5 h-3.5" />
                {scannerOpen ? "Close Scanner" : "Scan Student ID"}
              </Btn>
            </div>

            {/* QR Scanner */}
            {scannerOpen && (
              <div className="mt-4 rounded-xl border border-emerald-200/70 bg-emerald-50/30 p-3">
                <div className="max-w-3xl mx-auto">
                  <QrScanner active={scannerOpen} onScan={handleQrScan} />
                </div>
                <p className="mt-3 text-xs text-center text-muted-foreground">
                  Hold the student QR code inside the frame to scan. The camera stays open for continuous scanning.
                </p>
              </div>
            )}

            {/* Summary counts */}
            <div className="mt-3 flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-600">
                <CheckCircle className="w-4 h-4" />{presentCount} Present
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="w-4 h-4" />{unmarkedCount} Unmarked
              </span>
            </div>
          </Card>

          {/* Student list */}
          <Card className="overflow-hidden">
            {loadingStudents ? (
              <div className="py-12 text-center text-sm text-muted-foreground">Loading students…</div>
            ) : students.length === 0 ? (
              <EmptyState icon={Users} title="No students" desc="No active students in this batch." />
            ) : (
              <div className="divide-y divide-border/50">
                {students.map((s) => {
                  const isMarked = markedStudents.has(s.callupNo);
                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 transition-colors",
                        isMarked ? "bg-emerald-50/50" : ""
                      )}
                    >
                      <Avatar name={s.fullName} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{s.fullName}</p>
                        <p className="text-xs text-muted-foreground">{s.callupNo}{s.email ? ` · ${s.email}` : ""}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {isMarked ? (
                          <span className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3.5 h-3.5" />Present
                          </span>
                        ) : (
                          <button
                            onClick={() => handleMarkPresent(s)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-emerald-50 text-muted-foreground border border-border"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />Present
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Pagination */}
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            pageSize={pagination.pageSize}
            totalRecords={pagination.totalRecords}
            setPagination={setPagination}
          />
        </>
      )}

      {/* ── QR Scan Result Modal ─────────────────────────────────────────── */}
      <Modal open={scanModal.open} onClose={closeScanModal} title="Scan Result">
        <style>{`
          @keyframes checkmark-scale {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.3); }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes checkmark-circle {
            0% { stroke-dashoffset: 166; }
            100% { stroke-dashoffset: 0; }
          }
          @keyframes checkmark-check {
            0% { stroke-dashoffset: 56; }
            100% { stroke-dashoffset: 0; }
          }
        `}</style>

        <div className="space-y-4">
          {scanModal.marked ? (
            /* ── Success tick animation ── */
            <div className="flex flex-col items-center justify-center py-8">
              <div className="relative w-24 h-24">
                <svg
                  className="w-24 h-24"
                  viewBox="0 0 72 72"
                  style={{ animation: "checkmark-scale 0.4s ease-out" }}
                >
                  <circle
                    cx="36" cy="36" r="33"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeDasharray="166"
                    strokeDashoffset="166"
                    style={{ animation: "checkmark-circle 0.5s 0.2s ease-out forwards" }}
                  />
                  <path
                    d="M20 36 l10 10 l22 -22"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray="56"
                    strokeDashoffset="56"
                    style={{ animation: "checkmark-check 0.3s 0.5s ease-out forwards" }}
                  />
                </svg>
              </div>
              <p className="mt-4 text-lg font-semibold text-emerald-600">Attendance Marked!</p>
              <p className="text-sm text-muted-foreground">
                {scanModal.student?.user?.first_name} {scanModal.student?.user?.last_name}
              </p>
            </div>
          ) : scanModal.error ? (
            /* ── Error state ── */
            <div className="text-center py-4">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                <span className="text-2xl font-bold">!</span>
              </div>
              <p className="text-sm text-red-600 font-medium">{scanModal.error}</p>
            </div>
          ) : scanModal.student ? (
            /* ── Student info ── */
            <>
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                <Avatar
                  name={`${scanModal.student.user?.first_name ?? ""} ${scanModal.student.user?.last_name ?? ""}`}
                  size="lg"
                />
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {scanModal.student.user?.first_name} {scanModal.student.user?.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">{scanModal.student.call_up_no}</p>
                  {scanModal.student.user?.email && (
                    <p className="text-xs text-muted-foreground">{scanModal.student.user.email}</p>
                  )}
                  {scanModal.student.batch?.name && (
                    <Badge v="default" className="mt-1">{scanModal.student.batch.name}</Badge>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Btn v="outline" onClick={closeScanModal}>Cancel</Btn>
                <Btn onClick={handleMarkFromScan} disabled={scanModal.marking}>
                  {scanModal.marking ? "Marking…" : "Mark Attendance"}
                </Btn>
              </div>
            </>
          ) : (
            /* ── Loading ── */
            <div className="text-center py-8 text-sm text-muted-foreground">Looking up student…</div>
          )}
        </div>
      </Modal>

      {/* ── New Day Modal ────────────────────────────────────────────────── */}
      <Modal open={paperModal} onClose={() => setPaperModal(false)} title="Create New Class Day">
        <div className="space-y-4">
          <div>
            <FLabel>Batch</FLabel>
            <Sel
              className="w-full"
              value={form.batchId}
              onChange={(e) => setForm((f) => ({ ...f, batchId: e.target.value }))}
            >
              <option value="">Select a batch</option>
              {activeBatches.filter((b) => b.active).map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Sel>
          </div>
          <div>
            <FLabel>Date</FLabel>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setPaperModal(false)} disabled={creating}>Cancel</Btn>
            <Btn onClick={handleCreateDay} disabled={creating}>
              {creating ? "Creating…" : "Create Day"}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
