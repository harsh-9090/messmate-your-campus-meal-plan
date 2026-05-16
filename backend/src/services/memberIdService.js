import { query } from "../db/index.js";

const pad = (n, w = 3) => String(n).padStart(w, "0");

export async function nextMemberId() {
  const { rows } = await query(
    `SELECT member_id FROM members WHERE member_id ~ '^MK[0-9]+$'
     ORDER BY (substring(member_id from 3))::int DESC LIMIT 1`
  );
  const n = rows[0] ? parseInt(rows[0].member_id.slice(2), 10) || 0 : 0;
  return `MK${pad(n + 1)}`;
}
