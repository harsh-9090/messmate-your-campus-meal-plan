import type { Plan } from "@/lib/messmate/types";
import { PLAN_COLORS } from "@/lib/messmate/constants";
import { cn } from "@/lib/utils";

export function PlanBadge({ planId, label }: { planId: string; label: string }) {
  const grad = PLAN_COLORS[planId] ?? PLAN_COLORS.custom;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full bg-gradient-to-r px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm",
        grad
      )}
    >
      {label}
    </span>
  );
}

export function PlanIcons({ plan }: { plan: Plan | { meals?: string[] } | null | undefined }) {
  const meals = (plan as Plan)?.meals || [];
  return (
    <div className="flex gap-1.5">
      {meals.includes("Breakfast") && (
        <span title="Breakfast" className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-50 text-amber-600 shadow-sm ring-1 ring-inset ring-amber-500/20">
          🌅
        </span>
      )}
      {meals.includes("Lunch") && (
        <span title="Lunch" className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-50 text-blue-600 shadow-sm ring-1 ring-inset ring-blue-500/20">
          🍱
        </span>
      )}
      {meals.includes("Dinner") && (
        <span title="Dinner" className="flex h-6 w-6 items-center justify-center rounded-md bg-indigo-50 text-indigo-600 shadow-sm ring-1 ring-inset ring-indigo-500/20">
          🌙
        </span>
      )}
    </div>
  );
}
