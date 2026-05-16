import { query } from "./src/db/index.js";
import dotenv from "dotenv";
dotenv.config();

async function backfill() {
  try {
    const res = await query(`
      UPDATE members m
      SET 
        sub_start_date = created_at::date,
        sub_end_date = (created_at + (COALESCE(p.duration_months, 1) || ' months')::interval)::date
      FROM plans p
      WHERE m.sub_plan_id = p.plan_id
      AND m.sub_start_date IS NULL
      AND m.role = 'member'
    `);
    console.log("Backfill complete. Rows affected:", res.rowCount);
    process.exit(0);
  } catch (e) {
    console.error("Backfill failed:", e);
    process.exit(1);
  }
}

backfill();
