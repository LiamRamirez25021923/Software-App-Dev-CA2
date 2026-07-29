require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const multer = require('multer');
const nodemailer = require('nodemailer');
const mysql = require('mysql2/promise');
const pool = require('./config/db');
const newsHub = require('./src/services/newshub.service');
const createForumFeature = require('./src/forum/forum');
const profileOptions = require('./src/data/profileOptions');
const app = express();
const PORT = Number(process.env.PORT) || 3001;
const fs = require('fs');

// User-uploaded media is held in memory briefly, then saved inside MySQL.
// This makes uploads survive Render restarts and redeployments.
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files can be uploaded here.'));
        }
        cb(null, true);
    }
});

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    } : undefined
});

const profileUpload = upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'bannerImage', maxCount: 1 }
]);

async function ensureMediaStorage() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS media_assets (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            owner_user_id INT NULL,
            media_kind ENUM('image','video') NOT NULL,
            mime_type VARCHAR(120) NOT NULL,
            original_name VARCHAR(255) NULL,
            byte_size INT NOT NULL,
            media_data LONGBLOB NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_media_owner (owner_user_id),
            INDEX idx_media_kind (media_kind)
        )
    `);
}


async function ensureCartStorage() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_cart_items (
            user_id INT NOT NULL,
            product_id INT NOT NULL,
            quantity INT NOT NULL DEFAULT 1,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, product_id),
            INDEX idx_cart_user (user_id),
            INDEX idx_cart_product (product_id)
        )
    `);
}

async function loadPersistentCart(userId) {
    const [rows] = await pool.execute(
        `SELECT product_id, quantity
         FROM user_cart_items
         WHERE user_id=?`,
        [userId]
    );

    const cart = {};
    for (const row of rows) {
        const productId = Number(row.product_id);
        const quantity = Number(row.quantity);
        if (
            Number.isInteger(productId) &&
            productId > 0 &&
            Number.isInteger(quantity) &&
            quantity > 0
        ) {
            cart[productId] = quantity;
        }
    }

    return cart;
}

async function savePersistentCartItem(userId, productId, quantity) {
    if (!Number.isInteger(Number(userId)) || !Number.isInteger(Number(productId))) {
        throw new Error('A valid user and product are required to save a cart item.');
    }

    const safeQuantity = Number(quantity);

    if (!Number.isInteger(safeQuantity) || safeQuantity <= 0) {
        await pool.execute(
            `DELETE FROM user_cart_items
             WHERE user_id=? AND product_id=?`,
            [userId, productId]
        );
        return;
    }

    await pool.execute(
        `INSERT INTO user_cart_items (user_id, product_id, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE
            quantity=VALUES(quantity),
            updated_at=CURRENT_TIMESTAMP`,
        [userId, productId, safeQuantity]
    );
}

async function clearPersistentCart(userId, connection = pool) {
    await connection.execute(
        'DELETE FROM user_cart_items WHERE user_id=?',
        [userId]
    );
}

async function saveMediaAsset(file, ownerUserId, mediaKind = null) {
    if (!file?.buffer) return null;

    const kind = mediaKind || (file.mimetype.startsWith('video/') ? 'video' : 'image');
    const [result] = await pool.execute(
        `INSERT INTO media_assets
         (owner_user_id, media_kind, mime_type, original_name, byte_size, media_data)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ownerUserId || null, kind, file.mimetype, file.originalname || null, file.size, file.buffer]
    );

    return `/media/${result.insertId}`;
}

// Detect the existing products-table column names.
// This project's database uses id, name and image.
// so all marketplace queries work with the existing products table.
let productSchema = {
    id: 'id',
    name: 'name',
    image: 'image'
};

async function configureProductSchema() {
    const [columns] = await pool.query(
        'SHOW COLUMNS FROM products'
    );

    const names = new Set(
        columns.map(column => column.Field)
    );

    productSchema.id =
        names.has('productId') ? 'productId'
            : names.has('product_id') ? 'product_id'
                : names.has('id') ? 'id'
                    : null;

    productSchema.name =
        names.has('productName') ? 'productName'
            : names.has('product_name') ? 'product_name'
                : names.has('name') ? 'name'
                    : names.has('title') ? 'title'
                        : null;

    productSchema.image =
        names.has('image') ? 'image'
            : names.has('image_url') ? 'image_url'
                : names.has('imageUrl') ? 'imageUrl'
                    : null;

    if (!productSchema.id) {
        throw new Error(
            'Products table requires an id column.'
        );
    }

    if (!productSchema.name) {
        throw new Error(
            'Products table requires a name column.'
        );
    }

    if (!productSchema.image) {
        await pool.query(`
            ALTER TABLE products
            ADD COLUMN image VARCHAR(255) NULL
        `);

        productSchema.image = 'image';
        names.add('image');
    }

    const additions = [
        ['seller_user_id', 'INT NULL'],
        ['description', 'TEXT NULL'],
        [
            'category',
            "VARCHAR(80) NOT NULL DEFAULT 'Games'"
        ],
        ['platform', 'VARCHAR(80) NULL'],
        ['quantity', 'INT NOT NULL DEFAULT 1'],
        ['price', 'DECIMAL(10,2) NOT NULL DEFAULT 0'],
        [
            'status',
            "ENUM('active','sold','removed') "
            + "NOT NULL DEFAULT 'active'"
        ],
        [
            'created_at',
            'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
        ]
    ];

    for (const [column, definition] of additions) {
        if (!names.has(column)) {
            await pool.query(
                `ALTER TABLE products
                 ADD COLUMN \`${column}\` ${definition}`
            );

            names.add(column);
        }
    }

    console.log('Detected products schema:', productSchema);
}

