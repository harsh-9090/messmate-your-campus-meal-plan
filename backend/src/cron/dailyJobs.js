import cron from "node-cron";
import { Member } from "../models/Member.js";
import { addDays, differenceInCalendarDays } from "date-fns";
import { notifyExpiringSoon, notifyExpired } from "../services/notificationService.js";

export function startCron() {
  // Every day at 00:01
  cron.schedule("1 0 * * *", async () => {
    console.log("[CRON] Running daily jobs…");
    const now = new Date();

    const expiringSoon = await Member.find({
      role: "member", isActive: true,
      "subscription.endDate": { $gte: addDays(now, 2), $lte: addDays(now, 3) },
    });
    for (const m of expiringSoon) await notifyExpiringSoon(m, differenceInCalendarDays(m.subscription.endDate, now));

    const expiredToday = await Member.find({
      role: "member", isActive: true,
      "subscription.endDate": { $gte: addDays(now, -1), $lt: now },
    });
    for (const m of expiredToday) await notifyExpired(m);

    console.log(`[CRON] Done. expiringSoon=${expiringSoon.length} expiredToday=${expiredToday.length}`);
  });
  console.log("✓ Cron scheduled (00:01 daily)");
}
