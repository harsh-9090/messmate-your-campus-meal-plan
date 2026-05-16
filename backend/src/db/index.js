import pg from "pg";

const { Pool } = pg;

const ssl =
  process.env.PGSSL === "true" || /sslmode=require/i.test(process.env.DATABASE_URL || "")
    ? { rejectUnauthorized: false }
    : undefined;

export const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL, ssl }
    : { ssl }, // falls back to PGHOST/PGUSER/PGPASSWORD/PGDATABASE/PGPORT env vars
);

pool.on("error", (err) => console.error("[pg] idle client error:", err));

export const query = (text, params) => pool.query(text, params);

export async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

/** Reshape a member row into the API shape the frontend expects (nested subscription). */
export function rowToMember(r) {
  if (!r) return null;
  const {
    member_id, name, email, room, photo_url, role, is_active,
    sub_plan_id, sub_plan_label, sub_meals, sub_start_date, sub_end_date,
    sub_is_paid, sub_paid_at, sub_price_per_month, sub_renewed_at, sub_renewal_count,
    password_hash, created_at, updated_at,
  } = r;
  return {
    memberId: member_id,
    name, email, room,
    photoUrl: photo_url,
    role,
    isActive: is_active,
    passwordHash: password_hash, // callers strip when needed
    subscription: {
      planId: sub_plan_id,
      planLabel: sub_plan_label,
      meals: sub_meals || [],
      startDate: sub_start_date,
      endDate: sub_end_date,
      isPaid: sub_is_paid,
      paidAt: sub_paid_at,
      pricePerMonth: sub_price_per_month,
      renewedAt: sub_renewed_at,
      renewalCount: sub_renewal_count,
    },
    createdAt: created_at,
    updatedAt: updated_at,
  };
}

export function stripPassword(m) {
  if (!m) return m;
  const { passwordHash, ...rest } = m;
  return rest;
}
