require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
<<<<<<< HEAD
const methodOverride = require('method-override');

const pool = require('./config/db');

const app = express();
/*
const connection = mysql.createConnection({
 host: 'c237-leonard-mysql.mysql.database.azure.com',
 user: 'c237_007',
 password: 'c237017@2026',
 database: 'c237_017_team5_savepoint'

 ssl: {
    rejectUnauthorized: false
    }
});
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
*/
const connection = mysql.createConnection({
 host: 'localhost',
 user: 'root',
 password: '',
 database: 'c237_017_team5_savepoint'
});
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});
=======

const pool = require('./config/db');
const newsHub = require('./src/services/newshub.service');

const app = express();
>>>>>>> 44b0f9dad49978eca690fd08368c0809855def6e
const PORT = Number(process.env.PORT) || 3001;


app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
app.use(express.urlencoded({extended:true}));
app.use(express.json());
<<<<<<< HEAD
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-env',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  if (!req.session.cart) req.session.cart = [];
  next();
});

let products = [
  {
    id: 1,
    name: 'Hayabusa T3 Gloves',
    category: 'gloves',
    price: 129.00,
    image: 'Hayabusa_gloves.png',
    description: 'S4 Leather Boxing Gloves offer everything you need to begin your boxing journey. Crafted from 100% genuine leather, this glove is built for heavy bag work, drills, and intense training sessions. Designed to protect your knuckles and keep you comfortable as you sharpen your skills.',
    features: ['Genuine leather construction', 'Splinted wrist support for ergonomic fit', 'Hand pocket ergonomics eliminate hand strain', 'Suitable for boxing, Muay Thai, kickboxing'],
    sizes: ['10 oz', '12 oz', '14 oz', '16 oz']
  },
  {
    id: 2,
    name: 'Everlast Pro Style Gloves',
    category: 'gloves',
    price: 62.99,
    image: 'Everlast_Gloves.png',
    description: 'Olden and golden. The Everlast Pro Style Training Gloves are a reliable staple for boxers of all levels. Built with durable synthetic leather and multi-layer foam padding, they deliver solid protection for bag work and pad sessions.',
    features: ['Durable synthetic leather', 'Multi-layer foam padding', 'Hook-and-loop wrist closure', 'Moisture-wicking lining'],
    sizes: ['10 oz', '12 oz', '14 oz', '16 oz']
  },
  {
    id: 3,
    name: 'Rival RFX-Guerrero Gloves',
    category: 'gloves',
    price: 77.98,
    image: 'Rival_Gloves.png',
    description: 'The best in the game. Rival\'s RFX-Guerrero gloves are crafted for fighters who demand top-tier performance. Robust construction meets refined padding to keep your hands safe through the toughest sessions.',
    features: ['Premium cowhide leather', 'IHFS foam padding system', 'Anatomically designed thumb', 'Full mesh palm ventilation'],
    sizes: ['10 oz', '12 oz', '14 oz', '16 oz']
  },
  {
    id: 4,
    name: 'Hayabusa Talon Shoes',
    category: 'shoes',
    price: 252.00,
    image: 'hayabusa_shoes.png',
    description: 'Bleeding edge boxing technology. The Hayabusa Talon Boxing Shoes deliver precision footwork and superior ankle support. Lightweight yet durable, they let you move with speed and confidence in every round.',
    features: ['Lightweight mesh upper', 'Non-slip rubber outsole', 'High ankle support', 'Breathable interior lining'],
    sizes: ['US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12']
  },
  {
    id: 5,
    name: 'Everlast Elite Shoes',
    category: 'shoes',
    price: 119.00,
    image: 'everlast_shoes.png',
    description: 'Olden and golden. The Everlast Elite Boxing Shoes are a reliable choice for fighters at every level. Built for comfort and durability, they keep you grounded with a solid outsole while offering enough flexibility for swift footwork.',
    features: ['Durable synthetic upper', 'Cushioned insole', 'Pivot point outsole', 'Low-profile design for agility'],
    sizes: ['US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12']
  },
  {
    id: 6,
    name: 'Rival RSX-Guerrero Shoes',
    category: 'shoes',
    price: 129.95,
    image: 'rival_shoes.png',
    description: 'The best in the game. Rival\'s RSX-Guerrero Boxing Shoes are built for fighters who refuse to settle. Robust and long-lasting, they combine ankle support with responsive cushioning to handle even the most intense training camps.',
    features: ['Premium leather and mesh upper', 'Multi-directional traction sole', 'Padded ankle collar', 'Reinforced toe cap'],
    sizes: ['US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12']
  },
  {
    id: 7,
    name: 'Hayabusa T3 LX',
    category: 'headgear',
    price: 299.00,
    image: 'hayabusa_headgear.png',
    description: 'The best headgear in the world is now handcrafted with the finest quality leathers. Designed with you in mind, T3 LX Headgear offers low-profile, full face protection with a broad field of vision.',
    features: ['Advanced cheek protection', 'Breathable mesh panels', 'Adjustable rear strap', 'Lightweight ergonomic fit'],
    sizes: ['XS', 'S', 'M', 'L', 'XL']
  },
  {
    id: 8,
    name: 'Everlast 1910 Pro Leather Groin Protector Lace Up',
    category: 'groinwear',
    price: 59.99,
    image: 'everlast-groinguard.png',
    description: 'The 1910 Pro Groin Protector Lace Up combines heritage boxing design with modern protective technology.',
    features: ['EVERDRI inner lining', '100% premium full grain leather', 'Integrated XL box for reinforcement', 'Superior comfort and durability'],
    sizes: ['S', 'M', 'L', 'XL']
  },
  {
    id: 9,
    name: 'Venum Boxing Handwraps',
    category: 'handwraps',
    price: 19.95,
    image: 'venum_handwraps.jpg',
    description: 'Support your wrists and knuckles with premium stretch wrap designed for all-day training sessions.',
    features: ['360° stretch fabric', 'Secure hook and loop closure', 'Contoured grip support', 'Easy to rewrap between rounds'],
    sizes: ['120 in', '180 in', '210 in']
  }
];

let nextId = 10;


function normaliseJsonArray(value) {
    if (Array.isArray(value)) {
        return value;
    }

    if (!value) {
        return [];
    }

    try {
        const parsedValue =
            typeof value === 'string'
                ? JSON.parse(value)
                : value;

        return Array.isArray(parsedValue)
            ? parsedValue
            : [];
    } catch (error) {
        return [];
    }
}

/*
 * The existing school database may use names such as:
 *
 * productId instead of id
 * productName instead of name
 * productPrice instead of price
 *
 * This object stores the real column names after checking the table.
 */
let productColumns = null;

function quoteIdentifier(identifier) {
    return `\`${String(identifier).replace(/`/g, '``')}\``;
}

async function detectProductColumns() {
    const [columns] = await pool.query(
        'SHOW COLUMNS FROM products'
    );

    const columnNames = new Set(
        columns.map(column => column.Field)
    );

    function firstExistingColumn(...possibleNames) {
        return possibleNames.find(name =>
            columnNames.has(name)
        );
    }

    const primaryKeyColumn = columns.find(
        column => column.Key === 'PRI'
    );

    productColumns = {
        id:
            firstExistingColumn(
                'id',
                'productId',
                'product_id'
            ) ||
            primaryKeyColumn?.Field,

        name: firstExistingColumn(
            'name',
            'productName',
            'product_name'
        ),

        category: firstExistingColumn(
            'category',
            'productCategory',
            'product_category'
        ),

        price: firstExistingColumn(
            'price',
            'productPrice',
            'product_price'
        ),

        image: firstExistingColumn(
            'image',
            'imageUrl',
            'image_url',
            'productImage',
            'product_image'
        ),

        description: firstExistingColumn(
            'description',
            'productDescription',
            'product_description'
        ),

        features: firstExistingColumn('features'),
        sizes: firstExistingColumn('sizes')
    };

    return {
        columns,
        columnNames
    };
}

