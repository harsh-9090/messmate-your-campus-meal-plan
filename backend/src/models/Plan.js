import mongoose from "mongoose";

const PlanSchema = new mongoose.Schema({
  planId: { type: String, unique: true, required: true },
  label: { type: String, required: true },
  meals: [{ type: String, enum: ["Breakfast", "Lunch", "Dinner"] }],
  pricePerMonth: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Plan = mongoose.model("Plan", PlanSchema);
