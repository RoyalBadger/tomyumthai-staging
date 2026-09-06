// GET    /api/admin/menu — full menu (incl. hidden) with sizes, variants, removal settings,
//                          categories, and the removal vocabulary for editor previews
// PATCH  /api/admin/menu — quick toggles: {id, is_86ed?, base_price_cents?, is_hidden?, station?}
// PUT    /api/admin/menu — full dish editor save (create when id is omitted), or
//                          {kind:'category', id?, name} to create/rename a category
// POST   /api/admin/menu — {id, mime, data_base64}: upload/replace the dish PHOTO (stored in Neon)
// DELETE /api/admin/menu?id=<id>            — remove the dish PHOTO
// DELETE /api/admin/menu?id=<id>&what=item  — delete the dish itself (order history keeps its snapshot)
// (Everything lives here so we stay under Vercel Hobby's 12-function cap.)
import { getPool, query } from '../../lib/db.js';
import { requireAdmin, audit, readJsonBody } from '../../lib/auth.js';
import { REMOVAL_VOCAB, autoRemovals, finalRemovals } from '../../lib/removals.js';

const MAX_IMG_BYTES = 900_000; // ~900KB decoded — plenty for a 900px JPEG
const IMG_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

function magicOk(buf, mime) {
  if (mime === 'image/jpeg') return buf[0] === 0xff && buf[1] === 0xd8;
  if (mime === 'image/png') return buf[0] === 0x89 && buf[1] === 0x50;
  if (mime === 'image/webp') return buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
  return false;
}

const ITEM_COLS = `id, category_id, name, thai_name, description, base_price_cents, price_note,
  protein_choice, extra_protein, spice_selectable, is_orderable, is_86ed, is_hidden, station,
  image_url, sort, removals_hidden, removals_custom`;

const slugify = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const text = (v, max) => (v === undefined || v === null) ? null : (String(v).trim().slice(0, max) || null);
const cents = (v, max = 50_000) => { const n = Number(v); return Number.isInteger(n) && n >= 0 && n <= max ? n : NaN; };
const bool = v => v === true;

/** Validate + normalize a dish editor payload. Returns {error} or {item, sizes, variants}. */
function parseItem(body) {
  const name = text(body.name, 80);
  if (!name) return { error: 'Dish name is required.' };
  const category_id = text(body.category_id, 60);
  if (!category_id) return { error: 'Pick a category.' };

  const sizesIn = Array.isArray(body.sizes) ? body.sizes : [];
  const sizes = [];
  for (const s of sizesIn.slice(0, 6)) {
    const label = text(s?.label, 30);
    const price = cents(s?.price_cents);
    if (!label || Number.isNaN(price)) return { error: 'Each size needs a label and a price.' };
    if (sizes.some(x => x.label.toLowerCase() === label.toLowerCase())) return { error: `Duplicate size "${label}".` };
    sizes.push({ label, price_cents: price });
  }

  const variantsIn = Array.isArray(body.variants) ? body.variants : [];
  const variants = [];
  for (const v of variantsIn.slice(0, 12)) {
    const label = text(v?.label, 40);
    const delta = cents(v?.delta_cents ?? 0, 5_000);
    if (!label || Number.isNaN(delta)) return { error: 'Each "Your Choice" option needs a label (upcharge may be 0).' };
    if (variants.some(x => x.label.toLowerCase() === label.toLowerCase())) return { error: `Duplicate choice "${label}".` };
    variants.push({ label, delta_cents: delta });
  }
  if (variants.length === 1) return { error: 'A "Your Choice" list needs at least two options (or none).' };

  let base_price_cents = null;
  const price_note = text(body.price_note, 60);
  if (sizes.length === 0) {
    if (body.base_price_cents === null || body.base_price_cents === undefined || body.base_price_cents === '') {
      if (!price_note) return { error: 'Enter a price, add sizes, or give a price note (e.g. "Market Price").' };
    } else {
      base_price_cents = cents(body.base_price_cents);
      if (Number.isNaN(base_price_cents)) return { error: 'Price must be between $0 and $500.' };
    }
  }

  const station = body.station === 'second' ? 'second' : 'main';
  const sort = Number.isInteger(Number(body.sort)) ? Math.max(0, Math.min(999, Number(body.sort))) : 0;
  const listOf = (arr, max) => (Array.isArray(arr) ? arr : []).map(x => text(x, 40)).filter(Boolean).slice(0, max);

  return {
    item: {
      category_id, name,
      thai_name: text(body.thai_name, 120),
      description: text(body.description, 400),
      base_price_cents, price_note,
      protein_choice: bool(body.protein_choice),
      extra_protein: bool(body.extra_protein),
      spice_selectable: bool(body.spice_selectable),
      // orderable unless it is a note-only (market price) dish with no price and no sizes
      is_orderable: body.is_orderable === undefined ? (base_price_cents !== null || sizes.length > 0) : bool(body.is_orderable),
      station, sort,
      removals_hidden: listOf(body.removals_hidden, 20),
      removals_custom: listOf(body.removals_custom, 20),
    },
    sizes, variants,
  };
}