async function ensureProductsTable() {
    /*
     * This creates the table only when products does not
     * already exist.
     *
     * It does not replace an existing products table.
     */
    await pool.execute(`
        CREATE TABLE IF NOT EXISTS products (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            category VARCHAR(50) NOT NULL,
            price DECIMAL(10, 2) NOT NULL,
            image VARCHAR(255)
                NOT NULL
                DEFAULT 'placeholder.png',
            description TEXT,
            features JSON,
            sizes JSON,
            created_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP
                DEFAULT CURRENT_TIMESTAMP
                ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    await detectProductColumns();

    const missingColumns = [];

    if (!productColumns.id) {
        missingColumns.push(
            'ADD COLUMN id INT NOT NULL AUTO_INCREMENT UNIQUE'
        );
    }

    if (!productColumns.name) {
        missingColumns.push(
            `ADD COLUMN name VARCHAR(255)
             NOT NULL DEFAULT 'Unnamed product'`
        );
    }

    if (!productColumns.category) {
        missingColumns.push(
            `ADD COLUMN category VARCHAR(50)
             NOT NULL DEFAULT 'uncategorised'`
        );
    }

    if (!productColumns.price) {
        missingColumns.push(
            `ADD COLUMN price DECIMAL(10, 2)
             NOT NULL DEFAULT 0`
        );
    }

    if (!productColumns.image) {
        missingColumns.push(
            `ADD COLUMN image VARCHAR(255)
             NOT NULL DEFAULT 'placeholder.png'`
        );
    }

    if (!productColumns.description) {
        missingColumns.push(
            'ADD COLUMN description TEXT'
        );
    }

    if (!productColumns.features) {
        missingColumns.push(
            'ADD COLUMN features JSON'
        );
    }

    if (!productColumns.sizes) {
        missingColumns.push(
            'ADD COLUMN sizes JSON'
        );
    }

    for (const missingColumn of missingColumns) {
        await pool.execute(
            `ALTER TABLE products ${missingColumn}`
        );
    }

    await detectProductColumns();

    const requiredMappings = [
        'id',
        'name',
        'category',
        'price',
        'image',
        'description',
        'features',
        'sizes'
    ];

    const unavailableMappings =
        requiredMappings.filter(
            key => !productColumns[key]
        );

    if (unavailableMappings.length > 0) {
        throw new Error(
            `The products table has no usable columns for: ` +
            unavailableMappings.join(', ')
        );
    }

    console.log(
        'Using products table columns:',
        productColumns
    );
}

async function seedProductsIfEmpty() {
    const [countRows] = await pool.query(
        'SELECT COUNT(*) AS total FROM products'
    );

    if (Number(countRows[0].total) > 0) {
        return;
    }

    const databaseColumns = [
        productColumns.id,
        productColumns.name,
        productColumns.category,
        productColumns.price,
        productColumns.image,
        productColumns.description,
        productColumns.features,
        productColumns.sizes
    ];

    const columnList = databaseColumns
        .map(quoteIdentifier)
        .join(', ');

    for (const product of products) {
        await pool.execute(
            `
            INSERT INTO products (${columnList})
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            [
                product.id,
                product.name,
                product.category,
                product.price,
                product.image,
                product.description,
                JSON.stringify(product.features || []),
                JSON.stringify(product.sizes || [])
            ]
        );
    }

    console.log(
        `Seeded ${products.length} products into MySQL`
    );
}

async function loadProductsFromDatabase() {
    const columns = productColumns;

    const [rows] = await pool.query(`
        SELECT
            ${quoteIdentifier(columns.id)} AS id,
            ${quoteIdentifier(columns.name)} AS name,
            ${quoteIdentifier(columns.category)} AS category,
            ${quoteIdentifier(columns.price)} AS price,
            ${quoteIdentifier(columns.image)} AS image,
            ${quoteIdentifier(columns.description)}
                AS description,
            ${quoteIdentifier(columns.features)} AS features,
            ${quoteIdentifier(columns.sizes)} AS sizes
        FROM products
        ORDER BY ${quoteIdentifier(columns.id)}
    `);

    products = rows.map(row => ({
        ...row,
        id: Number(row.id),
        price: Number(row.price),
        features: normaliseJsonArray(row.features),
        sizes: normaliseJsonArray(row.sizes)
    }));

    nextId =
        products.length > 0
            ? Math.max(
                ...products.map(product => product.id)
            ) + 1
            : 1;
}

function getCartTotal(cart, products, userListings) {
  return cart.reduce((total, item) => {
    let product = products.find(p => p.id === item.id);
    if (!product) product = userListings.find(l => l.id === item.id && l.isUserListing);
    return total + (product ? product.price * item.quantity : 0);
  }, 0).toFixed(2);
}

function getCartCount(cart) {
  return cart.reduce((count, item) => count + item.quantity, 0);
}

const users = [
  { username: 'bouTime', password: 'pull_counter1-2', role: 'admin', fullName: 'Admin', email: '' }
];

// Forum data structures
let forumPosts = [];
let forumComments = [];
let postVotes = {}; // { postId: { username: 'upvote'|'downvote' } }
let commentVotes = {}; // { commentId: { username: 'upvote'|'downvote' } }
let nextPostId = 1;
let nextCommentId = 1;

// Helper to manage user profiles (stored on the user object as `profile`)
function toKg(lb) { return +(lb * 0.45359237).toFixed(2); }
function toLb(kg) { return +(kg / 0.45359237).toFixed(2); }
function cmFromFeetInches(feet, inches) { return Math.round((Number(feet) * 30.48) + (Number(inches) * 2.54)); }
function feetInchesFromCm(cm) {
  const totalInches = +(cm / 2.54).toFixed(0);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches };
}

function determineWeightClass(kg) {
  if (kg === null || kg === undefined || isNaN(kg)) return null;
  const classes = [
    ['Minimumweight', 47.627],
    ['Light Flyweight', 48.988],
    ['Flyweight', 50.802],
    ['Bantamweight', 53.525],
    ['Featherweight', 57.153],
    ['Lightweight', 61.235],
    ['Welterweight', 66.678],
    ['Middleweight', 72.574],
    ['Super Middleweight', 76.205],
    ['Light Heavyweight', 79.378],
    ['Cruiserweight', 90.718],
    ['Heavyweight', Infinity]
  ];
  for (let i = 0; i < classes.length; i++) {
    if (kg <= classes[i][1]) return classes[i][0];
  }
  return 'Heavyweight';
}

const categorySizeOptions = {
  gloves: ['10 oz', '12 oz', '14 oz', '16 oz'],
  shoes: ['US 7', 'US 8', 'US 9', 'US 10', 'US 11', 'US 12'],
  headgear: ['XS', 'S', 'M', 'L', 'XL'],
  groinwear: ['S', 'M', 'L', 'XL'],
  handwraps: ['120 in', '180 in', '210 in']
};

