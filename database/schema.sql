create database if not exists c237_017_team5_savepoint;
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

/* uncomment the following line to add a new column to an existing table, remember to comment it back after use
 alter table (table_name) add (column_name) (data_type) (null/not null); */

/* when adding anything new to the database, use the following syntax to insert data into the table, remember to comment it back after use
insert into (table_name) (table_columns) values (values_to_insert);
*/

/* when updating anything in the database, use the following syntax to update data in the table, remember to comment it back after use
update (table_name) set (column_name) = (new_value) where (condition);
*/