import type { AppUser, Role } from "./types";

export const cn = (...c: (string | boolean | undefined | null)[]): string =>
  c.filter(Boolean).join(" ");

export const fmtCur = (n: number): string => `LKR ${n.toLocaleString()}`;

export const fmtDate = (d: string): string =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "";

export const fmtMonth = (m: string): string => {
  const [y, mo] = m.split("-");
  return new Date(+y, +mo - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
};

export const initials = (name: string): string =>
  name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// Map a snake_case backend user row → frontend AppUser shape
export const mapBackendUser = (u: any): AppUser => ({
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
});