function findUser(username) {
  return users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

function requireAdmin(req, res, next) {
  if (!req.session.isAdmin) return res.redirect('/login');
  next();
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

app.use((req, res, next) => {
  res.locals.cartCount = getCartCount(req.session.cart);
  res.locals.isAdmin = !!req.session.isAdmin;
  res.locals.user = req.session.user || null;
  next();
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/home');
  res.render('login', { error: null, message: null, formMode: 'login' });
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/home');
  const formMode = req.query.mode === 'signup' ? 'signup' : 'login';
  res.render('login', { error: null, message: null, formMode });
});

app.get('/signup', (req, res) => {
  if (req.session.user) return res.redirect('/home');
  res.render('login', { error: null, message: null, formMode: 'signup' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = findUser(username);
  if (!user || user.password !== password) {
    return res.render('login', { error: 'Invalid username or password', message: null, formMode: 'login' });
  }
  req.session.user = { username: user.username, role: user.role, fullName: user.fullName || '', email: user.email || '' };
  req.session.isAdmin = user.role === 'admin';
  req.session.cart = [];
  return res.redirect('/home');
});

app.post('/signup', (req, res) => {
  const { username, password, fullName, email } = req.body;
  if (!username || !password) {
    return res.render('login', { error: 'Username and password are required.', message: null, formMode: 'signup' });
  }
  if (findUser(username)) {
    return res.render('login', { error: 'That username is already taken.', message: null, formMode: 'signup' });
  }

  // Build profile if provided
  let profile = null;
  try {
    if (req.body.createProfile === 'yes') {
      const age = req.body.age ? parseInt(req.body.age) : null;
      let weightKg = null, weightLb = null;
      if (req.body.weight && req.body.weightUnit) {
        const val = parseFloat(req.body.weight) || null;
        if (req.body.weightUnit === 'kg') { weightKg = val; weightLb = toLb(val); }
        else { weightLb = val; weightKg = toKg(val); }
      }
      let heightCm = null, heightFeet = null, heightInches = null;
      if (req.body.heightUnit === 'cm' && req.body.height) {
        heightCm = parseInt(req.body.height) || null;
        const fi = heightCm ? feetInchesFromCm(heightCm) : { feet: null, inches: null };
        heightFeet = fi.feet; heightInches = fi.inches;
      } else if (req.body.heightUnit === 'ft' && (req.body.heightFeet || req.body.heightInches)) {
        heightFeet = parseInt(req.body.heightFeet) || 0;
        heightInches = parseInt(req.body.heightInches) || 0;
        heightCm = cmFromFeetInches(heightFeet, heightInches);
      }

      const country = req.body.country || '';
      const gymActive = req.body.gymActive === 'yes';
      const gymName = gymActive ? (req.body.gymName || '') : null;
      const favoriteBoxers = req.body.favoriteBoxers ? req.body.favoriteBoxers.split('\n').map(s => s.trim()).filter(s => s).slice(0,10) : [];
      const preferredStyles = Array.isArray(req.body.preferredStyles) ? req.body.preferredStyles.slice(0,3) : (req.body.preferredStyles ? [req.body.preferredStyles] : []);

      const weightClass = (weightKg ? determineWeightClass(weightKg) : null);

      profile = {
        age: age || null,
        weightKg: weightKg || null,
        weightLb: weightLb || null,
        heightCm: heightCm || null,
        heightFeet: heightFeet || null,
        heightInches: heightInches || null,
        country,
        gym: gymActive ? { active: true, name: gymName } : { active: false, name: null },
        favoriteBoxers,
        preferredStyles,
        weightClass
      };
    }
  } catch (e) {
    console.error('Error parsing profile', e);
  }

  const newUser = { username, password, role: 'user', fullName: fullName || '', email: email || '', profile };
  users.push(newUser);
  req.session.user = { username: newUser.username, role: newUser.role, fullName: newUser.fullName, email: newUser.email, profile: newUser.profile };
  req.session.isAdmin = false;
  req.session.cart = [];

  // If the user opted to create a profile but did not fill it, redirect them to profile edit
  if (req.body.createProfile === 'yes' && !profile) return res.redirect('/profile/edit');
  return res.redirect('/home');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ─── Product Routes ───────────────────────────────────────────────────────────

// Landing page
app.get('/home', (req, res) => res.render('landing', { products, userListings, cart: req.session.cart }));

// E-commerce shop
app.get('/shop', (req, res) => res.render('index', { products, userListings, cart: req.session.cart }));

app.get('/gloves', (req, res) => res.render('gloves', {
  gloves: [...products.filter(p => p.category === 'gloves'), ...userListings.filter(l => l.category === 'gloves')],
  cart: req.session.cart
}));

app.get('/shoes', (req, res) => res.render('shoes', {
  shoes: [...products.filter(p => p.category === 'shoes'), ...userListings.filter(l => l.category === 'shoes')],
  cart: req.session.cart
}));

app.get('/headgear', (req, res) => res.render('headgear', {
  headgear: [...products.filter(p => p.category === 'headgear'), ...userListings.filter(l => l.category === 'headgear')],
  cart: req.session.cart
}));

app.get('/groinwear', (req, res) => res.render('groinwear', {
  groinwear: [...products.filter(p => p.category === 'groinwear'), ...userListings.filter(l => l.category === 'groinwear')],
  cart: req.session.cart
}));

app.get('/groingear', (req, res) => res.redirect('/groinwear'));

app.get('/handwraps', (req, res) => res.render('handwraps', {
  handwraps: [...products.filter(p => p.category === 'handwraps'), ...userListings.filter(l => l.category === 'handwraps')],
  cart: req.session.cart
}));

app.get('/product/:id', (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).send('Product not found');
  res.render('productDetail', { product, cart: req.session.cart });
});

app.get('/listing/:id', (req, res) => {
  const listing = userListings.find(l => l.id === parseInt(req.params.id));
  if (!listing) return res.status(404).send('Listing not found');
  res.render('userListing', { listing, cart: req.session.cart });
});

// ─── Community Routes ────────────────────────────────────────────────────────

// Main forum feed - list all posts with sorting
app.get('/forum', (req, res) => {
  const sort = req.query.sort || 'recency'; // recency, upvotes, comments
  let posts = [...forumPosts];
  
  posts.forEach(post => {
    post.commentCount = forumComments.filter(c => c.postId === post.id).length;
    post.netVotes = Object.values(postVotes[post.id] || {}).reduce((sum, vote) => {
      return sum + (vote === 'upvote' ? 1 : vote === 'downvote' ? -1 : 0);
    }, 0);
    post.userVote = postVotes[post.id] && req.session.user 
      ? postVotes[post.id][req.session.user.username] 
      : null;
  });

  if (sort === 'upvotes') posts.sort((a, b) => b.netVotes - a.netVotes);
  else if (sort === 'comments') posts.sort((a, b) => b.commentCount - a.commentCount);
  else posts.sort((a, b) => b.createdAt - a.createdAt);

  res.render('forum', { posts, sort, user: req.session.user });
});

// Show create post form
app.get('/forum/new', requireLogin, (req, res) => {
  res.render('forum-create-post', { error: null });
});

// Create a new post
app.post('/forum/posts', requireLogin, upload.single('image'), (req, res) => {
  const { title, description, link } = req.body;
  
  if (!title || !title.trim()) {
    return res.render('forum-create-post', { error: 'Title is required' });
  }
  if (!description || !description.trim()) {
    return res.render('forum-create-post', { error: 'Description is required' });
  }

  const newPost = {
    id: nextPostId++,
    title: title.trim(),
    description: description.trim(),
    link: link && link.trim() ? link.trim() : null,
    image: req.file ? req.file.filename : null,
    author: req.session.user.username,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  forumPosts.push(newPost);
  res.redirect(`/forum/posts/${newPost.id}`);
});

// View a single post with comments
app.get('/forum/posts/:id', (req, res) => {
  const post = forumPosts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).send('Post not found');

  let comments = forumComments.filter(c => c.postId === post.id);
  
  comments.forEach(comment => {
    comment.netVotes = Object.values(commentVotes[comment.id] || {}).reduce((sum, vote) => {
      return sum + (vote === 'upvote' ? 1 : vote === 'downvote' ? -1 : 0);
    }, 0);
    comment.userVote = commentVotes[comment.id] && req.session.user 
      ? commentVotes[comment.id][req.session.user.username] 
      : null;
  });

  comments.sort((a, b) => b.createdAt - a.createdAt);

  post.commentCount = comments.length;
  post.netVotes = Object.values(postVotes[post.id] || {}).reduce((sum, vote) => {
    return sum + (vote === 'upvote' ? 1 : vote === 'downvote' ? -1 : 0);
  }, 0);
  post.userVote = postVotes[post.id] && req.session.user 
    ? postVotes[post.id][req.session.user.username] 
    : null;

  res.render('forum-post-detail', { post, comments, user: req.session.user });
});

// Add a comment to a post
app.post('/forum/posts/:id/comments', requireLogin, upload.single('image'), (req, res) => {
  const postId = parseInt(req.params.id);
  const post = forumPosts.find(p => p.id === postId);
  if (!post) return res.status(404).send('Post not found');

  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).send('Comment cannot be empty');
  }

  const newComment = {
    id: nextCommentId++,
    postId,
    text: text.trim(),
    image: req.file ? req.file.filename : null,
    author: req.session.user.username,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  forumComments.push(newComment);
  res.redirect(`/forum/posts/${postId}`);
});

// Edit a post (only by author)
app.put('/forum/posts/:id', requireLogin, upload.single('image'), (req, res) => {
  const post = forumPosts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author !== req.session.user.username) return res.status(403).json({ error: 'Unauthorized' });

  const { title, description, link } = req.body;
  if (title && title.trim()) post.title = title.trim();
  if (description && description.trim()) post.description = description.trim();
  if (link) post.link = link.trim() || null;
  if (req.file) post.image = req.file.filename;
  post.updatedAt = new Date();

  res.json({ success: true, post });
});

// Delete a post (only by author)
app.delete('/forum/posts/:id', requireLogin, (req, res) => {
  const post = forumPosts.find(p => p.id === parseInt(req.params.id));
  if (!post) return res.status(404).json({ error: 'Post not found' });
  if (post.author !== req.session.user.username) return res.status(403).json({ error: 'Unauthorized' });

  forumPosts = forumPosts.filter(p => p.id !== post.id);
  forumComments = forumComments.filter(c => c.postId !== post.id);
  res.json({ success: true });
});

// Edit a comment (only by author)
app.put('/forum/comments/:id', requireLogin, upload.single('image'), (req, res) => {
  const comment = forumComments.find(c => c.id === parseInt(req.params.id));
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.author !== req.session.user.username) return res.status(403).json({ error: 'Unauthorized' });

  const { text } = req.body;
  if (text && text.trim()) comment.text = text.trim();
  if (req.file) comment.image = req.file.filename;
  comment.updatedAt = new Date();

  res.json({ success: true, comment });
});

// Delete a comment (only by author)
app.delete('/forum/comments/:id', requireLogin, (req, res) => {
  const comment = forumComments.find(c => c.id === parseInt(req.params.id));
  if (!comment) return res.status(404).json({ error: 'Comment not found' });
  if (comment.author !== req.session.user.username) return res.status(403).json({ error: 'Unauthorized' });

  forumComments = forumComments.filter(c => c.id !== comment.id);
  res.json({ success: true });
});

// Vote on a post
app.post('/forum/posts/:id/vote', requireLogin, (req, res) => {
  const postId = parseInt(req.params.id);
  const post = forumPosts.find(p => p.id === postId);
  if (!post) return res.status(404).json({ error: 'Post not found' });

  const { voteType } = req.body; // 'upvote', 'downvote', or 'remove'
  const username = req.session.user.username;

  if (!postVotes[postId]) postVotes[postId] = {};

  if (voteType === 'remove') {
    delete postVotes[postId][username];
  } else if (voteType === 'upvote' || voteType === 'downvote') {
    postVotes[postId][username] = voteType;
  }

  const netVotes = Object.values(postVotes[postId]).reduce((sum, vote) => {
    return sum + (vote === 'upvote' ? 1 : vote === 'downvote' ? -1 : 0);
  }, 0);

  res.json({ success: true, netVotes, userVote: postVotes[postId][username] || null });
});

// Vote on a comment
app.post('/forum/comments/:id/vote', requireLogin, (req, res) => {
  const commentId = parseInt(req.params.id);
  const comment = forumComments.find(c => c.id === commentId);
  if (!comment) return res.status(404).json({ error: 'Comment not found' });

  const { voteType } = req.body; // 'upvote', 'downvote', or 'remove'
  const username = req.session.user.username;

  if (!commentVotes[commentId]) commentVotes[commentId] = {};

  if (voteType === 'remove') {
    delete commentVotes[commentId][username];
  } else if (voteType === 'upvote' || voteType === 'downvote') {
    commentVotes[commentId][username] = voteType;
  }

  const netVotes = Object.values(commentVotes[commentId]).reduce((sum, vote) => {
    return sum + (vote === 'upvote' ? 1 : vote === 'downvote' ? -1 : 0);
  }, 0);

  res.json({ success: true, netVotes, userVote: commentVotes[commentId][username] || null });
});

// Explore fights (placeholder)
app.get('/explore', (req, res) => res.render('explore'));

// ─── User Profile Routes ─────────────────────────────────────────────────────

app.get('/profile', requireLogin, (req, res) => {
  const user = findUser(req.session.user.username);
  const profile = (user && user.profile) ? user.profile : null;
  res.render('profile', { profile, user: req.session.user });
});

app.get('/profile/edit', requireLogin, (req, res) => {
  const user = findUser(req.session.user.username);
  const profile = (user && user.profile) ? user.profile : null;
  const styles = ['Swarmer','Out-Boxer','Slugger','Boxer-Puncher','Counterpuncher','Southpaw','Switch-Hitter'];
  res.render('profileEdit', { profile, styles });
});

app.post('/profile', requireLogin, (req, res) => {
  const user = findUser(req.session.user.username);
  if (!user) return res.status(404).send('User not found');

  const age = req.body.age ? parseInt(req.body.age) : null;
  let weightKg = null, weightLb = null;
  if (req.body.weight && req.body.weightUnit) {
    const val = parseFloat(req.body.weight) || null;
    if (req.body.weightUnit === 'kg') { weightKg = val; weightLb = toLb(val); }
    else { weightLb = val; weightKg = toKg(val); }
  }
  let heightCm = null, heightFeet = null, heightInches = null;
  if (req.body.heightUnit === 'cm' && req.body.height) {
    heightCm = parseInt(req.body.height) || null;
    const fi = heightCm ? feetInchesFromCm(heightCm) : { feet: null, inches: null };
    heightFeet = fi.feet; heightInches = fi.inches;
  } else if (req.body.heightUnit === 'ft' && (req.body.heightFeet || req.body.heightInches)) {
    heightFeet = parseInt(req.body.heightFeet) || 0;
    heightInches = parseInt(req.body.heightInches) || 0;
    heightCm = cmFromFeetInches(heightFeet, heightInches);
  }

  const country = req.body.country || '';
  const gymActive = req.body.gymActive === 'yes';
  const gymName = gymActive ? (req.body.gymName || '') : null;
  const favoriteBoxers = req.body.favoriteBoxers ? req.body.favoriteBoxers.split('\n').map(s => s.trim()).filter(s => s).slice(0,10) : [];
  const preferredStyles = Array.isArray(req.body.preferredStyles) ? req.body.preferredStyles.slice(0,3) : (req.body.preferredStyles ? [req.body.preferredStyles] : []);

  const weightClass = (weightKg ? determineWeightClass(weightKg) : null);

  const profile = {
    age: age || null,
    weightKg: weightKg || null,
    weightLb: weightLb || null,
    heightCm: heightCm || null,
    heightFeet: heightFeet || null,
    heightInches: heightInches || null,
    country,
    gym: gymActive ? { active: true, name: gymName } : { active: false, name: null },
    favoriteBoxers,
    preferredStyles,
    weightClass
  };

  user.profile = profile;
  // update session copy
  req.session.user.profile = profile;
  res.redirect('/profile');
});

// Redirect to BoxRec if possible, otherwise show placeholder
const fs = require('fs');
const boxrecDataDir = path.join(__dirname, 'data');
const boxrecMapPath = path.join(boxrecDataDir, 'boxrecMap.json');

// Ensure data directory exists
if (!fs.existsSync(boxrecDataDir)) {
  try { fs.mkdirSync(boxrecDataDir); } catch (e) { console.error('Could not create data dir', e); }
}

// Load persisted boxrec map if available (keys are lowercase boxer names)
let boxrecMap = {};
try {
  if (fs.existsSync(boxrecMapPath)) {
    const raw = fs.readFileSync(boxrecMapPath, 'utf8');
    boxrecMap = JSON.parse(raw || '{}');
  }
} catch (e) {
  console.error('Failed to read boxrec map file', e);
}

// Seed a known mapping if not present
if (!boxrecMap['ryan garcia']) boxrecMap['ryan garcia'] = 'https://boxrec.com/en/box-pro/765995';

function persistBoxrecMap() {
  try {
    fs.writeFileSync(boxrecMapPath, JSON.stringify(boxrecMap, null, 2), 'utf8');
  } catch (e) {
    console.error('Failed to persist boxrec map', e);
  }
}

app.get('/boxer/:name', async (req, res) => {
  const name = req.params.name || req.query.name || '';
  const decoded = decodeURIComponent(name).trim();
  const key = decoded.toLowerCase();

  // If the user provided a BoxRec ID or a URL containing the ID, extract and redirect directly
  const idOnlyMatch = decoded.match(/^\d+$/);
  const idEmbeddedMatch = decoded.match(/(?:box-pro\/)\b(\d{4,7})\b/);
  if (idOnlyMatch) {
    const id = idOnlyMatch[0];
    const boxerUrl = 'https://boxrec.com/en/box-pro/' + id;
    boxrecMap[key] = boxerUrl;
    persistBoxrecMap();
    return res.redirect(boxerUrl);
  } else if (idEmbeddedMatch && idEmbeddedMatch[1]) {
    const id = idEmbeddedMatch[1];
    const boxerUrl = 'https://boxrec.com/en/box-pro/' + id;
    boxrecMap[key] = boxerUrl;
    persistBoxrecMap();
    return res.redirect(boxerUrl);
  }

  // If we have a direct BoxRec URL mapped (case-insensitive), go there.
  if (boxrecMap[key]) return res.redirect(boxrecMap[key]);

  // Otherwise try to resolve by fetching BoxRec search results and extracting the first boxer page.
  const searchUrl = 'https://boxrec.com/en/search?search=' + encodeURIComponent(decoded);
  try {
    const resp = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const text = await resp.text();
    
    // Try multiple regex patterns to find the boxer ID
    let id = null;
    const patterns = [
      /href\s*=\s*"\/en\/box-pro\/(\d+)/i,  // Standard pattern
      /\/en\/box-pro\/(\d+)/i,               // Simple pattern
      /box-pro\/(\d{4,7})/i                  // More specific pattern
    ];
    
    for (const pattern of patterns) {
      const m = text.match(pattern);
      if (m && m[1]) {
        id = m[1];
        break;
      }
    }
    
    if (id) {
      const boxerUrl = 'https://boxrec.com/en/box-pro/' + id;
      boxrecMap[key] = boxerUrl;
      persistBoxrecMap();
      return res.redirect(boxerUrl);
    }
  } catch (err) {
    console.error('Error resolving BoxRec for', decoded, err);
  }

  // Fallback: open the search results page
  return res.redirect(searchUrl);
});


// ─── Admin Routes ─────────────────────────────────────────────────────────────

app.get('/admin', requireAdmin, (req, res) => res.render('admin', { products }));

app.get('/db-health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ connected: true });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(500).json({ connected: false });
  }
});
app.get('/admin/add', requireAdmin, (req, res) => res.render('addProduct', {}));

