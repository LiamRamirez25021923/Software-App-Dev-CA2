create database if not exists c237_017_team5_savepoint, 
use c237_017_team5_savepoint;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image VARCHAR(255) NOT NULL DEFAULT 'placeholder.png',
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
  password varchar(255) not null,
  role enum('admin', 'user') not null default 'user'
);

create table if not exists forums (
  id int auto_increment primary key,
  title varchar(255) not null,
  description text,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp
);

create table if not exists news (
  id int auto_increment primary key,
  title varchar(255) not null,
  content text not null,
  created_at timestamp default current_timestamp,
  updated_at timestamp default current_timestamp on update current_timestamp
);