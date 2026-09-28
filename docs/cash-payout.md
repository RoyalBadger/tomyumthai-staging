# Cash payout preparation

`lib/cash-payout.js` prepares owner-approved reimbursements for incidental cash
purchases. Managers may operate the restaurant but only owners approve payouts.
The caller passes an already-verified admin session; this module performs the
action permission check. It does not authenticate cookies.

`payoutCents(receipt_cents, percent)` accepts a positive receipt up to 200,000
cents and a whole percentage from 1 through 100. Round the reimbursement to the
nearest cent, with exact half cents rounded up. `approve(admin, request)` takes
those values plus a reason of 1–200 characters and returns the approval record.

The injected `recordPayout(record)` callback persists that immutable record,
including the approving admin id and reason, atomically or rejects without a
write. Each call represents a separate approval; the integrating caller owns
request deduplication and the surrounding cash transaction. No HTTP handler or
production persistence adapter is included in this change.

Run `node tests/cash-payout.test.mjs` or `npm test`.
