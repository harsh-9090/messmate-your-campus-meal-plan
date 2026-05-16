import cron from "node-cron";
import { differenceInCalendarDays, format } from "date-fns";
import { query, rowToMember } from "../db/index.js";
import { notifyExpiringSoon, notifyExpired } from "../services/notificationService.js";
import { delCache, delByPattern } from "../db/redis.js";

export function startCron() {
  cron.schedule("1 0 * * *", async () => {
    console.log("[CRON] Running daily jobs…");
    const todayStr = format(new Date(), "yyyy-MM-dd");

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
      await notifyExpiringSoon(m, differenceInCalendarDays(new Date(m.subscription.endDate), new Date()));
    }

    const { rows: gone } = await query(
      `SELECT * FROM members
        WHERE role = 'member' AND is_active = TRUE
          AND sub_end_date >= CURRENT_DATE - INTERVAL '1 day'
          AND sub_end_date <  CURRENT_DATE`
    );
    for (const r of gone) await notifyExpired(rowToMember(r));

    console.log(`[CRON] Done. expiringSoon=${soon.length} expiredToday=${gone.length}`);
  });
  console.log("✓ Cron scheduled (00:01 daily)");
}
