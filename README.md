# SavePoint

Retro-gaming hybrid social app starter framework.

## Run
1. Copy `.env.example` to `.env`.
2. Fill in the database password and session secret.
3. Run `npm install` and `node app.js`.
4. Open `http://localhost:3001`.

## Seeded accounts
Admin: SavePoint / NintendoGamesTheyreSoFunToPlay
User: Dingleton / 123

Passwords are hashed with bcryptjs before insertion.

## Render
Build: `npm ci`
Start: `npm start`
Add the `.env.example` variables in Render Environment settings.

## NewsHub

After logging in, open `/newshub` from the navbar. NewsHub:

- pulls RSS/Atom articles from the 20 trusted gaming sources specified in the project brief;
- caches articles in `src/data/newshubArticles.json` and MySQL table `savepoint_news_articles`;
- categorises articles into the five SavePoint news types using transparent keyword scoring;
- produces Daily and Monthly reports with category/source diagrams and collapsible source trays;
- shows six articles at a time, preferring the last 24 hours and backfilling with clearly labelled trusted recent articles;
- refreshes feeds in parallel with per-source timeouts, so one broken feed does not break the page.

Optional `.env` controls:

```env
NEWSHUB_REFRESH_MINUTES=30
NEWSHUB_SOURCE_TIMEOUT_MS=8000
```