function productSelectList(alias = 'p') {
    return `
        ${alias}.\`${productSchema.id}\` AS id,
        ${alias}.\`${productSchema.name}\` AS title,
        ${alias}.description,
        ${alias}.category,
        ${alias}.platform,
        ${alias}.price,
        ${alias}.quantity,
        ${alias}.\`${productSchema.image}\` AS image_url,
        ${alias}.status,
        ${alias}.created_at,
        ${alias}.seller_user_id
    `;
}


app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

app.get('/media/:id', async (req, res, next) => {
    try {
        const mediaId = Number(req.params.id);
        if (!Number.isInteger(mediaId) || mediaId < 1) return res.sendStatus(404);

        const [rows] = await pool.execute(
            `SELECT mime_type, byte_size, media_data
             FROM media_assets
             WHERE id=? LIMIT 1`,
            [mediaId]
        );
        if (!rows.length) return res.sendStatus(404);

        const media = rows[0];
        res.setHeader('Content-Type', media.mime_type);
        res.setHeader('Content-Length', String(media.byte_size));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        return res.end(media.media_data);
    } catch (error) {
        return next(error);
    }
});

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({ secret: process.env.SESSION_SECRET || 'development-only-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400000 } }));

app.use((req, res, next) => {
    res.locals.currentUser =
        req.session.user || null;

    res.locals.isAdmin =
        req.session.user?.role === 'admin';

    res.locals.currentPath = req.path;

    res.locals.profileOptions = profileOptions;

    res.locals.cartCount = Object.values(
        req.session.cart || {}
    ).reduce(
        (sum, quantity) =>
            sum + Number(quantity),
        0
    );

    next();
});

function requireLogin(req, res, next) { if (!req.session.user) return res.redirect('/login'); next(); }

function requireAdmin(req, res, next) { if (!req.session.user) return res.redirect('/login'); if (req.session.user.role !== 'admin') return res.status(403).render('error', { title: 'Access denied', message: 'This page is available only to SavePoint administrators.' }); next(); }

const forumFeature = createForumFeature({
    pool,
    requireLogin,
    requireAdmin,
    projectRoot: __dirname,
    saveMediaAsset
});

function requireRegularUser(req, res, next) {
    if (!req.session.user) {
        return res.redirect('/login');
    }

    if (req.session.user.role === 'admin') {
        return res.status(403).render('error', {
            title: 'Admin restriction',
            message: 'Administrator accounts cannot use shopping features.'
        });
    }

    next();
}

async function ensureUsersTableSchema() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(150) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            profile_image VARCHAR(255) NOT NULL DEFAULT 'default_profile.png',
            banner_image VARCHAR(255) NOT NULL DEFAULT 'default_banner.png',
            role ENUM('admin','user') NOT NULL DEFAULT 'user',
            bio TEXT,
            favourite_console VARCHAR(100),
            favorite_game_company VARCHAR(120) NULL,
            favorite_game_genre VARCHAR(120) NULL,
            favorite_game VARCHAR(180) NULL,
            consoles_owned TEXT NULL,
            consoles_wanted TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const [columns] = await pool.query('SHOW COLUMNS FROM users');
    const existing = new Set(columns.map((column) => column.Field));
    const migrations = [];

    if (!existing.has('email')) {
        migrations.push('ALTER TABLE users ADD COLUMN email VARCHAR(150) NULL');
    }
    if (!existing.has('password')) {
        migrations.push('ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL');
    }
    if (!existing.has('profile_image')) {
        migrations.push("ALTER TABLE users ADD COLUMN profile_image VARCHAR(255) NOT NULL DEFAULT 'default_profile.png'");
    }
    if (!existing.has('banner_image')) {
        migrations.push("ALTER TABLE users ADD COLUMN banner_image VARCHAR(255) NOT NULL DEFAULT 'default_banner.png'");
    }
    if (!existing.has('role')) {
        migrations.push("ALTER TABLE users ADD COLUMN role ENUM('admin','user') NOT NULL DEFAULT 'user'");
    }
    if (!existing.has('bio')) {
        migrations.push('ALTER TABLE users ADD COLUMN bio TEXT NULL');
    }
    if (!existing.has('favourite_console')) {
        migrations.push('ALTER TABLE users ADD COLUMN favourite_console VARCHAR(100) NULL');
    }
    if (!existing.has('favorite_game_company')) {
        migrations.push('ALTER TABLE users ADD COLUMN favorite_game_company VARCHAR(120) NULL');
    }
    if (!existing.has('favorite_game_genre')) {
        migrations.push('ALTER TABLE users ADD COLUMN favorite_game_genre VARCHAR(120) NULL');
    }
    if (!existing.has('favorite_game')) {
        migrations.push('ALTER TABLE users ADD COLUMN favorite_game VARCHAR(180) NULL');
    }
    if (!existing.has('consoles_owned')) {
        migrations.push('ALTER TABLE users ADD COLUMN consoles_owned TEXT NULL');
    }
    if (!existing.has('consoles_wanted')) {
        migrations.push('ALTER TABLE users ADD COLUMN consoles_wanted TEXT NULL');
    }
    if (!existing.has('created_at')) {
        migrations.push('ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP');
    }

    for (const statement of migrations) {
        await pool.query(statement);
    }

    // Re-read the schema after migrations, then copy hashes from the older
    // SavePoint password_hash column into the merged password column.
    const [updatedColumns] = await pool.query('SHOW COLUMNS FROM users');
    const updatedColumnNames = new Set(
        updatedColumns.map((column) => column.Field)
    );

    if (
        updatedColumnNames.has('password') &&
        updatedColumnNames.has('password_hash')
    ) {
        await pool.query(`
            UPDATE users
            SET password = password_hash
            WHERE (password IS NULL OR password = '')
              AND password_hash IS NOT NULL
              AND password_hash <> ''
        `);
    }

    // Repair values left null by older versions of the project.
    // Separate updates avoid COALESCE comparing columns that may have
    // inherited different collations from older team schemas.
    await pool.query(`
        UPDATE users
        SET profile_image = '/icons/icon-192.png'
        WHERE profile_image IS NULL OR CHAR_LENGTH(profile_image) = 0
    `);

    await pool.query(`
        UPDATE users
        SET banner_image = '/icons/icon-512.png'
        WHERE banner_image IS NULL OR CHAR_LENGTH(banner_image) = 0
    `);

    await pool.query(`
        UPDATE users
        SET role = 'user'
        WHERE role IS NULL
    `);
}

async function seedAccount({ username, password, email, role }) {
    const [rows] = await pool.execute(
        'SELECT id, password FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1',
        [username]
    );

    const hash = await bcrypt.hash(password, 12);

    if (rows.length) {
        const updates = [];
        const values = [];

        if (typeof rows[0].password !== 'string' || rows[0].password.length === 0) {
            updates.push('password=?');
            values.push(hash);
        }

        updates.push("email=COALESCE(NULLIF(email, ''), ?)");
        values.push(email || `${username}@savepoint.local`);
        updates.push('role=?');
        values.push(role);

        if (updates.length > 0) {
            values.push(rows[0].id);
            await pool.execute(
                `UPDATE users SET ${updates.join(', ')} WHERE id=?`,
                values
            );
        }
        return;
    }

    await pool.execute(
        'INSERT INTO users (username,email,password,role) VALUES (?,?,?,?)',
        [username, email || `${username}@savepoint.local`, hash, role]
    );
}

async function initialiseDatabase() {
    await ensureUsersTableSchema();
    await ensureMediaStorage();
    await ensureCartStorage();

    await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            category VARCHAR(80) NOT NULL DEFAULT 'Games',
            price DECIMAL(10,2) NOT NULL DEFAULT 0,
            image VARCHAR(255),
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            status ENUM('active','sold','removed') NOT NULL DEFAULT 'active',
            quantity INT NOT NULL DEFAULT 1,
            seller_user_id INT NULL,
            platform VARCHAR(80)
        )
    `);
    await configureProductSchema();

    await pool.query(`CREATE TABLE IF NOT EXISTS forum_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        author_user_id INT NULL,
        title VARCHAR(180) NOT NULL,
        body TEXT NOT NULL,
        status ENUM('visible','removed') NOT NULL DEFAULT 'visible',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS news_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(200) NOT NULL,
        summary TEXT,
        source_name VARCHAR(120),
        source_url VARCHAR(500),
        published_at DATETIME,
        status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS orders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        customer_name VARCHAR(120) NOT NULL,
        customer_email VARCHAR(150) NOT NULL,
        delivery_address TEXT NOT NULL,
        card_last_four CHAR(4) NOT NULL,
        total_price DECIMAL(10,2) NOT NULL,
        status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        order_id INT NOT NULL,
        product_id INT NULL,
        product_title VARCHAR(150) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL,
        line_total DECIMAL(10,2) NOT NULL
    )`);

    await seedAccount({
        username: 'SavePoint',
        password: 'NintendoGamesTheyreSoFunToPlay',
        email: 'admin@savepoint.local',
        role: 'admin'
    });
    await seedAccount({
        username: 'Dingleton',
        password: '123',
        email: 'dingleton@savepoint.local',
        role: 'user'
    });

    const [[pc]] = await pool.query('SELECT COUNT(*) total FROM products');
    if (!Number(pc.total)) {
        const [[admin]] = await pool.execute('SELECT id FROM users WHERE username=?', ['SavePoint']);
        await pool.execute(
            `INSERT INTO products
             (\`${productSchema.name}\`, category, price, \`${productSchema.image}\`,
              description, status, quantity, seller_user_id, platform)
             VALUES (?, ?, ?, ?, ?, 'active', ?, ?, ?)`,
            [
                'Nintendo Game Boy Color',
                'Hardware',
                129.90,
                '1784795987149-Nintendo_Game_Boy_Color.jpg',
                'Starter marketplace listing.',
                1,
                admin.id,
                'Game Boy'
            ]
        );
    }

    const [[fc]] = await pool.query('SELECT COUNT(*) total FROM forum_posts');
    if (!Number(fc.total)) {
        const [[user]] = await pool.execute('SELECT id FROM users WHERE username=?', ['Dingleton']);
        await pool.execute(
            'INSERT INTO forum_posts (author_user_id,title,body) VALUES (?,?,?)',
            [user.id, 'What retro game are you playing right now?', 'Starter discussion post.']
        );
    }

    const [[nc]] = await pool.query('SELECT COUNT(*) total FROM news_items');
    if (!Number(nc.total)) {
        await pool.execute(
            'INSERT INTO news_items (title,summary,source_name,published_at) VALUES (?,?,?,NOW())',
            ['SavePoint News Hub is ready', 'Retro gaming news storage is ready.', 'SavePoint']
        );
    }
}

