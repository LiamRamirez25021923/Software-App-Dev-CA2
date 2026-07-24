CREATE DATABASE IF NOT EXISTS c237_017_team5_savepoint;
USE c237_017_team5_savepoint;

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE,
    bio TEXT,
    favourite_console VARCHAR(100),
    favorite_console_company VARCHAR(100),
    favorite_game_company VARCHAR(100),
    favorite_game_genre VARCHAR(100),
    favorite_game VARCHAR(150),
    consoles_owned TEXT,
    consoles_wanted TEXT,
    profile_completed TINYINT(1) NOT NULL DEFAULT 0,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    seller_user_id INT NULL,
    title VARCHAR(150) NOT NULL,
    description TEXT,
    category VARCHAR(80) NOT NULL,
    platform VARCHAR(80),
    price DECIMAL(10, 2) NOT NULL DEFAULT 0,
    quantity INT NOT NULL DEFAULT 1,
    image_url VARCHAR(255),
    status ENUM('active', 'sold', 'removed') NOT NULL DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_products_seller
        FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS forum_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    author_user_id INT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    status ENUM('visible', 'removed') NOT NULL DEFAULT 'visible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_forum_author
        FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS news_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    summary TEXT,
    source_name VARCHAR(120),
    source_url VARCHAR(500),
    published_at DATETIME,
    status ENUM('visible', 'hidden') NOT NULL DEFAULT 'visible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
