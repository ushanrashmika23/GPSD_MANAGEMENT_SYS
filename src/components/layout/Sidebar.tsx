import {
  LayoutDashboard, Users, Layers, CalendarCheck, Award,
  CreditCard, BookMarked, BookOpen, QrCode, MessageSquare,
  BarChart2, UserCog, Settings, GraduationCap, LogOut, Menu,
} from "lucide-react";
import { cn } from "../../lib/utils";
import { Avatar, Badge } from "../ui";
import type { NavSection, Role, AppUser } from "../../lib/types";

interface NavItem {
  section: NavSection;
  label: string;
  icon: React.ElementType;
  adminOnly?: boolean;
  group: string;
}

export const NAV_ITEMS: NavItem[] = [
  { section: "dashboard",     label: "Dashboard",     icon: LayoutDashboard, group: "main" },
  { section: "students",      label: "Students",      icon: Users,           group: "academic" },
  { section: "batches",       label: "Batches",        icon: Layers,          group: "academic" },
  { section: "attendance",    label: "Attendance",     icon: CalendarCheck,   group: "academic" },
  { section: "marks",         label: "Marks",          icon: Award,           group: "academic" },
  { section: "fees",          label: "Fees",           icon: CreditCard,      group: "finance" },
  { section: "materials",     label: "Materials",      icon: BookMarked,      group: "content" },
  { section: "lessons",       label: "Lessons",        icon: BookOpen,        group: "content" },
  { section: "qrcodes",       label: "QR Codes",       icon: QrCode,          group: "tools" },
  { section: "communication", label: "Communication",  icon: MessageSquare,   group: "tools",  adminOnly: true },
  { section: "reports",       label: "Reports",        icon: BarChart2,       group: "admin",  adminOnly: true },
  { section: "users",         label: "Users",          icon: UserCog,         group: "admin",  adminOnly: true },
  { section: "settings",      label: "Settings",       icon: Settings,        group: "admin",  adminOnly: true },
];

const GROUPS = [
  { id: "main",     label: "" },
  { id: "academic", label: "Academic" },
  { id: "finance",  label: "Finance" },
  { id: "content",  label: "Content" },
  { id: "tools",    label: "Tools" },
  { id: "admin",    label: "Admin" },
];

interface SidebarProps {
  section: NavSection;
  setSection: (s: NavSection) => void;
  role: Role;
  user: AppUser;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}

export function Sidebar({
  section, setSection, role, user, onLogout, collapsed, setCollapsed,
}: SidebarProps) {
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || role === "admin");

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-200 shrink-0",
        collapsed ? "w-14" : "w-56"
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center gap-3 px-3 py-4 border-b border-sidebar-border",
          collapsed && "justify-center"
        )}
      >
        <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center shrink-0">
          <GraduationCap className="w-5 h-5 text-accent-foreground" />
        </div>
        {!collapsed && (
          <div className="flex-1 min-w-0">
            <p className="font-bold text-xs leading-tight truncate">Maths Institute</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">A/L Combined Maths</p>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 hover:bg-sidebar-accent rounded-lg transition-colors shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {GROUPS.map((group) => {
          const groupItems = items.filter((i) => i.group === group.id);
          if (groupItems.length === 0) return null;
          return (
            <div key={group.id} className="mb-1">
              {group.label && !collapsed && (
                <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                  {group.label}
                </p>
              )}
              {groupItems.map((item) => (
                <button
                  key={item.section}
                  onClick={() => setSection(item.section)}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-3 mx-1 rounded-xl text-sm font-medium transition-colors",
                    "py-2.5 px-3",
                    collapsed ? "w-auto" : "w-[calc(100%-8px)]",
                    section === item.section
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className={cn("border-t border-sidebar-border p-3", collapsed && "flex justify-center")}>
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <Avatar name={user.name} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user.name.split(" ").slice(-1)[0]}</p>
              <Badge v="muted" className="!text-[10px] !px-1.5 !py-0">{user.role}</Badge>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 hover:bg-sidebar-accent rounded-lg transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogout}
            className="p-1.5 hover:bg-sidebar-accent rounded-lg transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </aside>
  );
}
