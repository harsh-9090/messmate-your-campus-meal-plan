import mongoose from "mongoose";

const MealWindowSchema = new mongoose.Schema({
  meal: { type: String, enum: ["Breakfast", "Lunch", "Dinner"], unique: true, required: true },
  startTime: { type: String, required: true }, // "07:00"
  endTime: { type: String, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const MealWindow = mongoose.model("MealWindow", MealWindowSchema);
