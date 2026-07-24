<<<<<<< HEAD
create database if not exists c237_017_team5_savepoint;
use c237_017_team5_savepoint;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image TEXT NOT NULL DEFAULT 'placeholder.png',
  description TEXT,
  features JSON,
  sizes JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

create table if not exists users (
  id int auto_increment primary key,
  username varchar(50) not null unique,
  email varchar(100) not null unique,
  password varchar(255) not null,aa
  profile_image text default 'default_profile.png',
  banner_image text default 'default_banner.png',
  role enum('admin', 'user') not null default 'user'
);

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
=======
-- SavePoint tables are also created automatically by app.js on startup.
-- This file is provided for inspection and manual setup.
>>>>>>> 1baade9e804acd22a340912c0af2658cf22a8d69
