// GET  /api/admin/menu           — full menu incl. hidden items and 86 state
// PATCH /api/admin/menu          — {id, is_86ed?, base_price_cents?, is_hidden?, station?}
import { query } from '../../lib/db.js';
import { requireAdmin, audit, readJsonBody } from '../../lib/auth.js';

export default requireAdmin(async (req, res, admin) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') {
    const r = await query(
      `SELECT i.id, i.category_id, c.name AS category, i.name, i.base_price_cents,
              i.price_note, i.is_orderable, i.is_86ed, i.is_hidden, i.station, i.is_vegetarian, i.image_url, i.sort
       FROM menu_items i JOIN menu_categories c ON c.id = i.category_id
       ORDER BY c.sort, i.sort`, []);
    return res.status(200).json({ items: r.rows });
  }

  if (req.method === 'PATCH') {
    const { id, is_86ed, base_price_cents, is_hidden, station, is_vegetarian } = readJsonBody(req);
    if (!id) return res.status(400).json({ error: 'id required' });

    const cur = await query('SELECT id, name, is_86ed, base_price_cents, is_hidden, station, is_vegetarian FROM menu_items WHERE id = $1', [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'unknown item' });
    const before = cur.rows[0];

    const sets = [];
    const vals = [id];
    const changes = {};
    if (typeof is_86ed === 'boolean') { vals.push(is_86ed); sets.push(`is_86ed = $${vals.length}`); changes.is_86ed = [before.is_86ed, is_86ed]; }
    if (typeof is_hidden === 'boolean') { vals.push(is_hidden); sets.push(`is_hidden = $${vals.length}`); changes.is_hidden = [before.is_hidden, is_hidden]; }
    if (typeof is_vegetarian === 'boolean') { vals.push(is_vegetarian); sets.push(`is_vegetarian = $${vals.length}`); changes.is_vegetarian = [before.is_vegetarian, is_vegetarian]; }
    if (station !== undefined) {
      if (station !== 'main' && station !== 'second') {
        return res.status(400).json({ error: "station must be 'main' or 'second'" });
      }
      vals.push(station); sets.push(`station = $${vals.length}`);
      changes.station = [before.station, station];
    }
    if (base_price_cents !== undefined) {
      const cents = Number(base_price_cents);
      if (!Number.isInteger(cents) || cents < 0 || cents > 50_000) {
        return res.status(400).json({ error: 'base_price_cents must be an integer 0..50000' });
      }
      vals.push(cents); sets.push(`base_price_cents = $${vals.length}`);
      changes.base_price_cents = [before.base_price_cents, cents];
    }
    if (sets.length === 0) return res.status(400).json({ error: 'nothing to update' });

    await query(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = $1`, vals);
    await audit(admin.id, 'menu_update', id, changes);
    const after = await query('SELECT id, name, base_price_cents, is_86ed, is_hidden, station, is_vegetarian FROM menu_items WHERE id = $1', [id]);
    return res.status(200).json({ ok: true, item: after.rows[0] });
  }

  res.status(405).json({ error: 'method not allowed' });
});