const sessionUser = u => ({ id: u.id, username: u.username, displayName: u.username, email: u.email, role: u.role });

app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

app.get('/login', (req, res) => { if (req.session.user) return res.redirect('/dashboard'); res.render('auth', { title: 'Log in', mode: 'login', error: null, values: {} }); });

app.get('/signup', (req, res) => { if (req.session.user) return res.redirect('/dashboard'); res.render('auth', { title: 'Create account', mode: 'signup', error: null, values: {} }); });

app.post('/signup', async (req, res, next) => {
    try {
        const username = String(req.body.username || '').trim();
        const displayName = String(req.body.displayName || '').trim();
        const email = String(req.body.email || '').trim();
        const password = String(req.body.password || '');
        const favoriteGameCompany = String(req.body.favoriteGameCompany || '').trim();
        const favoriteGameGenre = String(req.body.favoriteGameGenre || '').trim();
        const favoriteGame = String(req.body.favoriteGame || '').trim();
        const consolesOwned = String(req.body.consolesOwned || '').trim();
        const consolesWanted = String(req.body.consolesWanted || '').trim();

        if (!username || !displayName || !password) {
            return res.status(400).render('auth', {
                title: 'Create account', mode: 'signup',
                error: 'Username, display name and password are required.',
                values: { username, displayName, email, favoriteGameCompany, favoriteGameGenre, favoriteGame, consolesOwned, consolesWanted }
            });
        }

        if (username.length < 3 || password.length < 6) {
            return res.status(400).render('auth', {
                title: 'Create account', mode: 'signup',
                error: 'Username must be at least 3 characters and password at least 6 characters.',
                values: { username, displayName, email, favoriteGameCompany, favoriteGameGenre, favoriteGame, consolesOwned, consolesWanted }
            });
        }

        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1',
            [username]
        );
        if (existing.length) {
            return res.status(409).render('auth', {
                title: 'Create account', mode: 'signup',
                error: 'That username is already taken.',
                values: { username, displayName, email, favoriteGameCompany, favoriteGameGenre, favoriteGame, consolesOwned, consolesWanted }
            });
        }

        const hash = await bcrypt.hash(password, 12);
        const normalizedEmail = email || `${username}@savepoint.local`;
        const [result] = await pool.execute(
            `INSERT INTO users (
                username, email, password, role,
                favorite_game_company, favorite_game_genre, favorite_game,
                consoles_owned, consoles_wanted
             ) VALUES (?, ?, ?, 'user', ?, ?, ?, ?, ?)`,
            [
                username,
                normalizedEmail,
                hash,
                favoriteGameCompany || null,
                favoriteGameGenre || null,
                favoriteGame || null,
                consolesOwned || null,
                consolesWanted || null
            ]
        );

        req.session.user = {
            id: result.insertId,
            username,
            displayName: displayName || username,
            email: normalizedEmail,
            role: 'user'
        };
        req.session.cart = await loadPersistentCart(result.insertId);
        res.redirect('/profile?welcome=1');
    } catch (error) {
        next(error);
    }
});

