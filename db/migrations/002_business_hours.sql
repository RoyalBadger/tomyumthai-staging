-- Business hours (authoritative per To-Go Menu Rev. 09-2025, owner-confirmed 2026-08-30):
-- Lunch Tue-Fri 11:00-14:30 (closed Monday lunch)
-- Dinner Mon-Thu 17:00-21:30, Fri 17:00-22:00
-- Sat-Sun 12:00-22:00 (continuous)
-- Keys are JS weekday numbers: 0=Sunday ... 6=Saturday. Times are America/Chicago.

ALTER TABLE settings ADD COLUMN business_hours jsonb NOT NULL DEFAULT '{
  "0": [["12:00","22:00"]],
  "1": [["17:00","21:30"]],
  "2": [["11:00","14:30"],["17:00","21:30"]],
  "3": [["11:00","14:30"],["17:00","21:30"]],
  "4": [["11:00","14:30"],["17:00","21:30"]],
  "5": [["11:00","14:30"],["17:00","22:00"]],
  "6": [["12:00","22:00"]]
}'::jsonb;

-- Stop accepting new online orders this many minutes before each closing time.
ALTER TABLE settings ADD COLUMN last_order_buffer_minutes int NOT NULL DEFAULT 20;
