-- Owner (2026-09-06): offer "Extra X" ($1.00 default) on every dish modifier already listed.
UPDATE item_modifiers SET can_extra = true WHERE can_remove;
