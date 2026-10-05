# P0B foundation inventory

The existing suite is green on the recorded `main` commit under Node 20, with Node 22 as a second passing baseline. **Capacity confirmed is not met:** the remaining decision and evidence gaps are listed in Done-when. Updated 2026-10-04 with the human's dated answers and three redacted dashboard reports: Vercel Pro, 12 built functions on Node 24.x, and Neon settings are now evidenced. Current login-protected Previews share the production database branch. The original repository baseline below remains historical; the dated Q1–Q9 evidence and appendix record the later account reads, including two version-only SQL queries. No restore rehearsal was performed.

## Base

Inventoried on 2026-10-01 UTC in `/home/dev/worktrees/tyt-p0b`, branch `codex/p0b-foundation-inventory`. Before any edits, `git status --short` was empty and `git rev-parse HEAD main` printed:

```text
1cd14a68cc2ad6d6c97b195d3795ec2a71d5552a
1cd14a68cc2ad6d6c97b195d3795ec2a71d5552a
```

Selected Node with `export PATH=/home/dev/.local/opt/node-v20.20.2-linux-x64/bin:$PATH`; `node --version` printed `v20.20.2`. `package.json:6–7` requires `>=20`. The 2026-10-04 evidence now confirms production at `fdba3389bb8497a48baffe12512dcae73ff0869d`, Node 24.x (Question 7). The original test/CI baseline remains Node 20/22; the Preview deployment of the initial inventory PR is recorded below.

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

The tree supplies static files at the root (including `index.html`, `manager.html`, `insert.html`, `privacy.html`, and `sms-optin-proof.html`) and image assets. There is no package build script. `vercel.json` sets version 2, clean URLs, and no trailing slash; it supplies no build-command/output-directory, function size, duration, or region override. `.vercelignore` excludes `print-agent`, which is intended to run on the restaurant PC. These facts describe the expected static-plus-serverless layout; the later dashboard reads confirm unchecked build overrides and actual deployed output of 12 functions and 87 static assets (Question 7 and appendix).

