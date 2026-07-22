require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const multer = require('multer');
const pool = require('./config/db');
const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Lesson 18-style product image uploads.
const imageDirectory = path.join(__dirname, 'public', 'images');
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

// Some earlier lesson databases use productId/productName/image, while newer
// SavePoint databases use id/title/image_url. This object is detected at startup
// so all marketplace queries work with the existing products table.
let productSchema = {
    id: 'id',
    name: 'title',
    image: 'image_url'
};

async function configureProductSchema() {
    const [columns] = await pool.query('SHOW COLUMNS FROM products');
    const names = new Set(columns.map(column => column.Field));

    productSchema.id = names.has('productId') ? 'productId' : 'id';
    productSchema.name = names.has('productName') ? 'productName' : 'title';
    productSchema.image = names.has('image') ? 'image' : 'image_url';

    const additions = [
        ['seller_user_id', 'INT NULL'],
        ['description', 'TEXT NULL'],
        ['category', "VARCHAR(80) NOT NULL DEFAULT 'Games'"],
        ['platform', 'VARCHAR(80) NULL'],
        ['status', "ENUM('active','sold','removed') NOT NULL DEFAULT 'active'"],
        ['created_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP']
    ];

    for (const [column, definition] of additions) {
        if (!names.has(column)) {
            await pool.query(`ALTER TABLE products ADD COLUMN \`${column}\` ${definition}`);
            names.add(column);
        }
    }
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

app.use((req, res, next) => { res.locals.currentUser = req.session.user || null; res.locals.isAdmin = req.session.user?.role === 'admin'; res.locals.currentPath = req.path; next(); });

function requireLogin(req, res, next) { if (!req.session.user) return res.redirect('/login'); next(); }

function requireAdmin(req, res, next) { if (!req.session.user) return res.redirect('/login'); if (req.session.user.role !== 'admin') return res.status(403).render('error', { title: 'Access denied', message: 'This page is available only to SavePoint administrators.' }); next(); }

async function seedAccount({ username, password, displayName, email, role }) { const [rows] = await pool.execute('SELECT id FROM users WHERE username=? LIMIT 1', [username]); if (rows.length) return; const hash = await bcrypt.hash(password, 12); await pool.execute('INSERT INTO users (username,password_hash,display_name,email,role) VALUES (?,?,?,?,?)', [username, hash, displayName, email, role]); }

async function initialiseDatabase() {
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(50) NOT NULL UNIQUE,password_hash VARCHAR(255) NOT NULL,display_name VARCHAR(100) NOT NULL,email VARCHAR(150),bio TEXT,favourite_console VARCHAR(100),role ENUM('user','admin') NOT NULL DEFAULT 'user',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS products (productId INT AUTO_INCREMENT PRIMARY KEY,productName VARCHAR(150) NOT NULL,quantity INT NOT NULL DEFAULT 1,price DECIMAL(10,2) NOT NULL DEFAULT 0,image VARCHAR(255),seller_user_id INT NULL,description TEXT,category VARCHAR(80) NOT NULL DEFAULT 'Games',platform VARCHAR(80),status ENUM('active','sold','removed') NOT NULL DEFAULT 'active',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await configureProductSchema();
    await pool.query(`CREATE TABLE IF NOT EXISTS forum_posts (id INT AUTO_INCREMENT PRIMARY KEY,author_user_id INT NULL,title VARCHAR(180) NOT NULL,body TEXT NOT NULL,status ENUM('visible','removed') NOT NULL DEFAULT 'visible',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,CONSTRAINT fk_forum_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS news_items (id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(200) NOT NULL,summary TEXT,source_name VARCHAR(120),source_url VARCHAR(500),published_at DATETIME,status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS orders (id INT AUTO_INCREMENT PRIMARY KEY,user_id INT NOT NULL,customer_name VARCHAR(120) NOT NULL,customer_email VARCHAR(150) NOT NULL,delivery_address TEXT NOT NULL,card_last_four CHAR(4) NOT NULL,total_price DECIMAL(10,2) NOT NULL,status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS order_items (id INT AUTO_INCREMENT PRIMARY KEY,order_id INT NOT NULL,product_id INT NULL,product_title VARCHAR(150) NOT NULL,unit_price DECIMAL(10,2) NOT NULL,quantity INT NOT NULL,line_total DECIMAL(10,2) NOT NULL,CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE)`);
    await seedAccount({ username: 'SavePoint', password: 'NintendoGamesTheyreSoFunToPlay', displayName: 'SavePoint Admin', email: 'admin@savepoint.local', role: 'admin' });
    await seedAccount({ username: 'Dingleton', password: '123', displayName: 'Dingleton', email: 'dingleton@savepoint.local', role: 'user' });
    const [[pc]] = await pool.query('SELECT COUNT(*) total FROM products');
    if (!Number(pc.total)) {
        const [[u]] = await pool.execute('SELECT id FROM users WHERE username=?', ['SavePoint']);
        await pool.execute(
            `INSERT INTO products (\`${productSchema.name}\`,quantity,price,\`${productSchema.image}\`,seller_user_id,description,category,platform,status) VALUES (?,?,?,?,?,?,?,?,?)`,
            ['Nintendo Game Boy Color', 1, 129.90, null, u.id, 'Starter marketplace listing.', 'Hardware', 'Game Boy', 'active']
        );
    }
    const [[fc]] = await pool.query('SELECT COUNT(*) total FROM forum_posts'); if (!Number(fc.total)) { const [[u]] = await pool.execute('SELECT id FROM users WHERE username=?', ['Dingleton']); await pool.execute('INSERT INTO forum_posts (author_user_id,title,body) VALUES (?,?,?)', [u.id, 'What retro game are you playing right now?', 'Starter discussion post.']); }
    const [[nc]] = await pool.query('SELECT COUNT(*) total FROM news_items'); if (!Number(nc.total)) await pool.execute('INSERT INTO news_items (title,summary,source_name,published_at) VALUES (?,?,?,NOW())', ['SavePoint News Hub is ready', 'This confirms that retro gaming news can be stored in MySQL.', 'SavePoint']);
}

const sessionUser = u => ({ id: u.id, username: u.username, displayName: u.display_name, email: u.email, role: u.role });

app.get('/', (req, res) => res.redirect(req.session.user ? '/dashboard' : '/login'));

app.get('/login', (req, res) => { if (req.session.user) return res.redirect('/dashboard'); res.render('auth', { title: 'Log in', mode: 'login', error: null, values: {} }); });

app.get('/signup', (req, res) => { if (req.session.user) return res.redirect('/dashboard'); res.render('auth', { title: 'Create account', mode: 'signup', error: null, values: {} }); });

app.post('/signup', async (req, res, next) => { try { const username = String(req.body.username || '').trim(), displayName = String(req.body.displayName || '').trim(), email = String(req.body.email || '').trim(), password = String(req.body.password || ''); if (!username || !displayName || !password) return res.status(400).render('auth', { title: 'Create account', mode: 'signup', error: 'Username, display name and password are required.', values: { username, displayName, email } }); if (username.length < 3 || password.length < 6) return res.status(400).render('auth', { title: 'Create account', mode: 'signup', error: 'Username must be at least 3 characters and password at least 6 characters.', values: { username, displayName, email } }); const [e] = await pool.execute('SELECT id FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1', [username]); if (e.length) return res.status(409).render('auth', { title: 'Create account', mode: 'signup', error: 'That username is already taken.', values: { username, displayName, email } }); const hash = await bcrypt.hash(password, 12); const [r] = await pool.execute("INSERT INTO users (username,password_hash,display_name,email,role) VALUES (?,?,?,?,'user')", [username, hash, displayName, email || null]); req.session.user = { id: r.insertId, username, displayName, email: email || null, role: 'user' }; res.redirect('/dashboard'); } catch (e) { next(e); } });

app.post('/login', async (req, res, next) => { try { const username = String(req.body.username || '').trim(), password = String(req.body.password || ''); const [rows] = await pool.execute('SELECT id,username,password_hash,display_name,email,role FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1', [username]); if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).render('auth', { title: 'Log in', mode: 'login', error: 'Invalid username or password.', values: { username } }); req.session.user = sessionUser(rows[0]); res.redirect('/dashboard'); } catch (e) { next(e); } });

app.post('/logout', (req, res) => req.session.destroy(() => res.redirect('/login')));

app.get('/dashboard', requireLogin, async (req, res, next) => { try { const [[a]] = await pool.query("SELECT COUNT(*) total FROM products WHERE status='active'"), [[b]] = await pool.query("SELECT COUNT(*) total FROM forum_posts WHERE status='visible'"), [[c]] = await pool.query("SELECT COUNT(*) total FROM news_items WHERE status='visible'"); res.render('dashboard', { title: 'Dashboard', stats: { products: Number(a.total), posts: Number(b.total), news: Number(c.total) } }); } catch (e) { next(e); } });

app.get('/profile', requireLogin, async (req, res, next) => { try { const [rows] = await pool.execute('SELECT id,username,display_name,email,bio,favourite_console,role,created_at FROM users WHERE id=? LIMIT 1', [req.session.user.id]); if (!rows.length) return res.redirect('/logout'); res.render('profile', { title: 'Profile', profile: rows[0] }); } catch (e) { next(e); } });

app.post('/profile', requireLogin, async (req, res, next) => { try { const displayName = String(req.body.displayName || '').trim(), email = String(req.body.email || '').trim(), bio = String(req.body.bio || '').trim(), fc = String(req.body.favouriteConsole || '').trim(); if (!displayName) return res.status(400).render('error', { title: 'Profile error', message: 'Display name cannot be empty.' }); await pool.execute('UPDATE users SET display_name=?,email=?,bio=?,favourite_console=? WHERE id=?', [displayName, email || null, bio || null, fc || null, req.session.user.id]); req.session.user.displayName = displayName; res.redirect('/profile'); } catch (e) { next(e); } });

app.get('/marketplace', requireLogin, async (req, res, next) => {
    try {
        const search = String(req.query.search || '').trim();
        const like = `%${search}%`;
        let sql = `SELECT ${productSelectList('p')}, u.username AS seller_username
                   FROM products p
                   LEFT JOIN users u ON u.id = p.seller_user_id
                   WHERE p.status='active' AND p.quantity>0`;
        const params = [];

        if (search) {
            sql += ` AND (p.\`${productSchema.name}\` LIKE ? OR p.category LIKE ? OR p.platform LIKE ?)`;
            params.push(like, like, like);
        }
        sql += ' ORDER BY p.created_at DESC';

        const [products] = await pool.execute(sql, params);
        const cartCount = Object.values(req.session.cart || {}).reduce((sum, quantity) => sum + Number(quantity), 0);
        res.render('marketplace', {
            title: 'Retro Marketplace',
            products,
            search,
            cartCount,
            message: req.session.marketplaceMessage || null
        });
        delete req.session.marketplaceMessage;
    } catch (e) { next(e); }
});

app.post('/admin/products', requireAdmin, upload.single('image'), async (req, res, next) => {
    try {
        const title = String(req.body.title || '').trim();
        const description = String(req.body.description || '').trim();
        const category = String(req.body.category || '').trim();
        const platform = String(req.body.platform || '').trim();
        const price = Number(req.body.price);
        const quantity = Number.parseInt(req.body.quantity, 10);
        const image = req.file ? req.file.filename : null;

        if (!title || !category || !Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity < 1) {
            return res.status(400).render('error', {
                title: 'Invalid product',
                message: 'Enter a product name, category, price above $0 and quantity of at least 1.'
            });
        }

        await pool.execute(
            `INSERT INTO products (\`${productSchema.name}\`,quantity,price,\`${productSchema.image}\`,seller_user_id,description,category,platform,status)
             VALUES (?,?,?,?,?,?,?,?,?)`,
            [title, quantity, price, image, req.session.user.id, description || null, category, platform || null, 'active']
        );
        res.redirect('/admin');
    } catch (e) { next(e); }
});

app.post('/cart/add/:id', requireLogin, async (req, res, next) => {
    try {
        if (req.session.user.role === 'admin') {
            return res.status(403).render('error', {
                title: 'Admin restriction',
                message: 'Administrator accounts manage products and cannot purchase them.'
            });
        }

        const productId = Number(req.params.id);
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

app.get('/cart', requireLogin, async (req, res, next) => {
    try {
        if (req.session.user.role === 'admin') return res.status(403).render('error', { title: 'Admin restriction', message: 'Administrator accounts do not have shopping carts.' });
        const cart = await getCartDetails(req);
        res.render('cart', { title: 'Your Cart', ...cart });
    } catch (e) { next(e); }
});

app.post('/cart/:id/decrease', requireLogin, (req, res) => {
    const id = Number(req.params.id);
    req.session.cart = req.session.cart || {};
    if (req.session.cart[id]) {
        req.session.cart[id] -= 1;
        if (req.session.cart[id] <= 0) delete req.session.cart[id];
    }
    res.redirect('/cart');
});

app.post('/cart/:id/remove', requireLogin, (req, res) => {
    req.session.cart = req.session.cart || {};
    delete req.session.cart[Number(req.params.id)];
    res.redirect('/cart');
});

app.get('/purchase', requireLogin, async (req, res, next) => {
    try {
        if (req.session.user.role === 'admin') return res.status(403).render('error', { title: 'Admin restriction', message: 'Administrator accounts cannot make purchases.' });
        const cart = await getCartDetails(req);
        if (!cart.items.length) return res.redirect('/cart');
        res.render('purchase', { title: 'Checkout', ...cart, error: null, values: { name: req.session.user.displayName, email: req.session.user.email || '', address: '' } });
    } catch (e) { next(e); }
});

app.post('/purchase', requireLogin, async (req, res, next) => {
    const connection = await pool.getConnection();
    try {
        if (req.session.user.role === 'admin') return res.status(403).render('error', { title: 'Admin restriction', message: 'Administrator accounts cannot make purchases.' });
        const name = String(req.body.name || '').trim();
        const email = String(req.body.email || '').trim();
        const address = String(req.body.address || '').trim();
        const cardNumber = String(req.body.cardNumber || '').replace(/[\s-]/g, '');
        const cart = await getCartDetails(req);
        if (!cart.items.length) return res.redirect('/cart');
        if (!name || !email || !address || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{13,19}$/.test(cardNumber)) {
            return res.status(400).render('purchase', { title: 'Checkout', ...cart, error: 'Enter a name, valid email, address and a 13–19 digit card number.', values: { name, email, address } });
        }
        await connection.beginTransaction();
        for (const item of cart.items) {
            const [locked] = await connection.execute(`SELECT quantity,status FROM products WHERE \`${productSchema.id}\`=? FOR UPDATE`, [item.id]);
            if (!locked.length || locked[0].status !== 'active' || locked[0].quantity < item.selectedQuantity) throw new Error(`${item.title} no longer has enough stock.`);
        }
        const lastFour = cardNumber.slice(-4);
        const [orderResult] = await connection.execute('INSERT INTO orders (user_id,customer_name,customer_email,delivery_address,card_last_four,total_price) VALUES (?,?,?,?,?,?)', [req.session.user.id, name, email, address, lastFour, cart.total]);
        for (const item of cart.items) {
            await connection.execute('INSERT INTO order_items (order_id,product_id,product_title,unit_price,quantity,line_total) VALUES (?,?,?,?,?,?)', [orderResult.insertId, item.id, item.title, item.price, item.selectedQuantity, item.lineTotal]);
            await connection.execute(`UPDATE products SET quantity=quantity-?, status=IF(quantity-?<=0,'sold','active') WHERE \`${productSchema.id}\`=?`, [item.selectedQuantity, item.selectedQuantity, item.id]);
        }
        await connection.commit();
        req.session.cart = {};
        res.redirect(`/confirmation/${orderResult.insertId}`);
    } catch (e) {
        await connection.rollback();
        next(e);
    } finally { connection.release(); }
});

app.get('/confirmation/:id', requireLogin, async (req, res, next) => {
    try {
        const [orders] = await pool.execute('SELECT * FROM orders WHERE id=? AND user_id=? LIMIT 1', [Number(req.params.id), req.session.user.id]);
        if (!orders.length) return res.status(404).render('error', { title: 'Order not found', message: 'That confirmation could not be found.' });
        const [items] = await pool.execute('SELECT * FROM order_items WHERE order_id=? ORDER BY id', [orders[0].id]);
        res.render('confirmation', { title: 'Purchase Confirmed', order: orders[0], items });
    } catch (e) { next(e); }
});

app.get('/forum', requireLogin, async (req, res, next) => { try { const [rows] = await pool.query("SELECT f.*,u.username author_username FROM forum_posts f LEFT JOIN users u ON u.id=f.author_user_id WHERE f.status='visible' ORDER BY f.created_at DESC"); res.render('placeholder', { title: 'Community Forum', heading: 'Discuss retro games with the community', description: 'The forum table is ready for posts, comments and voting.', items: rows.map(x => ({ title: x.title, detail: `Posted by ${x.author_username || 'Deleted user'}` })) }); } catch (e) { next(e); } });

app.get('/news', requireLogin, async (req, res, next) => { try { const [rows] = await pool.query("SELECT * FROM news_items WHERE status='visible' ORDER BY COALESCE(published_at,created_at) DESC"); res.render('placeholder', { title: 'News Hub', heading: 'Retro gaming news hub', description: 'News records are stored in MySQL. RSS/API integration can be added later.', items: rows.map(x => ({ title: x.title, detail: x.source_name || 'SavePoint' })) }); } catch (e) { next(e); } });

app.get('/admin', requireAdmin, async (req, res, next) => { try { const [users] = await pool.query('SELECT id,username,display_name,role,created_at FROM users ORDER BY created_at DESC'), [products] = await pool.query(`SELECT \`${productSchema.id}\` AS id, \`${productSchema.name}\` AS title, status, created_at FROM products ORDER BY created_at DESC`), [posts] = await pool.query('SELECT id,title,status,created_at FROM forum_posts ORDER BY created_at DESC'); res.render('admin', { title: 'Admin Panel', users, products, posts }); } catch (e) { next(e); } });

app.post('/admin/products/:id/delete', requireAdmin, async (req, res, next) => { try { await pool.execute(`UPDATE products SET status='removed' WHERE \`${productSchema.id}\`=?`, [Number(req.params.id)]); res.redirect('/admin'); } catch (e) { next(e); } });

app.post('/admin/posts/:id/delete', requireAdmin, async (req, res, next) => { try { await pool.execute("UPDATE forum_posts SET status='removed' WHERE id=?", [Number(req.params.id)]); res.redirect('/admin'); } catch (e) { next(e); } });

app.get('/health', async (req, res) => { try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected' }); } catch (e) { res.status(500).json({ ok: false, database: 'disconnected' }); } });

app.use((req, res) => res.status(404).render('error', { title: 'Page not found', message: 'That save file does not exist.' }));

app.use((e, req, res, next) => { console.error(e); res.status(500).render('error', { title: 'Application error', message: process.env.NODE_ENV === 'production' ? 'SavePoint ran into an unexpected error.' : e.message }); });

async function startServer() { try { await pool.query('SELECT 1'); console.log('Connected to MySQL database'); await initialiseDatabase(); console.log('SavePoint database tables are ready'); app.listen(PORT, '0.0.0.0', () => console.log(`SavePoint is running at http://localhost:${PORT}`)); } catch (e) { console.error('Could not start SavePoint:', e); process.exit(1); } } startServer();
