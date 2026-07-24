import type { Plan } from "@/lib/messmate/types";
import { PLAN_COLORS } from "@/lib/messmate/constants";
import { cn } from "@/lib/utils";

export function PlanBadge({ planId, label, dietType }: { planId: string; label: string; dietType?: string }) {
  const grad = PLAN_COLORS[planId] ?? PLAN_COLORS.custom;
  return (
    <div className="flex flex-col items-start gap-1">
      <span
        className={cn(
          "inline-flex items-center rounded-full bg-gradient-to-r px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm",
          grad,
        )}
      >
        {label}
      </span>
      {dietType && (
        <span className={cn("text-[9px] uppercase font-bold px-1.5 py-0.5 rounded-sm border", 
          dietType === "Non-Veg" ? "text-destructive bg-destructive/10 border-destructive/20" :
          dietType === "Both" ? "text-muted-foreground bg-muted border-border/50" :
          "text-green-600 bg-green-500/10 border-green-600/20"
        )}>
          {dietType}
        </span>
      )}
    </div>
  );
}

export function PlanIcons({ plan }: { plan: Plan | { meals?: string[] } | null | undefined }) {
  const meals = (plan as Plan)?.meals || [];
  return (
    <div className="flex gap-1.5">
      {meals.includes("Breakfast") && (
        <span
          title="Breakfast"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600 shadow-sm ring-1 ring-inset ring-amber-500/20"
        >
          🌅
        </span>
      )}
      {meals.includes("Lunch") && (
        <span
          title="Lunch"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600 shadow-sm ring-1 ring-inset ring-blue-500/20"
        >
          🍱
        </span>
      )}
      {meals.includes("Dinner") && (
        <span
          title="Dinner"
          className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-inset ring-indigo-500/20"
        >
          🌙
        </span>
      )}
    </div>
  );
}
