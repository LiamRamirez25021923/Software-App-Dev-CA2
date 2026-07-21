const express = require('express');
const mysql = require('mysql2');
const app = express();

//app.js very important
const multer = require('multer');
// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

//UPLOAD LINE
const upload = multer({ storage: storage });//add into app.post, route handler /addProduct 

// Create MySQL connection
const connection = mysql.createConnection({
    host: 'c237-leonard-mysql.mysql.database.azure.com',
    user: 'c237_017',
    password: 'c237017@2026!',
    database: 'c237_017_team5_supermarketapp',

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
// Set up view engine
app.set('view engine', 'ejs');
// enable static files
app.use(express.static('public'));

// enable form processing
app.use(express.urlencoded({
    extended:false
}));


// Define routes
app.get('/', (req, res) => {
const sql = 'SELECT * FROM products';
// Fetch data from MySQL
connection.query( sql , (error, results) => {
if (error) {
console.error('Database query error:', error.message);
return res.send('Error Retrieving products');
}
// Render HTML page with data
res.render('index', { products: results });
});
})

app.get('/product/:id', (req, res) => {
// Extract the product ID from the request parameters
const productId = req.params.id;
const sql = 'SELECT * FROM products WHERE productId = ?';
// Fetch data from MySQL based on the product ID
connection.query( sql , [productId], (error, results) => {
if (error) {
console.error('Database query error:', error.message);
return res.send('Error Retrieving product by ID');
}
// Check if any product with the given ID was found
if (results.length > 0) {
// Render HTML page with the product data
res.render('product', { product: results[0] });
} else {
// If no product with the given ID was found
res.send('Product not found');
}
});
});

//Display the form
app.get('/addProduct', (req, res) => {
    res.render('addProduct'); 
});

//Process the form
//add into app.post, route handler /addProduct 
app.post('/addProduct', upload.single('image'), (req, res) => {
    // Extract product data from the request body
    const { name, quantity, price } = req.body;
    let image;
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }

    const sql = 'INSERT INTO products (productName, quantity, price, image) VALUES (?, ?, ?, ?)';
    // Insert the new product into the database
    connection.query( sql , [name, quantity, price, image], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding product:", error);
            res.send('Error adding product');
        } else {
            // Send a success response
            res.redirect('/');
        }
    });
});

app.get('/editProduct/:id', (req,res) => {
const productId = req.params.id;
const sql = 'SELECT * FROM products WHERE productId = ?';
// Fetch data from MySQL based on the product ID
connection.query( sql , [productId], (error, results) => {
if (error) {
console.error('Database query error:', error.message);
return res.send('Error retrieving product by ID');
}
// Check if any product with the given ID was found
if (results.length > 0) {
// Render HTML page with the product data
res.render('editProduct', { product: results[0] });
} else {
// If no product with the given ID was found, render a 404 page or handle it accordingly
res.send('Product not found');
}
});

});
app.get('/deleteProduct/:id', (req, res) => {
const productId = req.params.id;
const sql = 'DELETE FROM products WHERE productId = ?';
connection.query( sql , [productId], (error, results) => {
if (error) {
// Handle any error that occurs during the database operation
console.error("Error deleting product:", error);
res.send('Error deleting product');
} else {
// Send a success response
res.redirect('/');
}
});
});

const PORT = process.env.PORT || 3003;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));