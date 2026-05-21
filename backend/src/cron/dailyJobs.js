import cron from "node-cron";
import { differenceInCalendarDays, format } from "date-fns";
import { query, rowToMember } from "../db/index.js";
import { notifyExpiringSoon, notifyExpired } from "../services/notificationService.js";
import { sendPushToMember } from "../services/pushNotificationService.js";
import { delCache, delByPattern } from "../db/redis.js";

const getISTDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)); // Force UTC+5.30 (Indian Standard Time)
};

export async function runDailyTasks() {
  console.log("[CRON] Running daily jobs…");
  const todayStr = format(getISTDate(), "yyyy-MM-dd");

  await delCache([
    `messmate:usage:summary:${todayStr}`,
    `messmate:scan:log:${todayStr}`,
    `messmate:scan:denials:${todayStr}`,
    "messmate:report:weekly"
  ]);
  await delByPattern("report:expiring");

  const { rows: soon } = await query(
    `SELECT * FROM members
      WHERE role = 'member' AND is_active = TRUE
        AND sub_end_date BETWEEN CURRENT_DATE + INTERVAL '2 day' AND CURRENT_DATE + INTERVAL '3 day'`
  );
  for (const r of soon) {
    const m = rowToMember(r);
    const daysLeft = differenceInCalendarDays(new Date(m.subscription.endDate), getISTDate());
    await notifyExpiringSoon(m, daysLeft);
    sendPushToMember(m.memberId, {
      title: "Subscription Expiring Soon ⚠️",
      body: `Your meal plan subscription expires in ${daysLeft} days (on ${m.subscription.endDate}). Please visit the mess office to renew.`,
      url: "/dashboard",
    }).catch((err) => {
      console.error(`[PUSH-ERROR] Failed to send push subscription expiry warning to member ${m.memberId}:`, err.message);
    });
  }

  const { rows: gone } = await query(
    `SELECT * FROM members
      WHERE role = 'member' AND is_active = TRUE
        AND sub_end_date >= CURRENT_DATE - INTERVAL '1 day'
        AND sub_end_date <  CURRENT_DATE`
  );
  for (const r of gone) await notifyExpired(rowToMember(r));

  console.log(`[CRON] Done. expiringSoon=${soon.length} expiredToday=${gone.length}`);
  return { expiringSoon: soon.length, expired: gone.length };
}

export function startCron() {
  // Only auto-run node-cron scheduler in local development/non-production env
  // if not triggered externally.
  if (process.env.NODE_ENV === "production") {
    console.log("[CRON] Production detected. node-cron scheduler disabled in-process (using external webhook).");
    return;
  }
  
  cron.schedule("1 0 * * *", async () => {
    try {
      await runDailyTasks();
    } catch (err) {
      console.error("[CRON-ERROR] Failed to run daily tasks in node-cron:", err);
    }
  });
  console.log("✓ Local cron scheduled (00:01 daily)");
}
