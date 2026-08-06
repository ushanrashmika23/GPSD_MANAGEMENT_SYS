import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Search, Plus, ChevronLeft, ChevronRight, QrCodeIcon, CheckCircle, Users } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card, Avatar, EmptyState, FLabel } from "../ui";
import Pagination from "../ui/Pagination";
import { QrScanner } from "../../lib/QrScanner";
import { cn, fmtCur, fmtDate, fmtMonth } from "../../lib/utils";
import type { Payment, Student, Batch, Role } from "../../lib/types";
import { getAllPayments, createPayment, getAllStudents, getAllBatches } from "../../api/apiCalls";

// ── Types ──────────────────────────────────────────────────────────────────

type CellStatus = "paid" | "late" | "unpaid";

const CELL_STYLES: Record<CellStatus, { bg: string; border: string; label: string }> = {
  paid: { bg: "bg-emerald-500", border: "border-emerald-500", label: "Paid" },
  late: { bg: "bg-amber-400", border: "border-amber-400", label: "Late" },
  unpaid: { bg: "bg-card", border: "border-gray-250", label: "Unpaid" },
};

const STUDENTS_PER_PAGE = 25;

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ── Helpers ────────────────────────────────────────────────────────────────

/** Compute the 12 "YYYY-MM" strings for a given year */
function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

/** Classify a cell: paid=green, late=amber (paid after month end), unpaid=empty */
function getCellStatus(payment: Payment | undefined, month: string): CellStatus {
  if (!payment) return "unpaid";
  const [y, m] = month.split("-").map(Number);
  const monthEnd = new Date(y, m, 0);
  const payDate = new Date(payment.date + "T00:00:00");
  return payDate > monthEnd ? "late" : "paid";
}

// ── API mappers: backend snake_case → frontend camelCase ─────────────────

