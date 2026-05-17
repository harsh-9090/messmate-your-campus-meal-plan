import { format, parseISO, differenceInCalendarDays, addDays } from "date-fns";
import type { Meal, MealWindow } from "./types";

export const todayISO = () => format(new Date(), "yyyy-MM-dd");

export const formatDate = (iso: string | null | undefined) => 
  iso ? format(parseISO(iso), "dd MMM yyyy") : "-";

export const daysRemaining = (endDateISO: string | null | undefined) =>
  endDateISO ? differenceInCalendarDays(parseISO(endDateISO), new Date()) : 0;

export const daysElapsed = (startDateISO: string | null | undefined) =>
  startDateISO ? Math.max(0, differenceInCalendarDays(new Date(), parseISO(startDateISO))) : 0;

export const addDaysISO = (startISO: string, days: number) =>
  format(addDays(parseISO(startISO), days), "yyyy-MM-dd");

export const formatTime12h = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hr = h % 12 || 12;
  return `${hr}:${m.toString().padStart(2, "0")} ${period}`;
};

export const isWithinWindow = (now: Date, w: MealWindow) => {
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = w.startTime.split(":").map(Number);
  const [eh, em] = w.endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return cur >= start && cur <= end;
};

export const getActiveMeal = (windows: MealWindow[], now = new Date()): Meal | null => {
  const w = windows.find((x) => isWithinWindow(now, x));
  return w ? w.meal : null;
};

export const formatINR = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const formatTimestamp = (iso: string) => format(parseISO(iso), "dd MMM, hh:mm a");
