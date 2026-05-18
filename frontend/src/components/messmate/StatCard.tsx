import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "primary",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "destructive";
}) {
  const ring = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  }[accent];

  return (
    <Card className="p-4 sm:p-6 transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1.5">
          <p className="text-xs sm:text-sm font-semibold text-muted-foreground uppercase tracking-wider leading-none">
            {label}
          </p>
          <p className="font-display text-2xl sm:text-4xl font-bold truncate leading-tight">
            {value}
          </p>
          {hint && (
            <p className="text-[11px] sm:text-sm font-medium text-muted-foreground/80 leading-tight">
              {hint}
            </p>
          )}
        </div>
        <div className={cn("rounded-xl p-2.5 sm:p-3.5 shrink-0 shadow-sm", ring)}>
          <Icon className="h-5 w-5 sm:h-6 w-6" />
        </div>
      </div>
    </Card>
  );
}
