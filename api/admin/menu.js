// GET    /api/admin/menu — full menu incl. hidden items and 86 state
// PATCH  /api/admin/menu — {id, is_86ed?, base_price_cents?, is_hidden?, station?, is_vegetarian?}
// POST   /api/admin/menu — {id, mime, data_base64}: upload/replace the dish PHOTO (stored in Neon)
// DELETE /api/admin/menu?id=<id> — remove the dish PHOTO
// (Photo routes live here so we stay under Vercel Hobby's 12-function cap.)
import { query } from '../../lib/db.js';
import { requireAdmin, audit, readJsonBody } from '../../lib/auth.js';

const MAX_IMG_BYTES = 900_000; // ~900KB decoded — plenty for a 900px JPEG
const IMG_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

function magicOk(buf, mime) {
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50;
  if (mime === 'image/webp') return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  return false;
}

export default requireAdmin(async (req, res, admin) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'POST') {
    const { id, mime, data_base64 } = readJsonBody(req);
    if (!id || !data_base64) return res.status(400).json({ error: 'id and data_base64 required' });
    if (!IMG_MIMES.includes(mime)) return res.status(400).json({ error: 'mime must be image/jpeg, image/png, or image/webp' });

    const item = (await query('SELECT id, name FROM menu_items WHERE id = $1', [id])).rows[0];
    if (!item) return res.status(404).json({ error: 'unknown item' });

    let buf;
    try { buf = Buffer.from(String(data_base64), 'base64'); } catch { buf = null; }
    if (!buf || buf.length < 1_000) return res.status(400).json({ error: 'image data missing or too small' });
    if (buf.length > MAX_IMG_BYTES) return res.status(400).json({ error: 'image too large after processing — try a smaller photo' });
    if (!magicOk(buf, mime)) return res.status(400).json({ error: 'file content does not match its image type' });

    await query(
      `INSERT INTO menu_item_images (item_id, data, mime, updated_at) VALUES ($1, $2, $3, now())
       ON CONFLICT (item_id) DO UPDATE SET data = $2, mime = $3, updated_at = now()`,
      [id, buf, mime]);
    const image_url = `/api/menu-image?id=${id}&v=${Date.now()}`;
    await query('UPDATE menu_items SET image_url = $2 WHERE id = $1', [id, image_url]);
    await audit(admin.id, 'image_upload', id, { bytes: buf.length, mime });
    return res.status(200).json({ ok: true, image_url });
  }

  if (req.method === 'DELETE') {
    const id = String(req.query?.id || '');
    if (!id) return res.status(400).json({ error: 'id required' });
    const item = (await query('SELECT id FROM menu_items WHERE id = $1', [id])).rows[0];
    if (!item) return res.status(404).json({ error: 'unknown item' });
    await query('DELETE FROM menu_item_images WHERE item_id = $1', [id]);
    await query('UPDATE menu_items SET image_url = NULL WHERE id = $1', [id]);
    await audit(admin.id, 'image_delete', id, {});
    return res.status(200).json({ ok: true });
  }

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
