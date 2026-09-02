-- Manager-uploaded dish photos, stored in Neon itself (bytea). One per item.
-- menu_items.image_url points at /api/menu-image?id=<id>&v=<ts> for these
-- (static repo files under /img/dishes/ remain valid values too).
CREATE TABLE menu_item_images (
  item_id    text PRIMARY KEY REFERENCES menu_items(id) ON DELETE CASCADE,
  data       bytea NOT NULL,
  mime       text NOT NULL DEFAULT 'image/jpeg',
  updated_at timestamptz NOT NULL DEFAULT now()
);