app.post(
    '/admin/add',
    requireAdmin,
    async (req, res) => {
        try {
            const {
                name,
                category,
                price,
                image,
                description
            } = req.body;

            if (!name || !category || !price) {
                return res
                    .status(400)
                    .send(
                        'Name, category and price are required.'
                    );
            }

            const numericPrice = Number(price);

            if (
                !Number.isFinite(numericPrice) ||
                numericPrice < 0
            ) {
                return res
                    .status(400)
                    .send('Price must be a valid number.');
            }

            const features = req.body.features
                ? req.body.features
                    .split('\n')
                    .map(feature => feature.trim())
                    .filter(Boolean)
                : [];

            const sizes =
                categorySizeOptions[category] || [];

            const columns = productColumns;

            await pool.execute(
                `
                INSERT INTO products (
                    ${quoteIdentifier(columns.name)},
                    ${quoteIdentifier(columns.category)},
                    ${quoteIdentifier(columns.price)},
                    ${quoteIdentifier(columns.image)},
                    ${quoteIdentifier(columns.description)},
                    ${quoteIdentifier(columns.features)},
                    ${quoteIdentifier(columns.sizes)}
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                `,
                [
                    name.trim(),
                    category,
                    numericPrice,
                    image?.trim() ||
                        'placeholder.png',
                    description?.trim() || '',
                    JSON.stringify(features),
                    JSON.stringify(sizes)
                ]
            );

            await loadProductsFromDatabase();

            res.redirect('/admin');
        } catch (error) {
            console.error(
                'Error adding product:',
                error
            );

            res
                .status(500)
                .send(
                    `Could not add product: ${error.message}`
                );
        }
    }
);

