import { cn } from "../../lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "muted" | "accent";

const variants: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-primary",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  muted: "bg-muted text-muted-foreground",
  accent: "bg-accent/10 text-accent",
};

interface BadgeProps {
  children: React.ReactNode;
  v?: BadgeVariant;
  className?: string;
}

export function Badge({ children, v = "default", className = "" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium",
        variants[v],
        className
      )}
    >
      {children}
    </span>
  );
}
