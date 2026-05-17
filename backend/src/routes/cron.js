import { Router } from "express";
import { runDailyTasks } from "../cron/dailyJobs.js";

const router = Router();

// Secure endpoint called externally (e.g. by cron-job.org)
router.post("/daily", async (req, res, next) => {
  try {
    const cronToken = req.headers["x-cron-token"];
    const secretToken = process.env.CRON_SECRET_TOKEN || "development_cron_secret_token";

    // Validate headers for security
    if (!cronToken || cronToken !== secretToken) {
      console.warn("[CRON-WARNING] Unauthorized daily cron attempt rejected.");
      return res.status(403).json({ error: "Unauthorized access" });
    }

    console.log("[CRON] External daily task execution triggered successfully.");
    const summary = await runDailyTasks();

    res.json({
      ok: true,
      message: "Daily cron tasks successfully completed.",
      summary,
    });
  } catch (err) {
    console.error("[CRON-ERROR] Failed to run daily tasks over HTTP:", err.message);
    next(err);
  }
});

export default router;
