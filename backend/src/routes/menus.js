import { Router } from "express";
import { query } from "../db/index.js";
import { verifyToken, requireRole } from "../middleware/authMiddleware.js";

const router = Router();
router.use(verifyToken);

// GET /menus -> fetch menus by date or range
router.get("/", async (req, res, next) => {
  try {
    const { date, startDate, endDate } = req.query;
    
    let sql = "SELECT * FROM menus";
    const params = [];
    
    if (date) {
      params.push(date);
      sql += ` WHERE date = $${params.length}`;
    } else if (startDate && endDate) {
      params.push(startDate, endDate);
      sql += ` WHERE date BETWEEN $1 AND $2`;
    }
    
    sql += " ORDER BY date ASC, CASE meal WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 WHEN 'Dinner' THEN 3 END";
    
    const { rows } = await query(sql, params);
    
    res.json(rows.map(r => {
      // Handle timestamp/date objects gracefully if pg driver parses as Date
      let dStr = r.date;
      if (dStr instanceof Date) {
        // Format to YYYY-MM-DD in local time boundary
        const y = dStr.getFullYear();
        const m = String(dStr.getMonth() + 1).padStart(2, '0');
        const d = String(dStr.getDate()).padStart(2, '0');
        dStr = `${y}-${m}-${d}`;
      }
      return {
        id: r.id,
        date: dStr,
        meal: r.meal,
        items: r.items,
        notes: r.notes || "",
        createdAt: r.created_at,
        updatedAt: r.updated_at
      };
    }));
  } catch (e) { next(e); }
});

// POST /menus -> upsert a menu for a specific date and meal (Admin only)
router.post("/", requireRole("admin"), async (req, res, next) => {
  try {
    const { date, meal, items, notes = "" } = req.body;
    
    if (!date || !meal || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "date, meal, and non-empty items array are required" });
    }
    
    if (!['Breakfast', 'Lunch', 'Dinner'].includes(meal)) {
      return res.status(400).json({ error: "Invalid meal type" });
    }
    
    const { rows } = await query(`
      INSERT INTO menus (date, meal, items, notes, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (date, meal)
      DO UPDATE SET items = EXCLUDED.items, notes = EXCLUDED.notes, updated_at = NOW()
      RETURNING *
    `, [date, meal, items, notes]);
    
    const r = rows[0];
    let dStr = r.date;
    if (dStr instanceof Date) {
      const y = dStr.getFullYear();
      const m = String(dStr.getMonth() + 1).padStart(2, '0');
      const d = String(dStr.getDate()).padStart(2, '0');
      dStr = `${y}-${m}-${d}`;
    }
    res.json({
      id: r.id,
      date: dStr,
      meal: r.meal,
      items: r.items,
      notes: r.notes || "",
      createdAt: r.created_at,
      updatedAt: r.updated_at
    });
  } catch (e) { next(e); }
});

// DELETE /menus/:id -> delete a menu (Admin only)
router.delete("/:id", requireRole("admin"), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rowCount } = await query(`DELETE FROM menus WHERE id = $1`, [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: "Menu not found" });
    }
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
