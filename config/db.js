require('dotenv').config();

const mysql = require('mysql2');

const requiredVariables = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME'
];

const missingVariables = requiredVariables.filter(
    variableName => !process.env[variableName]
);

if (missingVariables.length > 0) {
    throw new Error(
        `Missing database environment variables: ${missingVariables.join(', ')}`
    );
}

const pool = mysql
    .createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 3306,

        ssl: {
            rejectUnauthorized: false
        },

        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    })
    .promise();

module.exports = pool;