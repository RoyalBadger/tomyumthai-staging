// GET /api/menu — public menu with 86/closed state. Cached at the edge for 60s.
import { query } from '../lib/db.js';
import { orderingWindow, closedMessage } from '../lib/hours.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const [cats, items, sizes, proteins, extras, settings] = await Promise.all([
      query('SELECT id, name FROM menu_categories ORDER BY sort', []),
      query(`SELECT id, category_id, name, thai_name, description, base_price_cents,
                    price_note, protein_choice, extra_protein, spice_selectable,
                    is_orderable, is_86ed, is_vegetarian, image_url
             FROM menu_items WHERE NOT is_hidden ORDER BY sort`, []),
      query('SELECT item_id, label, price_cents FROM item_sizes ORDER BY sort', []),
      query('SELECT id, label, delta_cents FROM protein_options WHERE active ORDER BY sort', []),
      query('SELECT id, label, delta_cents, option_group FROM extra_protein_options WHERE active ORDER BY sort', []),
      // settings is a one-row table; SELECT * so a freshly added column can
      // deploy in either order with its migration (missing => undefined => off).
      query('SELECT * FROM settings', []),
    ]);

    const sizesByItem = {};
    for (const s of sizes.rows) (sizesByItem[s.item_id] ??= []).push({ label: s.label, price_cents: s.price_cents });

    const itemsByCat = {};
    for (const it of items.rows) {
      (itemsByCat[it.category_id] ??= []).push({
        id: it.id,
        name: it.name,
        thai: it.thai_name,
        description: it.description,
        price_cents: it.base_price_cents,
        price_note: it.price_note,
        sizes: sizesByItem[it.id] || [],
        protein_choice: it.protein_choice,
        extra_protein: it.extra_protein,
        spice_selectable: it.spice_selectable,
        vegetarian: it.is_vegetarian,
        image: it.image_url,
        orderable: it.is_orderable && !it.is_86ed,
        sold_out: it.is_86ed,
      });
    }

    const st = settings.rows[0];
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
    const holidayToday = (st.holiday_dates || []).some(d =>
      new Date(d).toISOString().slice(0, 10) === today);
    const win = orderingWindow(st.business_hours, st.last_order_buffer_minutes);

    let accepting = true;
    let message = null;
    if (st.store_open_override === 'open') {
      // Force-open override (testing): ignore hours and holidays entirely.
    } else if (st.store_open_override === 'closed') {
      accepting = false;
      message = st.closed_message || 'Online ordering is paused right now — please call us at (214) 703-0391.';
    } else if (holidayToday) {
      accepting = false;
      message = st.closed_message || 'We are closed today for a holiday. See you soon!';
    } else if (!win.open) {
      accepting = false;
      message = closedMessage(win.reason);
    }

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    res.status(200).json({
      accepting_orders: accepting,
      closed_message: message,
      hours: st.business_hours, // 0=Sunday..6=Saturday, America/Chicago — single source of truth
      etas: { pickup: st.pickup_eta_minutes, delivery: st.delivery_eta_minutes },
      delivery: {
        radius_miles: Number(st.delivery_radius_miles),
        fee_cents: st.delivery_fee_cents,
        minimum_cents: st.delivery_minimum_cents,
        paused: st.delivery_paused === true, // drivers off-duty; site offers Grubhub for delivery
      },
      options: {
        protein_choice: proteins.rows,
        extra_protein: extras.rows,
        spice_levels: [
          { level: 1, label: 'Mild Spicy' },
          { level: 2, label: 'Spicy' },
          { level: 3, label: 'Medium Spicy' },
          { level: 4, label: 'Very Spicy' },
          { level: 5, label: 'Extremely Spicy' },
        ],
      },
      categories: cats.rows.map(c => ({ id: c.id, name: c.name, items: itemsByCat[c.id] || [] })),
      allergy_note: 'Menu items may contain egg, peanuts, tree nuts, wheat and seafood. Please note any food allergies on your order.',
    });
  } catch (e) {
    console.error('menu error', e);
    res.status(500).json({ error: 'menu unavailable' });
  }
}
