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

export function PlanIcons({ plan }: { plan: Plan | { meals: string[] } }) {
  const meals = (plan as Plan).meals;
  return (
    <div className="flex gap-1 text-sm">
      {meals.includes("Breakfast") && <span title="Breakfast">🌅</span>}
      {meals.includes("Lunch") && <span title="Lunch">🍱</span>}
      {meals.includes("Dinner") && <span title="Dinner">🌙</span>}
    </div>
  );
}
