import { useEffect, useState } from "react";
import { LoginPage } from "../components/auth/LoginPage";
import { Shell } from "../components/layout/Shell";
import { autoLogin } from "../api/apiCalls";
import { mapBackendUser } from "../lib/utils";
import {
  INIT_USERS, INIT_BATCHES, INIT_STUDENTS, INIT_ATT,
  INIT_PAYMENTS, INIT_PAPERS, INIT_MARKS, INIT_MATERIALS,
  INIT_LESSONS, INIT_MESSAGES,
} from "../lib/data";
import type { AppUser, AppState } from "../lib/types";
import type {
  Student, Batch, AttendanceRecord, Payment,
  Paper, Mark, Material, Lesson, CMessage,
} from "../lib/types";

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Global state — lifted here so Shell and all pages share a single source of truth
  const [students,   setStudents]   = useState<Student[]>         (INIT_STUDENTS);
  const [batches,    setBatches]    = useState<Batch[]>            (INIT_BATCHES);
  const [attendance, setAttendance] = useState<AttendanceRecord[]> (INIT_ATT);
  const [payments,   setPayments]   = useState<Payment[]>          (INIT_PAYMENTS);
  const [papers,     setPapers]     = useState<Paper[]>            (INIT_PAPERS);
  const [marks,      setMarks]      = useState<Mark[]>             (INIT_MARKS);
  const [materials,  setMaterials]  = useState<Material[]>         (INIT_MATERIALS);
  const [lessons,    setLessons]    = useState<Lesson[]>           (INIT_LESSONS);
  const [messages,   setMessages]   = useState<CMessage[]>         (INIT_MESSAGES);
  const [users,      setUsers]      = useState<AppUser[]>          (INIT_USERS);

  // ── Autologin: restore session from the JWT in localStorage on page load ──
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setAuthLoading(false);
        return;
      }
      try {
        const res = await autoLogin();
        if (res?.success && res.data?.user) {
          setCurrentUser(mapBackendUser(res.data.user));
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
        }
      } catch {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
      } finally {
        setAuthLoading(false);
      }
    };
    restoreSession();
  }, []);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage onLogin={setCurrentUser} />;
  }

  const state: AppState = {
    students,   setStudents,
    batches,    setBatches,
    attendance, setAttendance,
    payments,   setPayments,
    papers,     setPapers,
    marks,      setMarks,
    materials,  setMaterials,
    lessons,    setLessons,
    messages,   setMessages,
    users,      setUsers,
  };

  return (
    <Shell
      user={currentUser}
      onLogout={() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setCurrentUser(null);
      }}
      state={state}
    />
  );
}
