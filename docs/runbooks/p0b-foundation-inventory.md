# P0B foundation inventory

The existing suite is green on the recorded `main` commit under Node 20. **Capacity confirmed is not met:** Vercel and Neon account settings and deployed build-output/limit details remain unavailable; Questions 1–9 below identify the human evidence needed. This inventory uses repository and GitHub deployment evidence; no live database inspection or restore rehearsal was performed. Pushing its branch triggered the existing Vercel integration’s Preview deployment, as recorded below.

## Base

Inventoried on 2026-10-01 UTC in `/home/dev/worktrees/tyt-p0b`, branch `codex/p0b-foundation-inventory`. Before any edits, `git status --short` was empty and `git rev-parse HEAD main` printed:

```text
1cd14a68cc2ad6d6c97b195d3795ec2a71d5552a
1cd14a68cc2ad6d6c97b195d3795ec2a71d5552a
```

Selected Node with `export PATH=/home/dev/.local/opt/node-v20.20.2-linux-x64/bin:$PATH`; `node --version` printed `v20.20.2`. `package.json:6–7` requires `>=20`. The production commit and runtime remain unverified (Question 7); the Preview deployment of this PR’s initial head is recorded below.

Assignment sources read, in order: `/home/dev/agent-teams/docs/team/roles/platform.md`, `/home/dev/agent-teams/docs/team/roles/platform-record.md` (no open lessons), `/home/dev/agent-teams/docs/team/charters/codex-pos-platform.md`, `/home/dev/.herdr-mail/p0b-brief.md`. Additional process sources: `/home/dev/HERDR-AGENTS.md`, `/home/dev/agent-teams/docs/pos-first-assignment.md`, `/home/dev/agent-teams/docs/runbooks/agent-identities.md`, `/home/dev/agent-teams/scripts/devvm-check.sh`. These are external devvm references, not files added to this repository. Fix-cycle sources read on 2026-10-02: `/home/dev/.herdr-mail/p0b-fix-brief.md` and `/home/dev/.herdr-mail/p0b-review-1-claude-pos-reviewer.md`. Repository sources are named in the relevant sections below; no Vercel or Neon credentials were accessed.

## Test baseline

Sources: `package.json:9–13`, `package-lock.json`, all nine test files listed below, and `tests/fixtures/delivery-zone-edge-cases.json`. Both runs occurred on the unchanged base before creating the report or workflow.

| Test file | Successful assertion/check invocations | Printed PASS lines |
| --- | ---: | ---: |
| `tests/hours.test.mjs` | 19 | 19 |
| `tests/totp.test.mjs` | 11 | 11 |
| `tests/auth.test.mjs` | 6 | 6 |
| `tests/pricing.test.mjs` | 39 | 39 |
| `tests/stripe.test.mjs` | 22 | 22 |
| `tests/order-status.test.mjs` | 12 | 12 |
| `tests/distance.test.mjs` | 6 | 6 |
| `tests/print-tickets.test.mjs` | 28 | 28 |
| `tests/delivery-zone-fixture.test.mjs` | 44 | 3 |
| **Total: 9 files** | **187** | **146** |

Counting convention: the first eight files execute 143 explicit boolean checks (a compound boolean is one check). Fixture validation executes two top-level assertions plus three entries × (one object assertion + four fields × three assertions + one expected-value assertion) = 44 `assert` calls. It prints only one PASS per entry. The `test` script runs all nine files sequentially. The posting's eight-target count and `PROJECT_STATUS.md:51`'s approximately 96 tests are stale.

Commands for the baseline:

```bash
export PATH=/home/dev/.local/opt/node-v20.20.2-linux-x64/bin:$PATH
node --version
npm --version
npm ci
npm test
npm run check
```

```text
node --version: v20.20.2
npm --version: 10.8.2

$ npm ci
added 14 packages, and audited 15 packages in 506ms

found 0 vulnerabilities
exit=0

$ npm test (last six lines)
PASS  test ticket mentions the label
all print-ticket tests pass
PASS  delivery-zone fixture: just-inside-driving-radius
PASS  delivery-zone fixture: at-driving-tolerance-boundary
PASS  delivery-zone fixture: just-outside-driving-tolerance
all delivery-zone fixture tests pass
exit=0

$ npm run check
> tomyumthai-ordering@0.1.0 check
> node --check api/menu.js && node --check api/health.js && node --check lib/db.js && node --check lib/hours.js && node --check db/seed.mjs && node --check db/migrate.mjs && node --check api/distance.js && node --check lib/distance.js
exit=0
```

