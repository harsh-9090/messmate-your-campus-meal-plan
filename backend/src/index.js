import "dotenv/config";
import { app } from "./app.js";
import { pool } from "./db/index.js";
import { migrate } from "./db/migrate.js";
import { startCron } from "./cron/dailyJobs.js";

const PORT = process.env.PORT || 4000;

(async () => {
  try {
    await pool.query("SELECT 1");
    console.log("✓ PostgreSQL connected");
    await migrate();
    startCron();
    app.listen(PORT, () => console.log(`✓ MessMate API listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error("✗ Startup failed:", err);
    process.exit(1);
  }
})();
