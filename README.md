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

## Personalised NewsHub sources

The NewsHub includes a collapsible source checklist. Selections are saved in the browser with localStorage and are sent to the backend so Game News, Daily Report, and Monthly Report all use the same enabled-source list.


## Integrated e-commerce feature

This build combines the current SavePoint main branch with Ryan's e-commerce branch.

Included:
- Searchable retro marketplace
- Admin product creation with image upload
- Session-based shopping cart
- Checkout transaction and order confirmation
- Product stock updates
- NewsHub, profile, admin controls and SavePoint app icon preserved

Run `npm install` after extracting so the Multer dependency is installed.

## Community Forum implementation

The Forum now supports communities, searching, joining/leaving, image posts, comments, upvotes/downvotes, notifications and community-specific RBAC.

Community owners receive permanent Owner authority and cannot be kicked, banned or assigned another role. Owners can create roles with toggleable permissions, assign roles, appoint Co-Owners, moderate posts and members, and transfer ownership. SavePoint administrators can enter community management, delete communities and transfer ownership.

Forum tables are created automatically when `node app.js` starts. The related routes and schema logic live in `src/forum/forum.js`, and the EJS pages are under `views/forum/`.

- Long community posts can now be expanded with **See full post** and collapsed with **Show less**.

- Forum posts automatically embed the first supported YouTube link as a responsive miniplayer.

## Build User Profile survey

New accounts can optionally complete a SavePoint Profile during sign-up. The five nullable fields are:

- Favorite game company
- Favorite game genre
- Favorite game
- Consoles owned
- Consoles wanted / being considered

The profile can be changed later from **Profile** in the navbar. Suggestion arrays are maintained in `src/data/profileOptions.js`; inputs remain open-ended. Existing databases are upgraded automatically when `node app.js` starts.


## Legacy database collation repair

If MySQL reports `Illegal mix of collations`, run:

```sql
SOURCE database/repair_collations.sql;
```

or open `database/repair_collations.sql` in MySQL Workbench and execute it.
The application profile update no longer uses cross-collation `COALESCE`,
and forum voting now toggles like Reddit.
