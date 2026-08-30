// Seeds the real Tom Yum Thai menu (from To-Go Menu Rev. 09-2025 PDF).
// Idempotent: upserts by slug, so re-running is safe. OWNER MUST REVIEW PRICES LINE BY LINE.
// Usage: DATABASE_URL=... npm run seed
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }

const CATEGORIES = [
  ['signatures', "Signatures & Chef's Specials"],
  ['appetizers', 'Appetizers'],
  ['salads', 'Thai Salads'],
  ['soups', 'Thai Soups'],
  ['noodles', 'Noodles'],
  ['stir-fried', 'Stir Fried'],
  ['fried-rice', 'Fried Rice'],
  ['curries', 'Thai Coconut Curries'],
  ['sides', 'Side Orders'],
  ['desserts', 'Desserts'],
  ['beverages', 'Beverages'],
];

// Flags: P = protein choice (chicken/pork/tofu incl.; beef/shrimp/seafood upcharge)
//        X = extra protein add-ons, S = spice selectable
// price null + note => display-only (not orderable online).
const F = { P: 'protein_choice', X: 'extra_protein', S: 'spice_selectable' };
const I = (cat, id, name, price, flags = '', opts = {}) => ({
  cat, id, name, price_cents: price === null ? null : Math.round(price * 100),
  protein_choice: flags.includes('P'), extra_protein: flags.includes('X'),
  spice_selectable: flags.includes('S'), ...opts,
});