Second data point, not the baseline: `export PATH=/usr/bin:$PATH`, then the same five commands. `/usr/bin/node --version` returned `v22.23.2`; npm returned `12.1.0`. Both runtimes satisfy the package's engines range.

```text
node --version: v22.23.2
npm --version: 12.1.0

$ npm ci
added 14 packages, and audited 15 packages in 670ms

found 0 vulnerabilities
exit=0

$ npm test (last six lines)
PASS  test ticket mentions the label
all print-ticket tests pass
PASS  delivery-zone fixture: just-inside-driving-radius
PASS  delivery-zone fixture: at-driving-tolerance-boundary
PASS  delivery-zone fixture: just-outside-driving-tolerance
all delivery-zone fixture tests pass
exit=0

$ npm run check
npm notice run tomyumthai-ordering@0.1.0 check
npm notice run node --check api/menu.js && node --check api/health.js && node --check lib/db.js && node --check lib/hours.js && node --check db/seed.mjs && node --check db/migrate.mjs && node --check api/distance.js && node --check lib/distance.js
exit=0
```

`npm run check` parses only its eight named source files; it is not a whole-tree syntax, type, or lint check. The suite is local unit/fixture validation: no browser suite, database connection, migration replay, live payment, measured driving route, or physical printer exercise is included. `DEV.md:52–56` explicitly records the database limitation. Those behaviors remain unverified by this baseline.

## Deploy plan and capacity

Sources: `vercel.json:1–5`, `.vercelignore:1`, `package.json`, the tracked tree, the default-handler declarations in every API file below, and `PROJECT_STATUS.md:3,77–80,194–196,239`, plus PR #5’s GitHub checks and deployments record.

The tree supplies static files at the root (including `index.html`, `manager.html`, `insert.html`, `privacy.html`, and `sms-optin-proof.html`) and image assets. There is no package build script. `vercel.json` sets version 2, clean URLs, and no trailing slash; it supplies no build-command/output-directory, function size, duration, or region override. `.vercelignore` excludes `print-agent`, which is intended to run on the restaurant PC. These facts describe the expected static-plus-serverless layout; dashboard overrides and the actual deployed build output cannot be read here (Question 7).

