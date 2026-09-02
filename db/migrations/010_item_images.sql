-- Optional dish photo, served from /img/dishes/ in this repo. NULL = no photo
-- (the customer site shows a Photo button only when set). Initial set sourced
-- from our own Uber Eats listing 2026-09-01; to be replaced by real photography.
ALTER TABLE menu_items ADD COLUMN image_url text;
