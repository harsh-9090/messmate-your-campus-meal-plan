import { Member } from "../models/Member.js";

const pad = (n, w = 3) => String(n).padStart(w, "0");

export async function nextMemberId() {
  const last = await Member.find({ memberId: /^STU/ }).sort({ memberId: -1 }).limit(1).lean();
  const n = last[0] ? parseInt(last[0].memberId.replace("STU", "")) || 0 : 0;
  return `STU${pad(n + 1)}`;
}
