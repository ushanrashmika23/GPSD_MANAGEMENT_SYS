import { Download, QrCode } from "lucide-react";
import { Btn, Sel, Card } from "../ui";
import { useState } from "react";
import { cn } from "../../lib/utils";
import type { Student, Batch } from "../../lib/types";

interface QRCodesPageProps {
  students: Student[];
  batches: Batch[];
}

export function QRCodesPage({ students, batches }: QRCodesPageProps) {
  const [filter, setFilter] = useState("all");
  const filtered = students.filter((s) => s.active && (filter === "all" || s.batchIds.includes(filter)));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">QR Codes</h1>
        <p className="text-sm text-muted-foreground">
          Generate and manage student QR codes for attendance and fee payment
        </p>
      </div>

      <Card className="p-4">
        <div className="flex gap-3">
          <Sel className="w-48" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Batches</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </Sel>
          <Btn v="outline" sz="sm"><Download className="w-4 h-4" />Download All QR Codes</Btn>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {filtered.map((s) => (
          <Card key={s.id} className="p-4 text-center">
            <div className="w-full aspect-square bg-muted/50 rounded-xl mb-3 flex items-center justify-center relative overflow-hidden border border-border">
              {/* Pseudo QR pattern */}
              <div className="grid grid-cols-8 gap-0.5 p-3 opacity-70">
                {Array.from({ length: 64 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "w-2 h-2 rounded-[1px]",
                      (s.id.charCodeAt(i % s.id.length) + i) % 3 === 0 ? "bg-foreground" : "bg-transparent"
                    )}
                  />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 bg-card rounded-lg flex items-center justify-center border-2 border-border">
                  <QrCode className="w-5 h-5 text-primary" />
                </div>
              </div>
            </div>
            <p className="text-xs font-semibold text-foreground truncate">{s.fullName}</p>
            <p className="text-xs text-muted-foreground font-mono">{s.callupNo}</p>
            <Btn v="outline" sz="xs" className="mt-2 w-full justify-center">
              <Download className="w-3 h-3" />Download
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}
