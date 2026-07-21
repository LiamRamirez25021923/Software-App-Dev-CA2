# Render setup

1. Run `database-image-migration.sql` once in MySQL.
2. In Render > Environment, add `DB_HOST`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`.
3. Use build command `npm install` and start command `npm start`.
4. Commit and push these files, then deploy the latest commit.

New uploaded images are stored inside MySQL instead of Render's local filesystem.
Existing seeded images in `public/images` still work.