app.post('/login', async (req, res, next) => {
    try {
        const username = String(req.body.username || '').trim();
        const password = String(req.body.password || '');

        const [rows] = await pool.execute(
            `SELECT id, username, password, email, role
             FROM users
             WHERE LOWER(username)=LOWER(?)
             LIMIT 1`,
            [username]
        );

        if (rows.length === 0) {
            return res.status(401).render('auth', {
                title: 'Log in',
                mode: 'login',
                error: 'Invalid username or password.',
                values: { username }
            });
        }

        const storedPassword = rows[0].password;
        const passwordMatches =
            typeof storedPassword === 'string' &&
            storedPassword.length > 0 &&
            await bcrypt.compare(password, storedPassword);

        if (!passwordMatches) {
            return res.status(401).render('auth', {
                title: 'Log in',
                mode: 'login',
                error: 'Invalid username or password.',
                values: { username }
            });
        }

        req.session.user = sessionUser(rows[0]);
        req.session.cart = await loadPersistentCart(rows[0].id);
        return res.redirect('/dashboard');
    } catch (error) {
        return next(error);
    }
});

app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.get('/dashboard', requireLogin, async (req, res, next) => {
    try {
        const [[products]] = await pool.query("SELECT COUNT(*) total FROM products WHERE status='active'");
        const [[posts]] = await pool.query("SELECT COUNT(*) total FROM forum_posts WHERE status='visible'");
        const [[news]] = await pool.query("SELECT COUNT(*) total FROM news_items WHERE status='visible'");
        res.render('dashboard', {
            title: 'Dashboard',
            stats: {
                products: Number(products.total),
                posts: Number(posts.total),
                news: Number(news.total)
            }
        });
    } catch (error) {
        next(error);
    }
});

app.get('/users/:id', requireLogin, async (req, res, next) => {
    try {
        const userId = Number(req.params.id);
        if (!Number.isInteger(userId) || userId < 1) {
            return res.status(404).render('error', { title: 'Player not found', message: 'That SavePoint player does not exist.' });
        }
        const [rows] = await pool.execute(
            `SELECT id, username, bio, favourite_console,
                    favorite_game_company, favorite_game_genre, favorite_game,
                    consoles_owned, consoles_wanted, profile_image, banner_image,
                    role, created_at
             FROM users WHERE id=? LIMIT 1`,
            [userId]
        );
        if (!rows.length) {
            return res.status(404).render('error', { title: 'Player not found', message: 'That SavePoint player does not exist.' });
        }
        return res.render('userProfile', { title: rows[0].username, profile: rows[0] });
    } catch (error) {
        return next(error);
    }
});