const ITEMS = [
  // --- Signatures & Chef's Specials ---
  I('signatures', 'chicken-ginger-rice', 'Thai Chicken Rice (Khao Man Gai)', 14.99, 'X', {
    thai: 'Khao Man Gai • ข้าวมันไก่',
    description: 'Boiled chicken over special ginger rice, served with spicy ginger sauce.' }),
  I('signatures', 'curry-salmon', 'Red or Green Curry Salmon', 16.99, 'S', {
    description: 'Grilled salmon topped with Thai style coconut curry sauce.' }),
  I('signatures', 'teriyaki-salmon', 'Teriyaki Salmon', 16.99, '', {
    description: 'Grilled salmon over a mix of steamed vegetables, topped with Teriyaki sauce.' }),
  I('signatures', 'spicy-basil-duck', 'Spicy Basil Duck', 16.99, 'S', {
    description: 'Lightly battered duck topped with spicy basil sauce.' }),
  I('signatures', 'curry-duck', 'Red or Green Curry Duck', 16.99, 'S', {
    description: 'Roasted duck topped with Thai style coconut red curry sauce.' }),
  I('signatures', 'crispy-garlic-whole-fish', 'Crispy Garlic Whole Fish', null, '', {
    description: 'Whole fish topped with crispy garlic pepper, served with spicy lime sauce.',
    price_note: 'Market Price — call us at (214) 703-0391', is_orderable: false }),
  I('signatures', 'sweet-sour-whole-fish', 'Crispy Sweet & Sour Whole Fish', null, '', {
    description: 'Whole fish topped with Thai style spicy & sweet sauce.',
    price_note: 'Market Price — call us at (214) 703-0391', is_orderable: false }),

  // --- Appetizers ---
  I('appetizers', 'crab-rangoon', 'Crab Rangoon', 5.99, '', { description: 'Crab cream cheese seasoned in a wonton wrap.' }),
  I('appetizers', 'crispy-rolls', 'Thai Crispy Rolls (Chicken, Pork, or Vegetable)', 5.99, '', { description: 'Crispy Thai egg rolls served with sweet & sour sauce.' }),
  I('appetizers', 'summer-rolls', 'Shrimp Summer Rolls w/ Spicy Peanut Sauce', 5.99, '', { description: 'An assortment of vegetables wrapped in rice paper.' }),
  I('appetizers', 'corn-patties', 'Corn Patties', 5.99, '', { description: 'Deep fried corn kernels battered with Thai seasonings.' }),
  I('appetizers', 'fried-tofu', 'Fried Tofu', 5.99, '', { description: 'Deep fried tofu served with sweet & sour peanut sauce.' }),
  I('appetizers', 'potstickers', 'Chicken & Vegetable Potstickers', 5.99, '', { description: 'Your choice of fried or steamed, served with sweet & sour sauce.' }),
  I('appetizers', 'shrimp-blankets', 'Shrimp Blankets', 7.99, '', { description: 'Shrimp seasoned and wrapped, served with sweet & sour sauce.' }),
  I('appetizers', 'fish-patties', 'Fish Patties', 9.99, '', { description: 'A combination of spicy red curry with fish paste.' }),
  I('appetizers', 'herbal-chicken', 'Herbal Chicken', 9.99, '', { description: 'Crispy chicken infused with Thai herbs and seasonings.' }),
  I('appetizers', 'thai-satay', 'Thai Satay (Chicken or Pork) w/ Cucumber & Peanut Sauce', 9.99, '', { description: 'Marinated in Thai seasonings and curry, served with sweet & sour.' }),
  I('appetizers', 'fried-calamari', 'Fried Calamari', 9.99, '', { description: 'Lightly battered calamari served with sweet & sour peanut sauce.' }),
  I('appetizers', 'curry-puffs', 'Curry Puffs', 9.99, '', { description: 'Minced chicken marinated and stuffed with Thai herbs and deep fried.' }),
  I('appetizers', 'crispy-wings', 'Thai Crispy Wings', 9.99, '', { description: 'Chicken wings marinated with Thai herbs and deep fried.' }),
  I('appetizers', 'lemongrass-sausage', 'Lemon Grass Sausage', 9.99, '', { description: 'Ground pork mixed with Thai herbs and grilled.' }),

  // --- Thai Salads ---
  I('salads', 'house-salad', 'Thai House Salad w/ Peanut Dressing', 7.99, '', { description: 'Fresh lettuce, tomatoes, and carrots served with peanut dressing.' }),
  I('salads', 'papaya-salad-laos', 'Papaya Salad Laos Style', 11.99, 'S', { description: 'Fresh green papaya salad mixed with crab, tomatoes, chili, and lime juice.' }),
  I('salads', 'papaya-salad-thai', 'Papaya Salad Thai Style', 11.99, 'S', { description: 'Fresh green papaya salad mixed with peanuts, dry shrimp, tomatoes, chili, and lime juice.' }),
  I('salads', 'shrimp-salad', 'Shrimp Salad', 13.99, 'S', { description: 'Shrimp salad mixed with tomatoes, onions, lemongrass and cilantro with spicy lime dressing.' }),
  I('salads', 'grilled-meat-salad', 'Grilled Pork or Beef Salad', 13.99, 'S', { description: 'Sliced grilled meat mixed with chili, onions, cilantro, and lemongrass with spicy lime dressing.' }),
  I('salads', 'glass-noodle-salad', 'Glass Noodle Salad (Chicken, Beef or Pork)', 13.99, 'S', { description: 'Glass noodles mixed with minced meat, tomatoes, onions, cilantro with spicy lime dressing. Substitute shrimp +$3 or seafood +$4.' }),
  I('salads', 'larb', 'Larb (Chicken, Beef or Pork)', 13.99, 'S', { description: 'Minced meat with ground rice, onions, cilantro with spicy lime dressing.' }),
  I('salads', 'seafood-salad', 'Seafood Salad', 14.99, 'S', { description: 'Seafood salad mixed with tomatoes, onions, lemongrass, and cilantro with spicy lime dressing.' }),

  // --- Thai Soups (Small/Large via item_sizes) ---
  I('soups', 'tom-yum', 'Tom Yum', null, 'PXS', { thai: 'ต้มยำ', description: 'An exotic spicy soup with mushrooms, onions, tomatoes, and chili.' }),
  I('soups', 'tom-kha', 'Tom Kha', null, 'PXS', { description: 'An exotic spicy soup with coconut milk, mushrooms, onions, tomatoes and chili.' }),
  I('soups', 'onion-basil-soup', 'Onion Basil', null, 'PXS', { description: 'Traditional Thai spicy & sour soup with kaffir lime leaves, lemongrass, basil and chili.' }),
  I('soups', 'shrimp-wonton-soup', 'Shrimp Wonton Soup', null, '', { description: 'Shrimp marinated and wrapped in wonton patty.' }),
  I('soups', 'thai-noodle-soup', 'Thai Noodle Soup', 11.99, 'PXS', { description: 'Thai style rice noodle soup with peanuts, bean sprouts, onions, cilantro and chili.' }),
  I('soups', 'vegetable-soup', 'Vegetable Soup', null, 'S', { description: 'Traditional Thai vegetable soup (protein choice not included).' }),

  // --- Noodles (choice of chicken/pork/tofu $13.99; beef +3, shrimp +3, seafood +4) ---
  I('noodles', 'pad-thai', 'Pad Thai', 13.99, 'PXS', { thai: 'ผัดไทย', description: 'Traditional Thai rice noodle dish with peanuts, egg, red onions, bean sprouts, and scallions in a sweet & tangy sauce.' }),
  I('noodles', 'pad-kee-mow', 'Pad Kee Mow (Spicy Basil Noodles)', 13.99, 'PXS', { thai: 'ผัดขี้เมา', description: 'Big flat noodles with egg, tomatoes, onions, bell peppers and fresh basil.' }),
  I('noodles', 'pad-see-iew', 'Pad See Iew (Sweet Broccoli Noodles)', 13.99, 'PX', { description: 'Big flat noodles with egg, broccoli, and Thai seasonings.' }),
  I('noodles', 'tung-tac', 'Tung Tac (Spicy Peanut Noodles)', 13.99, 'PXS', { description: 'Big flat noodles with peanuts, egg, napa cabbage, bean sprouts, green onions, and spicy Thai seasonings.' }),
  I('noodles', 'raad-naa', 'Raad Naa (Gravy Noodles)', 13.99, 'PX', { description: 'Pan seared big flat noodles with broccoli in a black bean gravy.' }),
  I('noodles', 'sukiyaki', 'Sukiyaki', 13.99, 'PXS', { description: 'Glass noodles with egg, carrots, celery, napa cabbage, scallions, and cilantro in a spicy sukiyaki sauce.' }),
  I('noodles', 'curry-noodles', 'Red or Green Curry Noodles', 13.99, 'PXS', { description: 'An exotic spicy curry with bamboo shoots, zucchini, bell peppers and sweet basil, served with vermicelli noodles.' }),

  // --- Stir Fried (served with steamed rice) ---
  I('stir-fried', 'spicy-basil', 'Spicy Basil', 13.99, 'PXS', { description: 'Thai spicy basil sauce with bell peppers, bamboo shoots, and fresh basil.' }),
  I('stir-fried', 'pepper-garlic', 'Pepper Garlic', 13.99, 'PX', { description: 'Sliced meat with zucchini, broccoli and carrots.' }),
  I('stir-fried', 'rama-peanut', 'Rama Peanut', 13.99, 'PX', { description: 'Sliced meat in homemade peanut sauce over a bed of steamed vegetables.' }),
  I('stir-fried', 'ginger-stirfry', 'Ginger', 13.99, 'PX', { description: 'Sliced meat sautéed with fresh ginger, bell peppers, onions, garlic and carrots in a light ginger sauce.' }),
  I('stir-fried', 'cashew-nut', 'Cashew Nut', 13.99, 'PXS', { description: 'A spicy sweet chili paste with cashew nuts, sweet onions, bell peppers and carrots.' }),
  I('stir-fried', 'curry-basil', 'Curry Basil', 13.99, 'PXS', { description: 'A blend of Thai chili paste, stir fried with bell peppers, zucchini and basil.' }),
  I('stir-fried', 'sesame-chicken', 'Sesame Chicken', 13.99, 'X', { description: 'Lightly battered chicken stir fried in sweet and sour sauce with sesame seeds, onions, bell peppers and carrots.' }),

  // --- Fried Rice ---
  I('fried-rice', 'thai-fried-rice', 'Thai Fried Rice', 13.99, 'PX', { description: 'Thai style fried rice with egg, onions, tomatoes and garlic.' }),
  I('fried-rice', 'spicy-basil-fried-rice', 'Spicy Basil Fried Rice', 13.99, 'PXS', { description: 'A spicy basil fried rice with egg, bell peppers, and garlic.' }),
  I('fried-rice', 'curry-fried-rice', 'Curry Fried Rice', 13.99, 'PXS', { description: 'A spicy yellow curry fried rice with egg, bell peppers, onions and garlic.' }),
  I('fried-rice', 'fish-patty-fried-rice', 'Fish Patty Fried Rice', 14.99, 'S', { description: 'A spicy red curry fried rice with egg, onions, bell peppers and basil.' }),
  I('fried-rice', 'tom-yum-fried-rice', 'Tom Yum Fried Rice', 14.99, 'PXS', { description: 'A blend of lemongrass and chili paste with mushrooms, tomatoes, and onions.' }),
  I('fried-rice', 'pineapple-fried-rice', 'Pineapple Fried Rice', 14.99, 'PX', { description: 'Thai style fried rice with cashews, egg, onions, tomatoes, raisins and pineapple.' }),

  // --- Thai Coconut Curries (served with steamed rice) ---
  I('curries', 'panang-curry', 'Panang Curry', 13.99, 'PXS', { thai: 'แกงพะแนง', description: 'A thick sweet red curry with bell peppers, carrots and basil.' }),
  I('curries', 'red-curry', 'Red Curry', 13.99, 'PXS', { description: 'A spicy red curry simmered with bell peppers, bamboo shoots, zucchini and basil.' }),
  I('curries', 'green-curry', 'Green Curry', 13.99, 'PXS', { description: 'A spicy green curry simmered with bell peppers, bamboo shoots, zucchini and basil.' }),
  I('curries', 'yellow-curry', 'Yellow Curry', 13.99, 'PXS', { description: 'A yellow curry dish with potatoes, onions and carrots.' }),
  I('curries', 'pineapple-curry', 'Pineapple Curry', 13.99, 'PXS', { description: 'A spicy red curry simmered with pineapple, bell peppers, zucchini and basil.' }),
  I('curries', 'massaman-curry', 'Massaman Curry', 13.99, 'PXS', { description: 'A massaman curry paste simmered with peanuts, potatoes, onions and carrots.' }),

  // --- Side Orders ---
  I('sides', 'steamed-rice', 'Steamed Rice', 3.00),
  I('sides', 'sticky-brown-rice', 'Steamed Sticky Rice / Brown Rice', 4.00),
  I('sides', 'vermicelli-noodles', 'Vermicelli Noodles', 3.00),
  I('sides', 'steamed-vegetables', 'Steamed Mix Vegetables', null),
  I('sides', 'peanut-sauce', 'Peanut Sauce / Peanut Dressing (2 oz)', 1.00),
  I('sides', 'cucumber-sauce', 'Cool Cucumber Sauce (2 oz)', 1.00),

  // --- Desserts ---
  I('desserts', 'black-rice-pudding', 'Black Rice Pudding', 7.99),
  I('desserts', 'fried-ice-cream', 'Fried Ice Cream', 7.99),
  I('desserts', 'sweet-sticky-rice', 'Sweet Sticky Rice', 8.99, '', { description: 'Served with coconut ice cream or fresh mango.' }),
  I('desserts', 'banana-pastry', 'Banana Pastry Delight', 9.99, '', { description: 'Banana wrapped in pastry with two scoops of ice cream.' }),
  I('desserts', 'ice-cream', 'Ice Cream', 4.99, '', { description: 'Vanilla, Coconut, or Green Tea.' }),

  // --- Beverages ---
  I('beverages', 'thai-iced-tea', 'Thai Iced Tea or Thai Iced Coffee', null, '', { description: 'No refill.' }),
  I('beverages', 'thai-iced-tea-no-ice', 'Thai Iced Tea or Coffee (No Ice)', null, '', { description: 'No refill, no ice.' }),
  I('beverages', 'hot-iced-tea', 'Hot Tea (per person) / Iced Tea', 2.50),
  I('beverages', 'coconut-water', 'Coconut Water', 4.00),
  I('beverages', 'can-soda', 'Can Soda', 2.00),
  I('beverages', 'bottled-water', 'Bottled Water', 2.00),
];

