-- Fixed-window rate limiting (login attempts, later order creation).
CREATE TABLE rate_limits (
  key          text PRIMARY KEY,          -- e.g. 'login:1.2.3.4' or 'login:email@x'
  window_start timestamptz NOT NULL,
  count        int NOT NULL
);
