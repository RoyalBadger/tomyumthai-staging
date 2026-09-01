# Menu Cross-Check: Our Database vs. Delivery Platforms

**Captured:** September 1, 2026, from the live public storefronts.
**Sources:** Uber Eats (full catalog, 87 listings from embedded page data), DoorDash (full menu via
storefront), Grubhub (partial — best sellers; full crawl blocked by browser permissions),
plus one Uber Eats item dialog (Pad Thai) for the complete customization structure.
**Our DB:** 78 items seeded from the To-Go Menu PDF Rev 09-2025 (in-store prices).

No official APIs exist for this (Aldelo has none; GH/DD/UE merchant APIs are partner-gated) —
this was extracted from our own restaurant's public listing pages.

---

## Bottom line

1. **Our database covers everything the platforms sell, plus more.** Every platform item maps to
   one of ours (their "Chicken Ginger Rice" = our Khao Man Gai). We additionally carry: all 5
   Desserts, Corn Patties†, Shrimp Blankets, Shrimp Summer Rolls, Curry Puffs, Thai Crispy Wings,
   Lemon Grass Sausage, Thai House Salad, Coconut Water, Hot Tea, and the market-price whole fish.
   († on DD but not UE)
2. **Platform prices run ≈ +$1.00 over our in-store prices** (UE and DD, consistently across
   entrees, appetizers, soups, chef's specials). **Grubhub lists at in-store prices** ($13.99
   entrees, $5.99 apps — matches our PDF). Our site correctly uses in-store pricing.
3. **Beef upcharge — RESOLVED (owner ruling 2026-09-01: ours is correct, Beef +$3.00; no change).** Original finding: Uber Eats charges **Beef +$2.00**
   (both as protein choice and extra protein). Our DB has **Beef +$3.00** (from the PDF).
   (Shrimp +$3 and Seafood +$4 match everywhere. Uber Eats' +$2 beef is their listing's issue, not ours.)
4. Soups: we sell Small/Large ($6.99/$10.99); UE & DD list a single ~$7.99 soup (small only).
   Our size structure is richer — nothing to change.
5. Beverages: UE's 16oz/32oz + "No Ice" variants at $3.50/$7.00/$4.00/$8.00 exactly match our
   sizes — good validation of the seed.

## Customization structure (Uber Eats item dialog, Pad Thai)

| Group | UE options | Our DB |
|---|---|---|
| Choice of Protein (required) | Chicken, Pork, Tofu, No Meat, Mixed Veg incl.; Beef **+$2**, Shrimp +$3, Seafood +$4 | Chicken/Pork/Tofu/Vegetable incl.; Beef **+$3**, Shrimp +$3, Seafood +$4 |
| Spice Level (required) | 5 levels, Mild→Extremely Spicy | 5 levels 1–5 ✓ |
| Extra Protein (up to 1) | Chicken/Pork/Beef/Tofu/Mixed Veg **+$2**, Shrimp +$3, Seafood +$4 | Extra Chicken/Pork/Tofu/Veggies +$2, **Extra Beef +$3**, Shrimp +$3, Seafood +$4 |
| Remove Topping | "No Bean" checkbox | Our exclusions list (peanuts/egg/vegan/onion/sprouts/GF) — richer ✓ |
| Special instructions | free text | free text ✓ |

## Price comparison (representative; in dollars)

| Item | Ours (in-store) | Grubhub | DoorDash | Uber Eats |
|---|---|---|---|---|
| Pad Thai / noodles | 13.99 | 13.99+ | 14.99 | 14.99 |
| Stir fried / curries / Thai FR | 13.99 | — | 14.99 | 14.99 |
| Pineapple/Tom Yum/Fish Patty FR | 14.99 | — | 15.99 | 15.99 |
| Crab Rangoon, Crispy Rolls, Fried Tofu, Potstickers | 5.99 | 5.99 | 6.99 | 6.99 |
| Satay, Herbal Chicken, Calamari, Fish Patties | 9.99 | — | 10.99 | 10.99 |
| Tom Yum / Tom Kha (small) | 6.99 (L 10.99) | — | 7.99 | 7.99 |
| Shrimp Wonton Soup (small) | 7.99 (L 11.99) | — | 8.99 | 8.99 |
| Thai Noodle Soup | 11.99 | — | 12.99 | 12.99 |
| Papaya Salads | 11.99 | — | 12.99 | 12.99 |
| Grilled/Larb/Glass Noodle/Shrimp Salads | 13.99 | — | 14.99 | 14.99 |
| Seafood Salad | 14.99 | — | 15.99 | 15.99 |
| Khao Man Gai (Chicken Ginger Rice) | 14.99 | — | 15.99 | 15.99 |
| Salmon / Duck specials | 16.99 | — | 17.99 | 17.99 |
| Steamed Rice | 3.00 | 3.00 | — | 3.50 |
| Sticky/Brown Rice | 4.00 | — | 4.50 | 4.50 |
| Thai Iced Tea/Coffee 16oz / 32oz | 3.50 / 7.00 | — | 3.50 / 7.00 | 3.50 / 7.00 |
| " No-Ice 16oz / 32oz | 4.00 / 8.00 | — | — | 4.00 / 8.00 |
| Peanut Sauce / Cucumber Sauce 2oz | 1.00 | — | 1.00 | 1.00 |

## Items on our menu that platforms don't list
Desserts (Black Rice Pudding, Fried Ice Cream, Sweet Sticky Rice, Banana Pastry Delight,
Ice Cream — Grubhub does have a Desserts tab, contents unverified), Shrimp Blankets, Shrimp
Summer Rolls, Curry Puffs, Thai Crispy Wings, Lemon Grass Sausage, Thai House Salad, Vegetable
Soup†franchise, Coconut Water, Hot Tea, market-price whole fish. **Direct-order advantage:
our site sells the full menu.**

## Notes
- UE "Remove Topping: No Bean" suggests bean sprouts is the removal customers ask for —
  already in our exclusions list. ✓
- DD shows service hours 11:00–2:10 / 5:00–8:40 (their own ~20-min buffer on our hours —
  same idea as our last-order buffer). ✓
- Grubhub full-menu crawl requires enabling JavaScript for grubhub.com (and doordash.com) in
  the Claude-in-Chrome extension's site permissions if we ever want the complete GH dataset.
