USE c237_017_team5_savepoint;

ALTER TABLE users
  ADD COLUMN favorite_game_company VARCHAR(120) NULL,
  ADD COLUMN favorite_game_genre VARCHAR(120) NULL,
  ADD COLUMN favorite_game VARCHAR(180) NULL,
  ADD COLUMN consoles_owned TEXT NULL,
  ADD COLUMN consoles_wanted TEXT NULL;

-- Note: app.js also performs these additions automatically and safely checks
-- whether each column already exists. Run this file only for manual setup on a
-- database that has none of the five columns yet.
