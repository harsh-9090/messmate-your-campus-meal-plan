import "dotenv/config";
import bcrypt from "bcrypt";
import { addDays, format } from "date-fns";
import { pool, query } from "./src/db/index.js";
import { migrate } from "./src/db/migrate.js";

const PLANS = [
  { planId: "full",            label: "Full Board",        meals: ["Breakfast", "Lunch", "Dinner"], pricePerMonth: 4500 },
  { planId: "lunch-dinner",    label: "Lunch + Dinner",    meals: ["Lunch", "Dinner"],              pricePerMonth: 3200 },
  { planId: "breakfast-lunch", label: "Breakfast + Lunch", meals: ["Breakfast", "Lunch"],           pricePerMonth: 3000 },
  { planId: "lunch-only",      label: "Lunch Only",        meals: ["Lunch"],                        pricePerMonth: 1800 },
  { planId: "dinner-only",     label: "Dinner Only",       meals: ["Dinner"],                       pricePerMonth: 1800 },
  { planId: "breakfast-only",  label: "Breakfast Only",    meals: ["Breakfast"],                    pricePerMonth: 1500 },
];

const WINDOWS = [
  { meal: "Breakfast", startTime: "07:00", endTime: "10:00" },
  { meal: "Lunch",     startTime: "11:30", endTime: "14:30" },
  { meal: "Dinner",    startTime: "19:00", endTime: "21:30" },
];

const MEMBERS = [
  ["ADMIN01", "Priya Sharma",   "admin@messmate.app", "admin123", "admin",  "full"],
  ["STAFF01", "Ramesh Kumar",   "staff@messmate.app", "staff123", "staff",  "full"],
  ["STU001",  "Arjun Mehta",    "stu001@messmate.app","pass123",  "member", "lunch-dinner"],
  ["STU002",  "Ananya Iyer",    "stu002@messmate.app","pass123",  "member", "full"],
  ["STU003",  "Karthik Reddy",  "stu003@messmate.app","pass123",  "member", "breakfast-lunch"],
  ["STU004",  "Sneha Patil",    "stu004@messmate.app","pass123",  "member", "lunch-only"],
  ["STU005",  "Vikram Singh",   "stu005@messmate.app","pass123",  "member", "dinner-only"],
];

const fmt = (d) => format(d, "yyyy-MM-dd");

(async () => {
  await migrate();
  console.log("Seeding…");

  await query(`TRUNCATE TABLE scan_logs, meal_usage, members, plans, meal_windows RESTART IDENTITY CASCADE`);

  for (const p of PLANS) {
    await query(
      `INSERT INTO plans (plan_id, label, meals, price_per_month) VALUES ($1,$2,$3,$4)`,
      [p.planId, p.label, p.meals, p.pricePerMonth]
    );
  }
  for (const w of WINDOWS) {
    await query(
      `INSERT INTO meal_windows (meal, start_time, end_time) VALUES ($1,$2,$3)`,
      [w.meal, w.startTime, w.endTime]
    );
  }

  const today = new Date();
  for (const [memberId, name, email, password, role, planId] of MEMBERS) {
    const plan = PLANS.find((p) => p.planId === planId);
    const isPaid = memberId !== "STU005";
    await query(
      `INSERT INTO members
        (member_id, name, email, password_hash, role, is_active,
         sub_plan_id, sub_plan_label, sub_meals, sub_start_date, sub_end_date,
         sub_is_paid, sub_paid_at, sub_price_per_month, sub_amount_paid, sub_renewal_count)
       VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7,$8,$9,$10,$11,$12,$13,$14,0)`,
      [memberId, name, email, await bcrypt.hash(password, 12), role,
        planId, plan.label, plan.meals, fmt(today), fmt(addDays(today, 30)),
        isPaid, isPaid ? new Date() : null, plan.pricePerMonth, isPaid ? plan.pricePerMonth : 0]
    );
  }
  console.log(`✓ Seeded ${PLANS.length} plans, ${WINDOWS.length} windows, ${MEMBERS.length} members`);
  await pool.end();
})().catch((e) => { console.error(e); process.exit(1); });