app.get('/profile', requireLogin, async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id, username, email, bio, favourite_console,
                    favorite_game_company, favorite_game_genre, favorite_game,
                    consoles_owned, consoles_wanted, profile_image, banner_image,
                    role, created_at
             FROM users WHERE id=? LIMIT 1`,
            [req.session.user.id]
        );
        if (!rows.length) return res.redirect('/logout');
        res.render('profile', {
            title: 'Profile',
            profile: rows[0],
            welcome: req.query.welcome === '1'
        });
    } catch (error) {
        next(error);
    }
});

app.post('/profile', requireLogin, profileUpload, async (req, res, next) => {
    try {
        const username = String(req.body.username || req.session.user.username || '').trim();
        const email = String(req.body.email || '').trim();
        const bio = String(req.body.bio || '').trim();
        const favouriteConsole = String(req.body.favouriteConsole || '').trim();
        const favoriteGameCompany = String(req.body.favoriteGameCompany || '').trim();
        const favoriteGameGenre = String(req.body.favoriteGameGenre || '').trim();
        const favoriteGame = String(req.body.favoriteGame || '').trim();
        const consolesOwned = String(req.body.consolesOwned || '').trim();
        const consolesWanted = String(req.body.consolesWanted || '').trim();
        const uploadedProfileImage = req.files?.profileImage?.[0];
        const uploadedBannerImage = req.files?.bannerImage?.[0];
        const profileImage = uploadedProfileImage
            ? await saveMediaAsset(uploadedProfileImage, req.session.user.id, 'image')
            : String(req.body.profileImageUrl || req.body.profileImage || '').trim();
        const bannerImage = uploadedBannerImage
            ? await saveMediaAsset(uploadedBannerImage, req.session.user.id, 'image')
            : String(req.body.bannerImageUrl || req.body.bannerImage || '').trim();

        if (!username) {
            return res.status(400).render('error', {
                title: 'Profile error',
                message: 'Username cannot be empty.'
            });
        }

        const normalizedEmail = email || req.session.user.email || `${username}@savepoint.local`;
        const [existing] = await pool.execute(
            'SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND id<>? LIMIT 1',
            [username, req.session.user.id]
        );
        if (existing.length) {
            return res.status(409).render('error', {
                title: 'Profile error',
                message: 'That username is already taken.'
            });
        }

        // Read the current image values first, then send concrete strings in
        // the UPDATE. This avoids MySQL trying to COALESCE values that came
        // from legacy columns with different collations.
        const [currentProfileRows] = await pool.execute(
            `SELECT profile_image, banner_image
             FROM users
             WHERE id=?
             LIMIT 1`,
            [req.session.user.id]
        );

        if (!currentProfileRows.length) {
            return res.status(404).render('error', {
                title: 'Profile not found',
                message: 'Your account could not be found.'
            });
        }

        const finalProfileImage =
            profileImage ||
            currentProfileRows[0].profile_image ||
            '/icons/icon-192.png';

        const finalBannerImage =
            bannerImage ||
            currentProfileRows[0].banner_image ||
            '/icons/icon-512.png';

        await pool.execute(
            `UPDATE users
             SET username=?,
                 email=?,
                 bio=?,
                 favourite_console=?,
                 favorite_game_company=?,
                 favorite_game_genre=?,
                 favorite_game=?,
                 consoles_owned=?,
                 consoles_wanted=?,
                 profile_image=?,
                 banner_image=?
             WHERE id=?`,
            [
                username,
                normalizedEmail,
                bio || null,
                favouriteConsole || null,
                favoriteGameCompany || null,
                favoriteGameGenre || null,
                favoriteGame || null,
                consolesOwned || null,
                consolesWanted || null,
                finalProfileImage,
                finalBannerImage,
                req.session.user.id
            ]
        );

        req.session.user.username = username;
        req.session.user.displayName = username;
        req.session.user.email = normalizedEmail;
        res.redirect('/profile');
    } catch (error) {
        next(error);
    }
});

app.get('/marketplace', requireLogin, async (req, res, next) => {
    try {
        const search = String(req.query.search || '').trim();
        const like = `%${search}%`;
        let sql = `SELECT ${productSelectList('p')}, u.username AS seller_username
                   FROM products p
                   LEFT JOIN users u ON u.id = p.seller_user_id`;
        const params = [];

        if (req.session.user.role === 'admin') {
            // Admins can see and restore sold/removed/out-of-stock listings.
            sql += ' WHERE 1=1';
        } else {
            sql += ` WHERE p.status='active' AND p.quantity>0`;
        }

        if (search) {
            sql += ` AND (p.\`${productSchema.name}\` LIKE ? OR p.category LIKE ? OR p.platform LIKE ?)`;
            params.push(like, like, like);
        }
        sql += ' ORDER BY p.created_at DESC';

        const [products] = await pool.execute(sql, params);
        res.render('marketplace', {
            title: 'Retro Marketplace',
            products,
            search,
            message: req.session.marketplaceMessage || null
        });
        delete req.session.marketplaceMessage;
    } catch (e) { next(e); }
});

async function createMarketplaceProduct(req, res, next) {
    try {
        const title = String(req.body.title || '').trim();
        const description = String(req.body.description || '').trim();
        const category = String(req.body.category || '').trim();
        const platform = String(req.body.platform || '').trim();
        const price = Number(req.body.price);
        const quantity = Number.parseInt(req.body.quantity, 10);
        const image = req.file
            ? await saveMediaAsset(req.file, req.session.user.id, 'image')
            : null;

        if (!title || !category || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 0) {
            return res.status(400).render('error', {
                title: 'Invalid product',
                message: 'Enter a product name, category, price above $0 and a quantity of 0 or more.'
            });
        }

        await pool.execute(
            `INSERT INTO products (\`${productSchema.name}\`,quantity,price,\`${productSchema.image}\`,seller_user_id,description,category,platform,status)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [title, quantity, price, image, req.session.user.id, description || null, category, platform || null, 'active']
        );

        req.session.marketplaceMessage = `${title} was created successfully.`;
        res.redirect('/marketplace');
    } catch (error) {
        next(error);
    }
}

// Admins manage listings directly from the Marketplace page.
app.post('/marketplace/products', requireAdmin, upload.single('image'), createMarketplaceProduct);

// Kept as a backwards-compatible alias for older forms/bookmarks.
app.post('/admin/products', requireAdmin, upload.single('image'), createMarketplaceProduct);

app.post('/marketplace/products/:id/edit', requireAdmin, upload.single('image'), async (req, res, next) => {
    try {
        const productId = Number(req.params.id);
        const title = String(req.body.title || '').trim();
        const description = String(req.body.description || '').trim();
        const category = String(req.body.category || '').trim();
        const platform = String(req.body.platform || '').trim();
        const price = Number(req.body.price);
        const quantity = Number.parseInt(req.body.quantity, 10);
        const status = ['active', 'sold', 'removed'].includes(req.body.status)
            ? req.body.status
            : 'active';

        if (!Number.isInteger(productId) || productId < 1) {
            return res.status(400).render('error', {
                title: 'Invalid product',
                message: 'The selected product ID is invalid.'
            });
        }

        if (!title || !category || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 0) {
            return res.status(400).render('error', {
                title: 'Invalid product',
                message: 'Enter a product name, category, price above $0 and a quantity of 0 or more.'
            });
        }

        const [existingRows] = await pool.execute(
            `SELECT \`${productSchema.image}\` AS image_url
             FROM products
             WHERE \`${productSchema.id}\` = ?
             LIMIT 1`,
            [productId]
        );

        if (!existingRows.length) {
            return res.status(404).render('error', {
                title: 'Product not found',
                message: 'That marketplace listing no longer exists.'
            });
        }

        const image = req.file
            ? await saveMediaAsset(req.file, req.session.user.id, 'image')
            : existingRows[0].image_url;

        await pool.execute(
            `UPDATE products
             SET \`${productSchema.name}\` = ?,
                 description = ?,
                 category = ?,
                 platform = ?,
                 price = ?,
                 quantity = ?,
                 \`${productSchema.image}\` = ?,
                 status = ?
             WHERE \`${productSchema.id}\` = ?`,
            [title, description || null, category, platform || null, price, quantity, image || null, status, productId]
        );

        req.session.marketplaceMessage = `${title} was updated successfully.`;
        res.redirect('/marketplace');
    } catch (error) {
        next(error);
    }
});

