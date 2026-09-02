// GET /api/menu-image?id=<item_id> — serve a manager-uploaded dish photo from Neon.
// Public; cached at the edge. Replacements bust caches via the &v= param the
// admin upload endpoint bakes into menu_items.image_url.
import { query } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const id = String(req.query?.id || '');
  if (!/^[a-z0-9-]{1,80}$/.test(id)) return res.status(400).json({ error: 'bad id' });
  try {
    const r = await query('SELECT data, mime FROM menu_item_images WHERE item_id = $1', [id]);
    if (!r.rows[0]) return res.status(404).json({ error: 'no image' });
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', r.rows[0].mime);
    return res.status(200).send(r.rows[0].data);
  } catch (e) {
    console.error('menu-image error', e);
    return res.status(500).json({ error: 'image unavailable' });
  }
}
