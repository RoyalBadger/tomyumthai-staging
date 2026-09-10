-- Automatic ticket printing via the restaurant-PC print agent (print-agent/agent.mjs).
-- printed_at: set by the agent once the receipt + kitchen tickets are on paper.
-- print_requested_at: set by the portal's Reprint button; the agent reprints when it is
--   newer than printed_at.
-- settings.print_agent_seen_at: heartbeat (updated on every agent poll) so the portal can
--   show online/offline and fall back to browser printing when the agent is down.
ALTER TABLE orders ADD COLUMN printed_at timestamptz;
ALTER TABLE orders ADD COLUMN print_requested_at timestamptz;
CREATE INDEX orders_unprinted_idx ON orders (created_at)
  WHERE status IN ('received','cooking','ready') AND printed_at IS NULL;
ALTER TABLE settings ADD COLUMN print_agent_seen_at timestamptz;

-- Orders that already exist were handled by hand; don't dump them on the printers when
-- the agent first starts.
UPDATE orders SET printed_at = now() WHERE status <> 'pending_payment';
