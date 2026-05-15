import mongoose from "mongoose";

const ScanLogSchema = new mongoose.Schema({
  memberId: { type: String, index: true },
  memberName: String,
  meal: { type: String, enum: ["Breakfast", "Lunch", "Dinner"] },
  date: { type: String, index: true },
  timestamp: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ["allowed", "denied"], required: true, index: true },
  denialCode: String,
  denialReason: String,
  scannedBy: String,
  deviceInfo: String,
});

ScanLogSchema.index({ memberId: 1, date: 1 });
ScanLogSchema.index({ date: 1, status: 1 });

export const ScanLog = mongoose.model("ScanLog", ScanLogSchema);
