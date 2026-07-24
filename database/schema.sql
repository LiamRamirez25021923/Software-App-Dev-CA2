create database if not exists c237_017_team5_savepoint;
use c237_017_team5_savepoint;

create table if not exists users (
  id int auto_increment primary key,
  username varchar(50) not null unique,
  email varchar(150) not null unique,
  password varchar(255) not null,
  profile_image text default 'default_profile.png',
  banner_image text default 'default_banner.png',
  role enum('admin', 'user') not null default 'user',
  bio text,
  favourite_console varchar(100),
  created_at timestamp default current_timestamp
);

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image TEXT NOT NULL DEFAULT 'placeholder.png',
  description TEXT,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  quantity INT NOT NULL DEFAULT 1,
  platform VARCHAR(50) NOT NULL,
  seller_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  foreign key (seller_id) references users(id) on delete cascade
);

CREATE TABLE if not exists order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NULL,
    product_title VARCHAR(150) NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    quantity INT NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,

    FOREIGN KEY (order_id)
        REFERENCES orders(id)
        ON DELETE CASCADE,

    FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE SET NULL
);


create table if not exists forums (
  id int auto_increment primary key,
  author_id int not null,
  author_name varchar(100) not null,
  title varchar(255) not null,
  body text,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  foreign key (author_id) references users(id) on delete cascade
);

create table if not exists news (
  id int auto_increment primary key,
  admin_id int not null,
  title varchar(255) not null,
  summery text not null,
  source_name varchar(100) not null,
  source_url text not null,
  created_at timestamp default current_timestamp,
  foreign key (admin_id) references users(id) on delete cascade
);

create table if not exists comments (
  id int auto_increment primary key,
  forum_id int not null,
  user_id int not null,
  content text not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  foreign key (forum_id) references forums(id) on delete cascade,
  foreign key (user_id) references users(id) on delete cascade
);

create table if not exists shopping_cart (
  id int auto_increment primary key,
  user_id int not null,
  product_id int not null,
  quantity int not null default 1,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp,
  foreign key (user_id) references users(id) on delete cascade,
  foreign key (product_id) references products(id) on delete cascade
); 

CREATE TABLE if not exists orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    customer_name VARCHAR(120) NOT NULL,
    customer_email VARCHAR(150) NOT NULL,
    delivery_address TEXT NOT NULL,
    card_last_four CHAR(4) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    status ENUM('confirmed','cancelled')
        DEFAULT 'confirmed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
);
