import { cn } from "../../lib/utils";

export function Input({ className = "", ...p }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full px-3 py-2 text-sm border border-border rounded-lg bg-card",
        "focus:outline-none focus:ring-2 focus:ring-ring transition-colors",
        className
      )}
      {...p}
    />
  );
}

export function Sel({
  className = "",
  children,
  ...p
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      className={cn(
        "w-full px-3 py-2 text-sm border border-border rounded-lg bg-card",
        "focus:outline-none focus:ring-2 focus:ring-ring transition-colors",
        className
      )}
      {...p}
    >
      {children}
    </select>
  );
}

export function Textarea({ className = "", ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full px-3 py-2 text-sm border border-border rounded-lg bg-card",
        "focus:outline-none focus:ring-2 focus:ring-ring transition-colors resize-none",
        className
      )}
      {...p}
    />
  );
}

export function FLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
      {children}
    </label>
  );
}
