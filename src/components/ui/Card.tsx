import { cn } from "../../lib/utils";
import { TrendingUp } from "lucide-react";

export function Card({ className = "", children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-card rounded-xl border border-border", className)} {...p}>
      {children}
    </div>
  );
}

type StatColor = "navy" | "amber" | "emerald" | "blue" | "purple" | "rose";

const colorMap: Record<StatColor, { bg: string; text: string }> = {
  navy:    { bg: "bg-primary/10",    text: "text-primary" },
  amber:   { bg: "bg-amber-100",     text: "text-amber-600" },
  emerald: { bg: "bg-emerald-100",   text: "text-emerald-600" },
  blue:    { bg: "bg-blue-100",      text: "text-blue-600" },
  purple:  { bg: "bg-purple-100",    text: "text-purple-600" },
  rose:    { bg: "bg-rose-100",      text: "text-rose-600" },
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  trend?: string;
  sub?: string;
  color?: StatColor;
}

export function StatCard({ label, value, icon: Icon, trend, sub, color = "navy" }: StatCardProps) {
  const { bg, text } = colorMap[color];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-1">
            {label}
          </p>
          <p className="text-2xl font-bold text-foreground font-mono">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          {trend && (
            <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              {trend}
            </p>
          )}
        </div>
        <div className={cn("p-2.5 rounded-xl shrink-0", bg)}>
          <Icon className={cn("w-5 h-5", text)} />
        </div>
      </div>
    </Card>
  );
}
