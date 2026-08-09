import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "./Input";
import { cn } from "../../lib/utils";
import type { Batch } from "../../lib/types";

interface BatchDropdownProps {
  batches: Batch[];
  value: string;               // selected batch id, or "" / "all"
  onChange: (batchId: string) => void;
  includeAll?: boolean;        // show "All Batches" option (for filter bar)
  placeholder?: string;        // default "Select batch"
  className?: string;
}

export function BatchDropdown({
  batches,
  value,
  onChange,
  includeAll = false,
  placeholder = "Select batch",
  className,
}: BatchDropdownProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Outside-click close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Split + filter by search
  const { activeList, inactiveList } = useMemo(() => {
    const query = q.toLowerCase();
    const active = batches.filter(
      (b) => b.active && (!query || b.name.toLowerCase().includes(query))
    );
    const inactive = batches.filter(
      (b) => !b.active && (!query || b.name.toLowerCase().includes(query))
    );
    return { activeList: active, inactiveList: inactive };
  }, [batches, q]);

  // Display name
  const selectedName = useMemo(() => {
    if (includeAll && value === "all") return "All Batches";
    if (!value) return placeholder;
    const b = batches.find((x) => x.id === value);
    return b ? b.name : placeholder;
  }, [value, batches, includeAll, placeholder]);

  const select = (id: string) => {
    onChange(id);
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen((prev) => !prev); setQ(""); }}
        className={cn(
          "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-border bg-card",
          "hover:border-primary/40 transition-colors",
          value && value !== "all" && "border-primary/60"
        )}
      >
        <span className={cn(
          "truncate flex-1 text-left",
          value && value !== "all" ? "text-foreground font-medium" : "text-muted-foreground"
        )}>
          {selectedName}
        </span>
        <svg
          className={cn("w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute top-full left-0 mt-1 w-full min-w-[220px] bg-card border border-border rounded-xl shadow-xl z-30 overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-border">
            <Input
              className="w-full text-sm"
              placeholder="Search batches…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>

          <div className="max-h-52 overflow-y-auto">
            {/* All Batches */}
            {includeAll && (
              <button
                type="button"
                onClick={() => select("all")}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm transition-colors",
                  value === "all" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                )}
              >
                All Batches
              </button>
            )}

            {/* Active */}
            {activeList.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Active
                </div>
                {activeList.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => select(b.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2",
                      value === b.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
              </>
            )}

            {/* Inactive */}
            {inactiveList.length > 0 && (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Inactive
                </div>
                {inactiveList.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => select(b.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2",
                      value === b.id ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted/50"
                    )}
                  >
                    <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                    <span className="truncate text-muted-foreground">{b.name}</span>
                  </button>
                ))}
              </>
            )}

            {activeList.length === 0 && inactiveList.length === 0 && (
              <p className="px-3 py-3 text-sm text-muted-foreground text-center">
                No batches found
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
