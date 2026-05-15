import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Member, MealUsageDay, ScanLog, Plan, MealWindow, Meal, ScanResult } from "./types";
import { PLAN_PRESETS, DEFAULT_WINDOWS } from "./constants";
import { todayISO, addDaysISO } from "./dateHelpers";
import { validateScan } from "./scanValidator";

const today = todayISO();

const seedMembers: Member[] = [
  {
    memberId: "ADMIN01",
    name: "Priya Sharma",
    email: "admin@messmate.app",
    password: "admin123",
    room: "Office",
    role: "admin",
    isActive: true,
    subscription: {
      planId: "full", planLabel: "Full Board", meals: ["Breakfast", "Lunch", "Dinner"],
      startDate: today, endDate: addDaysISO(today, 30), isPaid: true,
      pricePerMonth: 4500, renewalCount: 0,
    },
  },
  {
    memberId: "STAFF01",
    name: "Ramesh Kumar",
    email: "staff@messmate.app",
    password: "staff123",
    room: "Kitchen",
    role: "staff",
    isActive: true,
    subscription: {
      planId: "full", planLabel: "Full Board", meals: ["Breakfast", "Lunch", "Dinner"],
      startDate: today, endDate: addDaysISO(today, 30), isPaid: true,
      pricePerMonth: 4500, renewalCount: 0,
    },
  },
  ...[
    ["STU001", "Arjun Mehta", "A-101", "lunch-dinner", true, 0],
    ["STU002", "Ananya Iyer", "A-102", "full", true, 0],
    ["STU003", "Karthik Reddy", "B-204", "breakfast-lunch", true, 0],
    ["STU004", "Sneha Patil", "B-210", "lunch-only", true, 0],
    ["STU005", "Vikram Singh", "C-305", "dinner-only", false, 0],
    ["STU006", "Meera Nair", "C-308", "full", true, 27],
    ["STU007", "Rohan Das", "A-115", "breakfast-only", true, 0],
    ["STU008", "Isha Kapoor", "B-220", "lunch-dinner", true, 28],
    ["STU009", "Aditya Rao", "C-301", "full", true, 0],
    ["STU010", "Divya Menon", "A-108", "lunch-dinner", true, 31],
  ].map(([memberId, name, room, planId, isPaid, daysIn]) => {
    const plan = PLAN_PRESETS.find((p) => p.planId === planId)!;
    const start = addDaysISO(today, -(daysIn as number));
    return {
      memberId: memberId as string,
      name: name as string,
      email: `${(memberId as string).toLowerCase()}@messmate.app`,
      password: "pass123",
      room: room as string,
      role: "member" as const,
      isActive: true,
      subscription: {
        planId: plan.planId, planLabel: plan.label, meals: plan.meals,
        startDate: start, endDate: addDaysISO(start, 30),
        isPaid: isPaid as boolean, pricePerMonth: plan.pricePerMonth, renewalCount: 0,
      },
    };
  }),
];

interface MessState {
  members: Member[];
  plans: Plan[];
  windows: MealWindow[];
  usage: MealUsageDay[];
  logs: ScanLog[];
  currentUserId: string | null;

  // Auth
  login: (memberId: string, password: string) => Member | null;
  logout: () => void;
  currentUser: () => Member | null;

  // Members
  addMember: (m: Omit<Member, "memberId" | "isActive" | "role"> & { role?: "member" | "staff" | "admin" }) => Member;
  updateMember: (id: string, patch: Partial<Member>) => void;
  deleteMember: (id: string) => void;
  renewMember: (id: string) => void;
  togglePaid: (id: string) => void;
  changePlan: (id: string, planId: string, customMeals?: Meal[], pricePerMonth?: number) => void;

  // Config
  updateWindow: (meal: Meal, startTime: string, endTime: string) => void;
  updatePlan: (planId: string, patch: Partial<Plan>) => void;

  // Scan
  performScan: (memberId: string, meal: Meal, scannedBy: string) => ScanResult;
  getUsageFor: (memberId: string, date: string) => MealUsageDay | null;
}

const nextMemberId = (members: Member[]) => {
  const nums = members
    .filter((m) => m.memberId.startsWith("STU"))
    .map((m) => parseInt(m.memberId.replace("STU", "")) || 0);
  const max = nums.length ? Math.max(...nums) : 0;
  return `STU${String(max + 1).padStart(3, "0")}`;
};

