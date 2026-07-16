const express = require('express');
const mysql = require('mysql2');

//******** TODO: Insert code to import 'express-session' *********//
const session = require('express-session');

const flash = require('connect-flash');

const app = express();

// Database connection
const db = mysql.createConnection({
    host: 'c237-leonard-mysql.mysql.database.azure.com',
    user: 'c237_017',
    password: 'c237017@2026!',
    database: 'C237_017_team5_yourdbname',
});

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to database');
});


app.listen(3000, () => {
    console.log('Server started on port 3000');
});
