# Cash drawer commands

`createCashDrawer({ appendEntry, tax_rate_bps = 825 })` creates the command
service for one open drawer. A caller supplies trusted, verified sessions with
an `id` and `role`: owners, managers and servers may record sales; only owners
and managers may change the tax rate. Authentication is outside this module.

`recordSale(session, { operation_id, subtotal_cents })` records a cash sale with
a positive subtotal up to 200,000 cents and a nonblank operation id up to 100
characters. It returns the immutable entry including the rate, tax, total and
staff id. Tax uses basis points and rounds to the nearest cent, with half cents
rounded up. `cashSaleTotal(subtotal_cents, tax_rate_bps)` exposes the same money
calculation without a side effect.

Within the instance's lifetime, an operation id identifies one sale: repeated
or overlapping submissions by the same staff member with the same subtotal
return the original entry and append once. Reuse with a different subtotal or
staff id is a conflict. Distinct operation ids represent distinct sales.

`setTaxRate(session, next_rate_bps)` accepts whole basis points from 0 to 10,000,
applies to subsequent sales, and preserves prior entries. Only managers and
owners may make this change; other staff receive a forbidden error.

The injected async `appendEntry(entry)` commits one entry atomically or rejects
without a write. Callers own the instance lifecycle; restart recovery and
coordination across instances are outside this in-memory service's scope.
This change provides no HTTP handler or production persistence adapter.

Run `node tests/cash-drawer.test.mjs` or `npm test`.
