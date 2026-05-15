import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { addDays } from "date-fns";
import { Member } from "./src/models/Member.js";
import { Plan } from "./src/models/Plan.js";
import { MealWindow } from "./src/models/MealWindow.js";

const PLANS = [
  { planId: "full", label: "Full Board", meals: ["Breakfast", "Lunch", "Dinner"], pricePerMonth: 4500 },
  { planId: "lunch-dinner", label: "Lunch + Dinner", meals: ["Lunch", "Dinner"], pricePerMonth: 3200 },
  { planId: "breakfast-lunch", label: "Breakfast + Lunch", meals: ["Breakfast", "Lunch"], pricePerMonth: 3000 },
  { planId: "lunch-only", label: "Lunch Only", meals: ["Lunch"], pricePerMonth: 1800 },
  { planId: "dinner-only", label: "Dinner Only", meals: ["Dinner"], pricePerMonth: 1800 },
  { planId: "breakfast-only", label: "Breakfast Only", meals: ["Breakfast"], pricePerMonth: 1500 },
];

const WINDOWS = [
  { meal: "Breakfast", startTime: "07:00", endTime: "10:00" },
  { meal: "Lunch", startTime: "11:30", endTime: "14:30" },
  { meal: "Dinner", startTime: "19:00", endTime: "21:30" },
];

const MEMBERS = [
  ["ADMIN01", "Priya Sharma", "admin@messmate.app", "admin123", "Office", "admin", "full"],
  ["STAFF01", "Ramesh Kumar", "staff@messmate.app", "staff123", "Kitchen", "staff", "full"],
  ["STU001", "Arjun Mehta", "stu001@messmate.app", "pass123", "A-101", "member", "lunch-dinner"],
  ["STU002", "Ananya Iyer", "stu002@messmate.app", "pass123", "A-102", "member", "full"],
  ["STU003", "Karthik Reddy", "stu003@messmate.app", "pass123", "B-204", "member", "breakfast-lunch"],
  ["STU004", "Sneha Patil", "stu004@messmate.app", "pass123", "B-210", "member", "lunch-only"],
  ["STU005", "Vikram Singh", "stu005@messmate.app", "pass123", "C-305", "member", "dinner-only"],
];

(async () => {
  await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/messmate");
  console.log("Connected. Seeding…");
  await Promise.all([Plan.deleteMany({}), MealWindow.deleteMany({}), Member.deleteMany({})]);
  await Plan.insertMany(PLANS);
  await MealWindow.insertMany(WINDOWS);

  const today = new Date();
  for (const [memberId, name, email, password, room, role, planId] of MEMBERS) {
    const plan = PLANS.find((p) => p.planId === planId);
    await Member.create({
      memberId, name, email, room, role, isActive: true,
      passwordHash: await bcrypt.hash(password, 12),
      subscription: {
        planId, planLabel: plan.label, meals: plan.meals,
        startDate: today, endDate: addDays(today, 30),
        isPaid: memberId !== "STU005", pricePerMonth: plan.pricePerMonth,
        renewalCount: 0,
      },
    });
  }
  console.log(`✓ Seeded ${PLANS.length} plans, ${WINDOWS.length} windows, ${MEMBERS.length} members`);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