async function permanentlyDeleteMarketplaceProduct(req, res, next) {
    try {
        const productId = Number(req.params.id);

        if (!Number.isInteger(productId) || productId < 1) {
            return res.status(400).render('error', {
                title: 'Invalid product',
                message: 'The selected product ID is invalid.'
            });
        }

        const [rows] = await pool.execute(
            `SELECT \`${productSchema.image}\` AS image_url
             FROM products
             WHERE \`${productSchema.id}\` = ?
             LIMIT 1`,
            [productId]
        );

        if (!rows.length) {
            return res.status(404).render('error', {
                title: 'Product not found',
                message: 'That marketplace listing no longer exists.'
            });
        }

        const imageFileName = rows[0].image_url;

        const [result] = await pool.execute(
            `DELETE FROM products
             WHERE \`${productSchema.id}\` = ?`,
            [productId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).render('error', {
                title: 'Product not found',
                message: 'That marketplace listing no longer exists.'
            });
        }

        // Remove the listing from this browser session's cart as well.
        if (req.session.cart) {
            delete req.session.cart[productId];
            delete req.session.cart[String(productId)];
        }

        // Delete an uploaded image only when no other product references it.
        if (imageFileName && !String(imageFileName).startsWith('/media/')) {
            const [imageReferences] = await pool.execute(
                `SELECT COUNT(*) AS total
                 FROM products
                 WHERE \`${productSchema.image}\` = ?`,
                [imageFileName]
            );

            const protectedImages = new Set([
                'placeholder.png',
                'default_product.png'
            ]);

            if (
                Number(imageReferences[0].total) === 0 &&
                !protectedImages.has(imageFileName)
            ) {
                const imagePath = path.join(
                    imageDirectory,
                    path.basename(imageFileName)
                );

                try {
                    await fs.promises.unlink(imagePath);
                } catch (fileError) {
                    if (fileError.code !== 'ENOENT') {
                        console.warn(
                            `Product ${productId} was deleted, but its image could not be removed:`,
                            fileError.message
                        );
                    }
                }
            }
        }

        req.session.marketplaceMessage =
            'The marketplace listing was permanently deleted.';

        return res.redirect('/marketplace');
    } catch (error) {
        if (
            error.code === 'ER_ROW_IS_REFERENCED_2' ||
            error.code === 'ER_ROW_IS_REFERENCED'
        ) {
            return res.status(409).render('error', {
                title: 'Listing cannot be deleted',
                message:
                    'This listing is connected to an existing order. ' +
                    'Edit it and set its status to Removed instead so ' +
                    'the purchase history remains intact.'
            });
        }

        return next(error);
    }
}

app.post(
    '/marketplace/products/:id/delete',
    requireAdmin,
    permanentlyDeleteMarketplaceProduct
);

app.post('/cart/add/:id', requireRegularUser, async (req, res, next) => {
    try {
        const productId = Number(req.params.id);
        if (!Number.isInteger(productId) || productId < 1) {
            return res.status(400).render('error', {
                title: 'Invalid product',
                message: 'The selected product ID is invalid.'
            });
        }
        const requestedQuantity = Number.parseInt(req.body.quantity, 10);
        const [rows] = await pool.execute(
            `SELECT \`${productSchema.id}\` AS id, \`${productSchema.name}\` AS title, quantity
             FROM products
             WHERE \`${productSchema.id}\`=? AND status='active'
             LIMIT 1`,
            [productId]
        );

        if (!rows.length) {
            return res.status(404).render('error', {
                title: 'Product unavailable',
                message: 'That product is no longer available.'
            });
        }

        const product = rows[0];
        const quantity = Number.isInteger(requestedQuantity) && requestedQuantity > 0 ? requestedQuantity : 1;
        req.session.cart = req.session.cart || {};
        const existing = Number(req.session.cart[productId] || 0);

        if (existing + quantity > Number(product.quantity)) {
            req.session.marketplaceMessage = `Only ${product.quantity} unit(s) of ${product.title} are available.`;
            return res.redirect('/marketplace');
        }

        req.session.cart[productId] = existing + quantity;
        await savePersistentCartItem(
            req.session.user.id,
            productId,
            req.session.cart[productId]
        );
        req.session.marketplaceMessage = `${product.title} was added to your cart.`;
        res.redirect('/marketplace');
    } catch (e) { next(e); }
});

