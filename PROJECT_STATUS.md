# Tom Yum Thai — Project Status

**As of:** September 1, 2026 · Staging: https://tomyumthai-staging.vercel.app · Production target: order.mytomyumthai.com

---

## ✅ Completed

### Marketing site (WordPress.com — mytomyumthai.com)
- `mytomyumthai.com` made the primary address (was a redirect); phone added (tap-to-call), dead
  goo.gl link replaced, broken Facebook `#` icon removed, placeholder About page drafted out,
  hours corrected to the menu PDF (Mon dinner-only, Tue–Thu 5–9:30, Fri to 10 PM, weekends 12–10).
- Git snapshot workflow in `C:\Repo\TYTWebsite\site\` — edit locally, push via WordPress MCP,
  rollback = re-push an older commit. Decision: WordPress stays for family continuity;
  the ordering app is separate with a kill switch (point the Order buttons back to Masa+/GrubHub).

### Ordering platform (this repo — Vercel + Neon + Stripe)
- **Phase 1 — Data:** Neon Postgres via Vercel; 78-item menu seeded from To-Go Menu Rev. 09-2025
  (S/L soups, 16/32 oz teas, protein upcharges +$3/+$3/+$4, market-price fish display-only);
  `/api/menu` is hours-aware with a 20-min last-order buffer and holiday/pause overrides.
- **Phase 2 — Manager portal:** email + password (scrypt) + TOTP (RFC 6238, zero-dependency,
  RFC test vectors) + recovery codes; server sessions, rate limits, per-action audit log.
  Live tabs: kitchen queue, 86/price/hide, hours view + buffer, holiday closures, store settings.
  Old PIN-in-source login eliminated. Admin: littlethaichef@mytomyumthai.com (owner).
- **Phase 3 — Payments (prepaid-only):** server recomputes all money (25-case tested pricing
  engine: DIRECT15, 8.25% TX tax incl. delivery fee, tamper rejection); Stripe PaymentIntents +
  Payment Element (Apple Pay/Google Pay/Link); webhook trusts nothing — re-fetches the intent
  from Stripe by id; public order-status endpoint (no PII; codes are sequential).
  **E2E verified twice:** API-level (TYT-2026-0001) and full-browser with real clicks
  (TYT-2026-0002 — $35.98 − $5.40 + $2.52 = $33.10 exact, webhook <5 s). Optional email →
  Stripe `receipt_email` (verified). Live Stripe account activated; sandbox keys stay until launch.
- **Phase 4 — Kitchen (server + UI):** queue polling with new-order chime, guarded lifecycle
  (received→cooking→ready→completed, no skips, optimistic concurrency), giant allergy callouts,
  80mm thermal receipt template + print button. Printer identified: Star TSP143IIIW (TSP100III futurePRNT, Wi-Fi). No native WebPRNT on this series — print tier = futurePRNT Windows driver + existing window.print receipt flow; validate at kitchen dry-run. Three-ticket printing added 2026-09-01: one print job = customer receipt + CHEF 2 ticket + MAIN KITCHEN ticket (auto-cut between pages, order code large on all three); owner assigns each dish a chef station in the manager menu tab.
- **Delivery zone:** Google Routes API **driving miles from the restaurant address** (fixed the
  straight-line bug the owner caught — Lake Highlands 5.1 mi crow-flies is 6.6+ mi by road, now
  correctly refused). Autocomplete geocodes street-only with location bias, re-attaches the typed
  house number, Texas-filtered, distance-sorted, red "· outside zone" labels. Spend shield:
  per-IP 30/10 min, 100-mi bound, `GOOGLE_DAILY_CAP` 500/day, `GOOGLE_MONTHLY_CAP` 9000/month
  (below free tier ⇒ $0 by construction), Google-console quota caps, $10 budget alert to both
  Gmail and hotmail. Any failure/cap ⇒ labeled estimate; nothing breaks.
- **Customization UX:** owner-requested **popup modal** flow (replaced accordions): compact cards
  → "Customize & Add" → modal with that dish's real options and live total → Add closes into cart.
  Browser-verified including closed-hours guard.
- **SMS compliance:** unchecked opt-in checkbox at checkout (linked to policy), consent stored
  per-order (`sms_opt_in` + timestamp), `/privacy` policy page, `/sms-optin-proof` hosted evidence
  page; approved message templates drafted; **Twilio toll-free verification submitted, under review**.
  Twilio Verify service `VA42a175e9f724ba7e7181ec5f98e4ca5c` created; all creds in Vercel envs.
- **Trust bar:** owner confirmed all ratings + "since 2005"; Grubhub 4.8/2,500+ added; every
  rating links to its listing (Uber Eats / Grubhub / DoorDash); TripAdvisor removed at owner request.
- ~96 unit tests green (hours, TOTP, auth, pricing, stripe encoding/validation, order lifecycle,
  distance). All vendor credentials in Vercel envs; `DEV.md` documents setup and operations.

## 🔲 Remaining

### Owner
- [ ] Mobile walkthrough on a real phone (especially the new customization modal)
- [x] Printer identified 2026-09-01: Star TSP143IIIW (photo) — decision: driver + browser print, no new code
- [ ] Delete the old unused Google API key; rotate Twilio auth token at launch (both passed through chat)
- [ ] Name the second admin (family member) for the manager portal
- [ ] Wait out Twilio toll-free review (submitted; days–2 weeks)
- **Standing instruction: no Stripe test charges until owner says the site is close to finished.**

### Gemini (design lane)
- [ ] Food photography (shot list in GEMINI_TODO.md C3) — 14 placeholder photos from our Uber Eats listing now live (See Photo buttons); real shots replace img/dishes/<id>.jpg files
- [x] Favicon — DONE 2026-08-31 by Claude (mortar emblem from owner logo via Adobe crop + bg removal)
- [ ] Marketing assets: DIRECT15 graphics, table tents, final bag insert (swap URL to order.mytomyumthai.com)
- [ ] Optional: restyle Claude's #dishModal / "My Orders" shell (A6) — logic stays Claude's

### Claude (code lane)
- [ ] Phase 5: phone-OTP login (Twilio Verify), `/api/me/orders`, one-tap reorder;
      SMS sender after toll-free approval (templates approved; must check `sms_opt_in`)
- [ ] Delete dead free-delivery-over-$45 markup (or implement server-side if owner wants the promo)
- [ ] Launch sequence: `order.mytomyumthai.com` CNAME via WordPress DNS API; live Stripe keys +
      live-mode webhook + Apple Pay domain file; ONE small real-card test + refund (owner present);
      update Twilio campaign URLs to production domain; runbook; family continuity sheet
      (Vercel/Neon/Stripe/GitHub/Google Cloud/Twilio/WordPress/domain/email accounts); key rotation.
- [ ] Kitchen dry-run during one dinner service before launch
- [ ] Turn OFF Test Mode (store_open_override → auto) before launch — enabled 2026-09-01 for owner testing

### Parked (marketing track)
- Influencer playbook cleanup (placeholder handles, FTC disclosure line, tasting-menu verification),
  creator sourcing, WordPress "as seen on" section. WordPress site has been campaign-ready since Aug 29.

## 🤝 Gemini's involvement

Division of labor (owner runs Claude Max + Gemini Ultra): **Gemini = visual design, layout, copy,
marketing assets. Claude = all backend, JavaScript logic, payments, auth, integration, testing.**
Work orders live in `GEMINI_TODO.md` (contract: element IDs and `data-*` hooks that must survive)
and `GEMINI_REQUEST.md`.

Gemini delivered: the entire customer-site visual design (index.html) and manager-portal design;
the 4 requested shells (checkout drawer, confirmation modal + status stepper, menu-card template,
kitchen-queue cards + 80mm receipt CSS — commit c5279af, high contract compliance); round-2 UX
(menu collapse bar, accordion customizers — later replaced by the modal at owner request — and the
pickup/delivery dispatch card); the 4×6 bag insert. Claude wired every shell to the live APIs.

## ⚠️ What went wrong sharing code between Claude and Gemini (lessons)

1. **Gemini wrote JavaScript despite the no-JS rule (round 2):** it added its own functions and an
   orphaned popup modal whose buttons called functions that existed nowhere (`closeCustomModal`,
   `addModalItemToCart` — would throw if clicked), plus hardcoded category-jump ids that didn't
   match the API's category ids. *Mitigation:* Claude reviews every Gemini drop as a git diff and
   reconciles — dead code removed, good UX kept and properly wired. The repo being under git made
   this safe; never let two authors touch one file without diff review.
2. **Gemini invented content:** placeholder ratings in the trust bar (later confirmed real by the
   owner, but unverifiable when shipped), fake menu options with fake prices in templates
   ("Thai Fried Egg +$1.50", "Regular 16 oz" on dishes with no sizes), a "$4.99 delivery fee" and
   "free delivery over $45" that didn't match server rules. *Mitigation:* all real options/prices
   render from the API; templates are treated as style-only; every factual claim goes through the
   owner before launch.
3. **Mixed line endings corrupted patch tooling:** three editors (Claude via PowerShell, Gemini,
   git autocrlf) left index.html with interleaved CRLF/LF. Exact-match patches silently failed —
   worse, Git Bash `sed`/`cat` strip CR on output, so byte-inspections lied. *Fix:* every patch
   script normalizes both file and patterns to LF first.
4. **Shell-escaping ate code in transit:** PowerShell here-strings mangled multi-line patterns;
   bash heredoc→template-literal layering swallowed one level of backslashes, deploying a regex
   as `/^s*(d+)s+/` (broken) — a real production bug, caught only by browser-testing the feature.
   *Fix that works:* author patch payloads with the Write tool (never heredocs for content with
   quotes/backticks/backslashes), match whole functions exactly, write regexes backslash-free
   (`[0-9]`, literal spaces) when they must survive multiple escaping layers.
5. **Single-file HTML has no module boundary:** with both agents in one 4,000-line index.html,
   only the ID/data-attribute contract kept integration tractable. If this grows further, split
   Claude's logic into a separate .js file Gemini never touches.

## Key files
`PLAN.md` (phases + security model) · `GEMINI_TODO.md` / `GEMINI_REQUEST.md` (design contracts) ·
`DEV.md` (setup, env vars, ops) · `db/migrations/` (5) · `db/seed.mjs` (real menu — owner reviews
prices pre-launch) · `tests/` (7 suites) · WordPress snapshot: `C:\Repo\TYTWebsite\site\`
