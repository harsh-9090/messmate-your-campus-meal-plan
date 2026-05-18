import type { Meal } from "@/lib/messmate/types";
import { MEAL_ICONS } from "@/lib/messmate/constants";
import { Check, Clock, X } from "lucide-react";
import { cn } from "@/lib/utils";

type State = "used" | "available" | "window-closed" | "not-in-plan";

const STATE_COPY: Record<State, string> = {
  used: "Used today",
  available: "Available",
  "window-closed": "Window closed",
  "not-in-plan": "Not in plan",
};

export function MealChip({ meal, state }: { meal: Meal; state: State }) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-1 rounded-xl border p-2 sm:p-3 transition-all min-w-0 w-full",
        state === "used" && "border-success/30 bg-success/10",
        state === "available" && "border-primary/30 bg-primary/5",
        state === "window-closed" && "border-warning/30 bg-warning/10",
        state === "not-in-plan" && "border-border bg-muted/40 opacity-60",
      )}
    >
      <div className="flex items-center gap-1 sm:gap-2 min-w-0 w-full">
        <span className="text-base sm:text-lg shrink-0">{MEAL_ICONS[meal]}</span>
        <span className="font-semibold text-xs sm:text-sm md:text-base truncate">{meal}</span>
      </div>
      <div className="flex items-center gap-1 text-[10px] sm:text-xs min-w-0 w-full">
        {state === "used" && <Check className="h-3 w-3 shrink-0 text-success" />}
        {state === "window-closed" && <Clock className="h-3 w-3 shrink-0 text-warning" />}
        {state === "not-in-plan" && <X className="h-3 w-3 shrink-0" />}
        <span
          className={cn(
            "truncate",
            state === "used" && "text-success",
            state === "available" && "text-primary",
            state === "window-closed" && "text-warning",
            state === "not-in-plan" && "text-muted-foreground",
          )}
        >
          {STATE_COPY[state]}
        </span>
      </div>
    </div>
  );
}
