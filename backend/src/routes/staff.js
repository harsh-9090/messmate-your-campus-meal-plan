import { Router } from "express";
import bcrypt from "bcrypt";
import { query, rowToMember, stripPassword } from "../db/index.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";
import { delByPattern } from "../db/redis.js";

const router = Router();
router.use(verifyToken);
router.use(requireRole("admin"));

// List all staff and admins
router.get("/", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT * FROM members WHERE role IN ('staff', 'admin') ORDER BY role ASC, name ASC`
    );
    res.json(rows.map(r => stripPassword(rowToMember(r))));
  } catch (e) { next(e); }
});

// Create new staff/admin
router.post("/", async (req, res, next) => {
  try {
    const { name, email, password, mobile = null, role = "staff" } = req.body;
    
    // Check if email exists
    const existing = await query(`SELECT 1 FROM members WHERE email = $1`, [email]);
    if (existing.rows[0]) return res.status(400).json({ error: "Email already in use" });

    const hash = await bcrypt.hash(password, 12);
    const id = `STAFF-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const { rows } = await query(
      `INSERT INTO members (member_id, name, email, mobile, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE) RETURNING *`,
      [id, name, email, mobile, hash, role]
    );

    await delByPattern("member:list");
    res.status(201).json(stripPassword(rowToMember(rows[0])));
  } catch (e) { next(e); }
});

// Update staff/admin
router.put("/:id", async (req, res, next) => {
  try {
    const { name, email, mobile, role, password, memberId } = req.body;
    const sets = [];
    const params = [];

    if (memberId && memberId !== req.params.id) {
      const existing = await query(`SELECT 1 FROM members WHERE member_id = $1`, [memberId]);
      if (existing.rows[0]) return res.status(400).json({ error: "Staff ID already exists" });
      params.push(memberId);
      sets.push(`member_id = $${params.length}`);
    }

    if (name) { params.push(name); sets.push(`name = $${params.length}`); }
    if (email) { params.push(email); sets.push(`email = $${params.length}`); }
    if (mobile !== undefined) { params.push(mobile); sets.push(`mobile = $${params.length}`); }
    if (role) { params.push(role); sets.push(`role = $${params.length}`); }
    
    if (password) {
      const hash = await bcrypt.hash(password, 12);
      params.push(hash);
      sets.push(`password_hash = $${params.length}`);
    }

    if (sets.length === 0) return res.status(400).json({ error: "No fields to update" });

    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE members SET ${sets.join(", ")}, updated_at = NOW() WHERE member_id = $${params.length} RETURNING *`,
      params
    );

    if (!rows[0]) return res.status(404).json({ error: "Not found" });
    
    await delByPattern("member:list");
    res.json(stripPassword(rowToMember(rows[0])));
  } catch (e) { next(e); }
});

// Delete staff/admin (Cannot delete yourself)
router.delete("/:id", async (req, res, next) => {
  try {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: "You cannot delete your own account" });
    }
    await query(`DELETE FROM members WHERE member_id = $1`, [req.params.id]);
    await delByPattern("member:list");
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