The repository's Vercel Git integration builds and deploys a **Preview of every pushed development/agent branch**, independently of this CI workflow and before any review. `vercel.json` contains no `git.deploymentEnabled` override. PR #5's initial push demonstrated that behavior: its [Vercel check](https://vercel.com/tytmktg/tomyumthai-staging/HyoXoursBgauSNQgHExVATdodmVU) reported `Deployment has completed`. GitHub's deployments record for that exact head confirms the creator, Preview environment and creation time (read on 2026-10-02):

```text
$ gh api 'repos/RoyalBadger/tomyumthai-staging/deployments?sha=58e0dbb95d1de53035bdba81855cfbc02b06ff37' --jq '.[] | {created_at, creator: .creator.login, environment}'
{"created_at":"2026-10-02T03:07:21Z","creator":"vercel[bot]","environment":"Preview"}
exit=0

$ gh pr checks 5 --repo RoyalBadger/tomyumthai-staging (Vercel row)
Vercel  pass  0  https://vercel.com/tytmktg/tomyumthai-staging/HyoXoursBgauSNQgHExVATdodmVU  Deployment has completed
```

Each Preview is a deployment and is subject to the per-deployment function cap; Preview deployment does not provide extra function slots. Code on an unreviewed agent branch runs under the Preview environment's variables. The 2026-10-04 reads establish that Preview DATABASE_URL targets production main and Vercel Authentication / Standard Protection is enabled. Stripe secret-key mode remains unconfirmed; the pre-review deployment policy remains the human's decision (Question 9). No absence of secrets or deploy steps in CI establishes Preview isolation. The GitHub record proves this Preview occurred; the later dashboard evidence confirms Preview tracks all unassigned branches, with no environment-variable git-branch overrides (Question 9).

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

All 12 export a default request handler, including the two wrapped by `requireAdmin`; none is a helper-only file. Shared code lives in `lib/`, outside `api/`. The source-file count alone does not prove deployment output; the 2026-10-04 Deployment Summary and Resources reads independently confirm all 12 built functions (Question 7 and appendix).

The status document’s header is dated **2026-09-06**, with entries through September 9. `PROJECT_STATUS.md:77–80` records a Hobby cap of **12 functions per deployment**, says “consolidated to 11” under September 1, and pre-approves Pro if needed. The September 6 entry at `PROJECT_STATUS.md:196` correctly says 12 functions. The latest cap statement is `PROJECT_STATUS.md:239`, under September 9: the print endpoint lives inside `api/admin/orders.js` because of the 12-function cap. Against that recorded cap, this checkout has **zero spare function slots: no new POS route fits on Hobby**. `/home/dev/agent-teams/docs/pos-first-assignment.md`, F7 and Step 0, require **Vercel Pro before any POS route**. That Hobby comparison is historical. The human's 2026-10-03 Pro confirmation and the 2026-10-04 General/Functions reads now establish the Pro step; effective deployed settings are in Questions 1 and 7. Capacity confirmation still awaits the remaining items in Done-when.

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

Neon is provisioned through the Vercel integration, which injects `DATABASE_URL` (`DEV.md:5–7,71`). The 2026-10-04 reads establish Free plan, six-hour retention, one of ten branches, fixed 0.25 CU compute and PostgreSQL 18.6; Questions 2–6 give exact sources and limits. Exact restore bounds were not exposed, and no restore was attempted.

The only documented branch practice is `DEV.md:25–59` (PR #4): create a temporary branch from the intended development parent with read-write compute; verify the temporary branch/database/role when copying its connection string; retain SSL options; enter it at a hidden prompt inside a subshell as `DATABASE_URL`; run `npm test`; then delete only that temporary branch even on failure. The current suite does not consume that database connection. This practice is not evidence of automatic per-PR isolation or a successful database test/restore.

## CI baseline

`git ls-tree -r --name-only main .github docs` returned no paths: neither directory existed on this base. The initial P0B commit adds `.github/workflows/ci.yml` as the CI baseline: push to `main` and `pull_request`, Ubuntu runner, independent Node 20/22 matrix jobs, npm cache, then `npm ci`, `npm run check`, and `npm test`. It declares only `actions/checkout@v4` and `actions/setup-node@v4`, sets `permissions: contents: read`, and disables checkout credential persistence. The CI workflow configures no secrets, migrations, additional token, or deploy step. Independently, the existing Vercel integration deploys branch Previews, including this PR’s initial head; its Preview variables and protection are now documented in Question 9. CI remains Node 20/22 while deployed functions use Node 24.x. Matrix major versions can resolve different patch versions from the local versions recorded here.

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

Other documented knobs are `GOOGLE_MONTHLY_CAP`, `GOOGLE_DAILY_CAP`, and `OTP_DAILY_CAP` (`DEV.md:76–81`); these are configuration names, not credentials. `db/create-admin.mjs` uses local `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `ADMIN_ROLE` for provisioning. No secret values are included here. `.env.local` and `.vercel/` are absent from this clone; `git check-ignore .env.local .vercel/` returned both paths, consistent with `.gitignore:2–4,7–8`. Question 8 records the human's confirmation of no omissions and family portal-only access; it is not an independent grant/custodian audit. Question 9 records the observed shared Preview database and remaining provider-mode gaps.

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

   **Answer — 2026-10-03 UTC:** “I'm upgraded to pro.”

   **Evidence — `p0b-vercel-read-codex-p0b-vercel.md`, 2026-10-04 01:05:41 UTC:** General and Functions show TYTMKTG on **Pro**. No billing-specific export was collected. Q1 closed.

2. **Question 2 — Neon plan:** Which Neon project serves this Vercel project and what plan is it on today? Why: plan-dependent capacity cannot be inferred from the integration. Closes with dated project identification and plan/tier evidence, with connection strings redacted.

   **Answer — 2026-10-03 UTC:** “Free plan for now until go live with website.” The supplied Vercel Storage screenshot identifies database `neon-purple-ferry`, Neon project `royal-block-63167414`, connected project `tomyumthai-staging`.

   **Evidence — `p0b-neon-read-codex-p0b-neon.md`, 2026-10-04 01:20:40; 01:21:30; 01:21:56; 01:22:31 UTC:** Overview, Billing, project API and General settings confirm **Free**, organization **Vercel: TYTMKTG**, subscription managed by Vercel, region **AWS US East 2 (Ohio)** (`aws-us-east-2`). Q2 closed.

3. **Question 3 — History retention and point-in-time restore:** What history-retention setting and actual earliest/latest restorable times apply to the relevant Neon branches? Why: application PII scrubbing is unrelated to recoverability, and the later pilot restore gate needs a known window. Closes with dated retention/PITR settings and available-window evidence; a later non-production restore rehearsal still needs separate evidence.

   **Answer — 2026-10-03 UTC:** The human pasted Neon documentation limits: Free = 6 hours default and maximum, capped at 1 GB of history; Launch = 1 day default, 7 days maximum; Scale = 1 day default, 30 days maximum. These are human-supplied documentation excerpts, not independent dashboard findings.

   **Evidence — `p0b-neon-read-codex-p0b-neon.md`, 2026-10-04 01:20:40; 01:21:06; 01:21:25–01:21:27; 01:21:56–01:21:57 UTC:** Postgres settings, Backup & Restore and project/limits APIs confirm **6 hours**, `history_retention_seconds=21600`, also the project maximum. Overview Usage shows storage **33.75 MB**, history **268.51 kB**. The human-supplied 1 GB history cap was not independently established by the dashboard; `history_size_bytes=0` has unverified semantics.

   **Evidence — `p0b-close-read-codex-p0b-close.md`, 2026-10-04 03:12:57; 03:13:44; 03:14:17.963 UTC:** Backup & Restore and its timestamp picker expose no exact earliest/latest restorable timestamps. Calendar-day boundaries are not restore bounds. Retention setting closed; exact bounds unavailable in the inspected UI. A restore rehearsal remains a separate later pilot gate, constrained by the six-hour window.

4. **Question 4 — Branch quota and existing branches:** What branch quota applies, how much is used, and which branches/parents currently exist for production, development and previews? Why: isolated testing and restore rehearsals need spare branches and an unambiguous parent. Closes with a dated branch inventory and quota/usage evidence, identifying intended test/preview parents.

   **Answer — 2026-10-03 UTC:** The human pasted Neon documentation limits: Free = 10 branches per project, 3 root branches; the DEFAULT branch is the production branch and default parent for previews; protected branches are paid-plan only; schema-only branches and branch expiry exist.

   **Evidence — `p0b-neon-read-codex-p0b-neon.md`, 2026-10-04 01:21:04–01:21:06; 01:21:57 UTC:** Branches, General settings and branches/limits APIs show exactly one branch: `main` (`br-broad-tree-axkb931p`), root (no parent), DEFAULT, unprotected, expiry Never, created **2026-08-30 21:08:39 UTC**. Usage **1 of 10 branches**, **1 of 3 roots**, protected-branch maximum 0. No preview branches exist. Default parent is main if omitted; an intended isolated test/preview parent is not a human decision established by this read. Inventory and quota closed; preview policy is Q9.3.

5. **Question 5 — Compute size and autosuspend:** What compute sizes/min–max autoscaling, autosuspend settings, and connection limits apply to the relevant Neon endpoints? Why: cold starts, concurrent serverless pools and POS load need verified headroom. Closes with dated endpoint settings including sizes, autosuspend delay, connection limits and pooled/unpooled usage (no URLs).

   **Answer — 2026-10-03 UTC:** Free-plan features pasted by the human: “Autoscale to 2 CU”, “Up to 100 projects”.

   **Evidence — `p0b-neon-read-codex-p0b-neon.md`, 2026-10-04 01:21:08; 01:21:25; 01:21:57; 01:22:13; 01:24:26 UTC:** Computes Edit/Connect, Postgres settings and endpoints/limits APIs show one read/write endpoint `ep-round-rice-axy3k1uk` on main, fixed **0.25–0.25 CU** (no effective autoscaling range), scale-to-zero after **5 minutes**, **105 direct / 10,000 pooled connections**. Free allows 2 CU, but this endpoint is not configured to scale there. Connect has pooling checked; endpoint API separately returns `pooler_enabled=false`, `pooler_mode=transaction`. Preserve both observations; connectivity was not tested. Raw `suspend_timeout_seconds=0` is not interpreted as disabled because the UI shows the effective five-minute default.

   **Evidence — `p0b-vercel-read-codex-p0b-vercel.md`, 2026-10-04 01:08:47; 01:09:20 UTC:** Environment Variables confirms DATABASE_URL uses the pooled endpoint label. Actual equality of the unpooled counterparts' stored endpoints remains unverified; their names alone are not proof (source: `p0b-neon-read-codex-p0b-neon.md`, 2026-10-04 01:21:57 UTC, unpooled-counterpart row). Q5 settings closed.

6. **Question 6 — Postgres version:** What Postgres major/minor version is the project running? Why: migrations, extensions and restore compatibility must use the actual engine version. Closes with dated console/version output supplied by the human, without credentials.

   **Answer — 2026-10-03 UTC:** “Unknown postgres.”

   **Evidence — `p0b-close-read-codex-p0b-close.md`, 2026-10-04 03:13:36; 03:13:39 UTC:** SQL Editor on main / Default, Primary compute, neondb: `SELECT version();` returned **PostgreSQL 18.6 (4e955f5) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit**; `SHOW server_version;` returned **18.6 (4e955f5)**. Q6 closed.

7. **Question 7 — Deployed build and Vercel limits:** Are build/output settings and function size, duration and regions at defaults, or overridden? Which commit and runtime are deployed? Why: source layout alone does not prove the packaged function count or effective limits. Closes with a dated deployment URL/commit, build output/function manifest, runtime, effective size/duration/region limits, and project overrides or an explicit defaults confirmation tied to the current plan.

   **Answer — 2026-10-03 UTC:** “Defaults, and I haven't checked which commit is live.”

   **Evidence — `p0b-vercel-read-codex-p0b-vercel.md`, 2026-10-04 01:07:17–01:07:28; 01:08:14; 01:09:36 UTC:** Current / Latest / Ready production deployment `7LVxBhUZbbk38YkAPSdjp4uVR3Wz` is main commit `fdba3389bb8497a48baffe12512dcae73ff0869d`. Deployment Summary and Resources confirm **12 functions from built output**, 87 static assets, no framework detected. All functions run **Node.js 24.x**, IAD1, **≤300s**; artifact sizes are reproduced in the appendix. The original local/CI baseline is Node **20/22**, not deployed-runtime validation on 24.x; this change does not alter CI.

   **Evidence — `p0b-vercel-read-codex-p0b-vercel.md`, 2026-10-04 01:07:02; 01:07:17; 01:07:52; deployment metadata 01:08:13 UTC:** Build and Deployment / Functions: build, output, install and development overrides unchecked; Ignored Build Step Automatic; Standard **1 vCPU / 2 GB**, Fluid Compute enabled, default region iad1, failover disabled. The duration input is empty; the deployed ≤300s limits above are the actual output evidence. Current build-machine setting inherits Team (Elastic); historical deployment metadata reports plan-default basic, fixed, 2 cores / 8192 MB. Q7 closed.

8. **Question 8 — Access-model omissions:** Does the recorded access model omit any person, service, vendor grant, recovery custodian or environment? Why: safe preview/production separation and independent reviews need actual ownership and grants. Closes with a dated redacted access matrix for GitHub/branch protection, Vercel, Neon roles, Stripe test/live, Twilio, Google/webhooks, print-agent token custody and manager-portal roles; confirm environment isolation and whether the family still has portal-only access. Include approved exceptions or explicitly confirm there are none; never send secret values.

   **Answer — 2026-10-03 UTC:** “No omissions, family only.” The human confirms the recorded matrix is complete, family access is portal-only, and names no exceptions.

   **Evidence — `p0b-answers-brief.md`, Table 1, human answer dated 2026-10-03 UTC:** This is the human's confirmation. No dashboard evidence was sought for Q8; there is no dashboard read time. Q8 closed without implying a live IAM audit.

9. **Question 9 — Preview environment and pre-review deployments:** Which variables are in Vercel Preview scope, including branch-specific overrides: does `DATABASE_URL` target the production Neon branch or a separate branch, are Stripe keys test or live, and which Twilio account/service is used? Is Vercel deployment protection enabled for Previews, and should agent branches deploy Previews at all before review? Why: each push deploys unreviewed code under those variables, potentially reaching production data or live services; deployment protection and a branch policy must be verified separately from CI. Closes with a dated redacted Preview variable-scope inventory (names, target environments and modes only; no values), identification of the Neon branch and isolation, Stripe/Twilio modes and targets, evidence of the Preview protection setting, and the human’s explicit decision on pre-review agent-branch deployment including any branch exclusions. Until supplied, Preview isolation and capacity confirmation remain unmet.

   **Answer — 2026-10-03 UTC:** “I'm not sure. Lets plan to use playwright to find out.”

   **Evidence — `p0b-vercel-read-codex-p0b-vercel.md`, 2026-10-04 01:08:47; 01:09:20 UTC:** **Q9.1 scopes:** Environment Variables returns **23 names / 33 target records**, no git-branch overrides. Each integration-created DATABASE_* variable has one record spanning Production, Preview and Development. Twilio and Google keys show Production/Preview sensitive and Development encrypted; the full name/type inventory is in the appendix. No STRIPE_PUBLISHABLE_KEY variable is listed. Preview STRIPE_SECRET_KEY is sensitive and its test/live prefix could not be established.

   **Evidence — `p0b-neon-read-codex-p0b-neon.md`, 2026-10-04 01:21:08; 01:21:57 UTC:** **Q9.1 database mapping:** Computes and endpoint/branch APIs map the pooled label to `ep-round-rice-axy3k1uk`, owned by main, the DEFAULT branch.

   **Evidence — `p0b-close-read-codex-p0b-close.md`, 2026-10-04 03:12:48–03:12:51; 03:15:30; 03:16:05; 03:16:56; 03:17:25 UTC:** **Q9.1 isolation:** Vercel Storage Projects / Update Project Connection lists exactly one connection, tomyumthai-staging, All Environments, DATABASE prefix. Create Database Branch For Deployment is unchecked for both Preview and Production. Combined with the shared DATABASE_URL record and endpoint mapping, **current Previews, including agent branches, use the production database branch main**. This closes the prior reports' missing toggle/binding evidence; it does not authorize that policy.

   **Evidence — `p0b-close-read-codex-p0b-close.md`, 2026-10-04 03:15:35 UTC:** **Q9.1 Stripe records:** Environment Variables metadata confirms three distinct STRIPE_SECRET_KEY records: Production sensitive, Preview sensitive, Development encrypted, none with a git-branch override. Record separation does not establish value equality or mode.

   **Evidence — `p0b-close-read-codex-p0b-close.md`, 2026-10-04 03:20:28; 03:20:39; 03:21:13; 03:21:29 UTC:** **Q9.1 Stripe account:** My Little Thai Chef, LLC DBA Tom Yum Thai Restaurant (account ending 4Zd0) has standard publishable and secret keys in test and live mode. Both Workbench Webhooks views show no endpoint rows. Dashboard key presence does not establish the deployed secret-key mode.

   **Evidence — repository `fdba3389bb8497a48baffe12512dcae73ff0869d`, `lib/stripe.js:3–8`, `DEV.md:72`, checked for this 2026-10-04 update; paired with `p0b-vercel-read-codex-p0b-vercel.md`, 2026-10-04 01:08:47 UTC:** With no STRIPE_PUBLISHABLE_KEY environment variable, this code uses its hard-coded test publishable-key fallback. DEV says “test key first (`sk_test_…`), live at launch”. Thus the recorded code/configuration selects a test publishable key in each scope. Secret-key mode is **inferred test, unconfirmed**: a successful checkout with that publishable key would require a matching test secret, but this task has no successful-checkout evidence and has not read the sensitive secret. The deployed `/api/stripe-webhook` has no registered Stripe destination and therefore receives no configured Stripe deliveries. The client deliberately authenticates by re-fetching Stripe objects, without a signing secret. Record this as a **Ledger / Integration finding, not a P0B item**; no fix or charge was attempted.

   **Evidence — `p0b-close-read-codex-p0b-close.md`, 2026-10-04 03:12:19 UTC:** **Q9.1 Twilio:** Console redirected to login, so account, Verify-service and sender inventories remain optional and unread. The Vercel report above establishes variable presence in all three scopes, not account/service identity.

   **Evidence — `p0b-vercel-read-codex-p0b-vercel.md`, 2026-10-04 01:06:15; 01:07:57 UTC:** **Q9.2 protection:** Deployment Protection shows Vercel Authentication / Require Log In, Standard Protection. Password and Trusted IP unchecked; no exceptions or bypass secrets; Allow OPTIONS Requests unchecked. Anonymous access to a deployed Preview URL was not tested. Setting closed.

   **Evidence — `p0b-vercel-read-codex-p0b-vercel.md`, 2026-10-04 01:07:02; 01:07:17; 01:09:02 UTC:** **Q9.3 deployment facts:** Git createDeployments enabled, Preview tracks all unassigned git branches, production branch main, no deploy hooks, Ignored Build Step Automatic. Six Ready agent-branch previews are named in the appendix. **Human decision still required: should agent branches deploy Previews before review, given login protection and shared production main on fixed 0.25 CU?** No policy recommendation or approval is inferred.

## Done-when

| P0B condition | Result |
| --- | --- |
| Baseline tests green on main | **Met** at `1cd14a68cc2ad6d6c97b195d3795ec2a71d5552a`: Node 20.20.2, npm ci/test/check all exit 0, nine test files / 187 assertion/check invocations. Node 22 is a second passing data point. |
| Capacity confirmed | **Not met.** Remaining: (1) **Q9.3 human decision** — should agent branches deploy Previews before review given Vercel login protection and shared production main on fixed 0.25 CU? (2) **Stripe secret-key mode** — inferred test, unconfirmed. (3) **Stripe webhook finding** — deployed route, no registered destination in either mode; for Ledger / Integration, **not a P0B item**. (4) **Twilio account / Verify-service inventory** — optional, unread. (5) **Restore evidence** — exact bounds not exposed; six-hour retention is the constraint, and the non-production rehearsal is the later pilot gate. Capacity approval remains the human's call. |

The dated answers and dashboard appendix are ready for independent review. P0B overall remains open pending the remaining confirmation and human capacity decision, including Q9.3. Pushing the branch causes the existing Vercel integration to deploy a Preview before review; the CI workflow itself has no deploy step. Production release, POS routes, production restore, pilot and charges remain separate human gates.

## Dashboard evidence, 2026-10-04

The following tables reproduce the three source reports’ finding tables, environment inventory and function output verbatim, with their original redaction. Reports live outside this repository; the tables and source-page descriptions below are self-contained. Times are UTC on 2026-10-04. Earlier “not found” rows are historical observations: the close read later establishes the PostgreSQL minor version and Vercel connection settings; the Q1–Q9 synthesis above records which gaps remain. No environment values, full connection hosts/strings, keys, tokens, cookies or screenshots are included.

### Vercel

Source report: `p0b-vercel-read-codex-p0b-vercel.md`.

Collected by codex-p0b-vercel through Playwright Core attached to the human’s laptop Chrome, read-only, approximately 01:05–01:10 UTC. No account settings changed, deployments triggered or tokens created by the inspection.

Times below are UTC on 2026-10-04. Page abbreviations are linked below. Dashboard API reads were executed inside the authenticated browser; only selected metadata and allowed secret classifications left browser memory. No secret values, cookies, tokens, screenshots, or raw API response files were recorded.

| Item | Status | Read time UTC | Redacted finding | Source page |
|---|---|---|---|---|
| Q1 plan | found | 01:05:41 | TYTMKTG displays **Pro**. Functions page independently describes the current Pro plan. Billing-specific export not collected. | General; Functions |
| Q7 current production | found | 01:07:17–01:07:28 | Current / Latest / Ready deployment `7LVxBhUZbbk38YkAPSdjp4uVR3Wz`; main commit **fdba3389bb8497a48baffe12512dcae73ff0869d**, “P0B: foundation inventory and CI baseline (#5)”. | Deployment; project metadata API |
| Q7 deployed runtime | found | 01:09:36 | All 12 deployed functions show **Node.js 24.x**. Current project Node selector also selects 24.x. | Resources; Build and Deployment |
| Q7 function count | found | 01:08:14; 01:09:36 | Deployment Summary: Functions All (12), Static Assets All (87), no framework detected. Resources confirms 12 functions (listed below). Evidence is built deployment output, not a repository file count; raw build logs were not exported. | Deployment Summary; Resources |
| Q7 function size / CPU | found | 01:07:52 | Current Functions selection **Standard: 1 vCPU / 2 GB memory**; Performance unselected. Fluid Compute enabled. Deployed artifact sizes 77.8–96.3 kB, detailed below. | Functions; Resources |
| Q7 duration | found | 01:07:52; 01:09:36 | Project Default Max Duration input is empty (no explicit value in this control). All 12 deployed functions show **≤300s**. Do not infer every possible code override from the empty project field; actual deployed limits are confirmed. | Functions → Advanced Settings; Resources |
| Q7 region | found | 01:07:17; 01:09:36 | Project function default region **iad1**; every deployed function shows IAD1. Function Failover disabled. | Functions; project metadata API; Resources |
| Q7 build overrides | found | 01:07:02 | Build / Output / Install / Development override checkboxes all unchecked. Ignored Build Step selects Automatic. Current build-machine selection inherits Team (Elastic); the deployed build metadata separately reports plan-default basic, fixed, 2 cores / 8192 MB. These describe current settings and historical deployment respectively. | Build and Deployment; deployment metadata API |
| Q9.1 env inventory / scopes | found | 01:08:47 | 23 unique names / 33 target records returned. Full list below. Every record has no gitBranch override; no pagination field returned. | Environment Variables; env metadata API |
| Q9.1 Preview DATABASE_URL | found | 01:08:47; 01:09:20 | Present for Production, Preview, Development in one record; no branch override. Pooled Neon endpoint label **ep-round-rice-axy3k1uk-pooler** (host label only; credentials and full host/URL omitted). | Environment Variables; individual env read via browser |
| Q9.1 Neon human-readable branch | not found | 01:09:20 | Endpoint label is not a Neon branch name. Mapping to production/main/another branch needs the later Neon inspection; no branch identity inferred. | Environment Variables |
| Q9.1 Preview Stripe mode | blocked | 01:09:20 | STRIPE_SECRET_KEY exists for Preview as type sensitive. Single-variable read did not expose a recognizable sk_test/sk_live prefix. Mode remains unknown. No Stripe publishable-key variable appears in the returned project inventory; this does not establish whether application code obtains one elsewhere. | Environment Variables; individual env read via browser |
| Q9.1 Preview Twilio names | found | 01:08:47 | TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SID all present for Preview (sensitive), also Production (sensitive) and Development (encrypted). | Environment Variables |
| Q9.2 Preview protection | found | 01:06:15; 01:07:57 | Vercel Authentication: Require Log In checked, **Standard Protection** shown. Password and Trusted IP unchecked. No protection exceptions or bypass secrets listed; Allow OPTIONS Requests unchecked. Exact behavior of an anonymous deployed URL was not separately tested. | Deployment Protection |
| Q9.3 ignored build step | found | 01:07:02 | **Automatic** selected: page says Vercel skips commits with a previously deployed SHA. | Build and Deployment |
| Q9.3 deployment-enabled branches | found | 01:07:17; 01:09:02 | Git provider createDeployments=enabled. Environments: Preview tracks **All unassigned git branches**. Existing Ready previews include codex/p0b-foundation-inventory, agy/qa-pr2, agy/pos-order-entry, codex/a00-neon-fixture, codex/trial-seed-qa, codex/trial-seed-review. | Git; Environments; Deployments; project metadata API |
| Q9.3 production branch | found | 01:09:02 | **main**. Connected repository RoyalBadger/tomyumthai-staging; no deploy hooks listed. | Environments; Git |
| Q9.3 decision on previews before review | blocked | 01:09:02 | Human decision still required. Existing configuration allows previews on unassigned branches; this read does not approve that policy. | Environments; human answers brief |

#### Full environment-variable inventory

Source: [Environment Variables](https://vercel.com/tytmktg/tomyumthai-staging/settings/environment-variables), read 2026-10-04 01:08:47 UTC through `/api/v9/projects/tomyumthai-staging/env?slug=tytmktg`. All listed names found. P = Production, V = Preview, D = Development. “None” means gitBranch was absent/null in every returned record for the name. Values omitted.

| Name | Targets | Branch override | Storage type |
|---|---|---|---|
| `TWILIO_VERIFY_SID` | P, V, D | None | P/V sensitive; D encrypted |
| `TWILIO_AUTH_TOKEN` | P, V, D | None | P/V sensitive; D encrypted |
| `TWILIO_ACCOUNT_SID` | P, V, D | None | P/V sensitive; D encrypted |
| `GOOGLE_MAPS_API_KEY` | P, V, D | None | P/V sensitive; D encrypted |
| `STRIPE_SECRET_KEY` | P, V, D | None | P/V sensitive; D encrypted |
| `DATABASE_NEON_AUTH_BASE_URL` | P, V, D | None | encrypted |
| `DATABASE_POSTGRES_PASSWORD` | P, V, D | None | encrypted |
| `DATABASE_POSTGRES_URL_NO_SSL` | P, V, D | None | encrypted |
| `DATABASE_PGPASSWORD` | P, V, D | None | encrypted |
| `DATABASE_POSTGRES_USER` | P, V, D | None | encrypted |
| `DATABASE_PGHOST_UNPOOLED` | P, V, D | None | encrypted |
| `DATABASE_POSTGRES_PRISMA_URL` | P, V, D | None | encrypted |
| `DATABASE_POSTGRES_HOST` | P, V, D | None | encrypted |
| `DATABASE_PGDATABASE` | P, V, D | None | encrypted |
| `DATABASE_URL_UNPOOLED` | P, V, D | None | encrypted |
| `DATABASE_PGUSER` | P, V, D | None | encrypted |
| `DATABASE_NEON_PROJECT_ID` | P, V, D | None | encrypted |
| `DATABASE_POSTGRES_DATABASE` | P, V, D | None | encrypted |
| `DATABASE_POSTGRES_URL` | P, V, D | None | encrypted |
| `DATABASE_URL` | P, V, D | None | encrypted |
| `DATABASE_VITE_NEON_AUTH_URL` | P, V, D | None | encrypted |
| `DATABASE_POSTGRES_URL_NON_POOLING` | P, V, D | None | encrypted |
| `DATABASE_PGHOST` | P, V, D | None | encrypted |

#### Deployed function output

Source: Resources, 2026-10-04 01:09:36 UTC. Every row: Node.js 24.x, IAD1, ≤300s.

| Function | Artifact size |
|---|---|
| /api/admin/login | 82.3 kB |
| /api/admin/menu | 85.3 kB |
| /api/admin/orders | 82.8 kB |
| /api/admin/settings | 81.9 kB |
| /api/distance | 83.1 kB |
| /api/health | 77.8 kB |
| /api/me | 84.6 kB |
| /api/menu | 82.1 kB |
| /api/menu-image | 78 kB |
| /api/order-status | 78.3 kB |
| /api/orders | 96.3 kB |
| /api/stripe-webhook | 82.1 kB |

#### Source pages

- [General](https://vercel.com/tytmktg/tomyumthai-staging/settings/general)
- [Functions](https://vercel.com/tytmktg/tomyumthai-staging/settings/functions)
- [Build and Deployment](https://vercel.com/tytmktg/tomyumthai-staging/settings/build-and-deployment)
- [Deployment Protection](https://vercel.com/tytmktg/tomyumthai-staging/settings/deployment-protection)
- [Git](https://vercel.com/tytmktg/tomyumthai-staging/settings/git)
- [Environments](https://vercel.com/tytmktg/tomyumthai-staging/settings/environments)
- [Deployments](https://vercel.com/tytmktg/tomyumthai-staging/deployments)
- [Current production Deployment / Summary](https://vercel.com/tytmktg/tomyumthai-staging/7LVxBhUZbbk38YkAPSdjp4uVR3Wz)
- [Current production Resources](https://vercel.com/tytmktg/tomyumthai-staging/7LVxBhUZbbk38YkAPSdjp4uVR3Wz/resources)
- Browser-authenticated project metadata: `/api/v9/projects/tomyumthai-staging?slug=tytmktg`, 01:07:17 UTC.
- Browser-authenticated deployment metadata: `/api/v13/deployments/dpl_7LVxBhUZbbk38YkAPSdjp4uVR3Wz?slug=tytmktg`, 01:08:13 UTC.

### Neon

Source report: `p0b-neon-read-codex-p0b-neon.md`.

Collected by codex-p0b-neon through the human’s laptop Chrome, read-only, 01:20–01:24 UTC (the final pooling observation is timestamped 01:24:26). No settings, branches, endpoints or data were changed; no SQL or restore was run.

Times below are UTC on 2026-10-04. Source-page abbreviations link to the pages below. API evidence is limited to browser-authenticated console metadata; no credentials or full connection hosts/strings are included.

| Item | Status | Read time UTC | Redacted finding | Source page |
|---|---|---|---|---|
| 1 / Q2 project and plan | found | 01:20:40; 01:21:30 | neon-purple-ferry, royal-block-63167414; **Free plan**, organization **Vercel: TYTMKTG**. Billing independently confirms Free. | Overview; Billing |
| 1 / Q6 region and major version | found | 01:20:40; 01:21:56 | **AWS US East 2 (Ohio)**, API region `aws-us-east-2`; **PostgreSQL 18**. | Overview; project API |
| 1 / Q6 minor version | not found | 01:20:40; 01:21:56 | Overview and project API expose only 18, not an 18.x minor version. No SQL was executed to discover it. | Overview; project API |
| 2 / Q3 history setting | found | 01:21:25–01:21:27; 01:21:56–01:21:57 | **6 hours**, API `history_retention_seconds=21600`; project maximum also 21600. Restore page confirms a six-hour window. | Settings → Postgres; Backup & Restore; project and limits APIs |
| 2 / Q3 earliest restorable time | not found | 01:21:27; 01:23:01; 01:24:04 | Neither inspected restore view showed an explicit earliest-restorable timestamp. Branch API did not return `oldest_available_timestamp`. The page's current point-in-time control is not proof of the earliest or latest restorable time. No restore or preview query was run. | Backup & Restore, both views; branch API |
| 3 / Q4 full branch inventory | found | 01:21:04–01:21:06; 01:21:57 | Exactly **one branch**, `main`, ID `br-broad-tree-axkb931p`; parent **none** (root; UI “-”); **DEFAULT=true**, **protected=false**, expiry **Never**. Created **2026-08-30 21:08:39 UTC** per API. The overview displayed 16:08:39 in the browser's local timezone. API pagination was empty. | Branches; General settings; Overview; branches API |
| 3 / Q4 integration-created previews | found | 01:21:06; 01:21:57 | **No preview branches exist** in the returned inventory, including no `preview/...` names. The sole branch's creator name is blank; exact creator attribution for `main` is not established by that field. The supplied Vercel evidence establishes integration creation of the project, not an independently readable per-branch creator. | Branches; branches API; prior Vercel report |
| 3 / Q4 quota | found | 01:21:57 | **1 of 10 branches**, **1 of 3 root branches**. Console limits API confirms 10 and 3; maximum protected branches is 0. Default parent is `main` when a new branch omits a parent. This does not decide the human's intended test/preview parent. | Branches; General settings; project limits API |
| 4 / Q5 all endpoints and size | found | 01:21:08; 01:21:57; 01:22:13 | Exactly **one endpoint**, `ep-round-rice-axy3k1uk`, read/write, belonging to `main`. Min **0.25 CU**, max **0.25 CU**, so there is **no effective autoscaling range** (fixed size). Edit dialog confirms both limits. No other endpoints/read replicas returned. Free plan allows up to 2 CU, but this endpoint is not configured to scale to 2 CU. | Computes → Edit; endpoints API; Billing |
| 4 / Q5 autosuspend | found | 01:21:25; 01:21:57; 01:22:13 | **Scales to zero after 5 minutes of inactivity**, explicit compute-dialog text. API `suspend_timeout_seconds=0` is retained as a raw setting, not interpreted as zero seconds or disabled: UI shows the effective default and limits API gives minimum autosuspend 300 seconds. | Computes → Edit; Settings → Postgres; endpoint and limits APIs |
| 4 / Q5 connection limits | found | 01:22:13 | **105 direct connections / 10,000 pooled connections** in the compute edit dialog. | Computes → Edit |
| 4 / Q5 pooler | found | 01:21:57; 01:24:26 | Connect dialog's **Connection pooling checkbox is checked**. Endpoint API separately returns `pooler_enabled=false`, `pooler_mode=transaction`. These are distinct observed surfaces; do not treat that API flag alone as proof that pooled access is unavailable. Vercel's previously inspected DATABASE_URL uses a pooled endpoint label. Actual connectivity was not tested. | Computes → Connect; endpoints API; prior Vercel report |
| 5 / Q9.1 pooled endpoint mapping | found | 01:21:08; 01:21:57 | `ep-round-rice-axy3k1uk-pooler` maps to endpoint **ep-round-rice-axy3k1uk**, owned by **main**, which **is the DEFAULT branch**. Combined with the prior Vercel env-scope read, the observed shared Production/Preview/Development DATABASE_URL record points to default branch main. | Computes; endpoints and branches APIs; prior Vercel report |
| 5 / Q9.1 unpooled counterpart | not found | prior Vercel read 01:08:47; Neon mapping 01:21:57 | Prior report already lists **DATABASE_URL_UNPOOLED** and **DATABASE_PGHOST_UNPOOLED**, each shared across Production/Preview/Development with no branch override. As integration-generated unpooled counterparts, they would be expected to select the same endpoint via its direct host. **Actual endpoint equality of their stored values is unverified**: names alone cannot establish it. No Vercel reopening was needed to obtain the requested names, and no values were read. | Prior Vercel Environment Variables report; Neon Computes |
| 6 / Q9.3 integration type | found | 01:21:11; 01:21:30; 01:22:31 | Neon lists **Vercel** under Added. Billing explicitly says **“Neon subscription managed by Vercel”**; General settings says deletion must use the Neon Postgres integration in Vercel. This is evidence of the Vercel-managed marketplace subscription, **not confirmation of a separately configured Neon-managed preview integration**. | Integrations; Billing; General settings |
| 6 / Q9.3 branch-per-preview toggle and bindings | not found | 01:21:11; 01:22:31; 01:23:01 | Integrations advertises “Create a database branch for every Vercel preview deployment” but exposes only **Manage Neon subscription**, not a checked/unchecked toggle or bound-project list. Browser console `/api/v2/integrations/vercel?org_id=…` returns 404. **Enabled/disabled remains unverified**; absence of preview branches is not sufficient proof of disabled. `tomyumthai-staging` is the known binding from the supplied Vercel evidence; additional bindings cannot be excluded from Neon. | Integrations; console integration API; prior Vercel report |
| 7 / Q3 storage and history usage | found | 01:20:40; 01:21:06; 01:21:56–01:21:57 | Overview Usage displays **Storage 33.75 MB**, **History 268.51 kB**, period “Since Sep 30, 2026”. Branch/API logical size is **33,751,040 bytes**. Project configured branch logical-size limit is **1,073,741,824 bytes (1 GiB)**, so logical data is about **3.14%** of that configured limit. | Overview → Usage; Branches; project and branches APIs |
| 7 / Q3 history limit comparison | not found | 01:20:40; 01:21:57 | Against the **human-supplied Free history cap of 1 GB**, displayed 268.51 kB is approximately **0.027%**. This cap was not independently shown by the dashboard: limits API returns `per_project.history_size_bytes=0`, whose semantics were not established. Do not interpret 0 as proof of zero usable history or unlimited history. Billing did not expose a separate storage allowance. | Overview → Usage; project limits API; human answers brief |

#### Source pages and API provenance

- [Overview and Usage](https://console.neon.tech/app/projects/royal-block-63167414/branches/br-broad-tree-axkb931p)
- [General settings](https://console.neon.tech/app/projects/royal-block-63167414/settings/general)
- [Postgres settings](https://console.neon.tech/app/projects/royal-block-63167414/settings/postgres)
- [Branches](https://console.neon.tech/app/projects/royal-block-63167414/branches)
- [Computes](https://console.neon.tech/app/projects/royal-block-63167414/branches/br-broad-tree-axkb931p/computes), including Edit and Connect dialogs; neither saved nor changed.
- [Backup & Restore](https://console.neon.tech/app/projects/royal-block-63167414/branches/br-broad-tree-axkb931p/restore)
- [Integrations](https://console.neon.tech/app/projects/royal-block-63167414/integrations)
- [Billing](https://console.neon.tech/app/org-late-shape-20389789/billing)
- Browser-authenticated GET reads: `/api/v2/projects/royal-block-63167414`, its `/branches`, `/branches/br-broad-tree-axkb931p`, `/endpoints`, and `/limits`; organization `/limits`; `/api/v2/integrations/vercel` with and without the console's `org_id` query parameter (both 404). No mutation API was issued by the inspection scripts.
- Prior evidence: `/home/dev/.herdr-mail/p0b-vercel-read-codex-p0b-vercel.md` and `/home/dev/.herdr-mail/p0b-answers-brief.md`.

### Close read: Vercel, Neon, Stripe and Twilio

Source report: `p0b-close-read-codex-p0b-close.md`.

Collected by codex-p0b-close through the human’s laptop Chrome, completed evidence reads 03:10:55–03:21:37 UTC. No settings were changed; the only SQL statements were the authorized read-only SELECT version() and SHOW server_version. Stripe test/live pages were reached by explicit routes; the final mode-selector interaction timed out. Mode-specific labels supplied the mode evidence; documentation quickstart pages were not endpoint evidence.

One row per requested item. All times are UTC on 2026-10-04. Source-page labels are expanded below.

| Item | Status | Read time UTC | Redacted finding | Source page |
|---|---|---|---|---|
| 1 — Store settings, connections, preview branching, subscription management | **found** | 03:12:48–03:12:51; 03:15:30; 03:16:05; 03:16:56; 03:17:25 | Store Settings displays region **Cleveland, USA (East), cle1**, **Auth=True**, installation-level **Free** plan. Projects lists exactly one connection: **tomyumthai-staging**, with **Production, Preview, Development**. The existing connection's **Update Project Connection** dialog shows **All Environments**. Under **Create Database Branch For Deployment**, both **Preview** and **Production** checkboxes are **unchecked**, verified by input checked state and associated labels. **Require Active Resource Before Deploy → Required** is checked. **Custom Environment Variable Prefix** input is **DATABASE**, with the UI suffix **_URL**, corresponding to generated names beginning **DATABASE_**. **Sensitive** is unchecked in this connection dialog. These are observed current settings; no control was changed or saved. The explicit **Manage Neon subscription** links on Neon Integrations target host **console.neon.tech**. Vercel's **See Installation** opens an installation settings page on **vercel.com**; that is a separate link. This closes the prior Neon report's missing preview-branch setting and binding inventory. | Vercel Storage → neon-purple-ferry → Settings / Projects → Update Project Connection; Installation Settings; Neon Integrations |
| 2 — PostgreSQL minor and full version | **found** | 03:13:36; 03:13:39 | In SQL Editor on **main / Default**, **Primary** compute, default database **neondb**, executed exactly `SELECT version();` and then `SHOW server_version;`. First result: **PostgreSQL 18.6 (4e955f5) on aarch64-unknown-linux-gnu, compiled by gcc (Ubuntu 13.3.0-6ubuntu2~24.04.1) 13.3.0, 64-bit**. Second result: **18.6 (4e955f5)**. Both returned one row. No role selection was required. Q6 minor version is closed. | Neon SQL Editor |
| 3 — Actual earliest/latest restorable UTC timestamps | **not found** | 03:12:57; picker opened 03:13:44; calendar inspected **03:14:17.963** | Page confirms **6 hours** history retention. Opened the point-in-time picker without selecting a restore point or pressing Proceed. Its text input exposes **no min or max**. In the October 2026 calendar, **October 3 alone is enabled**; October 2 and earlier displayed dates and October 4 and later displayed dates have the disabled class. Display timezone is **America/Chicago, GMT−05:00**. That enabled local calendar day spans **2026-10-03 05:00:00 UTC to before 2026-10-04 05:00:00 UTC**, but these are calendar-day boundaries, **not verified restore bounds**. Neither exact earliest nor exact latest restorable timestamp is exposed by the inspected control. No timestamp was inferred by subtracting six hours from the read time. Q3 actual restorable timestamps and restore rehearsal remain open. | Neon Backup & Restore → Timestamp picker |
| 4 — Stripe test/live webhooks and key presence | **found** (keys); **not found** (matching endpoints) | Test keys **03:20:28**; live keys **03:20:39**; test webhooks **03:21:13**; live webhooks **03:21:29** | After the human signed in, read account **My Little Thai Chef, LLC DBA Tom Yum Thai Restaurant** (account ID ending **4Zd0**). **Test mode** Workbench Webhooks displays the empty state “Trigger reactions in your integration with Stripe events” and **Add destination**, with no endpoint rows. **Live mode** displays the same empty state and no endpoint rows. Thus **no endpoint whose host contains vercel.app or tomyumthai was found in either mode**; endpoint host/path, status and selected-event count are not applicable. In **test mode**, standard **Publishable key** exists, ending **qrvS**, and **Secret key** exists, ending **w0Cp**. In **live mode**, standard **Publishable key** exists, ending **q48p**, and a **Secret key** row exists with **Reveal live key**; its last four characters are **not shown**, and Reveal was not clicked. No restricted keys listed in either mode. **The requested test-only /api/stripe-webhook evidence was not found. These observations do not establish the deployed app or Preview Stripe mode.** | Stripe Workbench Webhooks and Developers API keys, test and live routes |
| 5 — Twilio account, Verify services, senders | **blocked** | 03:12:19 | **console.twilio.com** redirected to the **www.twilio.com** Welcome login page, with Email address / Continue. The optional authenticated read was unavailable. Account friendly name and SID suffix, Verify service names/SID suffixes, and sender/phone inventory remain unread. No auth-token page was opened. | Twilio Console → login |
| 6 — STRIPE_SECRET_KEY record separation | **found** | **03:15:35** | A fresh environment metadata read returned **three distinct records**, all with no git-branch override: **Development — encrypted**, **Preview — sensitive**, **Production — sensitive**. **Preview is a separate record from Production.** This corrects the earlier brief's generalization that every variable is one shared P/V/D record. It does not establish whether the Stripe values are equal or different, or their test/live modes. No value reveal or individual-variable value request was used. | Vercel project Settings → Environment Variables; browser-authenticated env metadata GET |

#### Source pages

Resource identifiers in paths are intentionally omitted or reduced to their last four characters. The navigation descriptions identify the exact inspected surfaces without publishing full identifiers.

- [Vercel team Storage](https://vercel.com/tytmktg/~/stores) → **neon-purple-ferry** (Neon project ending 7414) → **Settings** and **Projects**. Resource route shape: `/tytmktg/~/integrations/neon/[installation ending MP6m]/resources/storage/[store ending pzzj]/settings` or `/projects`.
- Same store → **Projects → row menu → Update Project Connection**, existing **tomyumthai-staging** connection. Inspected configuration dialog only; never Save Changes.
- Same store → **See Installation → Settings**, host **vercel.com**.
- [Neon Console](https://console.neon.tech) → **neon-purple-ferry → main → SQL Editor**. Route shape: `/app/projects/[project ending 7414]/branches/[branch ending 931p]/sql-editor`.
- Same Neon project/branch → **Backup & Restore → Timestamp**, route suffix `/restore`.
- Same Neon project → **Integrations**, route suffix `/integrations`; **Manage Neon subscription** anchor host **console.neon.tech**. No SSO/query-string target was recorded.
- [Stripe test webhooks](https://dashboard.stripe.com/test/workbench/webhooks) and [live webhooks](https://dashboard.stripe.com/workbench/webhooks).
- [Stripe test API keys](https://dashboard.stripe.com/test/apikeys) and [live API keys](https://dashboard.stripe.com/apikeys). Stripe resolves these to the signed-in account (ID ending 4Zd0). Test views explicitly show Test mode / Sandbox; the live key view shows Reveal live key.
- [Twilio Console](https://console.twilio.com), redirected to login on **www.twilio.com**.
- [Vercel project Environment Variables](https://vercel.com/tytmktg/tomyumthai-staging/settings/environment-variables). Browser-authenticated GET `/api/v9/projects/tomyumthai-staging/env?slug=tytmktg`, HTTP 200; filtered in browser memory to STRIPE_SECRET_KEY record count, key name, type, targets, and gitBranch only.
- Prior evidence read in order: `/home/dev/.herdr-mail/p0b-answers-brief.md` (including both “read done” sections), `/home/dev/.herdr-mail/p0b-vercel-read-codex-p0b-vercel.md`, `/home/dev/.herdr-mail/p0b-neon-read-codex-p0b-neon.md`.