const SIZES = {
  'tom-yum':            [['Small', 699], ['Large', 1099]],
  'tom-kha':            [['Small', 699], ['Large', 1099]],
  'onion-basil-soup':   [['Small', 699], ['Large', 1099]],
  'shrimp-wonton-soup': [['Small', 799], ['Large', 1199]],
  'vegetable-soup':     [['Small', 699], ['Large', 1099]],
  'steamed-vegetables': [['Small', 400], ['Large', 600]],
  'thai-iced-tea':        [['16 oz', 350], ['32 oz', 700]],
  'thai-iced-tea-no-ice': [['16 oz', 400], ['32 oz', 800]],
};

const PROTEINS = [ // included choices at 0; premium upcharges
  ['chicken', 'Chicken', 0], ['pork', 'Pork', 0], ['tofu', 'Tofu', 0],
  ['vegetable', 'Vegetable', 0], ['beef', 'Beef', 300], ['shrimp', 'Shrimp', 300],
  ['seafood', 'Seafood', 400],
];
const EXTRAS = [
  ['extra-chicken', 'Extra Chicken', 200], ['extra-pork', 'Extra Pork', 200],
  ['extra-tofu', 'Extra Tofu', 200], ['extra-veggies', 'Extra Mixed Veggies', 200],
  ['extra-beef', 'Extra Beef', 300], ['extra-shrimp', 'Extra Shrimp', 300],
  ['extra-seafood', 'Extra Seafood', 400],
];

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: true } });
await client.connect();
try {
  await client.query('BEGIN');
  let sort = 0;
  for (const [id, name] of CATEGORIES) {
    await client.query(
      `INSERT INTO menu_categories (id, name, sort) VALUES ($1,$2,$3)
       ON CONFLICT (id) DO UPDATE SET name=$2, sort=$3`, [id, name, sort++]);
  }
  sort = 0;
  for (const it of ITEMS) {
    await client.query(
      `INSERT INTO menu_items (id, category_id, name, thai_name, description, base_price_cents,
         price_note, protein_choice, extra_protein, spice_selectable, is_orderable, sort)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (id) DO UPDATE SET category_id=$2, name=$3, thai_name=$4, description=$5,
         base_price_cents=$6, price_note=$7, protein_choice=$8, extra_protein=$9,
         spice_selectable=$10, is_orderable=$11, sort=$12`,
      [it.id, it.cat, it.name, it.thai ?? null, it.description ?? null, it.price_cents,
       it.price_note ?? null, it.protein_choice, it.extra_protein, it.spice_selectable,
       it.is_orderable ?? true, sort++]);
  }
  for (const [itemId, sizes] of Object.entries(SIZES)) {
    let s = 0;
    for (const [label, cents] of sizes) {
      await client.query(
        `INSERT INTO item_sizes (item_id, label, price_cents, sort) VALUES ($1,$2,$3,$4)
         ON CONFLICT (item_id, label) DO UPDATE SET price_cents=$3, sort=$4`,
        [itemId, label, cents, s++]);
    }
  }
  let p = 0;
  for (const [id, label, delta] of PROTEINS) {
    await client.query(
      `INSERT INTO protein_options (id, label, delta_cents, sort) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET label=$2, delta_cents=$3, sort=$4`, [id, label, delta, p++]);
  }
  p = 0;
  for (const [id, label, delta] of EXTRAS) {
    await client.query(
      `INSERT INTO extra_protein_options (id, label, delta_cents, sort) VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET label=$2, delta_cents=$3, sort=$4`, [id, label, delta, p++]);
  }
  await client.query(
    `INSERT INTO promo_codes (code, percent_off, active) VALUES ('DIRECT15', 15, true)
     ON CONFLICT (code) DO UPDATE SET percent_off=15, active=true`);
  await client.query('COMMIT');
  const n = await client.query('SELECT count(*)::int AS c FROM menu_items');
  console.log(`seed complete: ${n.rows[0].c} menu items`);
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  await client.end();
}