export const useMess = create<MessState>()(
  persist(
    (set, get) => ({
      members: seedMembers,
      plans: PLAN_PRESETS,
      windows: DEFAULT_WINDOWS,
      usage: [],
      logs: [],
      currentUserId: null,

      login: (memberId, password) => {
        const m = get().members.find(
          (x) => x.memberId.toLowerCase() === memberId.toLowerCase() && x.password === password && x.isActive
        );
        if (m) set({ currentUserId: m.memberId });
        return m ?? null;
      },
      logout: () => set({ currentUserId: null }),
      currentUser: () => {
        const id = get().currentUserId;
        return id ? get().members.find((m) => m.memberId === id) ?? null : null;
      },

      addMember: (m) => {
        const memberId = nextMemberId(get().members);
        const newMember: Member = {
          ...m,
          memberId,
          isActive: true,
          role: m.role ?? "member",
        };
        set({ members: [...get().members, newMember] });
        return newMember;
      },
      updateMember: (id, patch) =>
        set({ members: get().members.map((m) => (m.memberId === id ? { ...m, ...patch } : m)) }),
      deleteMember: (id) =>
        set({ members: get().members.map((m) => (m.memberId === id ? { ...m, isActive: false } : m)) }),
      renewMember: (id) => {
        const t = todayISO();
        set({
          members: get().members.map((m) =>
            m.memberId === id
              ? {
                  ...m,
                  subscription: {
                    ...m.subscription,
                    startDate: t,
                    endDate: addDaysISO(t, 30),
                    isPaid: true,
                    renewedAt: new Date().toISOString(),
                    renewalCount: (m.subscription.renewalCount || 0) + 1,
                  },
                }
              : m
          ),
        });
      },
      togglePaid: (id) =>
        set({
          members: get().members.map((m) =>
            m.memberId === id
              ? { ...m, subscription: { ...m.subscription, isPaid: !m.subscription.isPaid } }
              : m
          ),
        }),
      changePlan: (id, planId, customMeals, pricePerMonth) => {
        const plan = get().plans.find((p) => p.planId === planId);
        if (!plan && planId !== "custom") return;
        const meals = planId === "custom" ? customMeals ?? [] : plan!.meals;
        const label = planId === "custom" ? "Custom" : plan!.label;
        const price = pricePerMonth ?? plan?.pricePerMonth ?? 0;
        set({
          members: get().members.map((m) =>
            m.memberId === id
              ? {
                  ...m,
                  subscription: {
                    ...m.subscription,
                    planId, planLabel: label, meals, pricePerMonth: price,
                  },
                }
              : m
          ),
        });
      },

      updateWindow: (meal, startTime, endTime) =>
        set({
          windows: get().windows.map((w) =>
            w.meal === meal ? { ...w, startTime, endTime } : w
          ),
        }),
      updatePlan: (planId, patch) =>
        set({ plans: get().plans.map((p) => (p.planId === planId ? { ...p, ...patch } : p)) }),

      getUsageFor: (memberId, date) =>
        get().usage.find((u) => u.memberId === memberId && u.date === date) ?? null,

      performScan: (memberId, meal, scannedBy) => {
        const member = get().members.find((m) => m.memberId === memberId && m.isActive) ?? null;
        const date = todayISO();
        const usage = get().usage.find((u) => u.memberId === memberId && u.date === date) ?? null;
        const result = validateScan({ member, meal, windows: get().windows, usage });

        // Persist log
        const log: ScanLog = {
          id: crypto.randomUUID(),
          memberId,
          memberName: member?.name ?? "Unknown",
          meal,
          date,
          timestamp: new Date().toISOString(),
          status: result.status,
          denialCode: result.code,
          denialReason: result.reason,
          scannedBy,
        };
        set({ logs: [log, ...get().logs].slice(0, 1000) });

        // If allowed, mark usage
        if (result.status === "allowed") {
          const existing = get().usage.find((u) => u.memberId === memberId && u.date === date);
          if (existing) {
            set({
              usage: get().usage.map((u) =>
                u === existing ? { ...u, usedMeals: { ...u.usedMeals, [meal]: true } } : u
              ),
            });
          } else {
            set({
              usage: [
                ...get().usage,
                {
                  memberId, date,
                  usedMeals: {
                    Breakfast: meal === "Breakfast",
                    Lunch: meal === "Lunch",
                    Dinner: meal === "Dinner",
                  },
                },
              ],
            });
          }
        }
        return result;
      },
    }),
    {
      name: "messmate-store-v1",
      partialize: (s) => ({
        members: s.members,
        plans: s.plans,
        windows: s.windows,
        usage: s.usage,
        logs: s.logs,
        currentUserId: s.currentUserId,
      }),
    }
  )
);
