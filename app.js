require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const mysql = require('mysql2/promise');
const pool = require('./config/db');
const newsHub = require('./src/services/newshub.service');
const app = express();
const PORT = Number(process.env.PORT) || 3001;
const fs = require('fs');

// Lesson 18-style product image uploads.
const imageDirectory = path.join(__dirname, 'public', 'images');
if (!fs.existsSync(imageDirectory)) {
    fs.mkdirSync(imageDirectory, {
        recursive: true
    });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, imageDirectory),
    filename: (req, file, cb) => {
        const safeOriginalName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
        cb(null, `${Date.now()}-${safeOriginalName}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Only image files can be uploaded.'));
        }
        cb(null, true);
    }
});

const profileUpload = upload.fields([
    { name: 'profileImage', maxCount: 1 },
    { name: 'bannerImage', maxCount: 1 }
]);

const profileSuggestions = Object.freeze({
    platforms: [
        'Nintendo',
        'PlayStation',
        'Xbox',
        'Computer',
        'Arcade',
        'Mobile'
    ],
    gameCompanies: [
        'Nintendo',
        'Capcom',
        'Square Enix',
        'id Software',
        'Sega',
        'Konami',
        'Namco',
        'Atari',
        'SNK',
        'Rare'
    ],
    gameGenres: [
        'Action',
        'Adventure',
        'Fighter',
        'Platformer',
        'Puzzle',
        'Racing',
        'RPG',
        'Shooter',
        'Simulation',
        'Sports',
        'Strategy'
    ],
    gameConsoles: [
        'Nintendo Entertainment System',
        'Super Nintendo',
        'Nintendo 64',
        'Nintendo GameCube',
        'Nintendo DS',
        'Game Boy',
        'Game Boy Advance',
        'Sega Genesis',
        'Sega Saturn',
        'Sega Dreamcast',
        'PlayStation',
        'PlayStation 2',
        'PSP',
        'Xbox',
        'Atari 2600',
        'MS-DOS PC'
    ]
});

function nullableProfileValue(value, maxLength = 500) {
    const normalized = String(value || '').trim();
    return normalized ? normalized.slice(0, maxLength) : null;
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

app.use(express.static(path.join(__dirname, 'public')));

app.use(session({ secret: process.env.SESSION_SECRET || 'development-only-change-me', resave: false, saveUninitialized: false, cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400000 } }));

app.use((req, res, next) => {
    res.locals.currentUser =
        req.session.user || null;

    res.locals.isAdmin =
        req.session.user?.role === 'admin';

    res.locals.currentPath = req.path;

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
            favorite_game_company VARCHAR(150) NULL,
            favorite_game_genre VARCHAR(150) NULL,
            favorite_game VARCHAR(150) NULL,
            consoles_owned TEXT NULL,
            consoles_wanted TEXT NULL,
            profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
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
        migrations.push('ALTER TABLE users ADD COLUMN favorite_game_company VARCHAR(150) NULL');
    }
    if (!existing.has('favorite_game_genre')) {
        migrations.push('ALTER TABLE users ADD COLUMN favorite_game_genre VARCHAR(150) NULL');
    }
    if (!existing.has('favorite_game')) {
        migrations.push('ALTER TABLE users ADD COLUMN favorite_game VARCHAR(150) NULL');
    }
    if (!existing.has('consoles_owned')) {
        migrations.push('ALTER TABLE users ADD COLUMN consoles_owned TEXT NULL');
    }
    if (!existing.has('consoles_wanted')) {
        migrations.push('ALTER TABLE users ADD COLUMN consoles_wanted TEXT NULL');
    }
    if (!existing.has('profile_completed')) {
        migrations.push('ALTER TABLE users ADD COLUMN profile_completed BOOLEAN NOT NULL DEFAULT FALSE');
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
    await pool.query(`
        UPDATE users
        SET profile_image = COALESCE(NULLIF(profile_image, ''), 'default_profile.png'),
            banner_image = COALESCE(NULLIF(banner_image, ''), 'default_banner.png'),
            role = COALESCE(role, 'user')
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

        if (!username || !displayName || !password) {
            return res.status(400).render('auth', {
                title: 'Create account', mode: 'signup',
                error: 'Username, display name and password are required.',
                values: { username, displayName, email }
            });
        }

        if (username.length < 3 || password.length < 6) {
            return res.status(400).render('auth', {
                title: 'Create account', mode: 'signup',
                error: 'Username must be at least 3 characters and password at least 6 characters.',
                values: { username, displayName, email }
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
                values: { username, displayName, email }
            });
        }

        const hash = await bcrypt.hash(password, 12);
        const normalizedEmail = email || `${username}@savepoint.local`;
        const [result] = await pool.execute(
            "INSERT INTO users (username,email,password,role) VALUES (?,?,?,'user')",
            [username, normalizedEmail, hash]
        );

        req.session.user = {
            id: result.insertId,
            username,
            displayName: displayName || username,
            email: normalizedEmail,
            role: 'user'
        };
        res.redirect('/profile/setup');
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

app.get('/profile/setup', requireLogin, async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT favorite_game_company,
                    favorite_game_genre,
                    favorite_game,
                    consoles_owned,
                    consoles_wanted
             FROM users
             WHERE id=?
             LIMIT 1`,
            [req.session.user.id]
        );

        if (!rows.length) {
            return res.redirect('/logout');
        }

        res.render('profile-survey', {
            title: 'Build SavePoint Profile',
            profile: rows[0],
            suggestions: profileSuggestions,
            error: null
        });
    } catch (error) {
        next(error);
    }
});

app.post('/profile/setup', requireLogin, async (req, res, next) => {
    try {
        const profileValues = {
            favoriteGameCompany: nullableProfileValue(
                req.body.favoriteGameCompany,
                150
            ),
            favoriteGameGenre: nullableProfileValue(
                req.body.favoriteGameGenre,
                150
            ),
            favoriteGame: nullableProfileValue(
                req.body.favoriteGame,
                150
            ),
            consolesOwned: nullableProfileValue(
                req.body.consolesOwned,
                1000
            ),
            consolesWanted: nullableProfileValue(
                req.body.consolesWanted,
                1000
            )
        };

        await pool.execute(
            `UPDATE users
             SET favorite_game_company=?,
                 favorite_game_genre=?,
                 favorite_game=?,
                 consoles_owned=?,
                 consoles_wanted=?,
                 profile_completed=TRUE
             WHERE id=?`,
            [
                profileValues.favoriteGameCompany,
                profileValues.favoriteGameGenre,
                profileValues.favoriteGame,
                profileValues.consolesOwned,
                profileValues.consolesWanted,
                req.session.user.id
            ]
        );

        res.redirect('/profile');
    } catch (error) {
        next(error);
    }
});

app.post('/profile/setup/skip', requireLogin, async (req, res, next) => {
    try {
        await pool.execute(
            'UPDATE users SET profile_completed=FALSE WHERE id=?',
            [req.session.user.id]
        );
        res.redirect('/dashboard');
    } catch (error) {
        next(error);
    }
});

app.get('/profile', requireLogin, async (req, res, next) => {
    try {
        const [rows] = await pool.execute(
            `SELECT id,
                    username,
                    email,
                    bio,
                    favourite_console,
                    favorite_game_company,
                    favorite_game_genre,
                    favorite_game,
                    consoles_owned,
                    consoles_wanted,
                    profile_completed,
                    profile_image,
                    banner_image,
                    role,
                    created_at
             FROM users
             WHERE id=?
             LIMIT 1`,
            [req.session.user.id]
        );

        if (!rows.length) {
            return res.redirect('/logout');
        }

        res.render('profile', {
            title: 'Profile',
            profile: rows[0],
            suggestions: profileSuggestions
        });
    } catch (error) {
        next(error);
    }
});

app.post('/profile', requireLogin, profileUpload, async (req, res, next) => {
    try {
        const username = String(
            req.body.username || req.session.user.username || ''
        ).trim();
        const email = String(req.body.email || '').trim();
        const bio = nullableProfileValue(req.body.bio, 2000);
        const favouriteConsole = nullableProfileValue(
            req.body.favouriteConsole,
            100
        );
        const favoriteGameCompany = nullableProfileValue(
            req.body.favoriteGameCompany,
            150
        );
        const favoriteGameGenre = nullableProfileValue(
            req.body.favoriteGameGenre,
            150
        );
        const favoriteGame = nullableProfileValue(
            req.body.favoriteGame,
            150
        );
        const consolesOwned = nullableProfileValue(
            req.body.consolesOwned,
            1000
        );
        const consolesWanted = nullableProfileValue(
            req.body.consolesWanted,
            1000
        );
        const uploadedProfileImage = req.files?.profileImage?.[0];
        const uploadedBannerImage = req.files?.bannerImage?.[0];
        const profileImage = uploadedProfileImage
            ? `/images/${uploadedProfileImage.filename}`
            : String(
                req.body.profileImageUrl || req.body.profileImage || ''
            ).trim();
        const bannerImage = uploadedBannerImage
            ? `/images/${uploadedBannerImage.filename}`
            : String(
                req.body.bannerImageUrl || req.body.bannerImage || ''
            ).trim();

        if (!username) {
            return res.status(400).render('error', {
                title: 'Profile error',
                message: 'Username cannot be empty.'
            });
        }

        const normalizedEmail =
            email ||
            req.session.user.email ||
            `${username}@savepoint.local`;
        const [existing] = await pool.execute(
            `SELECT id
             FROM users
             WHERE LOWER(username)=LOWER(?)
               AND id<>?
             LIMIT 1`,
            [username, req.session.user.id]
        );

        if (existing.length) {
            return res.status(409).render('error', {
                title: 'Profile error',
                message: 'That username is already taken.'
            });
        }

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
                 profile_completed=TRUE,
                 profile_image=COALESCE(
                    NULLIF(?, ''),
                    profile_image,
                    'default_profile.png'
                 ),
                 banner_image=COALESCE(
                    NULLIF(?, ''),
                    banner_image,
                    'default_banner.png'
                 )
             WHERE id=?`,
            [
                username,
                normalizedEmail,
                bio,
                favouriteConsole,
                favoriteGameCompany,
                favoriteGameGenre,
                favoriteGame,
                consolesOwned,
                consolesWanted,
                profileImage,
                bannerImage,
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
        const image = req.file ? req.file.filename : null;

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
            ? req.file.filename
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
        if (imageFileName) {
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

app.post('/cart/:id/decrease', requireRegularUser, (req, res) => {
    const id = Number(req.params.id);
    req.session.cart = req.session.cart || {};
    if (req.session.cart[id]) {
        req.session.cart[id] -= 1;
        if (req.session.cart[id] <= 0) delete req.session.cart[id];
    }
    res.redirect('/cart');
});

app.post('/cart/:id/remove', requireRegularUser, (req, res) => {
    req.session.cart = req.session.cart || {};
    delete req.session.cart[Number(req.params.id)];
    res.redirect('/cart');
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

app.get('/forum', requireLogin, async (req, res, next) => { try { const [rows] = await pool.query("SELECT f.*,u.username author_username FROM forum_posts f LEFT JOIN users u ON u.id=f.author_user_id WHERE f.status='visible' ORDER BY f.created_at DESC"); res.render('placeholder', { title: 'Community Forum', heading: 'Discuss retro games with the community', description: 'The forum table is ready for posts, comments and voting.', items: rows.map(x => ({ title: x.title, detail: `Posted by ${x.author_username || 'Deleted user'}` })) }); } catch (e) { next(e); } });

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

app.get('/contact', (req, res) => res.render('contact', { title: 'Contact Us' }));

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
