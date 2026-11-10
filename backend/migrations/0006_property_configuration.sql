-- Story 04, slice 04a: configuration of a property beyond its column mapping.
-- Every column has a constant default, so existing rows stay valid and unchanged properties keep the
-- same seed value and snapshot shape (defaults are left out of both).

ALTER TABLE cfg_property ADD COLUMN description TEXT;
ALTER TABLE cfg_property ADD COLUMN required INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0,1));
ALTER TABLE cfg_property ADD COLUMN default_json TEXT;
ALTER TABLE cfg_property ADD COLUMN searchable INTEGER NOT NULL DEFAULT 0 CHECK (searchable IN (0,1));
ALTER TABLE cfg_property ADD COLUMN sensitivity TEXT NOT NULL DEFAULT 'normal' CHECK (sensitivity IN ('normal','sensitive'));
ALTER TABLE cfg_property ADD COLUMN config_json TEXT NOT NULL DEFAULT '{}';
