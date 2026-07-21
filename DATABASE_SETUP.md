# Database setup

This project uses `mysql2` with `mysql.createConnection()`.

## 1. Create your local `.env`

Copy `.env.example` and rename the copy to `.env`.

Fill in `DB_PASSWORD` with the current Azure MySQL password. Keep `.env` private; it is excluded by `.gitignore`.

## 2. Install dependencies

```powershell
npm install
```

## 3. Start the application

```powershell
npm start
```

At startup the app will:

1. connect to `c237_017_team5_savepoint`;
2. create the `products` table if it does not exist;
3. seed the default catalogue if the table is empty;
4. load the products from MySQL.

You can test the connection at:

`http://localhost:3001/db-health`

A successful response is:

```json
{"connected":true}
```

## Security

Never commit `.env` or paste the live password into source files. Rotate any password that has been shared publicly.
