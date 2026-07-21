const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const path = require('path');

const app = express();

// Keep uploaded images in memory long enough to save them into MySQL.
// This avoids relying on Render's temporary local filesystem.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB maximum
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed.'));
    }
    cb(null, true);
  }
});

const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
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
});

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));

// Home page. Do not fetch the full image blob for every row.
app.get('/', (req, res) => {
  const sql = `
    SELECT productId, productName, quantity, price, image,
           (imageData IS NOT NULL) AS hasUploadedImage
    FROM products
  `;

  connection.query(sql, (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving products');
    }
    res.render('index', { products: results });
  });
});

app.get('/product/:id', (req, res) => {
  const productId = req.params.id;
  const sql = `
    SELECT productId, productName, quantity, price, image,
           (imageData IS NOT NULL) AS hasUploadedImage
    FROM products
    WHERE productId = ?
  `;

  connection.query(sql, [productId], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving product by ID');
    }

    if (results.length === 0) {
      return res.status(404).send('Product not found');
    }

    res.render('product', { product: results[0] });
  });
});

// Serves a database-stored image to the browser.
app.get('/product-image/:id', (req, res) => {
  const sql = 'SELECT imageData, imageMimeType FROM products WHERE productId = ?';

  connection.query(sql, [req.params.id], (error, results) => {
    if (error) {
      console.error('Image query error:', error.message);
      return res.sendStatus(500);
    }

    if (results.length === 0 || !results[0].imageData) {
      return res.sendStatus(404);
    }

    res.set('Content-Type', results[0].imageMimeType || 'application/octet-stream');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(results[0].imageData);
  });
});

app.get('/addProduct', (req, res) => {
  res.render('addProduct');
});

app.post('/addProduct', upload.single('image'), (req, res) => {
  const { name, quantity, price } = req.body;
  const imageData = req.file ? req.file.buffer : null;
  const imageMimeType = req.file ? req.file.mimetype : null;

  const sql = `
    INSERT INTO products
      (productName, quantity, price, image, imageData, imageMimeType)
    VALUES (?, ?, ?, NULL, ?, ?)
  `;

  connection.query(
    sql,
    [name, quantity, price, imageData, imageMimeType],
    (error) => {
      if (error) {
        console.error('Error adding product:', error);
        return res.status(500).send('Error adding product');
      }
      res.redirect('/');
    }
  );
});

app.get('/editProduct/:id', (req, res) => {
  const sql = `
    SELECT productId, productName, quantity, price, image,
           (imageData IS NOT NULL) AS hasUploadedImage
    FROM products
    WHERE productId = ?
  `;

  connection.query(sql, [req.params.id], (error, results) => {
    if (error) {
      console.error('Database query error:', error.message);
      return res.status(500).send('Error retrieving product by ID');
    }

    if (results.length === 0) {
      return res.status(404).send('Product not found');
    }

    res.render('editProduct', { product: results[0] });
  });
});

app.post('/editProduct/:id', upload.single('image'), (req, res) => {
  const { name, quantity, price } = req.body;
  const productId = req.params.id;

  let sql;
  let values;

  if (req.file) {
    sql = `
      UPDATE products
      SET productName = ?, quantity = ?, price = ?,
          image = NULL, imageData = ?, imageMimeType = ?
      WHERE productId = ?
    `;
    values = [
      name,
      quantity,
      price,
      req.file.buffer,
      req.file.mimetype,
      productId
    ];
  } else {
    sql = `
      UPDATE products
      SET productName = ?, quantity = ?, price = ?
      WHERE productId = ?
    `;
    values = [name, quantity, price, productId];
  }

  connection.query(sql, values, (error) => {
    if (error) {
      console.error('Error updating product:', error);
      return res.status(500).send('Error updating product');
    }
    res.redirect('/');
  });
});

app.get('/deleteProduct/:id', (req, res) => {
  const sql = 'DELETE FROM products WHERE productId = ?';

  connection.query(sql, [req.params.id], (error) => {
    if (error) {
      console.error('Error deleting product:', error);
      return res.status(500).send('Error deleting product');
    }
    res.redirect('/');
  });
});

// Friendly Multer error response.
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError || error.message === 'Only image files are allowed.') {
    return res.status(400).send(error.message);
  }
  next(error);
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