app.get('/admin/edit/:id', requireAdmin, (req, res) => {
  const product = products.find(p => p.id === parseInt(req.params.id));
  if (!product) return res.status(404).send('Product not found');
  res.render('editProduct', { product, cart: req.session.cart });
});

app.post(
    '/admin/edit/:id',
    requireAdmin,
    async (req, res) => {
        try {
            const id = Number.parseInt(
                req.params.id,
                10
            );

            if (!Number.isInteger(id)) {
                return res
                    .status(400)
                    .send('Invalid product ID.');
            }

            const existingProduct = products.find(
                product => product.id === id
            );

            if (!existingProduct) {
                return res
                    .status(404)
                    .send('Product not found.');
            }

            const numericPrice = Number(
                req.body.price
            );

            if (
                !Number.isFinite(numericPrice) ||
                numericPrice < 0
            ) {
                return res
                    .status(400)
                    .send('Price must be a valid number.');
            }

            const features = req.body.features
                ? req.body.features
                    .split('\n')
                    .map(feature => feature.trim())
                    .filter(Boolean)
                : [];

            const sizes =
                categorySizeOptions[
                    req.body.category
                ] ||
                existingProduct.sizes ||
                [];

            const columns = productColumns;

            await pool.execute(
                `
                UPDATE products
                SET
                    ${quoteIdentifier(columns.name)} = ?,
                    ${quoteIdentifier(columns.category)} = ?,
                    ${quoteIdentifier(columns.price)} = ?,
                    ${quoteIdentifier(columns.image)} = ?,
                    ${quoteIdentifier(columns.description)} = ?,
                    ${quoteIdentifier(columns.features)} = ?,
                    ${quoteIdentifier(columns.sizes)} = ?
                WHERE
                    ${quoteIdentifier(columns.id)} = ?
                `,
                [
                    req.body.name.trim(),
                    req.body.category,
                    numericPrice,
                    req.body.image?.trim() ||
                        existingProduct.image,
                    req.body.description?.trim() || '',
                    JSON.stringify(features),
                    JSON.stringify(sizes),
                    id
                ]
            );

            await loadProductsFromDatabase();

            res.redirect('/admin');
        } catch (error) {
            console.error(
                'Error updating product:',
                error
            );

            res
                .status(500)
                .send(
                    `Could not update product: ${error.message}`
                );
        }
    }
);

