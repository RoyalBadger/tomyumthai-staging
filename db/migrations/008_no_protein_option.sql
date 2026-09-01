-- "No Protein" as an explicit protein choice ($0), for vegetarian orders and
-- anyone who wants the dish plain. Owner spec 2026-09-01.
INSERT INTO protein_options (id, label, delta_cents, sort, active)
VALUES ('no-protein', 'No Protein', 0, 90, true)
ON CONFLICT (id) DO NOTHING;