async function getCartDetails(req) {
    const cart = req.session.cart || {};
    const ids = Object.keys(cart).map(Number).filter(Number.isInteger);
    if (!ids.length) return { items: [], total: 0 };

    const placeholders = ids.map(() => '?').join(',');
    const [products] = await pool.query(
        `SELECT ${productSelectList('p')}
         FROM products p
         WHERE p.\`${productSchema.id}\` IN (${placeholders})`,
        ids
    );

    const items = products
        .filter(product => product.status === 'active')
        .map(product => {
            const selectedQuantity = Math.min(Number(cart[product.id] || 0), Number(product.quantity));
            cart[product.id] = selectedQuantity;
            return {
                ...product,
                selectedQuantity,
                lineTotal: Number(product.price) * selectedQuantity
            };
        })
        .filter(item => item.selectedQuantity > 0);

    const total = items.reduce((sum, item) => sum + item.lineTotal, 0);
    return { items, total };
}

app.get('/cart', requireRegularUser, async (req, res, next) => {
    try {
        const cart = await getCartDetails(req);
        res.render('cart', { title: 'Your Cart', ...cart });
    } catch (e) { next(e); }
});

app.post('/cart/:id/decrease', requireRegularUser, async (req, res, next) => {
    try {
        const id = Number(req.params.id);
        req.session.cart = req.session.cart || {};

        if (req.session.cart[id]) {
            req.session.cart[id] -= 1;

            if (req.session.cart[id] <= 0) {
                delete req.session.cart[id];
                await savePersistentCartItem(req.session.user.id, id, 0);
            } else {
                await savePersistentCartItem(
                    req.session.user.id,
                    id,
                    req.session.cart[id]
                );
            }
        }

        return res.redirect('/cart');
    } catch (error) {
        return next(error);
    }
});

app.post('/cart/:id/remove', requireRegularUser, async (req, res, next) => {
    try {
        const productId = Number(req.params.id);
        req.session.cart = req.session.cart || {};
        delete req.session.cart[productId];
        await savePersistentCartItem(req.session.user.id, productId, 0);
        return res.redirect('/cart');
    } catch (error) {
        return next(error);
    }
});

app.get('/purchase', requireRegularUser, async (req, res, next) => {
    try {
        const cart = await getCartDetails(req);
        if (!cart.items.length) return res.redirect('/cart');
        res.render('purchase', { title: 'Checkout', ...cart, error: null, values: { name: req.session.user.displayName, email: req.session.user.email || '', address: '' } });
    } catch (e) { next(e); }
});