app.post(
    '/admin/delete/:id',
    requireAdmin,
    async (req, res) => {
        try {
            const id = Number.parseInt(
                req.params.id,
                10
            );

            if (!Number.isInteger(id)) {
                return res
                    .status(400)
                    .send('Invalid product ID.');
            }

            const columns = productColumns;

            const [result] = await pool.execute(
                `
                DELETE FROM products
                WHERE ${quoteIdentifier(columns.id)} = ?
                `,
                [id]
            );

            if (result.affectedRows === 0) {
                return res
                    .status(404)
                    .send('Product not found.');
            }

            await loadProductsFromDatabase();

            res.redirect('/admin');
        } catch (error) {
            console.error(
                'Error deleting product:',
                error
            );

            res
                .status(500)
                .send(
                    `Could not delete product: ${error.message}`
                );
        }
    }
);
// ─── Contact ──────────────────────────────────────────────────────────────────

app.get('/contact', (req, res) => res.render('contact', { submitted: false }));
app.post('/contact', (req, res) => res.render('contact', { submitted: true }));

// ─── Cart Routes ──────────────────────────────────────────────────────────────

app.get('/cart', (req, res) => {
  const cartItems = req.session.cart.map(item => {
    let product = products.find(p => p.id === item.id);
    if (!product) product = userListings.find(l => l.id === item.id && l.isUserListing);
    return { ...item, product };
  });
  const total = getCartTotal(req.session.cart, products, userListings);
  res.render('cart', { cart: cartItems, total, cartCount: getCartCount(req.session.cart) });
});

app.post('/cart/add/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const quantity = parseInt(req.body.quantity) || 1;
  const size = req.body.size || null;
  const listing = userListings.find(l => l.id === productId && l.isUserListing);
  const cartItem = req.session.cart.find(item => item.id === productId && item.size === size);

  if (listing) {
    const alreadyInCart = cartItem ? cartItem.quantity : 0;
    const available = Math.max(0, listing.stock - alreadyInCart);
    if (available <= 0) return res.redirect(req.body.redirect || '/cart');
    const addQty = Math.min(quantity, available);
    if (cartItem) cartItem.quantity += addQty;
    else req.session.cart.push({ id: productId, quantity: addQty, size });
  } else {
    if (cartItem) cartItem.quantity += quantity;
    else req.session.cart.push({ id: productId, quantity, size });
  }
  res.redirect(req.body.redirect || '/cart');
});

app.post('/cart/remove/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const size = req.body.size || null;
  req.session.cart = req.session.cart.filter(item => !(item.id === productId && item.size === size));
  res.redirect('/cart');
});

app.post('/cart/update/:id', (req, res) => {
  const productId = parseInt(req.params.id);
  const quantity = parseInt(req.body.quantity) || 1;
  const size = req.body.size || null;
  const cartItem = req.session.cart.find(item => item.id === productId && item.size === size);
  if (cartItem) {
    if (quantity <= 0) req.session.cart = req.session.cart.filter(item => !(item.id === productId && item.size === size));
    else cartItem.quantity = quantity;
  }
  res.redirect('/cart');
});

app.get('/checkout', (req, res) => {
  if (req.session.cart.length === 0) return res.redirect('/cart');
  const cartItems = req.session.cart.map(item => {
    let product = products.find(p => p.id === item.id);
    if (!product) product = userListings.find(l => l.id === item.id && l.isUserListing);
    return { ...item, product };
  });
  const total = getCartTotal(req.session.cart, products, userListings);
  res.render('checkout', { cart: cartItems, total, cartCount: getCartCount(req.session.cart) });
});

app.post('/checkout', (req, res) => {
  const { firstName, lastName, email, phone, address, city, state, zipCode } = req.body;
  if (!firstName || !lastName || !email || !address || !city) {
    return res.status(400).send('Please fill in all required fields');
  }
  req.session.cart.forEach(item => {
    const listing = userListings.find(l => l.id === item.id && l.isUserListing);
    if (listing) listing.stock = Math.max(0, listing.stock - item.quantity);
  });
  req.session.cart = [];
  res.render('orderConfirmation', {
    order: { firstName, lastName, email, phone, address, city, state, zipCode },
    cartCount: 0
  });
});

// ─── Seller Routes ────────────────────────────────────────────────────────────

app.get('/seller/dashboard', requireLogin, (req, res) => {
  const myListings = userListings.filter(l => l.seller === req.session.user.username);
  res.render('sellerDashboard', { listings: myListings });
});

// Show create listing form
app.get('/seller/create', requireLogin, (req, res) => {
  res.render('sellerCreateListing', { listing: null, categorySizeOptions, error: null });
});

// Handle create listing form submission
app.post('/seller/create', requireLogin, upload.single('image'), (req, res) => {
  const { name, category, price, description, stock } = req.body;
  const features = req.body.features
    ? req.body.features.split('\n').map(f => f.trim()).filter(f => f)
    : [];
  const sizes = req.body.sizes
    ? req.body.sizes.split('\n').map(s => s.trim()).filter(s => s)
    : [];

  if (!name || !category || !price || !description || !stock) {
    return res.render('sellerCreateListing', { error: 'All fields are required', listing: null, categorySizeOptions });
  }

  // If a file was uploaded use its filename, otherwise fall back to placeholder
  const image = req.file ? req.file.filename : 'placeholder.png';

  const newListing = {
    id: nextListingId++,
    name, category,
    price: parseFloat(price),
    image,
    description, features,
    sizes: sizes.length > 0 ? sizes : (categorySizeOptions[category] || []),
    stock: parseInt(stock),
    seller: req.session.user.username,
    isUserListing: true,
    createdAt: new Date()
  };

  userListings.push(newListing);
  res.redirect('/seller/dashboard');
});

// Show edit listing form
app.get('/seller/edit/:id', requireLogin, (req, res) => {
  const listing = userListings.find(l => l.id === parseInt(req.params.id));
  if (!listing) return res.status(404).send('Listing not found');
  if (listing.seller !== req.session.user.username) return res.status(403).send('Unauthorized');
  res.render('sellerCreateListing', { listing, categorySizeOptions, error: null });
});

// Handle edit listing form submission
app.post('/seller/edit/:id', requireLogin, upload.single('image'), (req, res) => {
  const listing = userListings.find(l => l.id === parseInt(req.params.id));
  if (!listing) return res.status(404).send('Listing not found');
  if (listing.seller !== req.session.user.username) return res.status(403).send('Unauthorized');

  const { name, category, price, description, stock } = req.body;
  const features = req.body.features
    ? req.body.features.split('\n').map(f => f.trim()).filter(f => f)
    : [];
  const sizes = req.body.sizes
    ? req.body.sizes.split('\n').map(s => s.trim()).filter(s => s)
    : [];

  // If a new file was uploaded use it, otherwise keep the existing image
  const image = req.file ? req.file.filename : (req.body.existingImage || listing.image);

  listing.name = name;
  listing.category = category;
  listing.price = parseFloat(price);
  listing.image = image;
  listing.description = description;
  listing.features = features;
  listing.sizes = sizes.length > 0 ? sizes : (categorySizeOptions[category] || []);
  listing.stock = parseInt(stock);

  res.redirect('/seller/dashboard');
});

app.post('/seller/delete/:id', requireLogin, (req, res) => {
  const listing = userListings.find(l => l.id === parseInt(req.params.id));
  if (!listing) return res.status(404).send('Listing not found');
  if (listing.seller !== req.session.user.username) return res.status(403).send('Unauthorized');
  userListings = userListings.filter(l => l.id !== parseInt(req.params.id));
  res.redirect('/seller/dashboard');
});

const PORT = Number(process.env.PORT) || 3001;

