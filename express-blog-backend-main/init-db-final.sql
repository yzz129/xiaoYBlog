-- Database initialization script with drop first
DROP DATABASE IF EXISTS blog;
CREATE DATABASE IF NOT EXISTS blog DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE blog;

-- Create user table
CREATE TABLE IF NOT EXISTS user (
id INT(11) NOT NULL AUTO_INCREMENT,
username VARCHAR(50) NOT NULL,
password VARCHAR(255) NOT NULL,
nick_name VARCHAR(100) NOT NULL,
avatar VARCHAR(255) DEFAULT NULL,
email VARCHAR(100) DEFAULT NULL,
intro TEXT,
role VARCHAR(20) NOT NULL DEFAULT 'user',
create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (id),
UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create category table
CREATE TABLE IF NOT EXISTS category (
id INT(11) NOT NULL AUTO_INCREMENT,
category_name VARCHAR(50) NOT NULL,
create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (id),
UNIQUE KEY category_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create tag table
CREATE TABLE IF NOT EXISTS tag (
id INT(11) NOT NULL AUTO_INCREMENT,
tag_name VARCHAR(50) NOT NULL,
create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (id),
UNIQUE KEY tag_name (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create article table
CREATE TABLE IF NOT EXISTS article (
id INT(11) NOT NULL AUTO_INCREMENT,
article_name VARCHAR(255) NOT NULL,
content LONGTEXT NOT NULL,
summary TEXT,
poster VARCHAR(255) DEFAULT NULL,
read_num INT(11) NOT NULL DEFAULT 0,
like_num INT(11) NOT NULL DEFAULT 0,
author_id INT(11) NOT NULL,
private TINYINT(1) NOT NULL DEFAULT 0,
deleted TINYINT(1) NOT NULL DEFAULT 0,
create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (id),
KEY author_id (author_id),
CONSTRAINT article_ibfk_1 FOREIGN KEY (author_id) REFERENCES user (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create article_category table
CREATE TABLE IF NOT EXISTS article_category (
id INT(11) NOT NULL AUTO_INCREMENT,
article_id INT(11) NOT NULL,
category_id INT(11) NOT NULL,
PRIMARY KEY (id),
UNIQUE KEY article_category (article_id,category_id),
KEY category_id (category_id),
CONSTRAINT article_category_ibfk_1 FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT article_category_ibfk_2 FOREIGN KEY (category_id) REFERENCES category (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create article_tag table
CREATE TABLE IF NOT EXISTS article_tag (
id INT(11) NOT NULL AUTO_INCREMENT,
article_id INT(11) NOT NULL,
tag_id INT(11) NOT NULL,
PRIMARY KEY (id),
UNIQUE KEY article_tag (article_id,tag_id),
KEY tag_id (tag_id),
CONSTRAINT article_tag_ibfk_1 FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT article_tag_ibfk_2 FOREIGN KEY (tag_id) REFERENCES tag (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
id INT(11) NOT NULL AUTO_INCREMENT,
article_id INT(11) DEFAULT NULL,
author_id INT(11) DEFAULT NULL,
content TEXT NOT NULL,
nick_name VARCHAR(100) NOT NULL,
site_url VARCHAR(255) DEFAULT NULL,
avatar VARCHAR(255) DEFAULT NULL,
device VARCHAR(255) DEFAULT NULL,
approved TINYINT(1) NOT NULL DEFAULT 0,
deleted TINYINT(1) NOT NULL DEFAULT 0,
create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (id),
KEY article_id (article_id),
KEY author_id (author_id),
CONSTRAINT comments_ibfk_1 FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT comments_ibfk_2 FOREIGN KEY (author_id) REFERENCES user (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Create reply table
CREATE TABLE IF NOT EXISTS reply (
id INT(11) NOT NULL AUTO_INCREMENT,
article_id INT(11) DEFAULT NULL,
comment_id INT(11) NOT NULL,
content TEXT NOT NULL,
nick_name VARCHAR(100) NOT NULL,
site_url VARCHAR(255) DEFAULT NULL,
avatar VARCHAR(255) DEFAULT NULL,
device VARCHAR(255) DEFAULT NULL,
approved TINYINT(1) NOT NULL DEFAULT 0,
deleted TINYINT(1) NOT NULL DEFAULT 0,
create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (id),
KEY article_id (article_id),
KEY comment_id (comment_id),
CONSTRAINT reply_ibfk_1 FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT reply_ibfk_2 FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert admin user
INSERT INTO user (username, password, nick_name, email, intro, role) VALUES
('admin', '$2b$10$e3q3QZ9V8Q0e3q3QZ9V8Qe3q3QZ9V8Qe3q3QZ9V8Qe3q3QZ9V8Qe', 'Administrator', 'admin@example.com', 'Site Administrator', 'admin');

-- Insert default categories
INSERT INTO category (category_name) VALUES
('Frontend'),
('Backend'),
('Life'),
('Technology');

-- Insert default tags
INSERT INTO tag (tag_name) VALUES
('Vue'),
('React'),
('Node.js'),
('Express'),
('MySQL'),
('JavaScript'),
('TypeScript');

-- Insert sample article
INSERT INTO article (article_name, content, summary, author_id) VALUES
('Welcome to Blog System', '<h1>Welcome to Blog System</h1><p>This is a sample article for testing blog system functionality.</p>', 'Welcome to Blog System, this is a sample article.', 1);

-- Associate article with category and tag
INSERT INTO article_category (article_id, category_id) VALUES (1, 1);
INSERT INTO article_tag (article_id, tag_id) VALUES (1, 1), (1, 6);

COMMIT;