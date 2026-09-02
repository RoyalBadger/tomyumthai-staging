// POST   /api/admin/menu-image        — {id, mime, data_base64}: upload/replace a dish photo
// DELETE /api/admin/menu-image?id=<id> — remove a dish photo
// Photos are stored in Neon (menu_item_images.bytea); menu_items.image_url is
// kept in sync so the customer site's Photo button follows automatically.
// The manager UI downscales client-side, but limits are enforced here anyway.
import { query } from '../../lib/db.js';
import { requireAdmin, audit, readJsonBody } from '../../lib/auth.js';

const MAX_BYTES = 900_000; // ~900KB decoded — plenty for an 900px JPEG
const MIMES = ['image/jpeg', 'image/png', 'image/webp'];

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
    if (!MIMES.includes(mime)) return res.status(400).json({ error: 'mime must be image/jpeg, image/png, or image/webp' });

    const item = (await query('SELECT id, name FROM menu_items WHERE id = $1', [id])).rows[0];
    if (!item) return res.status(404).json({ error: 'unknown item' });

    let buf;
    try { buf = Buffer.from(String(data_base64), 'base64'); } catch { buf = null; }
    if (!buf || buf.length < 1_000) return res.status(400).json({ error: 'image data missing or too small' });
    if (buf.length > MAX_BYTES) return res.status(400).json({ error: 'image too large after processing — try a smaller photo' });
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

  res.status(405).json({ error: 'method not allowed' });
});
