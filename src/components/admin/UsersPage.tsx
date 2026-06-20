import { useState } from "react";
import { Plus, Edit2, CheckCircle, XCircle, UserCog } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card, Avatar, StatCard } from "../ui";
import { FLabel } from "../ui";
import type { AppUser, Role } from "../../lib/types";

interface UsersPageProps {
  users: AppUser[];
  setUsers: React.Dispatch<React.SetStateAction<AppUser[]>>;
}

export function UsersPage({ users, setUsers }: UsersPageProps) {
  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [form, setForm] = useState<Partial<AppUser>>({});

  const save = () => {
    if (modal === "add") {
      setUsers((p) => [...p, { id: `u${Date.now()}`, active: true, ...form } as AppUser]);
    } else if (selected) {
      setUsers((p) => p.map((u) => (u.id === selected.id ? { ...u, ...form } as AppUser : u)));
    }
    setModal(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage system access and roles</p>
        </div>
        <Btn onClick={() => { setForm({ role: "staff", active: true }); setModal("add"); }}>
          <Plus className="w-4 h-4" />Add User
        </Btn>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Users"  value={users.length}                              icon={UserCog} color="navy" />
        <StatCard label="Admin Users"  value={users.filter((u) => u.role === "admin").length} icon={UserCog} color="amber" />
        <StatCard label="Staff Users"  value={users.filter((u) => u.role === "staff").length} icon={UserCog} color="blue" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["User", "Email", "Role", "Status", "Last Login", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} size="sm" />
                      <span className="font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{u.email}</td>
                  <td className="px-4 py-3"><Badge v={u.role === "admin" ? "accent" : "info"}>{u.role}</Badge></td>
                  <td className="px-4 py-3"><Badge v={u.active ? "success" : "danger"}>{u.active ? "Active" : "Inactive"}</Badge></td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{u.lastLogin || "Never"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setSelected(u); setForm({ ...u }); setModal("edit"); }}
                        className="p-1.5 hover:bg-muted rounded-lg"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)))}
                        className="p-1.5 hover:bg-muted rounded-lg"
                        title={u.active ? "Deactivate" : "Activate"}
                      >
                        {u.active
                          ? <XCircle className="w-3.5 h-3.5 text-amber-500" />
                          : <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === "add" ? "Add User" : "Edit User"}>
        <div className="space-y-4">
          <div><FLabel>Full Name</FLabel><Input value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
          <div><FLabel>Email</FLabel><Input type="email" value={form.email || ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div>
            <FLabel>Role</FLabel>
            <Sel value={form.role || "staff"} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </Sel>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="uactive" checked={form.active ?? true} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            <label htmlFor="uactive" className="text-sm font-medium">Active Account</label>
          </div>
          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save}>{modal === "add" ? "Add User" : "Save"}</Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