async function loadItem(id) {
  const it = (await query(`SELECT ${ITEM_COLS} FROM menu_items WHERE id = $1`, [id])).rows[0];
  if (!it) return null;
  it.sizes = (await query('SELECT label, price_cents FROM item_sizes WHERE item_id = $1 ORDER BY sort', [id])).rows;
  it.variants = (await query('SELECT label, delta_cents FROM item_variants WHERE item_id = $1 ORDER BY sort', [id])).rows;
  it.removals_auto = autoRemovals(it);
  it.removals = finalRemovals(it);
  return it;
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
    const item = (await query('SELECT id, name FROM menu_items WHERE id = $1', [id])).rows[0];
    if (!item) return res.status(404).json({ error: 'unknown item' });

    if (String(req.query?.what || 'photo') === 'item') {
      // order_items keeps its own name/price snapshot (item_id is reference-only),
      // so deleting a dish never touches order history or kitchen tickets.
      const client = await getPool().connect();
      try {
        await client.query('BEGIN');
        await client.query('DELETE FROM menu_item_images WHERE item_id = $1', [id]);
        await client.query('DELETE FROM item_sizes WHERE item_id = $1', [id]);
        await client.query('DELETE FROM item_variants WHERE item_id = $1', [id]);
        await client.query('DELETE FROM menu_items WHERE id = $1', [id]);
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
      await audit(admin.id, 'item_delete', id, { name: item.name });
      return res.status(200).json({ ok: true });
    }

    await query('DELETE FROM menu_item_images WHERE item_id = $1', [id]);
    await query('UPDATE menu_items SET image_url = NULL WHERE id = $1', [id]);
    await audit(admin.id, 'image_delete', id, {});
    return res.status(200).json({ ok: true });
  }

  if (req.method === 'GET') {
    const [items, cats, sizes, variants] = await Promise.all([
      query(`SELECT i.id, i.category_id, c.name AS category, i.name, i.thai_name, i.description,
                    i.base_price_cents, i.price_note, i.protein_choice, i.extra_protein, i.spice_selectable,
                    i.is_orderable, i.is_86ed, i.is_hidden, i.station, i.image_url, i.sort,
                    i.removals_hidden, i.removals_custom
             FROM menu_items i JOIN menu_categories c ON c.id = i.category_id
             ORDER BY c.sort, i.sort, i.name`, []),
      query('SELECT id, name, sort FROM menu_categories ORDER BY sort', []),
      query('SELECT item_id, label, price_cents FROM item_sizes ORDER BY sort', []),
      query('SELECT item_id, label, delta_cents FROM item_variants ORDER BY sort', []),
    ]);
    const sizesBy = {}, variantsBy = {};
    for (const s of sizes.rows) (sizesBy[s.item_id] ??= []).push({ label: s.label, price_cents: s.price_cents });
    for (const v of variants.rows) (variantsBy[v.item_id] ??= []).push({ label: v.label, delta_cents: v.delta_cents });
    for (const it of items.rows) {
      it.sizes = sizesBy[it.id] || [];
      it.variants = variantsBy[it.id] || [];
      it.removals_auto = autoRemovals(it);
      it.removals = finalRemovals(it);
    }
    return res.status(200).json({ items: items.rows, categories: cats.rows, removal_vocab: REMOVAL_VOCAB });
  }

  if (req.method === 'PUT') {
    const body = readJsonBody(req);

    if (body.kind === 'category') {
      const name = text(body.name, 60);
      if (!name) return res.status(400).json({ error: 'Category name is required.' });
      if (body.id) {
        const r = await query('UPDATE menu_categories SET name = $2 WHERE id = $1 RETURNING id, name, sort', [String(body.id), name]);
        if (!r.rows[0]) return res.status(404).json({ error: 'unknown category' });
        await audit(admin.id, 'category_rename', r.rows[0].id, { name });
        return res.status(200).json({ ok: true, category: r.rows[0] });
      }
      let id = slugify(name) || 'category';
      for (let n = 2; (await query('SELECT 1 FROM menu_categories WHERE id = $1', [id])).rows.length; n++) id = `${slugify(name)}-${n}`;
      const sort = ((await query('SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM menu_categories', [])).rows[0].s);
      const r = await query('INSERT INTO menu_categories (id, name, sort) VALUES ($1,$2,$3) RETURNING id, name, sort', [id, name, sort]);
      await audit(admin.id, 'category_create', id, { name });
      return res.status(200).json({ ok: true, category: r.rows[0] });
    }

    const parsed = parseItem(body);
    if (parsed.error) return res.status(400).json({ error: parsed.error });
    const { item, sizes, variants } = parsed;
    if (!(await query('SELECT 1 FROM menu_categories WHERE id = $1', [item.category_id])).rows.length) {
      return res.status(400).json({ error: 'unknown category' });
    }

    let id = body.id ? String(body.id) : null;
    let before = null;
    if (id) {
      before = await loadItem(id);
      if (!before) return res.status(404).json({ error: 'unknown item' });
    } else {
      const base = slugify(item.name) || 'dish';
      id = base;
      for (let n = 2; (await query('SELECT 1 FROM menu_items WHERE id = $1', [id])).rows.length; n++) id = `${base}-${n}`;
      if (body.sort === undefined) {
        item.sort = (await query('SELECT COALESCE(MAX(sort), -1) + 1 AS s FROM menu_items WHERE category_id = $1', [item.category_id])).rows[0].s;
      }
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO menu_items (id, category_id, name, thai_name, description, base_price_cents, price_note,
           protein_choice, extra_protein, spice_selectable, is_orderable, station, sort, removals_hidden, removals_custom)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         ON CONFLICT (id) DO UPDATE SET category_id=$2, name=$3, thai_name=$4, description=$5, base_price_cents=$6,
           price_note=$7, protein_choice=$8, extra_protein=$9, spice_selectable=$10, is_orderable=$11, station=$12,
           sort=$13, removals_hidden=$14, removals_custom=$15`,
        [id, item.category_id, item.name, item.thai_name, item.description, item.base_price_cents, item.price_note,
         item.protein_choice, item.extra_protein, item.spice_selectable, item.is_orderable, item.station, item.sort,
         item.removals_hidden, item.removals_custom]);
      await client.query('DELETE FROM item_sizes WHERE item_id = $1', [id]);
      for (const [i, s] of sizes.entries()) {
        await client.query('INSERT INTO item_sizes (item_id, label, price_cents, sort) VALUES ($1,$2,$3,$4)', [id, s.label, s.price_cents, i]);
      }
      await client.query('DELETE FROM item_variants WHERE item_id = $1', [id]);
      for (const [i, v] of variants.entries()) {
        await client.query('INSERT INTO item_variants (item_id, label, delta_cents, sort) VALUES ($1,$2,$3,$4)', [id, v.label, v.delta_cents, i]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }

    const after = await loadItem(id);
    const strip = o => o && { ...o, image_url: undefined, removals_auto: undefined, removals: undefined };
    await audit(admin.id, before ? 'item_update' : 'item_create', id, { before: strip(before), after: strip(after) });
    return res.status(200).json({ ok: true, item: after });
  }

  if (req.method === 'PATCH') {
    const { id, is_86ed, base_price_cents, is_hidden, station } = readJsonBody(req);
    if (!id) return res.status(400).json({ error: 'id required' });

    const cur = await query('SELECT id, name, is_86ed, base_price_cents, is_hidden, station FROM menu_items WHERE id = $1', [id]);
    if (!cur.rows[0]) return res.status(404).json({ error: 'unknown item' });
    const before = cur.rows[0];

    const sets = [];
    const vals = [id];
    const changes = {};
    if (typeof is_86ed === 'boolean') { vals.push(is_86ed); sets.push(`is_86ed = $${vals.length}`); changes.is_86ed = [before.is_86ed, is_86ed]; }
    if (typeof is_hidden === 'boolean') { vals.push(is_hidden); sets.push(`is_hidden = $${vals.length}`); changes.is_hidden = [before.is_hidden, is_hidden]; }
    if (station !== undefined) {
      if (station !== 'main' && station !== 'second') {
        return res.status(400).json({ error: "station must be 'main' or 'second'" });
      }
      vals.push(station); sets.push(`station = $${vals.length}`);
      changes.station = [before.station, station];
    }
    if (base_price_cents !== undefined) {
      const c = Number(base_price_cents);
      if (!Number.isInteger(c) || c < 0 || c > 50_000) {
        return res.status(400).json({ error: 'base_price_cents must be an integer 0..50000' });
      }
      vals.push(c); sets.push(`base_price_cents = $${vals.length}`);
      changes.base_price_cents = [before.base_price_cents, c];
    }
    if (sets.length === 0) return res.status(400).json({ error: 'nothing to update' });

    await query(`UPDATE menu_items SET ${sets.join(', ')} WHERE id = $1`, vals);
    await audit(admin.id, 'menu_update', id, changes);
    const after = await query('SELECT id, name, base_price_cents, is_86ed, is_hidden, station FROM menu_items WHERE id = $1', [id]);
    return res.status(200).json({ ok: true, item: after.rows[0] });
  }

  res.status(405).json({ error: 'method not allowed' });
});
