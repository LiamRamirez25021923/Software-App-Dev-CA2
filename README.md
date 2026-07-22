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

## Marketplace feature

Admin account:
- Open `/admin`.
- Use **Add Marketplace Product** to enter title, description, category, platform, price, quantity and an image URL.
- Admin accounts can manage products but cannot add products to a shopping cart.

Regular user account:
- Open `/marketplace` to browse and search products.
- Select a quantity and add the product to the session cart.
- Open `/cart` to reduce quantities, remove products, see line totals and see the overall total.
- Continue to `/purchase`, enter delivery and demo card details, then confirm the order.
- The checkout saves an order and its order items in MySQL and reduces product stock in one transaction.
- For safety, only the last four digits of the demo card number are stored.

The product image field uses an image URL rather than file upload so the feature stays within the Express/EJS/MySQL techniques used in class.

## Marketplace implementation (Lesson 18 approach)

The marketplace now follows the SupermarketApp Lesson 18 pattern:

- `multer` saves uploaded product images in `public/images`.
- Admin product forms use `enctype="multipart/form-data"`.
- Product records are inserted into MySQL with parameterised queries.
- Marketplace, cart and checkout queries read current product data from MySQL.
- The application detects either lesson-style columns (`productId`, `productName`, `image`) or SavePoint-style columns (`id`, `title`, `image_url`) and aliases them consistently.
- Missing marketplace metadata columns such as `category`, `platform`, `status` and `description` are added when the server starts.

After extracting the project, run:

```bash
npm install
npm start
```

Uploaded images must be JPG, PNG, GIF, WebP, or another browser-supported image format and must not exceed 5 MB.