app.post('/purchase', requireRegularUser, async (req, res, next) => {
    let connection;
    let transactionStarted = false;

    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim();
        const address = String(req.body.address || '').trim();
        const cardNumber = String(req.body.cardNumber || '').replace(/[\s-]/g, '');

        const cart = await getCartDetails(req);

        if (!cart.items.length) {
            return res.redirect('/cart');
        }

        if (
            !name ||
            !email ||
            !address ||
            !/^\S+@\S+\.\S+$/.test(email) ||
            !/^\d{13,19}$/.test(cardNumber)
        ) {
            return res.status(400).render('purchase', {
                title: 'Checkout',
                ...cart,
                error: 'Enter a name, valid email, address and a 13–19 digit card number.',
                values: { name, email, address }
            });
        }

        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionStarted = true;

        for (const item of cart.items) {
            const [locked] = await connection.execute(
                `SELECT quantity, status
                 FROM products
                 WHERE \`${productSchema.id}\` = ?
                 FOR UPDATE`,
                [item.id]
            );

            if (
                !locked.length ||
                locked[0].status !== 'active' ||
                Number(locked[0].quantity) < item.selectedQuantity
            ) {
                throw new Error(`${item.title} no longer has enough stock.`);
            }
        }

        const lastFour = cardNumber.slice(-4);

        const [orderResult] = await connection.execute(
            `INSERT INTO orders (
                user_id,
                customer_name,
                customer_email,
                delivery_address,
                card_last_four,
                total_price
            )
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                req.session.user.id,
                name,
                email,
                address,
                lastFour,
                cart.total
            ]
        );

        for (const item of cart.items) {
            await connection.execute(
                `INSERT INTO order_items (
                    order_id,
                    product_id,
                    product_title,
                    unit_price,
                    quantity,
                    line_total
                )
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    orderResult.insertId,
                    item.id,
                    item.title,
                    item.price,
                    item.selectedQuantity,
                    item.lineTotal
                ]
            );

            await connection.execute(
                `UPDATE products
                 SET
                    quantity = quantity - ?,
                    status = IF(quantity - ? <= 0, 'sold', 'active')
                 WHERE \`${productSchema.id}\` = ?`,
                [
                    item.selectedQuantity,
                    item.selectedQuantity,
                    item.id
                ]
            );
        }

        await clearPersistentCart(req.session.user.id, connection);

        await connection.commit();
        transactionStarted = false;

        req.session.cart = {};
        res.redirect(`/confirmation/${orderResult.insertId}`);
    } catch (error) {
        if (connection && transactionStarted) {
            await connection.rollback();
        }

        next(error);
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

app.get('/confirmation/:id', requireRegularUser, async (req, res, next) => {
    try {
        const [orders] = await pool.execute('SELECT * FROM orders WHERE id=? AND user_id=? LIMIT 1', [Number(req.params.id), req.session.user.id]);
        if (!orders.length) return res.status(404).render('error', { title: 'Order not found', message: 'That confirmation could not be found.' });
        const [items] = await pool.execute('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [orders[0].id]);
        res.render('confirmation', { title: 'Purchase Confirmed', order: orders[0], items });
    } catch (e) { next(e); }
});



app.use(forumFeature.router);

function parseSelectedNewsSources(value) {
    if (value === undefined || value === null || value === '') return null;
    if (Array.isArray(value)) return value;
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

app.get('/news', (req, res) => res.redirect('/newshub'));

app.get('/newshub', requireLogin, (req, res) => {
    newsHub.startBackgroundRefresh();
    const initialNews = newsHub.getNewsPage({
        page: 1,
        limit: 6,
        type: req.query.type || 'all',
        source: req.query.source || 'all',
        selectedSources: parseSelectedNewsSources(req.query.sources)
    });

    res.render('newshub/index', {
        title: 'NewsHub',
        initialNews,
        newsTypes: newsHub.NEWS_TYPES,
        sources: newsHub.TRUSTED_SOURCES
    });
});

app.get('/api/newshub/news', requireLogin, async (req, res, next) => {
    try {
        if (req.query.force === '1') await newsHub.refreshArticles({ force: true });
        else if (newsHub.getNewsPage({ page: 1, limit: 1 }).total === 0) await newsHub.refreshArticles();

        res.json(newsHub.getNewsPage({
            page: req.query.page || 1,
            limit: req.query.limit || 6,
            type: req.query.type || 'all',
            source: req.query.source || 'all',
            selectedSources: parseSelectedNewsSources(req.query.sources)
        }));
    } catch (error) {
        next(error);
    }
});

app.get('/api/newshub/daily-report', requireLogin, async (req, res, next) => {
    try {
        await newsHub.refreshArticles({ force: req.query.force === '1' });
        res.json({ report: newsHub.buildDailyReport(parseSelectedNewsSources(req.query.sources)) });
    } catch (error) {
        next(error);
    }
});

app.get('/api/newshub/monthly-report', requireLogin, async (req, res, next) => {
    try {
        await newsHub.refreshArticles({ force: req.query.force === '1' });
        res.json({ report: newsHub.buildMonthlyReport(parseSelectedNewsSources(req.query.sources)) });
    } catch (error) {
        next(error);
    }
});

app.get('/contact', (req, res) => res.render('contact', { title: 'Contact Us', success: null, error: null }));

app.post('/contact', async (req, res, next) => {
    try {
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim();
        const message = String(req.body.message || '').trim();

        if (!name || !email || !message) {
            return res.status(400).render('contact', {
                title: 'Contact Us',
                success: null,
                error: 'Please fill in your name, email and a message.'
            });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(400).render('contact', {
                title: 'Contact Us',
                success: null,
                error: 'Please enter a valid email address.'
            });
        }

        const mailOptions = {
            from: process.env.SMTP_FROM || process.env.SMTP_USER || 'savepoint@example.com',
            to: process.env.CONTACT_TO || process.env.SMTP_USER || 'support@savepoint.com',
            subject: `New contact form message from ${name}`,
            text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
        };

        if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
            console.warn('SMTP credentials not configured; contact form message was not sent.');
            return res.status(503).render('contact', {
                title: 'Contact Us',
                success: null,
                error: 'Email delivery is not configured yet. Please contact support@savepoint.com directly.'
            });
        }

        await transporter.sendMail(mailOptions);
        return res.render('contact', {
            title: 'Contact Us',
            success: 'Your message has been sent. We will get back to you soon.',
            error: null
        });
    } catch (error) {
        next(error);
    }
});

app.get('/admin', requireAdmin, async (req, res, next) => {
    try {
        const [users] = await pool.query(`
            SELECT
                id,
                username,
                username AS display_name,
                role,
                created_at
            FROM users
            ORDER BY created_at DESC
        `);

        const [products] = await pool.query(`
            SELECT
                \`${productSchema.id}\` AS id,
                \`${productSchema.name}\` AS title,
                status,
                created_at
            FROM products
            WHERE status != 'removed'
            ORDER BY created_at DESC
        `);

        const [posts] = await pool.query(`
            SELECT
                id,
                title,
                status,
                created_at
            FROM forum_posts
            ORDER BY created_at DESC
        `);

        res.render('admin', {
            title: 'Admin Panel',
            users,
            products,
            posts
        });
    } catch (error) {
        next(error);
    }
});

// Backwards-compatible alias for the old Admin Panel delete form.
app.post(
    '/admin/products/:id/delete',
    requireAdmin,
    permanentlyDeleteMarketplaceProduct
);

app.post('/admin/posts/:id/delete', requireAdmin, async (req, res, next) => { try { await pool.execute("UPDATE forum_posts SET status='removed' WHERE id=?", [Number(req.params.id)]); res.redirect('/admin'); } catch (e) { next(e); } });

app.get('/health', async (req, res) => { try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected' }); } catch (e) { res.status(500).json({ ok: false, database: 'disconnected' }); } });

app.use((req, res) => res.status(404).render('error', { title: 'Page not found', message: 'That save file does not exist.' }));

app.use((e, req, res, next) => { console.error(e); res.status(500).render('error', { title: 'Application error', message: process.env.NODE_ENV === 'production' ? 'SavePoint ran into an unexpected error.' : e.message }); });

async function ensureDatabaseExists() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' }
    });

    try {
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\``);
        console.log(`Database ${process.env.DB_NAME} is ready`);
    } finally {
        await connection.end();
    }
}

async function startServer() {
    try {
        await ensureDatabaseExists();
        await pool.query('SELECT 1');
        console.log('Connected to MySQL database');
        await initialiseDatabase();
        await forumFeature.ensureForumStorage();
        await newsHub.ensureNewsHubStorage();
        await newsHub.hydrateCacheFromDatabase();
        newsHub.startBackgroundRefresh();
        console.log('SavePoint database tables are ready');
        app.listen(PORT, '0.0.0.0', () => console.log(`SavePoint is running at http://localhost:${PORT}`));
    } catch (e) {
        console.error('Could not start SavePoint:', e);
        process.exit(1);
    }
}

startServer();