async function startServer() {
    try {
        await pool.query('SELECT 1');

        console.log(
            'Connected to MySQL database'
        );

        await ensureProductsTable();
        await seedProductsIfEmpty();
        await loadProductsFromDatabase();

        console.log(
            `Loaded ${products.length} products from MySQL`
        );

        app.listen(
            PORT,
            '0.0.0.0',
            () => {
                console.log(
                    `bouTime is running on port ${PORT}`
                );

                console.log(
                    `Local URL: http://localhost:${PORT}`
                );
            }
        );
    } catch (error) {
        console.error(
            'Could not start the application:',
            error
        );

        process.exit(1);
    }
}

=======
app.use(express.static(path.join(__dirname,'public')));
app.use(session({secret:process.env.SESSION_SECRET||'development-only-change-me',resave:false,saveUninitialized:false,cookie:{httpOnly:true,secure:false,sameSite:'lax',maxAge:86400000}}));
app.use((req,res,next)=>{res.locals.currentUser=req.session.user||null;res.locals.isAdmin=req.session.user?.role==='admin';res.locals.currentPath=req.path;next();});
function requireLogin(req,res,next){if(!req.session.user)return res.redirect('/login');next();}
function requireAdmin(req,res,next){if(!req.session.user)return res.redirect('/login');if(req.session.user.role!=='admin')return res.status(403).render('error',{title:'Access denied',message:'This page is available only to SavePoint administrators.'});next();}
async function seedAccount({username,password,email,role}){const [rows]=await pool.execute('SELECT id FROM users WHERE username=? LIMIT 1',[username]);if(rows.length)return;const hash=await bcrypt.hash(password,12);await pool.execute('INSERT INTO users (username,email,password,role) VALUES (?,?,?,?)',[username,email||`${username}@savepoint.local`,hash,role]);}
async function ensureUsersTableSchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY,username VARCHAR(50) NOT NULL UNIQUE,email VARCHAR(150) NOT NULL UNIQUE,password VARCHAR(255) NOT NULL,profile_image TEXT DEFAULT 'default_profile.png',banner_image TEXT DEFAULT 'default_banner.png',role ENUM('admin','user') NOT NULL DEFAULT 'user',bio TEXT,favourite_console VARCHAR(100),created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  const [columns]=await pool.query('SHOW COLUMNS FROM users');
  const existing=new Set(columns.map(column=>column.Field));
  const migrations=[];
  if(!existing.has('email')) migrations.push("ALTER TABLE users ADD COLUMN email VARCHAR(150) NOT NULL UNIQUE");
  if(!existing.has('password')) migrations.push("ALTER TABLE users ADD COLUMN password VARCHAR(255) NOT NULL");
  if(!existing.has('profile_image')) migrations.push("ALTER TABLE users ADD COLUMN profile_image TEXT DEFAULT 'default_profile.png'");
  if(!existing.has('banner_image')) migrations.push("ALTER TABLE users ADD COLUMN banner_image TEXT DEFAULT 'default_banner.png'");
  if(!existing.has('bio')) migrations.push('ALTER TABLE users ADD COLUMN bio TEXT');
  if(!existing.has('favourite_console')) migrations.push("ALTER TABLE users ADD COLUMN favourite_console VARCHAR(100)");
  if(!existing.has('created_at')) migrations.push("ALTER TABLE users ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
  for(const statement of migrations){await pool.query(statement);} 
}
async function initialiseDatabase(){
 await ensureUsersTableSchema();
 await pool.query(`CREATE TABLE IF NOT EXISTS products (id INT AUTO_INCREMENT PRIMARY KEY,seller_user_id INT NULL,title VARCHAR(150) NOT NULL,description TEXT,category VARCHAR(80) NOT NULL,platform VARCHAR(80),price DECIMAL(10,2) NOT NULL DEFAULT 0,quantity INT NOT NULL DEFAULT 1,image_url VARCHAR(255),status ENUM('active','sold','removed') NOT NULL DEFAULT 'active',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,CONSTRAINT fk_products_seller FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE SET NULL)`);
 await pool.query(`CREATE TABLE IF NOT EXISTS forum_posts (id INT AUTO_INCREMENT PRIMARY KEY,author_user_id INT NULL,title VARCHAR(180) NOT NULL,body TEXT NOT NULL,status ENUM('visible','removed') NOT NULL DEFAULT 'visible',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,CONSTRAINT fk_forum_author FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL)`);
 await pool.query(`CREATE TABLE IF NOT EXISTS news_items (id INT AUTO_INCREMENT PRIMARY KEY,title VARCHAR(200) NOT NULL,summary TEXT,source_name VARCHAR(120),source_url VARCHAR(500),published_at DATETIME,status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
 await seedAccount({username:'SavePoint',password:'NintendoGamesTheyreSoFunToPlay',email:'admin@savepoint.local',role:'admin'});
 await seedAccount({username:'Dingleton',password:'123',email:'dingleton@savepoint.local',role:'user'});
 const [[pc]]=await pool.query('SELECT COUNT(*) total FROM products');if(!Number(pc.total)){const [[u]]=await pool.execute('SELECT id FROM users WHERE username=?',['SavePoint']);await pool.execute('INSERT INTO products (seller_user_id,title,description,category,platform,price,quantity) VALUES (?,?,?,?,?,?,?)',[u.id,'Nintendo Game Boy Color','Starter marketplace listing.','Hardware','Game Boy',129.90,1]);}
 const [[fc]]=await pool.query('SELECT COUNT(*) total FROM forum_posts');if(!Number(fc.total)){const [[u]]=await pool.execute('SELECT id FROM users WHERE username=?',['Dingleton']);await pool.execute('INSERT INTO forum_posts (author_user_id,title,body) VALUES (?,?,?)',[u.id,'What retro game are you playing right now?','Starter discussion post.']);}
 const [[nc]]=await pool.query('SELECT COUNT(*) total FROM news_items');if(!Number(nc.total))await pool.execute('INSERT INTO news_items (title,summary,source_name,published_at) VALUES (?,?,?,NOW())',['SavePoint News Hub is ready','This confirms that retro gaming news can be stored in MySQL.','SavePoint']);
}
const sessionUser=u=>({id:u.id,username:u.username,displayName:u.username,email:u.email,role:u.role});
function parseSelectedNewsSources(value) {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value;
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
}

app.get('/',(req,res)=>res.redirect(req.session.user?'/dashboard':'/login'));
app.get('/login',(req,res)=>{if(req.session.user)return res.redirect('/dashboard');res.render('auth',{title:'Log in',mode:'login',error:null,values:{}});});
app.get('/signup',(req,res)=>{if(req.session.user)return res.redirect('/dashboard');res.render('auth',{title:'Create account',mode:'signup',error:null,values:{}});});
app.post('/signup',async(req,res,next)=>{try{const username=String(req.body.username||'').trim(),displayName=String(req.body.displayName||'').trim(),email=String(req.body.email||'').trim(),password=String(req.body.password||'');if(!username||!displayName||!password)return res.status(400).render('auth',{title:'Create account',mode:'signup',error:'Username, display name and password are required.',values:{username,displayName,email}});if(username.length<3||password.length<6)return res.status(400).render('auth',{title:'Create account',mode:'signup',error:'Username must be at least 3 characters and password at least 6 characters.',values:{username,displayName,email}});const [e]=await pool.execute('SELECT id FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1',[username]);if(e.length)return res.status(409).render('auth',{title:'Create account',mode:'signup',error:'That username is already taken.',values:{username,displayName,email}});const hash=await bcrypt.hash(password,12);const normalizedEmail=email||`${username}@savepoint.local`;const [r]=await pool.execute("INSERT INTO users (username,email,password,role) VALUES (?,?,?,'user')",[username,normalizedEmail,hash]);req.session.user={id:r.insertId,username,displayName:displayName||username,email:normalizedEmail,role:'user'};res.redirect('/dashboard');}catch(e){next(e);}});
app.post('/login',async(req,res,next)=>{try{const username=String(req.body.username||'').trim(),password=String(req.body.password||'');const [rows]=await pool.execute('SELECT id,username,password,email,role FROM users WHERE LOWER(username)=LOWER(?) LIMIT 1',[username]);if(!rows.length||!(await bcrypt.compare(password,rows[0].password)))return res.status(401).render('auth',{title:'Log in',mode:'login',error:'Invalid username or password.',values:{username}});req.session.user=sessionUser(rows[0]);res.redirect('/dashboard');}catch(e){next(e);}});
app.post('/logout',(req,res)=>req.session.destroy(()=>res.redirect('/login')));
app.get('/dashboard',requireLogin,async(req,res,next)=>{try{const [[a]]=await pool.query("SELECT COUNT(*) total FROM products WHERE status='active'"),[[b]]=await pool.query("SELECT COUNT(*) total FROM forum_posts WHERE status='visible'"),[[c]]=await pool.query("SELECT COUNT(*) total FROM news_items WHERE status='visible'");res.render('dashboard',{title:'Dashboard',stats:{products:Number(a.total),posts:Number(b.total),news:Number(c.total)}});}catch(e){next(e);}});
app.get('/profile',requireLogin,async(req,res,next)=>{try{const [rows]=await pool.execute('SELECT id,username,email,bio,favourite_console,profile_image,banner_image,role,created_at FROM users WHERE id=? LIMIT 1',[req.session.user.id]);if(!rows.length)return res.redirect('/logout');res.render('profile',{title:'Profile',profile:rows[0]});}catch(e){next(e);}});
app.post('/profile',requireLogin,async(req,res,next)=>{try{const username=String(req.body.username||req.session.user.username||'').trim(),email=String(req.body.email||'').trim(),bio=String(req.body.bio||'').trim(),fc=String(req.body.favouriteConsole||'').trim(),profileImage=String(req.body.profileImage||'').trim(),bannerImage=String(req.body.bannerImage||'').trim();if(!username)return res.status(400).render('error',{title:'Profile error',message:'Username cannot be empty.'});const normalizedEmail=email||req.session.user.email||`${username}@savepoint.local`;const [existing]=await pool.execute('SELECT id FROM users WHERE LOWER(username)=LOWER(?) AND id<>? LIMIT 1',[username,req.session.user.id]);if(existing.length)return res.status(409).render('error',{title:'Profile error',message:'That username is already taken.'});await pool.execute('UPDATE users SET username=?,email=?,bio=?,favourite_console=?,profile_image=?,banner_image=? WHERE id=?',[username,normalizedEmail,bio||null,fc||null,profileImage||null,bannerImage||null,req.session.user.id]);req.session.user.username=username;req.session.user.displayName=username;req.session.user.email=normalizedEmail;res.redirect('/profile');}catch(e){next(e);}});
app.get('/marketplace',requireLogin,async(req,res,next)=>{try{const [rows]=await pool.query("SELECT p.*,u.username seller_username FROM products p LEFT JOIN users u ON u.id=p.seller_user_id WHERE p.status='active' ORDER BY p.created_at DESC");res.render('placeholder',{title:'Retro Marketplace',heading:'Buy and sell retro gaming gear',description:'The marketplace table and starter listing are ready.',items:rows.map(x=>({title:x.title,detail:`${x.category}${x.platform?' · '+x.platform:''} · $${Number(x.price).toFixed(2)}`}))});}catch(e){next(e);}});
app.get('/forum',requireLogin,async(req,res,next)=>{try{const [rows]=await pool.query("SELECT f.*,u.username author_username FROM forum_posts f LEFT JOIN users u ON u.id=f.author_user_id WHERE f.status='visible' ORDER BY f.created_at DESC");res.render('placeholder',{title:'Community Forum',heading:'Discuss retro games with the community',description:'The forum table is ready for posts, comments and voting.',items:rows.map(x=>({title:x.title,detail:`Posted by ${x.author_username||'Deleted user'}`}))});}catch(e){next(e);}});
app.get('/news',(req,res)=>res.redirect('/newshub'));
app.get('/newshub',requireLogin,(req,res)=>{
  newsHub.startBackgroundRefresh();
  const initialNews=newsHub.getNewsPage({page:1,limit:6,type:req.query.type||'all',source:req.query.source||'all',selectedSources:parseSelectedNewsSources(req.query.sources)});
  res.render('newshub/index',{title:'NewsHub',initialNews,newsTypes:newsHub.NEWS_TYPES,sources:newsHub.TRUSTED_SOURCES});
});
app.get('/api/newshub/news',requireLogin,async(req,res,next)=>{try{
  if(req.query.force==='1') await newsHub.refreshArticles({force:true});
  else if(newsHub.getNewsPage({page:1,limit:1}).total===0) await newsHub.refreshArticles();
  res.json(newsHub.getNewsPage({page:req.query.page||1,limit:req.query.limit||6,type:req.query.type||'all',source:req.query.source||'all',selectedSources:parseSelectedNewsSources(req.query.sources)}));
}catch(e){next(e);}});
app.get('/api/newshub/daily-report',requireLogin,async(req,res,next)=>{try{
  if(req.query.force==='1') await newsHub.refreshArticles({force:true});
  else await newsHub.refreshArticles();
  res.json({report:newsHub.buildDailyReport(parseSelectedNewsSources(req.query.sources))});
}catch(e){next(e);}});
app.get('/api/newshub/monthly-report',requireLogin,async(req,res,next)=>{try{
  if(req.query.force==='1') await newsHub.refreshArticles({force:true});
  else await newsHub.refreshArticles();
  res.json({report:newsHub.buildMonthlyReport(parseSelectedNewsSources(req.query.sources))});
}catch(e){next(e);}});
app.get('/admin',requireAdmin,async(req,res,next)=>{try{const [users]=await pool.query('SELECT id,username,role,created_at FROM users ORDER BY created_at DESC'),[products]=await pool.query('SELECT id,title,status,created_at FROM products ORDER BY created_at DESC'),[posts]=await pool.query('SELECT id,title,status,created_at FROM forum_posts ORDER BY created_at DESC');res.render('admin',{title:'Admin Panel',users,products,posts});}catch(e){next(e);}});
app.post('/admin/products/:id/delete',requireAdmin,async(req,res,next)=>{try{await pool.execute("UPDATE products SET status='removed' WHERE id=?",[Number(req.params.id)]);res.redirect('/admin');}catch(e){next(e);}});
app.post('/admin/posts/:id/delete',requireAdmin,async(req,res,next)=>{try{await pool.execute("UPDATE forum_posts SET status='removed' WHERE id=?",[Number(req.params.id)]);res.redirect('/admin');}catch(e){next(e);}});
app.get('/health',async(req,res)=>{try{await pool.query('SELECT 1');res.json({ok:true,database:'connected'});}catch(e){res.status(500).json({ok:false,database:'disconnected'});}});
app.use((req,res)=>res.status(404).render('error',{title:'Page not found',message:'That save file does not exist.'}));
app.use((e,req,res,next)=>{console.error(e);res.status(500).render('error',{title:'Application error',message:process.env.NODE_ENV==='production'?'SavePoint ran into an unexpected error.':e.message});});
async function startServer(){try{await pool.query('SELECT 1');console.log('Connected to MySQL database');await initialiseDatabase();await newsHub.ensureNewsHubStorage();await newsHub.hydrateCacheFromDatabase();newsHub.startBackgroundRefresh();console.log('SavePoint database tables are ready');app.listen(PORT,'0.0.0.0',()=>console.log(`SavePoint is running at http://localhost:${PORT}`));}catch(e){console.error('Could not start SavePoint:',e);process.exit(1);}}
>>>>>>> 44b0f9dad49978eca690fd08368c0809855def6e
startServer();
