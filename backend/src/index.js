import "dotenv/config";
import mongoose from "mongoose";
import { app } from "./app.js";
import { startCron } from "./cron/dailyJobs.js";

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/messmate";

(async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("✓ MongoDB connected");
    startCron();
    app.listen(PORT, () => console.log(`✓ MessMate API listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error("✗ Startup failed:", err);
    process.exit(1);
  }
})();
