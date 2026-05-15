import mongoose from "mongoose";

const MealUsageSchema = new mongoose.Schema({
  memberId: { type: String, required: true, index: true },
  date: { type: String, required: true }, // YYYY-MM-DD
  usedMeals: {
    Breakfast: { type: Boolean, default: false },
    Lunch: { type: Boolean, default: false },
    Dinner: { type: Boolean, default: false },
  },
  usedCount: { type: Number, default: 0 },
}, { timestamps: true });

MealUsageSchema.index({ memberId: 1, date: 1 }, { unique: true });
MealUsageSchema.index({ date: 1 });

export const MealUsage = mongoose.model("MealUsage", MealUsageSchema);
