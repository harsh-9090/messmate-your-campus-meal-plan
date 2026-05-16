// Thin fetch wrapper around the MessMate Express backend.
// Reads VITE_API_URL (e.g. http://localhost:4000/api/v1).
// Attaches the JWT access token stored in the auth store.

import type {
  Member, Plan, MealWindow, Meal, ScanResult, ScanLog, MealUsageDay,
} from "./types";

const BASE_URL =
  (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_URL) ||
  "http://localhost:4000/api/v1";

let getToken: () => string | null = () => null;
let onUnauthorized: () => void = () => {};
export function configureApi(opts: { getToken: () => string | null; onUnauthorized: () => void }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  path: string,
  init: RequestInit & { auth?: boolean; raw?: boolean } = {}
): Promise<T> {
  const { auth = true, raw = false, headers, ...rest } = init;
  const h: Record<string, string> = { "Content-Type": "application/json", ...(headers as any) };
  if (auth) {
    const tok = getToken();
    if (tok) h.Authorization = `Bearer ${tok}`;
  }
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...rest, headers: h, credentials: "include" });
  } catch (e: any) {
    throw new ApiError(`Cannot reach API at ${BASE_URL}. Is the backend running?`, 0);
  }
  if (res.status === 401 && auth) onUnauthorized();
  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch {}
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status, body);
  }
  if (raw) return res as unknown as T;
  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

// ---------- Auth ----------
export const authApi = {
  login: (memberId: string, password: string) =>
    request<{ accessToken: string; user: { id: string; name: string; role: "admin" | "staff" | "member" } }>(
      "/auth/login", { method: "POST", auth: false, body: JSON.stringify({ memberId, password }) }
    ),
  me: () => request<Member>("/auth/me"),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST", auth: false }),
};

// ---------- Members ----------
export interface MemberListResponse { items: Member[]; total: number; page: number; limit: number; }
export const membersApi = {
  list: (params: { search?: string; status?: string; page?: number; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.status && params.status !== "all") q.set("status", params.status);
    q.set("page", String(params.page ?? 1));
    q.set("limit", String(params.limit ?? 100));
    return request<MemberListResponse>(`/members?${q.toString()}`);
  },
  get: (id: string) => request<Member>(`/members/${id}`),
  create: (data: {
    name: string; email: string; password: string; room?: string;
    planId: string; meals: Meal[]; startDate: string; isPaid?: boolean; role?: string;
  }) => request<Member>("/members", { method: "POST", body: JSON.stringify(data) }),
  update: (id: string, patch: Partial<{ name: string; email: string; room: string; password: string; photoUrl: string }>) =>
    request<Member>(`/members/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  remove: (id: string) => request<{ ok: true }>(`/members/${id}`, { method: "DELETE" }),
  renew: (id: string) => request(`/members/${id}/renew`, { method: "PUT" }),
  setPaid: (id: string, isPaid: boolean) =>
    request(`/members/${id}/payment`, { method: "PUT", body: JSON.stringify({ isPaid }) }),
  changePlan: (id: string, data: { planId: string; meals?: Meal[]; startDate?: string; isPaid?: boolean }) =>
    request(`/members/${id}/plan`, { method: "PUT", body: JSON.stringify(data) }),
};

// ---------- Config ----------
export const configApi = {
  listPlans: () => request<Plan[]>("/config/plans"),
  updatePlan: (planId: string, patch: Partial<Plan>) =>
    request<Plan>(`/config/plans/${planId}`, { method: "PUT", body: JSON.stringify(patch) }),
  createPlan: (plan: Plan & { isActive?: boolean }) =>
    request<Plan>("/config/plans", { method: "POST", body: JSON.stringify(plan) }),
  listWindows: () => request<MealWindow[]>("/config/windows"),
  updateWindow: (meal: Meal, startTime: string, endTime: string) =>
    request<MealWindow>(`/config/windows/${meal}`, { method: "PUT", body: JSON.stringify({ startTime, endTime }) }),
};

// ---------- QR ----------
export const qrApi = {
  token: () => request<{ token: string; expiresIn: number }>("/qr/token"),
};

// ---------- Scan ----------
export const scanApi = {
  validate: (qrToken: string, meal: Meal) =>
    request<ScanResult>("/scan/validate", { method: "POST", body: JSON.stringify({ qrToken, meal }) }),
  logs: (params: { date?: string; memberId?: string; status?: string; code?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v != null && v !== "") q.set(k, String(v)); });
    return request<ScanLog[]>(`/scan/logs?${q.toString()}`);
  },
};

// ---------- Usage / Reports ----------
export const usageApi = {
  today: () => request<MealUsageDay[]>("/usage/today"),
  summaryToday: () => request<{ Breakfast: number; Lunch: number; Dinner: number; total: number }>("/usage/summary/today"),
  forMember: (memberId: string, params: { from?: string; to?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    return request<MealUsageDay[]>(`/usage/${memberId}?${q.toString()}`);
  },
};

export const reportsApi = {
  daily: (date?: string) => request<{
    date: string; meals: Record<Meal, number>; allowed: number; denied: number; total: number;
    denialBreakdown: Record<string, number>;
  }>(`/reports/daily${date ? `?date=${date}` : ""}`),
  weekly: () => request<{
    days: { date: string; meals: number }[];
    estimatedMonthlyRevenue: number;
  }>("/reports/weekly"),
  monthly: (month?: string) => request<{ month: string; totalMeals: number; days: number }>(
    `/reports/monthly${month ? `?month=${month}` : ""}`
  ),
  expiring: (days = 7) => request<Member[]>(`/reports/expiring?days=${days}`),
  exportDailyCsv: async (date?: string) => {
    const tok = getToken();
    const res = await fetch(`${BASE_URL}/reports/export?type=daily${date ? `&date=${date}` : ""}`, {
      headers: tok ? { Authorization: `Bearer ${tok}` } : {},
      credentials: "include",
    });
    if (!res.ok) throw new ApiError("Export failed", res.status);
    return res.blob();
  },
};
