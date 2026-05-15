import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
  planId: String,
  planLabel: String,
  meals: [{ type: String, enum: ["Breakfast", "Lunch", "Dinner"] }],
  startDate: Date,
  endDate: Date,
  isPaid: { type: Boolean, default: false },
  paidAt: Date,
  pricePerMonth: Number,
  renewedAt: Date,
  renewalCount: { type: Number, default: 0 },
}, { _id: false });

const MemberSchema = new mongoose.Schema({
  memberId: { type: String, unique: true, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true, index: true },
  passwordHash: { type: String, required: true },
  room: String,
  photoUrl: String,
  role: { type: String, enum: ["admin", "staff", "member"], default: "member", index: true },
  isActive: { type: Boolean, default: true, index: true },
  subscription: SubscriptionSchema,
}, { timestamps: true });

MemberSchema.index({ "subscription.endDate": 1 });
MemberSchema.index({ "subscription.isPaid": 1 });

export const Member = mongoose.model("Member", MemberSchema);
