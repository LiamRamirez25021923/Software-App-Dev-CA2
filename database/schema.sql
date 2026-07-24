CREATE DATABASE IF NOT EXISTS c237_017_team5_savepoint;
USE c237_017_team5_savepoint;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
<<<<<<< HEAD
  display_name VARCHAR(100),
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  profile_image TEXT DEFAULT 'default_profile.png',
  banner_image TEXT DEFAULT 'default_banner.png',
=======
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  profile_image VARCHAR(255) NOT NULL DEFAULT 'default_profile.png',
  banner_image VARCHAR(255) NOT NULL DEFAULT 'default_banner.png',
>>>>>>> 62a7642584602e15e4a4f5e9023d760abfacdc3b
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  bio TEXT,
  favourite_console VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
<<<<<<< HEAD
);

CREATE TABLE IF NOT EXISTS contact_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_name VARCHAR(100) NOT NULL,
  sender_email VARCHAR(150) NOT NULL,
  subject VARCHAR(180) DEFAULT 'General enquiry',
  message TEXT NOT NULL,
  recipient_email VARCHAR(150) DEFAULT 'support@savepoint.com',
  status ENUM('new','read','resolved') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
=======
>>>>>>> 62a7642584602e15e4a4f5e9023d760abfacdc3b
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(80) NOT NULL DEFAULT 'Games',
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image VARCHAR(255),
  description TEXT,
<<<<<<< HEAD
  features JSON,
  sizes JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
=======
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  status ENUM('active','sold','removed') NOT NULL DEFAULT 'active',
  quantity INT NOT NULL DEFAULT 1,
  seller_user_id INT NULL,
  platform VARCHAR(80),
  FOREIGN KEY (seller_user_id) REFERENCES users(id) ON DELETE SET NULL
>>>>>>> 62a7642584602e15e4a4f5e9023d760abfacdc3b
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  author_user_id INT NULL,
  title VARCHAR(180) NOT NULL,
  body TEXT NOT NULL,
  status ENUM('visible','removed') NOT NULL DEFAULT 'visible',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (author_user_id) REFERENCES users(id) ON DELETE SET NULL
);

<<<<<<< HEAD
create table if not exists forums (
  id int auto_increment primary key,
  user_id int not null,
  title varchar(255) not null,
  description text,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  foreign key (user_id) references users(id) on delete cascade
);

create table if not exists news (
  id int auto_increment primary key,
  admin_id int not null,
  title varchar(255) not null,
  content text not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  foreign key (admin_id) references users(id) on delete cascade
=======
CREATE TABLE IF NOT EXISTS news_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  summary TEXT,
  source_name VARCHAR(120),
  source_url VARCHAR(500),
  published_at DATETIME,
  status ENUM('visible','hidden') NOT NULL DEFAULT 'visible',
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
>>>>>>> 62a7642584602e15e4a4f5e9023d760abfacdc3b
);

CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NULL,
  product_title VARCHAR(150) NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL,
  line_total DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);