function mapStudent(bs: any): Student {
  const user = bs.user ?? {};
  return {
    id: bs.call_up_no,
    callupNo: bs.call_up_no,
    fullName: `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim(),
    email: user.email ?? "",
    school: bs.school ?? "",
    address: user.address ?? "",
    nic: "",
    mobile: user.mobile ?? "",
    parentName: bs.parent_name ?? "",
    parentMobile: bs.parent_mobile ?? "",
    notes: "",
    active: user.is_active ?? true,
    registrationDate: user.createdAt ? user.createdAt.split("T")[0] : "",
    batchIds: bs.batch_id ? [bs.batch_id] : [],
  };
}

function mapBatch(bb: any): Batch {
  return {
    id: bb.id,
    name: bb.name,
    fee: bb.class_fee,
    startTime: bb.start_time,
    endTime: bb.end_time,
    examDate: bb.exam_date ? bb.exam_date.split("T")[0] : "",
    active: bb.is_active,
    day: bb.day,
  };
}

function mapPayment(bp: any): Payment {
  return {
    id: String(bp.id),
    studentId: bp.call_up_no,
    batchId: "",
    month: bp.month,
    amount: bp.amount,
    receiptNo: bp.receipt_no ?? "",
    date: bp.payment_date ? bp.payment_date.split("T")[0] : "",
  };
}

// ── Sub-components ─────────────────────────────────────────────────────────

function CellSquare({
  status,
  payment,
  month,
  studentName,
  onClick,
  tooltipBelow = false,
  muted = false,
}: {
  status: CellStatus;
  payment: Payment | undefined;
  month: string;
  studentName: string;
  onClick: () => void;
  tooltipBelow?: boolean;
  muted?: boolean;
}) {
  const { bg, border, label } = CELL_STYLES[status];

  return (
    <div className={cn("relative flex items-center justify-center", muted ? "" : "group/cell")}>
      <button
        onClick={muted ? undefined : onClick}
        role="button"
        tabIndex={muted ? -1 : 0}
        disabled={muted}
        aria-label={`${studentName} — ${fmtMonth(month)} — ${muted ? "Before batch" : label}${payment ? `, ${fmtCur(payment.amount)}` : ""}`}
        className={cn(
          "w-[22px] h-[22px] rounded-[4px] transition-all duration-200",
          muted
            ? "bg-muted/40 border border-dashed border-border/30 cursor-default"
            : `cursor-pointer border ${bg} ${border} hover:scale-125 hover:shadow-md hover:z-20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1`
        )}
      />

      {/* Tooltip — only for non-muted cells */}
      {!muted && (
      <div className={cn(
        "absolute left-1/2 -translate-x-1/2 hidden group-hover/cell:block z-[100] pointer-events-none",
        tooltipBelow ? "top-full mt-1.5" : "bottom-full mb-1.5"
      )}>
        <div className="bg-card border border-border text-foreground text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-lg">
          <p className="font-semibold text-foreground mb-0.5">{fmtMonth(month)}</p>
          <p className="text-muted-foreground text-[11px]">{studentName}</p>
          {payment ? (
            <>
              <p className="text-emerald-600 font-medium mt-0.5">{fmtCur(payment.amount)}</p>
              <p className="text-muted-foreground text-[10px]">Receipt: {payment.receiptNo}</p>
              <p className="text-muted-foreground text-[10px]">{fmtDate(payment.date)}</p>
              {status === "late" && (
                <p className="text-amber-600 text-[10px] font-medium">Paid late</p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground mt-0.5 text-[11px]">No payment</p>
          )}
        </div>
        {/* Arrow */}
        <div className={cn(
          "absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-card border-border",
          tooltipBelow
            ? "bottom-full mb-[-1px] border-l border-t"
            : "top-full -mt-[1px] border-r border-b"
        )} />
      </div>
      )}
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────

interface FeesPageProps {
  payments: Payment[];
  setPayments: React.Dispatch<React.SetStateAction<Payment[]>>;
  students: Student[];
  batches: Batch[];
  role: Role;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function FeesPage({ payments: _propPayments, setPayments: setGlobalPayments, students: _propStudents, batches: _propBatches, role }: FeesPageProps) {
  // ── Year navigation ────────────────────────────────────────────────────
  const [year, setYear] = useState(() => new Date().getFullYear());
  const months = useMemo(() => yearMonths(year), [year]);

  // ── API-loaded data (replaces mock props) ──────────────────────────────
  const [students, setStudents] = useState<Student[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  // Raw batch metadata for start-month computation
  const batchMetaRef = useRef<Map<string, string>>(new Map()); // batchId → "YYYY-MM" start

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setDataLoading(true);
      setDataError("");
      try {
        const [sRes, bRes, pRes] = await Promise.all([
          getAllStudents(1, 500),
          getAllBatches(1, 100),
          getAllPayments(1, 500),
        ]);
        if (cancelled) return;

        const rawBatches: any[] = bRes?.data?.data ?? [];
        const mappedStudents: Student[] = (sRes?.data?.data ?? []).map(mapStudent);
        const mappedBatches: Batch[] = rawBatches.map(mapBatch);
        const mappedPayments: Payment[] = (pRes?.data?.data ?? pRes?.data ?? []).map(mapPayment);

        // Store batch created_at for start-month lookups
        const meta = new Map<string, string>();
        for (const rb of rawBatches) {
          if (rb.created_at) {
            const d = new Date(rb.created_at);
            meta.set(rb.id, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
          }
        }
        batchMetaRef.current = meta;

        // Enrich payments with batchId from the student lookup
        for (const p of mappedPayments) {
          const s = mappedStudents.find((st) => st.id === p.studentId);
          if (s) p.batchId = s.batchIds[0] ?? "";
        }

        setStudents(mappedStudents);
        setBatches(mappedBatches);
        setPayments(mappedPayments);
        setGlobalPayments(mappedPayments);
      } catch (err: any) {
        if (!cancelled) {
          console.error("Failed to load fee data:", err);
          setDataError(err?.message ?? "Failed to load data from server");
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // ── Pagination state ───────────────────────────────────────────────────
  const [studentPage, setStudentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // ── Filters ────────────────────────────────────────────────────────────
  const [batchFilter, setBatchFilter] = useState("all");
  type StatusTab = "all" | "settled" | "outstanding";
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");

  // ── Searchable batch dropdown ──────────────────────────────────────────
  const [batchDropdownOpen, setBatchDropdownOpen] = useState(false);
  const [batchSearch, setBatchSearch] = useState("");
  const batchDropdownRef = useRef<HTMLDivElement>(null);

  // Close batch dropdown on outside click
  useEffect(() => {
    if (!batchDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (batchDropdownRef.current && !batchDropdownRef.current.contains(e.target as Node)) {
        setBatchDropdownOpen(false);
        setBatchSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [batchDropdownOpen]);

  // Sorted + filtered batch list: active first, then inactive; filter by search
  const filteredBatchOptions = useMemo(() => {
    const q = batchSearch.toLowerCase();
    const activeList = batches.filter(b => b.active && (!q || b.name.toLowerCase().includes(q)));
    const inactiveList = batches.filter(b => !b.active && (!q || b.name.toLowerCase().includes(q)));
    return { activeList, inactiveList };
  }, [batches, batchSearch]);

  const selectedBatchName = useMemo(() => {
    if (batchFilter === "all") return "All Batches";
    const b = batches.find(b => b.id === batchFilter);
    return b ? b.name : "All Batches";
  }, [batchFilter, batches]);

  // ── Debounced search ──────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(v);
    }, 300);
  };

  // ── QR Scanner ─────────────────────────────────────────────────────────
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanError, setScanError] = useState("");

  const handleQrScan = useCallback((value: string) => {
    const callUpNo = value.trim();
    if (!callUpNo) return;
    const student = students.find(
      s => s.callupNo.toLowerCase() === callUpNo.toLowerCase() && s.active
    );
    if (student) {
      setScanError("");
      setRecordForm(prev => ({
        ...prev,
        studentId: student.id,
        batchId: student.batchIds[0] || "",
        selectedMonths: [],
      }));
      setRecordModalOpen(true);
      setScannerOpen(false);
    } else {
      setScanError(`No active student found for ID: ${callUpNo}`);
    }
  }, [students]);

  // ── Payment lookup (O(1) per cell) ─────────────────────────────────────
  const paymentLookup = useMemo(() => {
    const map = new Map<string, Payment>();
    payments.forEach(p => {
      const [y] = p.month.split("-");
      if (+y === year) {
        map.set(`${p.studentId}-${p.month}`, p);
      }
    });
    return map;
  }, [payments, year]);

  // ── Student payment status (settled vs outstanding) ────────────────────
  const studentStatus = useMemo(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const map = new Map<string, "settled" | "outstanding">();

    students.forEach((s) => {
      // Expected months: Jan to current month in the selected year
      const expected = months.filter((m) => m <= currentMonth);
      const allPaid = expected.every((m) => paymentLookup.has(`${s.id}-${m}`));
      map.set(s.id, allPaid ? "settled" : "outstanding");
    });

    return map;
  }, [students, months, paymentLookup]);

  // ── Batch start month per student (for muting pre-batch cells) ──────────
  const batchStartMonths = useMemo(() => {
    const map = new Map<string, string>(); // studentId → "YYYY-MM"
    for (const s of students) {
      const bid = s.batchIds[0];
      if (bid && batchMetaRef.current.has(bid)) {
        map.set(s.id, batchMetaRef.current.get(bid)!);
      }
    }
    return map;
  }, [students]);

  // ── Filtered & paginated students ──────────────────────────────────────
  const filteredStudents = useMemo(() => {
    let list = students.filter(s => s.active);
    if (batchFilter !== "all") {
      list = list.filter(s => s.batchIds.includes(batchFilter));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.fullName.toLowerCase().includes(q) ||
        s.callupNo.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") {
      list = list.filter((s) => studentStatus.get(s.id) === statusFilter);
    }
    return list;
  }, [students, batchFilter, search, statusFilter, studentStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));

  // Reset page when filters change
  useEffect(() => {
    setStudentPage(1);
  }, [filteredStudents.length]);

  const paginatedStudents = useMemo(() => {
    const start = (studentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, studentPage, pageSize]);

  // ── Pagination bridge ──────────────────────────────────────────────────
  const paginationState = useMemo(() => ({
    page: studentPage,
    totalPages,
    pageSize,
    totalRecords: filteredStudents.length,
  }), [studentPage, totalPages, pageSize, filteredStudents.length]);

  const setPagination = useCallback(
    (updater: React.SetStateAction<{ page: number; totalPages: number; pageSize: number; totalRecords: number }>) => {
      if (typeof updater === "function") {
        const next = updater(paginationState);
        setStudentPage(next.page);
        if (next.pageSize && next.pageSize !== paginationState.pageSize) {
          setPageSize(next.pageSize);
          setStudentPage(1);
        }
      } else {
        setStudentPage(updater.page);
        if (updater.pageSize && updater.pageSize !== paginationState.pageSize) {
          setPageSize(updater.pageSize);
          setStudentPage(1);
        }
      }
    },
    [paginationState]
  );

  // ── Detail modal (cell click) ──────────────────────────────────────────
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    student: Student | null;
    month: string;
    payment: Payment | null;
  }>({ open: false, student: null, month: "", payment: null });

  const openCellDetail = (student: Student, month: string) => {
    const payment = paymentLookup.get(`${student.id}-${month}`) ?? null;
    setDetailModal({ open: true, student, month, payment });
  };

  // ── Record payment modal ───────────────────────────────────────────────
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordForm, setRecordForm] = useState({
    studentId: "",
    batchId: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    receiptNo: "",
    notes: "",
    selectedMonths: [] as string[],
  });

  // Auto-generate receipt number
  useEffect(() => {
    if (recordModalOpen && !recordForm.receiptNo) {
      setRecordForm(prev => ({
        ...prev,
        receiptNo: `RCP${Date.now().toString().slice(-6)}`,
      }));
    }
  }, [recordModalOpen, recordForm.receiptNo]);

  // Open modal - optionally pre-fill for a specific student
  const openRecordModal = (student?: Student) => {
    if (student) {
      setRecordForm({
        studentId: student.id,
        batchId: student.batchIds[0] || "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        receiptNo: `RCP${Date.now().toString().slice(-6)}`,
        notes: "",
        selectedMonths: [],
      });
    } else {
      setRecordForm({
        studentId: "",
        batchId: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        receiptNo: `RCP${Date.now().toString().slice(-6)}`,
        notes: "",
        selectedMonths: [],
      });
    }
    setRecordModalOpen(true);
  };

  // Outstanding months for selected student+batch (exclude pre-batch months)
  const outstandingMonths = useMemo(() => {
    if (!recordForm.studentId || !recordForm.batchId) return [] as string[];
    const batchStartMonth = batchMetaRef.current.get(recordForm.batchId);
    return months.filter(m => {
      // Exclude months before batch was created
      if (batchStartMonth && m < batchStartMonth) return false;
      const key = `${recordForm.studentId}-${m}`;
      return !paymentLookup.has(key);
    });
  }, [recordForm.studentId, recordForm.batchId, months, paymentLookup]);

  const selectedStudent = useMemo(
    () => students.find(s => s.id === recordForm.studentId) ?? null,
    [students, recordForm.studentId]
  );

  const selectedBatch = useMemo(
    () => batches.find(b => b.id === recordForm.batchId) ?? null,
    [batches, recordForm.batchId]
  );

  // Auto-calculated amount
  const calculatedAmount = useMemo(() => {
    if (!selectedBatch) return 0;
    return selectedBatch.fee * recordForm.selectedMonths.length;
  }, [selectedBatch, recordForm.selectedMonths.length]);

  const toggleMonth = (month: string) => {
    setRecordForm(prev => {
      const exists = prev.selectedMonths.includes(month);
      return {
        ...prev,
        selectedMonths: exists
          ? prev.selectedMonths.filter(m => m !== month)
          : [...prev.selectedMonths, month].sort(),
      };
    });
  };

  // ── Save payment ───────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const saveRecordPayment = async () => {
    if (!recordForm.studentId || !recordForm.batchId || recordForm.selectedMonths.length === 0) return;

    const student = students.find((s) => s.id === recordForm.studentId);
    if (!student) return;

    setSaving(true);
    setSaveError("");

    try {
      const newPayments: Payment[] = [];
      for (const month of recordForm.selectedMonths) {
        const res = await createPayment({
          amount: selectedBatch?.fee ?? 0,
          month,
          call_up_no: student.callupNo,
        });

        if (res?.success && res.data) {
          newPayments.push({
            id: String(res.data.id),
            studentId: recordForm.studentId,
            batchId: recordForm.batchId,
            month,
            amount: selectedBatch?.fee ?? 0,
            receiptNo: recordForm.receiptNo,
            date: recordForm.date,
          });
        }
      }

      if (newPayments.length > 0) {
        setPayments((prev) => [...prev, ...newPayments]);
        setGlobalPayments((prev) => [...prev, ...newPayments]);
        setRecordModalOpen(false);
      } else {
        setSaveError("No payments were created. Please try again.");
      }
    } catch (err: any) {
      console.error("Failed to save payment:", err);
      setSaveError(err?.response?.data?.msg ?? err?.message ?? "Failed to record payment");
    } finally {
      setSaving(false);
    }
  };

  // ── Quick-jump from detail → record ────────────────────────────────────
  const openRecordFromDetail = () => {
    if (!detailModal.student) return;
    setDetailModal(prev => ({ ...prev, open: false }));
    setRecordForm({
      studentId: detailModal.student.id,
      batchId: detailModal.student.batchIds[0] || "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      receiptNo: `RCP${Date.now().toString().slice(-6)}`,
      notes: "",
      selectedMonths: [detailModal.month],
    });
    setRecordModalOpen(true);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Fees</h1>
          <p className="text-sm text-muted-foreground">Monthly fee tracking dashboard</p>
        </div>
        {role === "admin" && (
          <Btn onClick={() => openRecordModal()}>
            <Plus className="w-4 h-4" />Record Payment
          </Btn>
        )}
      </div>

      {/* ── API status banner ──────────────────────────────────────────── */}
      {dataLoading && (
        <Card className="p-3 border-blue-200/70 bg-blue-50/30">
          <p className="text-sm text-blue-700 text-center">Loading students, batches &amp; payments from server…</p>
        </Card>
      )}
      {dataError && (
        <Card className="p-3 border-red-200/70 bg-red-50/30">
          <p className="text-sm text-red-700 text-center">{dataError}</p>
        </Card>
      )}

      {/* ── Action Bar: Quick Search + QR Scan ─────────────────────────── */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder="Search student by name or student ID..."
              value={searchInput}
              onChange={handleSearchChange}
            />
          </div>

          {/* QR Scan button */}
          <Btn
            sz="sm"
            v={scannerOpen ? "secondary" : "outline"}
            onClick={() => { setScannerOpen(prev => !prev); setScanError(""); }}
          >
            <QrCodeIcon className="w-3.5 h-3.5" />
            {scannerOpen ? "Close Scanner" : "Scan QR"}
          </Btn>
        </div>
      </Card>

      {/* ── QR Scanner (collapsible) ────────────────────────────────────── */}
      {scannerOpen && (
        <Card className="p-4 border-emerald-200/70 bg-emerald-50/30">
          <div className="max-w-3xl mx-auto">
            <QrScanner active={scannerOpen} onScan={handleQrScan} />
          </div>
          <p className="mt-3 text-xs text-center text-muted-foreground">
            Scan a student ID QR code to quickly record their payment.
          </p>
          {scanError && (
            <div className="mt-3 text-center">
              <p className="text-sm text-red-600 font-medium">{scanError}</p>
              <button
                onClick={() => setScanError("")}
                className="text-xs text-muted-foreground hover:text-foreground mt-1 underline"
              >
                Dismiss
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ── Filter Bar: Batch + Status + Year ──────────────────────────── */}
      <Card className="p-3">
        <div className="flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Searchable batch dropdown */}
            <div ref={batchDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => { setBatchDropdownOpen(prev => !prev); setBatchSearch(""); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border bg-card",
                  "hover:border-primary/40 transition-colors min-w-[160px]",
                  batchFilter !== "all" && "border-primary/60"
                )}
              >
                <span className={cn("truncate", batchFilter !== "all" ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {selectedBatchName}
                </span>
                <svg className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", batchDropdownOpen && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {batchDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden">
                  {/* Search input inside dropdown */}
                  <div className="p-2 border-b border-border">
                    <Input
                      className="w-full text-sm"
                      placeholder="Search batches..."
                      value={batchSearch}
                      onChange={e => setBatchSearch(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto">
                    {/* All Batches option */}
                    <button
                      type="button"
                      onClick={() => { setBatchFilter("all"); setBatchDropdownOpen(false); setBatchSearch(""); }}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm transition-colors",
                        batchFilter === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                      )}
                    >
                      All Batches
                    </button>

                    {/* Active batches */}
                    {filteredBatchOptions.activeList.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Active</div>
                        {filteredBatchOptions.activeList.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => { setBatchFilter(b.id); setBatchDropdownOpen(false); setBatchSearch(""); }}
                            className={cn(
                              "w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2",
                              batchFilter === b.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                            <span className="truncate">{b.name}</span>
                          </button>
                        ))}
                      </>
                    )}

                    {/* Inactive batches */}
                    {filteredBatchOptions.inactiveList.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Inactive</div>
                        {filteredBatchOptions.inactiveList.map(b => (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => { setBatchFilter(b.id); setBatchDropdownOpen(false); setBatchSearch(""); }}
                            className={cn(
                              "w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2",
                              batchFilter === b.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                            )}
                          >
                            <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                            <span className="truncate text-muted-foreground">{b.name}</span>
                          </button>
                        ))}
                      </>
                    )}

                    {filteredBatchOptions.activeList.length === 0 && filteredBatchOptions.inactiveList.length === 0 && (
                      <p className="px-3 py-3 text-sm text-muted-foreground text-center">No batches found</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Status filter tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden">
              {([
                { value: "all", label: "All Students" },
                { value: "settled", label: "Settled" },
                { value: "outstanding", label: "Outstanding" },
              ] as const).map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatusFilter(tab.value)}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0",
                    statusFilter === tab.value
                      ? "bg-primary text-primary-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-accent/20"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {batchFilter !== "all" && filteredStudents.length > 0 && (
              <Badge v="muted">{filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}</Badge>
            )}
          </div>

          {/* Year Navigator */}
          <div className="flex items-center gap-1.5">
            <Btn sz="sm" v="outline" onClick={() => setYear(y => y - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Btn>
            <span className="text-sm font-semibold min-w-[3.5rem] text-center tabular-nums">{year}</span>
            <Btn sz="sm" v="outline" onClick={() => setYear(y => y + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Btn>
          </div>
        </div>
      </Card>

      {/* ── Contribution Grid ───────────────────────────────────────────── */}
      <Card className="p-0">
        {dataLoading ? (
          <EmptyState
            icon={Users}
            title="Loading data…"
            desc="Fetching students, batches and payments from the server."
          />
        ) : dataError ? (
          <EmptyState
            icon={Users}
            title="Failed to load data"
            desc={dataError}
          />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students found"
            desc={search || batchFilter !== "all"
              ? "Try adjusting your search or batch filter."
              : "No active students available."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <div
              className="grid min-w-[860px]"
              style={{
                gridTemplateColumns: `minmax(220px, 1fr) repeat(12, 26px)`,
                gap: "1px",
                padding: "8px 10px 10px",
              }}
            >
              {/* ── Header row ────────────────────────────────────────── */}
              <div className="sticky left-0 z-10 bg-card flex items-end px-2 pb-2 pt-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Student
                </span>
              </div>
              {MONTH_LABELS.map((label, i) => {
                const currentMonth = `${year}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
                const isCurrentMonth = months[i] === currentMonth;
                return (
                  <div key={label} className="flex items-end justify-center pb-2 pt-1">
                    <span className={cn(
                      "text-[10px] font-semibold uppercase tracking-wide",
                      isCurrentMonth ? "text-primary font-bold" : "text-muted-foreground"
                    )}>
                      {label}
                    </span>
                  </div>
                );
              })}

              {/* ── Student rows ──────────────────────────────────────── */}
              {paginatedStudents.map((student, rowIdx) => (
                <div key={student.id} className="contents">
                  {/* Sticky student info */}
                  <div className="sticky left-0 z-10 bg-card flex items-center gap-3 px-2 py-2 border-t border-border/30">
                    <Avatar name={student.fullName} size="sm" />
                    <div className="min-w-0 overflow-hidden">
                      <p className="text-sm font-medium text-foreground truncate">
                        {student.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {student.callupNo} •  {batches.find(b => b.id === student.batchIds[0])?.name ?? "—"}
                      </p>
                    </div>
                  </div>

                  {/* 12 month cells */}
                  {months.map(month => {
                    const payment = paymentLookup.get(`${student.id}-${month}`);
                    const batchStart = batchStartMonths.get(student.id);
                    const isBeforeBatch = batchStart ? month < batchStart : false;
                    const isMuted = isBeforeBatch && !payment;
                    const status = isMuted ? "unpaid" : getCellStatus(payment, month);
                    return (
                      <div key={month} className="border-t border-border/30 flex items-center justify-center py-1">
                        <CellSquare
                          status={status}
                          payment={payment ?? undefined}
                          month={month}
                          studentName={student.fullName}
                          onClick={isMuted ? () => {} : () => openCellDetail(student, month)}
                          tooltipBelow={rowIdx < 2}
                          muted={isMuted}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Pagination ──────────────────────────────────────────────────── */}
      {filteredStudents.length > 0 && (
        <Pagination
          page={paginationState.page}
          totalPages={paginationState.totalPages}
          pageSize={paginationState.pageSize}
          totalRecords={paginationState.totalRecords}
          setPagination={setPagination}
        />
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
          ════════════════════════════════════════════════════════════════════ */}

      {/* ── Payment Detail Modal (cell click) ──────────────────────────── */}
      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal(prev => ({ ...prev, open: false }))}
        title="Payment Details"
      >
        {detailModal.student && (
          <div className="space-y-5">
            {/* Student info card */}
            <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
              <Avatar name={detailModal.student.fullName} size="lg" />
              <div>
                <h3 className="text-base font-bold text-foreground">{detailModal.student.fullName}</h3>
                <p className="text-sm text-muted-foreground font-mono">{detailModal.student.callupNo}</p>
                {detailModal.student.batchIds.length > 0 && (
                  <Badge v="default" className="mt-1">
                    {batches.find(b => b.id === detailModal.student!.batchIds[0])?.name ?? "—"}
                  </Badge>
                )}
              </div>
            </div>

            {/* Month */}
            <div>
              <FLabel>Month</FLabel>
              <p className="text-sm font-semibold text-foreground">{fmtMonth(detailModal.month)}</p>
            </div>

            {detailModal.payment ? (
              /* ── PAID ── */
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <FLabel>Amount</FLabel>
                    <p className="text-lg font-bold text-emerald-600 font-mono">
                      {fmtCur(detailModal.payment.amount)}
                    </p>
                  </div>
                  <div>
                    <FLabel>Receipt No.</FLabel>
                    <p className="text-sm font-mono text-primary font-medium">{detailModal.payment.receiptNo}</p>
                  </div>
                  <div>
                    <FLabel>Payment Date</FLabel>
                    <p className="text-sm text-foreground">{fmtDate(detailModal.payment.date)}</p>
                  </div>
                  <div>
                    <FLabel>Status</FLabel>
                    <Badge v={getCellStatus(detailModal.payment, detailModal.month) === "late" ? "warning" : "success"}>
                      {getCellStatus(detailModal.payment, detailModal.month) === "late" ? "Late Payment" : "Paid"}
                    </Badge>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Btn v="outline" onClick={() => setDetailModal(prev => ({ ...prev, open: false }))}>
                    Close
                  </Btn>
                </div>
              </>
            ) : (
              /* ── UNPAID ── */
              <>
                <div className="text-center py-4 space-y-4">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <span className="text-2xl font-bold">—</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Not Yet Paid</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      No payment has been recorded for {fmtMonth(detailModal.month)}.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Btn v="outline" onClick={() => setDetailModal(prev => ({ ...prev, open: false }))}>
                    Close
                  </Btn>
                  {role === "admin" && (
                    <Btn onClick={openRecordFromDetail}>
                      <Plus className="w-4 h-4" />Mark as Paid
                    </Btn>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Record Payment Modal ─────────────────────────────────────────── */}
      <Modal
        open={recordModalOpen}
        onClose={() => setRecordModalOpen(false)}
        title="Record Payment"
        wide
      >
        <div className="space-y-5">
          {/* Step 1: Select Student */}
          <div>
            <FLabel>Student</FLabel>
            <Sel
              className="w-full"
              value={recordForm.studentId}
              onChange={e => {
                const sid = e.target.value;
                const student = students.find(s => s.id === sid);
                setRecordForm(prev => ({
                  ...prev,
                  studentId: sid,
                  batchId: student?.batchIds[0] || "",
                  selectedMonths: [],
                }));
              }}
            >
              <option value="">Select a student</option>
              {students.filter(s => s.active).map(s => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.callupNo})
                </option>
              ))}
            </Sel>
          </div>

          {/* Step 2: Select Batch */}
          {selectedStudent && (
            <div>
              <FLabel>Batch</FLabel>
              <Sel
                className="w-full"
                value={recordForm.batchId}
                onChange={e => setRecordForm(prev => ({
                  ...prev,
                  batchId: e.target.value,
                  selectedMonths: [],
                }))}
              >
                <option value="">Select a batch</option>
                {batches
                  .filter(b => b.active && selectedStudent.batchIds.includes(b.id))
                  .map(b => (
                    <option key={b.id} value={b.id}>{b.name} — {fmtCur(b.fee)}/mo</option>
                  ))
                }
              </Sel>
            </div>
          )}

          {/* Student info display */}
          {selectedStudent && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <Avatar name={selectedStudent.fullName} size="sm" />
              <div>
                <p className="text-sm font-medium text-foreground">{selectedStudent.fullName}</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedStudent.callupNo}</p>
              </div>
            </div>
          )}

          {/* Step 3: Outstanding Months checklist */}
          {recordForm.studentId && recordForm.batchId && (
            <div>
              <FLabel>
                Outstanding Payments ({outstandingMonths.length} unpaid)
              </FLabel>
              {outstandingMonths.length === 0 ? (
                <div className="flex items-center gap-2 py-4 text-sm text-emerald-600">
                  <CheckCircle className="w-4 h-4" />
                  All months paid for {year}!
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mt-1.5">
                  {outstandingMonths.map(month => {
                    const [, m] = month.split("-").map(Number);
                    const monthLabel = new Date(year, m - 1).toLocaleDateString("en-US", { month: "short" });
                    const isSelected = recordForm.selectedMonths.includes(month);
                    return (
                      <button
                        key={month}
                        type="button"
                        onClick={() => toggleMonth(month)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all border cursor-pointer",
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card text-foreground border-border hover:border-primary/40"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          isSelected
                            ? "bg-primary-foreground border-primary-foreground"
                            : "border-gray-300"
                        )}>
                          {isSelected && (
                            <svg className="w-3 h-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <span>{monthLabel} {year}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Amount + Date */}
          {selectedBatch && recordForm.selectedMonths.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FLabel>Amount (auto-calculated)</FLabel>
                <p className="text-lg font-bold text-emerald-600 font-mono">
                  {fmtCur(calculatedAmount)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {recordForm.selectedMonths.length} month{recordForm.selectedMonths.length !== 1 ? "s" : ""} × {fmtCur(selectedBatch.fee)}
                </p>
              </div>
              <div>
                <FLabel>Payment Date</FLabel>
                <Input
                  type="date"
                  value={recordForm.date}
                  onChange={e => setRecordForm(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Step 5: Receipt + Notes */}
          {recordForm.studentId && recordForm.batchId && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FLabel>Receipt Number</FLabel>
                <Input
                  value={recordForm.receiptNo}
                  onChange={e => setRecordForm(prev => ({ ...prev, receiptNo: e.target.value }))}
                  placeholder="RCP0001"
                />
              </div>
              <div>
                <FLabel>Notes (optional)</FLabel>
                <Input
                  value={recordForm.notes}
                  onChange={e => setRecordForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Cash, bank transfer..."
                />
              </div>
            </div>
          )}

          {/* Actions */}
          {saveError && (
            <p className="text-sm text-red-600 font-medium text-center">{saveError}</p>
          )}
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Btn v="outline" onClick={() => { setRecordModalOpen(false); setSaveError(""); }} disabled={saving}>
              Cancel
            </Btn>
            <Btn
              onClick={saveRecordPayment}
              disabled={!recordForm.studentId || !recordForm.batchId || recordForm.selectedMonths.length === 0 || saving}
            >
              <Plus className="w-4 h-4" />
              {saving ? "Saving..." : `Record Payment${recordForm.selectedMonths.length > 0 ? ` (${recordForm.selectedMonths.length})` : ""}`}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
