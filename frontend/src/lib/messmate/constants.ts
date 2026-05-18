import type { Plan, MealWindow, Meal } from "./types";

export const MEALS: Meal[] = ["Breakfast", "Lunch", "Dinner"];

export const MEAL_ICONS: Record<Meal, string> = {
  Breakfast: "🌅",
  Lunch: "🍱",
  Dinner: "🌙",
};

export const PLAN_PRESETS: Plan[] = [
  {
    planId: "full",
    label: "Full Board",
    meals: ["Breakfast", "Lunch", "Dinner"],
    pricePerMonth: 4500,
    durationMonths: 1,
    isActive: true,
  },
  {
    planId: "lunch-dinner",
    label: "Lunch + Dinner",
    meals: ["Lunch", "Dinner"],
    pricePerMonth: 3200,
    durationMonths: 1,
    isActive: true,
  },
  {
    planId: "breakfast-lunch",
    label: "Breakfast + Lunch",
    meals: ["Breakfast", "Lunch"],
    pricePerMonth: 3000,
    durationMonths: 1,
    isActive: true,
  },
  {
    planId: "lunch-only",
    label: "Lunch Only",
    meals: ["Lunch"],
    pricePerMonth: 1800,
    durationMonths: 1,
    isActive: true,
  },
  {
    planId: "dinner-only",
    label: "Dinner Only",
    meals: ["Dinner"],
    pricePerMonth: 1800,
    durationMonths: 1,
    isActive: true,
  },
  {
    planId: "breakfast-only",
    label: "Breakfast Only",
    meals: ["Breakfast"],
    pricePerMonth: 1500,
    durationMonths: 1,
    isActive: true,
  },
];

export const DEFAULT_WINDOWS: MealWindow[] = [
  { meal: "Breakfast", startTime: "07:00", endTime: "10:00" },
  { meal: "Lunch", startTime: "11:30", endTime: "14:30" },
  { meal: "Dinner", startTime: "19:00", endTime: "21:30" },
];

export const PLAN_COLORS: Record<string, string> = {
  full: "from-indigo-500 to-purple-600",
  "lunch-dinner": "from-blue-500 to-indigo-500",
  "breakfast-lunch": "from-amber-500 to-orange-500",
  "lunch-only": "from-emerald-500 to-teal-500",
  "dinner-only": "from-violet-500 to-fuchsia-500",
  "breakfast-only": "from-yellow-400 to-amber-500",
  custom: "from-slate-500 to-slate-700",
};
