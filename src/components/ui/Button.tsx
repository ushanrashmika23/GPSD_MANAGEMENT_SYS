import { cn } from "../../lib/utils";

type BtnVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "accent";
type BtnSize = "xs" | "sm" | "md" | "lg" | "icon";

const vStyles: Record<BtnVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-border bg-transparent hover:bg-accent/30 text-foreground",
  ghost: "hover:bg-accent/20 text-foreground",
  danger: "bg-destructive text-white hover:bg-destructive/90",
  accent: "bg-accent text-accent-foreground hover:bg-accent/90",
};

const sStyles: Record<BtnSize, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-sm",
   icon: "h-10 w-10 p-0 justify-center"
};

export interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  v?: BtnVariant;
  sz?: BtnSize;
}

export function Btn({ v = "primary", sz = "md", className = "", children, ...p }: BtnProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors disabled:opacity-50 cursor-pointer",
        vStyles[v],
        sStyles[sz],
        className
      )}
      {...p}
    >
      {children}
    </button>
  );
}
