import { useEffect, useState } from "react";
import { Plus, Edit2, CheckCircle, XCircle, UserCog, KeyRound, Loader2 } from "lucide-react";
import { Badge, Btn, Input, Sel, Modal, Card, Avatar, StatCard } from "../ui";
import { FLabel } from "../ui";
import type { AppUser, Role } from "../../lib/types";
import { getAllUsers, addUser, updateUser, resetUserPassword } from "../../api/apiCalls";

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  address: string;
  role: Role;
  active: boolean;
  password: string; // add & reset-password only
}

const EMPTY_FORM: UserFormState = {
  firstName: "",
  lastName: "",
  email: "",
  mobile: "",
  address: "",
  role: "staff",
  active: true,
  password: "",
};

export function UsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState<"add" | "edit" | "reset" | null>(null);
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);

  // ── Fetch admin/staff users from the backend ─────────────────────────────
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await getAllUsers(1, 500, "");
      const rows = result?.data?.data ?? [];
      setUsers(
        rows.map((u: any) => ({
          id: u.id,
          name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
          email: u.email,
          role: u.roles as Role,
          active: u.is_active,
          lastLogin: u.lastLogin ? new Date(u.lastLogin).toLocaleString() : undefined,
          firstName: u.first_name ?? "",
          lastName: u.last_name ?? "",
          mobile: u.mobile ?? "",
          address: u.address ?? "",
        }))
      );
    } catch (err: any) {
      alert(err?.response?.data?.msg ?? err?.message ?? "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ── Add / Edit ───────────────────────────────────────────────────────────
  const save = async () => {
    if (
      !form.firstName.trim() || !form.lastName.trim() || !form.email.trim() ||
      !form.mobile.trim() || !form.address.trim()
    ) {
      alert("All fields are required.");
      return;
    }
    if (modal === "add" && form.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      let result: any;
      if (modal === "add") {
        result = await addUser({
          email: form.email,
          password: form.password,
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          address: form.address,
          role: form.role,
        });
      } else if (modal === "edit" && selected) {
        result = await updateUser(selected.id, {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          address: form.address,
          role: form.role,
          isActive: form.active,
        });
      }
      if (result?.success) {
        setModal(null);
        fetchUsers();
      } else {
        alert(result?.msg ?? "Failed to save user");
      }
    } catch (err: any) {
      alert(err?.response?.data?.msg ?? err?.message ?? "Failed to save user");
    } finally {
      setSaving(false);
    }
  };

  // ── Reset password ───────────────────────────────────────────────────────
  const resetPassword = async () => {
    if (!selected) return;
    if (form.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }
    setSaving(true);
    try {
      const result = await resetUserPassword(selected.id, form.password);
      if (result?.success) {
        setModal(null);
      } else {
        alert(result?.msg ?? "Failed to reset password");
      }
    } catch (err: any) {
      alert(err?.response?.data?.msg ?? err?.message ?? "Failed to reset password");
    } finally {
      setSaving(false);
    }
  };

  // ── Activate / deactivate ────────────────────────────────────────────────
  const toggleActive = async (u: AppUser) => {
    try {
      const result = await updateUser(u.id, { isActive: !u.active });
      if (result?.success) {
        setUsers((p) => p.map((x) => (x.id === u.id ? { ...x, active: !x.active } : x)));
      } else {
        alert(result?.msg ?? "Failed to update user");
      }
    } catch (err: any) {
      alert(err?.response?.data?.msg ?? err?.message ?? "Failed to update user");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">Manage system access and roles</p>
        </div>
        <Btn onClick={() => { setForm({ ...EMPTY_FORM }); setModal("add"); }}>
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No users found</td>
                </tr>
              ) : (
                users.map((u) => (
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
                          onClick={() => {
                            setSelected(u);
                            setForm({
                              firstName: u.firstName ?? "",
                              lastName: u.lastName ?? "",
                              email: u.email,
                              mobile: u.mobile ?? "",
                              address: u.address ?? "",
                              role: u.role,
                              active: u.active,
                              password: "",
                            });
                            setModal("edit");
                          }}
                          className="p-1.5 hover:bg-muted rounded-lg"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => {
                            setSelected(u);
                            setForm((f) => ({ ...f, password: "" }));
                            setModal("reset");
                          }}
                          className="p-1.5 hover:bg-muted rounded-lg"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => toggleActive(u)}
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Add / Edit user ─────────────────────────────────────────────── */}
      <Modal open={modal === "add" || modal === "edit"} onClose={() => setModal(null)} title={modal === "add" ? "Add User" : "Edit User"}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><FLabel>First Name</FLabel><Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} /></div>
            <div><FLabel>Last Name</FLabel><Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} /></div>
          </div>
          <div><FLabel>Email</FLabel><Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><FLabel>Mobile</FLabel><Input value={form.mobile} onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))} /></div>
            <div><FLabel>Address</FLabel><Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
          </div>
          {modal === "add" && (
            <div><FLabel>Password</FLabel><Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" /></div>
          )}
          <div>
            <FLabel>Role</FLabel>
            <Sel value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </Sel>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="uactive" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} />
            <label htmlFor="uactive" className="text-sm font-medium">Active Account</label>
          </div>
          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              {modal === "add" ? "Add User" : "Save"}
            </Btn>
          </div>
        </div>
      </Modal>

      {/* ── Reset password ─────────────────────────────────────────────── */}
      <Modal open={modal === "reset"} onClose={() => setModal(null)} title={`Reset Password — ${selected?.name ?? ""}`}>
        <div className="space-y-4">
          <div><FLabel>New Password</FLabel><Input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 6 characters" /></div>
          <div className="flex justify-end gap-2">
            <Btn v="outline" onClick={() => setModal(null)}>Cancel</Btn>
            <Btn onClick={resetPassword} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Reset Password
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