The repository's Vercel Git integration builds and deploys a **Preview of every pushed development/agent branch**, independently of this CI workflow and before any review. `vercel.json` contains no `git.deploymentEnabled` override. PR #5's initial push demonstrated that behavior: its [Vercel check](https://vercel.com/tytmktg/tomyumthai-staging/HyoXoursBgauSNQgHExVATdodmVU) reported `Deployment has completed`. GitHub's deployments record for that exact head confirms the creator, Preview environment and creation time (read on 2026-10-02):

```text
$ gh api 'repos/RoyalBadger/tomyumthai-staging/deployments?sha=58e0dbb95d1de53035bdba81855cfbc02b06ff37' --jq '.[] | {created_at, creator: .creator.login, environment}'
{"created_at":"2026-10-02T03:07:21Z","creator":"vercel[bot]","environment":"Preview"}
exit=0

$ gh pr checks 5 --repo RoyalBadger/tomyumthai-staging (Vercel row)
Vercel  pass  0  https://vercel.com/tytmktg/tomyumthai-staging/HyoXoursBgauSNQgHExVATdodmVU  Deployment has completed
```

Each Preview is a deployment and is subject to the per-deployment function cap; Preview deployment does not provide extra function slots. Code on an unreviewed agent branch runs under the Preview environment's variables. Whether those variables target production data or live services, whether Preview deployment protection is enabled, and whether agent branches should deploy before review are unverified account/policy facts (Question 9). No absence of secrets or deploy steps in CI establishes Preview isolation. The GitHub record proves this Preview occurred; dashboard branch exclusions and the effective deployment settings still need human confirmation.

```text
$ find api -name '*.js' | wc -l
12
```

| Source file / function entry point | Surface |
| --- | --- |
| `api/admin/login.js` | Admin login/session/logout |
| `api/admin/menu.js` | Admin menu editor and images |
| `api/admin/orders.js` | Kitchen orders and print-agent polling/acknowledgement |
| `api/admin/settings.js` | Store settings |
| `api/distance.js` | Delivery distance |
| `api/health.js` | Health |
| `api/me.js` | Customer account |
| `api/menu-image.js` | Menu photo |
| `api/menu.js` | Public menu |
| `api/order-status.js` | Public status |
| `api/orders.js` | Checkout |
| `api/stripe-webhook.js` | Stripe webhook |

All 12 export a default request handler, including the two wrapped by `requireAdmin`; none is a helper-only file. Shared code lives in `lib/`, outside `api/`. The file count does not independently prove the deployed function count.

The status document’s header is dated **2026-09-06**, with entries through September 9. `PROJECT_STATUS.md:77–80` records a Hobby cap of **12 functions per deployment**, says “consolidated to 11” under September 1, and pre-approves Pro if needed. The September 6 entry at `PROJECT_STATUS.md:196` correctly says 12 functions. The latest cap statement is `PROJECT_STATUS.md:239`, under September 9: the print endpoint lives inside `api/admin/orders.js` because of the 12-function cap. Against that recorded cap, this checkout has **zero spare function slots: no new POS route fits on Hobby**. `/home/dev/agent-teams/docs/pos-first-assignment.md`, F7 and Step 0, require **Vercel Pro before any POS route**. Neither the historical status nor its pre-approval establishes today's account plan, current limits, or completion of the upgrade: see Questions 1 and 7. No current pricing or account capacity is inferred from that historical entry.

## Database

Sources: all **23** SQL files below (the brief's count of 15 does not match this base), `db/migrate.mjs`, `db/migrate-with-env.mjs`, `db/seed.mjs`, `db/create-admin.mjs`, `db/set-delivery-pause.mjs`, `lib/db.js`, `lib/maintenance.js`, and `DEV.md:5–7,25–59,100–150`. This is the intended schema from source; no live `_migrations` ledger, row counts, or schema was read.

| Migration read | Main effect |
| --- | --- |
| `db/migrations/001_init.sql` | Core menu, pricing catalogs, customers, orders/snapshots, admin auth/audit, singleton settings, order-code sequence |
| `db/migrations/002_business_hours.sql` | Business hours and last-order buffer |
| `db/migrations/003_rate_limits.sql` | Rate-limit counters |
| `db/migrations/004_customer_email.sql` | Order email |
| `db/migrations/005_sms_opt_in.sql` | Order SMS consent flag |
| `db/migrations/006_chef_station.sql` | Menu station and order-line station snapshot |
| `db/migrations/007_vegetarian_and_addon_groups.sql` | Vegetarian flag/data and extra-protein grouping |
| `db/migrations/008_no_protein_option.sql` | No-protein catalog choice |
| `db/migrations/009_open_override.sql` | Allows force-open settings override |
| `db/migrations/010_item_images.sql` | Menu image URL |
| `db/migrations/011_item_image_blobs.sql` | Uploaded image table |
| `db/migrations/012_customer_portal.sql` | Customer email/address, customer sessions, order phone index |
| `db/migrations/013_delivery_pause.sql` | Delivery pause setting |
| `db/migrations/014_pii_retention.sql` | PII scrub marker and nullable order name/phone |
| `db/migrations/015_item_variants.sql` | Per-item variants, seed choices, order-line variant snapshot |
| `db/migrations/016_peanut_sauce_variants.sql` | Sauce choices |
| `db/migrations/017_summer_rolls.sql` | Rename and filling choices |
| `db/migrations/018_chicken_ginger_rice.sql` | Dish name/option changes |
| `db/migrations/019_menu_editor.sql` | Removal fields and change-request table |
| `db/migrations/020_modifiers.sql` | Modifier catalog and item assignments, populated from menu data |
| `db/migrations/021_modifier_default_price.sql` | Default/non-meat extra price of 100 cents |
| `db/migrations/022_enable_extras.sql` | Enables extras on existing removable modifiers |
| `db/migrations/023_print_agent.sql` | Print timestamps, unprinted-order index, heartbeat; marks existing non-pending orders printed |

Keys and relations after these migrations (20 application tables plus the runner's `_migrations` table):

| Table | Primary/unique keys and foreign-key relations |
| --- | --- |
| `menu_categories` | Text `id` primary key |
| `menu_items` | Text `id`; required `category_id` → `menu_categories.id` |
| `item_sizes` | Serial `id`; unique `(item_id,label)`; required `item_id` → `menu_items.id`, delete cascade |
| `protein_options` | Text `id`; global choices selected through menu flags, no item join FK |
| `extra_protein_options` | Text `id`; global add-on catalog |
| `promo_codes` | Text `code` |
| `customers` | UUID `id`; unique required `phone_e164` |
| `orders` | UUID `id`; unique required `public_code`, unique nullable `stripe_payment_intent`; nullable `customer_id` → `customers.id`, `promo_code` → `promo_codes.code` |
| `order_items` | Serial `id`; required `order_id` → `orders.id`, delete cascade; `item_id` is deliberately not a foreign key: names/options/prices are snapshots |
| `admin_users` | UUID `id`; unique required `email`; role constrained to owner/manager |
| `sessions` | Text `token_hash`; required `admin_id` → `admin_users.id`, delete cascade |
| `admin_audit_log` | Serial `id`; nullable `admin_id` → `admin_users.id` |
| `settings` | Boolean `id`, constrained true: singleton |
| `rate_limits` | Text `key`; window start and count |
| `menu_item_images` | `item_id` is both primary key and FK → `menu_items.id`, delete cascade |
| `customer_sessions` | Text `token_hash`; required `customer_id` → `customers.id`, delete cascade |
| `item_variants` | Serial `id`; unique `(item_id,label)`; required `item_id` → `menu_items.id`, delete cascade |
| `change_requests` | Serial `id`; nullable `admin_id` → `admin_users.id`; open/done/declined status |
| `modifiers` | Serial `id`; unique required `label` |
| `item_modifiers` | Composite primary key `(item_id,modifier_id)`; FKs to `menu_items.id` and `modifiers.id`, both delete cascade |
| `_migrations` | Text `name`; `applied_at` timestamp; created by runner, not SQL migrations |

Money columns use integer cents, tax rate uses basis points, and timestamps use `timestamptz`; `order_code_seq` is a separate sequence. Nullable FKs without an explicit delete action use the default constraint behavior.

`db/migrate.mjs` requires `DATABASE_URL`, uses TLS certificate verification, creates `_migrations`, sorts `.sql` filenames lexicographically (001 through 023), skips recorded filenames, and wraps each file plus its ledger insertion in its own transaction. Failure rolls back that file; previously committed files remain. It has no checksum validation, down-migration routine, or migration lock. `db/migrate-with-env.mjs` pulls **production** Vercel envs to `.env.migration`, invokes the runner, and has cleanup logic. `db/set-delivery-pause.mjs` also pulls production envs before updating settings. `db/create-admin.mjs` creates/resets an admin with password hashing, TOTP and hashed recovery codes and revokes existing sessions. These scripts were read, not executed.

`db/seed.mjs` loads 11 categories, 78 menu items from To-Go Menu Rev. 09-2025, sizes, per-dish variants, 24 modifier definitions and pattern-derived assignments, seven protein choices, seven extra-protein options, and active `DIRECT15` at 15%. It runs in one transaction using upserts; rerunning can overwrite menu edits and reactivate that promo. It is a baseline loader, not a safe production synchronization command (`DEV.md:149–150`). Migration 008 separately supplies the no-protein option. Fresh-database replay is unverified: migration 015 inserts variant FKs for pre-existing menu rows, and migration 020 derives assignments from existing dishes. The seed creates modifier assignments with `can_extra=false`, whereas 022 updates existing assignments to true. These ordering/data dependencies need a separate isolated replay before a fresh environment can be declared reproducible; this report does not repair them.

`lib/db.js` lazily creates a singleton `pg.Pool` with TLS verification, max 3 connections, 10-second idle timeout and 8-second connection timeout. This is a per-instance pool setting, not proof of total deployed connection capacity (Questions 4–5).

Migration **014 enables application PII scrubbing**, not Neon backup retention: it adds `orders.pii_scrubbed_at` and makes name/phone nullable. `lib/maintenance.js` cancels pending payments older than 24 hours; deletes never-paid canceled orders older than 30 days (cascading items); clears name, phone, email, delivery address/notes from completed/canceled orders older than 90 days while preserving totals/items and `customer_id`; and purges rate-limit windows older than 45 days. It runs opportunistically after order creation, rate-limited to four runs/day, so it is not a guaranteed daily scheduler. This does not establish a recoverable history window or scrub customer-account records.

Neon is provisioned through the Vercel integration, which injects `DATABASE_URL` (`DEV.md:5–7,71`). Plan, history retention/PITR, branch quota and current branches, compute/autosuspend, and Postgres version require Questions 2–6. No restore was attempted.

The only documented branch practice is `DEV.md:25–59` (PR #4): create a temporary branch from the intended development parent with read-write compute; verify the temporary branch/database/role when copying its connection string; retain SSL options; enter it at a hidden prompt inside a subshell as `DATABASE_URL`; run `npm test`; then delete only that temporary branch even on failure. The current suite does not consume that database connection. This practice is not evidence of automatic per-PR isolation or a successful database test/restore.

## CI baseline

`git ls-tree -r --name-only main .github docs` returned no paths: neither directory existed on this base. The initial P0B commit adds `.github/workflows/ci.yml` as the CI baseline: push to `main` and `pull_request`, Ubuntu runner, independent Node 20/22 matrix jobs, npm cache, then `npm ci`, `npm run check`, and `npm test`. It declares only `actions/checkout@v4` and `actions/setup-node@v4`, sets `permissions: contents: read`, and disables checkout credential persistence. The CI workflow configures no secrets, migrations, additional token, or deploy step. Independently, the existing Vercel integration deploys branch Previews, including this PR’s initial head; its Preview variables and protection remain unverified (Question 9). Matrix major versions can resolve different patch versions from the local versions recorded here.

Action inputs were checked against the official [setup-node v4 README](https://github.com/actions/setup-node/blob/v4/README.md) and [checkout v4 README](https://github.com/actions/checkout/blob/v4/README.md). YAML parsing and contract checks are recorded in the PR handoff. GitHub CI results and the tested head are recorded in the PR description and final handoff; the separate Vercel Preview deployment evidence is recorded in Deploy plan and capacity above. Adding a workflow does not itself make it a required branch-protection check.

## Access matrix

Sources and line references below are from the recorded base unless absolute. “Documented” is not a live IAM audit. The current GitHub session was checked with `gh auth status` (account line only retained); Vercel/Neon/provider memberships and scopes were not inspected (Question 8).

| Principal | Surface | Documented or observed level | Source line |
| --- | --- | --- | --- |
| Human / RoyalBadger | GitHub | Repository owner; human merges; documented admin bypass | `/home/dev/agent-teams/docs/runbooks/agent-identities.md:73–85` |
| Codex / `rb-codex-agents[bot]` | GitHub | App installed on this repo; Contents, Pull requests, Issues write; Metadata read; observed current gh login and session commit identity | Same runbook `:9,13,49,69–71`; local `gh auth status` |
| Claude / `rb-claude-agents[bot]` | GitHub | Separate vendor App with same documented scopes; independent real review states | Same runbook `:10,13,69–70` |
| Antigravity / `rb-agy-agents[bot]` | GitHub | Third vendor App with same documented scopes | Same runbook `:11,13` |
| GitHub Actions | GitHub | Default `GITHUB_TOKEN`, contents read only in this workflow | `.github/workflows/ci.yml:8–9` |
| Owner/operator | Vercel | Setup/project-env and operational access implied by documented procedures; exact current membership/role unknown | `DEV.md:3–9,100–120`; `PROJECT_STATUS.md:52,184–185` |
| Vercel app runtime | Neon | `DATABASE_URL` supplied by integration; SQL pool via pg; database role privileges unknown | `DEV.md:5–7,71`; `lib/db.js:8–18` |
| Owner/operator | Neon | Provisioning/migration/test-branch operations documented; exact account and DB roles unknown | `DEV.md:5–16,30–59,102–113` |
| Vercel app runtime / owner | Stripe | `STRIPE_SECRET_KEY` for payment APIs; `STRIPE_PUBLISHABLE_KEY` is public; status records sandbox keys pending launch, not independently verified now | `DEV.md:72–73,83–88`; `PROJECT_STATUS.md:25–31,52` |
| Vercel app runtime / owner | Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` in project envs for OTP; current console access unknown | `DEV.md:75,128–129`; `PROJECT_STATUS.md:45–48,52` |
| Restaurant-PC print agent | Print agent / orders API | Shared `PRINT_AGENT_TOKEN` via `X-Print-Token`; polls orders, updates heartbeat and acknowledges printing; local config holds token | `DEV.md:78`; `print-agent/README.md:19–23,79–82`; `api/admin/orders.js:6–10,34–66` |
| Owner/admin and family | Manager portal | Email/password + TOTP, sessions/audit; family routine menu/order settings via portal login only; no repo/Vercel/Neon/Stripe credentials | `PROJECT_STATUS.md:21–24,182–201`; `db/migrations/001_init.sql` admin tables |
| Owner/operator / runtime | Google Routes; optional change-request webhook | `GOOGLE_MAPS_API_KEY`; `CHANGE_REQUEST_WEBHOOK`; ownership/scopes beyond documented setup unknown | `DEV.md:79–80,124–129` |
| This Platform task | Vercel / Neon / Stripe / Twilio | Repository inspection only; no provider credential or service operation authorized | `/home/dev/.herdr-mail/p0b-brief.md`; Platform POS assignment, Tools and access |

The identity runbook records three Apps and `main` protection enabled 2026-09-29: **one approving review**, dismissal of stale approvals, no required status checks at that time, and `enforce_admins: false`. Different vendor identities let reviewers submit actual APPROVE/REQUEST_CHANGES states; the author's own App cannot approve its PR. This inventory does not assert current protection settings from an API read.

Other documented knobs are `GOOGLE_MONTHLY_CAP`, `GOOGLE_DAILY_CAP`, and `OTP_DAILY_CAP` (`DEV.md:76–81`); these are configuration names, not credentials. `db/create-admin.mjs` uses local `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_ROLE` for provisioning. No secret values are included here. `.env.local` and `.vercel/` are absent from this clone; `git check-ignore .env.local .vercel/` returned both paths, consistent with `.gitignore:2–4,7–8`. Actual grants, test/live modes, rotation custodians, preview isolation and any omitted operators need Question 8.

## Tooling versions

Sources: executed version commands, `package.json:16`, `package-lock.json:17–18`, the gitleaks history scan, and the read-only devvm gate script named below.

| Tool | Observed version/source |
| --- | --- |
| Selected Node | `v20.20.2`, `/home/dev/.local/opt/node-v20.20.2-linux-x64/bin/node` |
| Selected npm | `10.8.2` under the Node 20 PATH |
| Default Node | `v22.23.2`, `/usr/bin/node` |
| Default npm | `12.1.0` under `/usr/bin` PATH |
| pg | **8.23.0** resolved by `package-lock.json`; `package.json` declares **^8.13.1**. The brief's claim of 8.13.1 in the lockfile is stale. |
| gitleaks | `8.30.1`, `/home/dev/.local/bin/gitleaks` |

On the unchanged base, `gitleaks detect --source . --no-banner --redact` returned exit 0:

```text
3:53AM INF 121 commits scanned.
3:53AM INF scanned ~1218467 bytes (1.22 MB) in 343ms
3:53AM INF no leaks found
```

This command scans Git history; it does not certify provider environments or all ignored/untracked files. The final committed changes are scanned again in the handoff.

`bash /home/dev/agent-teams/scripts/devvm-check.sh` returned exit 0, with the default Node PATH:

```text
| Check            | State | Observed |
|------------------|-------|----------|
| gitleaks         | PASS | /home/dev/.local/bin/gitleaks: 8.30.1 |
| Node 20          | PASS | default=/usr/bin/node: v22.23.2; Node 20=/home/dev/.local/opt/node-v20.20.2-linux-x64/bin/node: v20.20.2 |
| python3          | PASS | Python 3.12.3 |
| GitHub auth      | PASS | gh auth status exit=0 |
| Herdr            | PASS | installed=herdr 0.8.2; protocol=0.8.2 |
| room checkout    | PASS | /home/dev/.local/bin/room -> /home/dev/Herdr/bin/room; HEAD=5013132fdde9476d7d68eccc0a81227b74225ce0 contains e7619dc; tracked tree=clean; index flags=none; clean means HEAD's code runs; guards accidents/leftover sparse or index flags, not tamper resistance; local descendant commits allowed |
| room wait        | PASS | room wait --help exit=0 |
```

No tooling installation or version adjustment was needed. The gate's Herdr version and room-help probes were run as part of the expressly requested check; no peer dispatch was performed. Tooling health is not a restore or deployed-capacity gate.

## Questions for the human

1. **Question 1 — Vercel plan today / Step 0:** Is this project's current plan Hobby or Pro, and has the approved Pro step been completed? Why: the 12 route files exhaust the documented Hobby cap and F7 requires Pro before any POS route. Closes with a dated project/team plan export or screenshot and explicit confirmation of the Pro decision/completion; no credentials needed.
2. **Question 2 — Neon plan:** Which Neon project serves this Vercel project and what plan is it on today? Why: plan-dependent capacity cannot be inferred from the integration. Closes with dated project identification and plan/tier evidence, with connection strings redacted.
3. **Question 3 — History retention and point-in-time restore:** What history-retention setting and actual earliest/latest restorable times apply to the relevant Neon branches? Why: application PII scrubbing is unrelated to recoverability, and the later pilot restore gate needs a known window. Closes with dated retention/PITR settings and available-window evidence; a later non-production restore rehearsal still needs separate evidence.
4. **Question 4 — Branch quota and existing branches:** What branch quota applies, how much is used, and which branches/parents currently exist for production, development and previews? Why: isolated testing and restore rehearsals need spare branches and an unambiguous parent. Closes with a dated branch inventory and quota/usage evidence, identifying intended test/preview parents.
5. **Question 5 — Compute size and autosuspend:** What compute sizes/min–max autoscaling, autosuspend settings, and connection limits apply to the relevant Neon endpoints? Why: cold starts, concurrent serverless pools and POS load need verified headroom. Closes with dated endpoint settings including sizes, autosuspend delay, connection limits and pooled/unpooled usage (no URLs).
6. **Question 6 — Postgres version:** What Postgres major/minor version is the project running? Why: migrations, extensions and restore compatibility must use the actual engine version. Closes with dated console/version output supplied by the human, without credentials.
7. **Question 7 — Deployed build and Vercel limits:** Are build/output settings and function size, duration and regions at defaults, or overridden? Which commit and runtime are deployed? Why: source layout alone does not prove the packaged function count or effective limits. Closes with a dated deployment URL/commit, build output/function manifest, runtime, effective size/duration/region limits, and project overrides or an explicit defaults confirmation tied to the current plan.
8. **Question 8 — Access-model omissions:** Does the recorded access model omit any person, service, vendor grant, recovery custodian or environment? Why: safe preview/production separation and independent reviews need actual ownership and grants. Closes with a dated redacted access matrix for GitHub/branch protection, Vercel, Neon roles, Stripe test/live, Twilio, Google/webhooks, print-agent token custody and manager-portal roles; confirm environment isolation and whether the family still has portal-only access. Include approved exceptions or explicitly confirm there are none; never send secret values.
9. **Question 9 — Preview environment and pre-review deployments:** Which variables are in Vercel Preview scope, including branch-specific overrides: does `DATABASE_URL` target the production Neon branch or a separate branch, are Stripe keys test or live, and which Twilio account/service is used? Is Vercel deployment protection enabled for Previews, and should agent branches deploy Previews at all before review? Why: each push deploys unreviewed code under those variables, potentially reaching production data or live services; deployment protection and a branch policy must be verified separately from CI. Closes with a dated redacted Preview variable-scope inventory (names, target environments and modes only; no values), identification of the Neon branch and isolation, Stripe/Twilio modes and targets, evidence of the Preview protection setting, and the human’s explicit decision on pre-review agent-branch deployment including any branch exclusions. Until supplied, Preview isolation and capacity confirmation remain unmet.

## Done-when

| P0B condition | Result |
| --- | --- |
| Baseline tests green on main | **Met** at `1cd14a68cc2ad6d6c97b195d3795ec2a71d5552a`: Node 20.20.2, npm ci/test/check all exit 0, nine test files / 187 assertion/check invocations. Node 22 is a second passing data point. |
| Capacity confirmed | **Not met.** Human evidence for Questions 1–9 remains outstanding; deployed build limits, Vercel plan, Neon retention/branches/compute/version, and Preview environment isolation/protection and branch policy are unverified. |

The report and CI baseline are ready for independent review. P0B overall remains open until the human evidence closes capacity, including Question 9. Pushing the branch causes the existing Vercel integration to deploy a Preview before review; the CI workflow itself has no deploy step. Production release, POS routes, production restore, pilot and charges remain separate human gates.
