-- SavePoint marketplace additions.
-- This version follows the C237 Lesson 18 SupermarketApp product structure.

CREATE TABLE IF NOT EXISTS products (
  productId INT AUTO_INCREMENT PRIMARY KEY,
  productName VARCHAR(150) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image VARCHAR(255),
  seller_user_id INT NULL,
  description TEXT,
  category VARCHAR(80) NOT NULL DEFAULT 'Games',
  platform VARCHAR(80),
  status ENUM('active','sold','removed') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  customer_name VARCHAR(120) NOT NULL,
  customer_email VARCHAR(150) NOT NULL,
  delivery_address TEXT NOT NULL,
  card_last_four CHAR(4) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  status ENUM('confirmed','cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NULL,
  product_title VARCHAR(150) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
