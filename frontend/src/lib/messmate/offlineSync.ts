import { get, set, del } from "idb-keyval";
import { scanApi } from "./api";
import type { Meal, ScanResult } from "./types";
import { todayISO, getActiveMeal } from "./dateHelpers";
import { MEALS } from "./constants";
import { differenceInCalendarDays } from "date-fns";

const STORE_KEY_DATA = "messmate_sync_data";
const STORE_KEY_LOGS = "messmate_offline_logs";
const STORE_KEY_DATE = "messmate_sync_date";

export interface OfflineLog {
  id: string; // uuid
  memberId?: string;
  memberName?: string;
  meal: Meal;
  status: "allowed" | "denied";
  code?: string;
  reason?: string;
  timestamp: number;
  dietServed?: string;
  isGuestPass?: boolean;
  guestToken?: string;
}

export const offlineSync = {
  /** Download today's active members, holidays, usage, skips, etc. */
  async downloadSyncData() {
    const data = await scanApi.syncData();
    const today = todayISO();
    await set(STORE_KEY_DATA, data);
    await set(STORE_KEY_DATE, today);
    return data;
  },

  /** Get local sync data. If not for today, return null to force re-sync if possible. */
  async getSyncData() {
    const date = await get(STORE_KEY_DATE);
    if (date !== todayISO()) return null; // Stale data
    return await get(STORE_KEY_DATA);
  },

  /** Fallback validator when network is unavailable */
  async validateOffline(
    qrToken: string,
    meal: Meal,
    windows: any[]
  ): Promise<ScanResult> {
    const data = await this.getSyncData();
    if (!data) {
      throw new Error("No offline data available for today. Please reconnect to Wi-Fi to sync.");
    }

    const { members, usage, skips, holidays, guestPasses } = data;
    const now = new Date();
    
    // Check holiday
    if (holidays && holidays.length > 0) {
      const h = holidays[0];
      if (
        (meal === "Breakfast" && h.blockBreakfast) ||
        (meal === "Lunch" && h.blockLunch) ||
        (meal === "Dinner" && h.blockDinner)
      ) {
        return this.logAndReturn({
          meal, status: "denied", code: "MESS_CLOSED", reason: `Mess is closed today for ${meal}: ${h.content}`
        });
      }
    }

    // Is it a guest pass?
    if (qrToken.startsWith("gp_")) {
      const gp = guestPasses?.find((g: any) => g.qrToken === qrToken);
      if (!gp) {
        return this.logAndReturn({ meal, status: "denied", code: "INVALID_TOKEN", reason: "Guest pass not found or not active today" });
      }
      if (gp.meal !== meal) {
        return this.logAndReturn({ meal, status: "denied", code: "WRONG_MEAL", reason: `Guest pass is for ${gp.meal} but scanned during ${meal}`, member: { memberId: gp.memberId, name: `${gp.guestName} (Host: ${gp.hostName})`} });
      }
      
      // Prevent double scan offline
      const pendingLogs = await this.getOfflineLogs();
      const alreadyScanned = pendingLogs.some(l => l.guestToken === qrToken && l.status === "allowed");
      if (alreadyScanned) {
        return this.logAndReturn({ meal, status: "denied", code: "ALREADY_USED", reason: "Guest pass has already been used", member: { memberId: gp.memberId, name: `${gp.guestName} (Host: ${gp.hostName})`} });
      }

      return this.logAndReturn({
        meal, status: "allowed", isGuestPass: true, guestName: gp.guestName, guestToken: qrToken,
        member: { memberId: gp.memberId, name: `${gp.guestName} (Host: ${gp.hostName})` }
      });
    }

    // Decode standard JWT
    let payload;
    try {
      // Very basic JWT decode (payload is middle base64 chunk)
      const base64Url = qrToken.split(".")[1];
      const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
      const jsonPayload = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
      payload = JSON.parse(jsonPayload);
    } catch (e) {
      return this.logAndReturn({ meal, status: "denied", code: "INVALID_TOKEN", reason: "Invalid or expired QR code format" });
    }

    const { userId, meal: tokenMeal, date: tokenDate } = payload;
    
    // We trust the timestamp/hash implicitly in offline mode (closed campus assumption)
    if (tokenDate !== todayISO()) {
      return this.logAndReturn({ meal, status: "denied", code: "EXPIRED", reason: "QR code date is invalid" });
    }
    
    if (tokenMeal !== meal) {
      return this.logAndReturn({ meal, status: "denied", code: "WRONG_MEAL_QR", reason: `It is currently the ${meal} window, but this QR code is for ${tokenMeal}` });
    }

    const member = members.find((m: any) => m.memberId === userId);
    if (!member) {
      return this.logAndReturn({ meal, status: "denied", code: "NOT_FOUND", reason: "Member not registered or active" });
    }

    const mInfo = { memberId: member.memberId, name: member.name };
    const sub = member.subscription;

    // Payment / Grace period check
    if (!sub.isPaid) {
      const start = new Date(sub.startDate || member.createdAt);
      const daysSinceStart = differenceInCalendarDays(now, start);
      if (daysSinceStart > 3) {
        return this.logAndReturn({
          meal, status: "denied", code: "UNPAID", member: mInfo,
          reason: sub.amountPaid > 0 ? `Grace period (3 days) expired. Please pay remaining ₹${sub.dueAmount}.` : `Payment pending. Please pay at the mess office.`
        });
      }
    }

    // Expiry check
    if (todayISO() < (sub.startDate || "")) {
      return this.logAndReturn({ meal, status: "denied", code: "EXPIRED", reason: "Plan not yet active", member: mInfo });
    }
    if (todayISO() > (sub.endDate || "")) {
      return this.logAndReturn({ meal, status: "denied", code: "EXPIRED", reason: "Plan expired", member: mInfo });
    }

    // Meal inclusion check
    if (!sub.meals.includes(meal)) {
      return this.logAndReturn({ meal, status: "denied", code: "NOT_IN_PLAN", reason: `${meal} is not included in your ${sub.planLabel} plan`, member: mInfo });
    }

    // Skip check
    const hasSkipped = skips?.some((s: any) => s.memberId === userId && s.meal === meal);
    if (hasSkipped) {
      return this.logAndReturn({ meal, status: "denied", code: "MEAL_SKIPPED", reason: `You have opted to skip ${meal} today.`, member: mInfo });
    }

    // Usage check (merged server usage + local pending offline usage)
    const serverUsage = usage?.find((u: any) => u.memberId === userId) || { usedBreakfast: false, usedLunch: false, usedDinner: false };
    const isUsedOnServer = (meal === "Breakfast" && serverUsage.usedBreakfast) || (meal === "Lunch" && serverUsage.usedLunch) || (meal === "Dinner" && serverUsage.usedDinner);
    
    const pendingLogs = await this.getOfflineLogs();
    const isUsedLocally = pendingLogs.some(l => l.memberId === userId && l.meal === meal && l.status === "allowed");

    if (isUsedOnServer || isUsedLocally) {
      return this.logAndReturn({ meal, status: "denied", code: "ALREADY_USED", reason: `${meal} already scanned today`, member: mInfo });
    }

    // Window check
    const activeFromTime = getActiveMeal(windows);
    if (activeFromTime !== meal) {
      return this.logAndReturn({ meal, status: "denied", code: "WRONG_TIME", reason: `Window for ${meal} is currently closed`, member: mInfo });
    }

    // All clear - Allowed!
    return this.logAndReturn({
      meal, status: "allowed", member: mInfo, planLabel: sub.planLabel, dietType: sub.dietType
    });
  },

  async logAndReturn(res: any): Promise<ScanResult> {
    const log: OfflineLog = {
      id: crypto.randomUUID(),
      memberId: res.member?.memberId,
      memberName: res.member?.name,
      meal: res.meal,
      status: res.status,
      code: res.code,
      reason: res.reason,
      timestamp: Date.now(),
      dietServed: res.dietType,
      isGuestPass: res.isGuestPass,
      guestToken: res.guestToken,
    };
    
    const logs = await this.getOfflineLogs();
    logs.push(log);
    await set(STORE_KEY_LOGS, logs);
    
    return res;
  },

  async getOfflineLogs(): Promise<OfflineLog[]> {
    return (await get(STORE_KEY_LOGS)) || [];
  },

  async clearSyncedLogs(ids: string[]) {
    const logs = await this.getOfflineLogs();
    const remaining = logs.filter(l => !ids.includes(l.id));
    await set(STORE_KEY_LOGS, remaining);
  },

  async uploadOfflineLogs() {
    if (!navigator.onLine) return;
    
    const logs = await this.getOfflineLogs();
    if (logs.length === 0) return;

    try {
      const res = await scanApi.bulkSync(logs);
      if (res.syncedIds && Array.isArray(res.syncedIds)) {
        await this.clearSyncedLogs(res.syncedIds);
      }
    } catch (e) {
      console.error("Failed to upload offline logs", e);
      throw e;
    }
  }
};
