import { useState } from "react";
import { GraduationCap } from "lucide-react";
import { Btn, Input, FLabel } from "../ui";
import type { AppUser } from "../../lib/types";

interface LoginPageProps {
  onLogin: (user: AppUser) => void;
  users: AppUser[];
}

export function LoginPage({ onLogin, users }: LoginPageProps) {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find((x) => x.email === email && x.active);
    if (!user) { setErr("No active account found for this email."); return; }
    if (pass !== "password123") { setErr("Incorrect password."); return; }
    onLogin(user);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[44%] bg-primary p-12 text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-accent-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm leading-none">Maths Institute</p>
            <p className="text-primary-foreground/60 text-xs mt-0.5">Management System</p>
          </div>
        </div>
        <div>
          <p className="text-accent/80 text-sm font-medium uppercase tracking-widest mb-4">
            Advanced Level
          </p>
          <h1
            className="text-4xl font-bold leading-tight mb-4"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Combined<br />Mathematics
          </h1>
          <p className="text-primary-foreground/60 text-base leading-relaxed max-w-sm">
            Track students, manage attendance, record fees, analyse performance —
            everything your institute needs in one place.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-6 border-t border-primary-foreground/10 pt-8">
          {[
            { n: "16", l: "Students" },
            { n: "4", l: "Batches" },
            { n: "98%", l: "Pass Rate" },
          ].map(({ n, l }) => (
            <div key={l}>
              <p className="text-3xl font-bold">{n}</p>
              <p className="text-primary-foreground/50 text-xs mt-1">{l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg">Maths Institute</span>
          </div>

          <h2 className="text-2xl font-bold text-foreground mb-1">Welcome back</h2>
          <p className="text-muted-foreground text-sm mb-8">
            Sign in to access the management system
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <FLabel>Email Address</FLabel>
              <Input
                type="email"
                placeholder="your@mathsinstitute.lk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <FLabel>Password</FLabel>
              <Input
                type="password"
                placeholder="••••••••"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                required
              />
            </div>
            {err && (
              <p className="text-xs text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {err}
              </p>
            )}
            <Btn type="submit" className="w-full justify-center" sz="lg">
              Sign In
            </Btn>
          </form>

          <div className="mt-8 p-4 bg-muted/60 rounded-xl border border-border">
            <p className="text-xs font-semibold text-foreground mb-2">
              Demo Credentials (password: password123)
            </p>
            <p className="text-xs text-muted-foreground">Admin: admin@mathsinstitute.lk</p>
            <p className="text-xs text-muted-foreground">Staff: staff@mathsinstitute.lk</p>
          </div>
        </div>
      </div>
    </div>
  );
}
