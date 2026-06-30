import { useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "../../lib/utils";
import { Avatar } from "../ui";
import { Sidebar, NAV_ITEMS } from "./Sidebar";
import type { AppUser, NavSection } from "../../lib/types";
import type { AppState } from "../../lib/types";

// Staff-accessible pages
import { Dashboard }       from "../staff/Dashboard";
import { StudentsPage }    from "../staff/StudentsPage";
import { BatchesPage }     from "../staff/BatchesPage";
import { AttendancePage }  from "../staff/AttendancePage";
import { MarksPage }       from "../staff/MarksPage";
import { FeesPage }        from "../staff/FeesPage";
import { MaterialsPage }   from "../staff/MaterialsPage";
import { LessonsPage }     from "../staff/LessonsPage";
import { QRCodesPage }     from "../staff/QRCodesPage";

// Admin-only pages
import { CommunicationPage } from "../admin/CommunicationPage";
import { ReportsPage }       from "../admin/ReportsPage";
import { UsersPage }         from "../admin/UsersPage";
import { SettingsPage }      from "../admin/SettingsPage";

interface ShellProps {
  user: AppUser;
  onLogout: () => void;
  state: AppState;
}

export function Shell({ user, onLogout, state }: ShellProps) {
  const [section, setSection] = useState<NavSection>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileSidebar, setMobileSidebar] = useState(false);

  const navLabel = NAV_ITEMS.find((i) => i.section === section)?.label ?? "";

  const renderPage = () => {
    const { role } = user;
    switch (section) {
      case "dashboard":
        return (
          <Dashboard
            students={state.students}
            batches={state.batches}
            payments={state.payments}
            attendance={state.attendance}
            papers={state.papers}
            marks={state.marks}
            role={role}
          />
        );
      case "students":
        return (
          <StudentsPage
            students={state.students}
            batches={state.batches}
            setStudents={state.setStudents}
            attendance={state.attendance}
            payments={state.payments}
            marks={state.marks}
            role={role}
          />
        );
      case "batches":
        return (
          <BatchesPage
            batches={state.batches}
            setBatches={state.setBatches}
            students={state.students}
            role={role}
          />
        );
      case "attendance":
        return (
          <AttendancePage
            attendance={state.attendance}
            setAttendance={state.setAttendance}
            students={state.students}
            batches={state.batches}
            role={role}
          />
        );
      case "marks":
        return (
          <MarksPage
            papers={state.papers}
            setPapers={state.setPapers}
            marks={state.marks}
            setMarks={state.setMarks}
            students={state.students}
            batches={state.batches}
            role={role}
            materials={state.materials}
          />
        );
      case "fees":
        return (
          <FeesPage
            payments={state.payments}
            setPayments={state.setPayments}
            students={state.students}
            batches={state.batches}
            role={role}
          />
        );
      case "materials":
        return (
          <MaterialsPage
            materials={state.materials}
            setMaterials={state.setMaterials}
            lessons={state.lessons}
            batches={state.batches}
            role={role}
          />
        );
      case "lessons":
        return (
          <LessonsPage
            lessons={state.lessons}
            setLessons={state.setLessons}
            materials={state.materials}
            batches={state.batches}
            role={role}
          />
        );
      case "qrcodes":
        return <QRCodesPage students={state.students} batches={state.batches} />;
      case "communication":
        return role === "admin" ? (
          <CommunicationPage
            messages={state.messages}
            setMessages={state.setMessages}
            batches={state.batches}
            students={state.students}
          />
        ) : null;
      case "reports":
        return role === "admin" ? (
          <ReportsPage
            students={state.students}
            batches={state.batches}
            payments={state.payments}
            attendance={state.attendance}
            marks={state.marks}
            papers={state.papers}
          />
        ) : null;
      case "users":
        return role === "admin" ? (
          <UsersPage users={state.users} setUsers={state.setUsers} />
        ) : null;
      case "settings":
        return role === "admin" ? <SettingsPage /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {mobileSidebar && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileSidebar(false)}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col h-full">
        <Sidebar
          section={section}
          setSection={(s) => { setSection(s); setMobileSidebar(false); }}
          role={user.role}
          user={user}
          onLogout={onLogout}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      </div>

      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 lg:hidden flex flex-col transition-transform duration-200",
          mobileSidebar ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar
          section={section}
          setSection={(s) => { setSection(s); setMobileSidebar(false); }}
          role={user.role}
          user={user}
          onLogout={onLogout}
          collapsed={false}
          setCollapsed={() => {}}
        />
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-4 shrink-0">
          <button
            onClick={() => setMobileSidebar(true)}
            className="p-1.5 hover:bg-muted rounded-lg lg:hidden"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-foreground">{navLabel}</h1>
          </div>
          <div className="flex items-center gap-2">
            {user.role === "admin" && (
              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-accent/10 rounded-lg">
                <span className="text-xs font-medium text-accent">Admin</span>
              </div>
            )}
            <Avatar name={user.name} size="sm" />
            <p className="hidden sm:block text-xs font-medium text-foreground leading-none">
              {user.name.split(" ").slice(0, 2).join(" ")}
            </p>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="max-w-7xl mx-auto">{renderPage()}</div>
        </main>
      </div>
    </div>
  );
}
