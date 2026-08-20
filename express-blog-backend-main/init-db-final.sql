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
author_id INT(11) DEFAULT NULL,
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
KEY author_id (author_id),
KEY comment_id (comment_id),
CONSTRAINT reply_ibfk_1 FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT reply_ibfk_2 FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE ON UPDATE CASCADE,
CONSTRAINT reply_ibfk_3 FOREIGN KEY (author_id) REFERENCES user (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Production social graph: follows remain subscriptions; friendships require requests.
CREATE TABLE IF NOT EXISTS user_follow (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, follower_id INT NOT NULL, following_id INT NOT NULL,
create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
UNIQUE KEY uk_user_follow (follower_id, following_id), KEY idx_user_follow_following (following_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_friend_request (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, requester_id INT NOT NULL, recipient_id INT NOT NULL,
status ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending', message VARCHAR(255) NOT NULL DEFAULT '',
create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
PRIMARY KEY (id), UNIQUE KEY uk_friend_request_pair (requester_id, recipient_id),
KEY idx_friend_request_recipient_status (recipient_id, status), KEY idx_friend_request_requester_status (requester_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_friendship (
user_low_id INT NOT NULL, user_high_id INT NOT NULL, create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (user_low_id, user_high_id), KEY idx_friendship_high (user_high_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_block (
blocker_id INT NOT NULL, blocked_id INT NOT NULL, create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
PRIMARY KEY (blocker_id, blocked_id), KEY idx_user_block_blocked (blocked_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_privacy (
user_id INT NOT NULL, allow_friend_requests ENUM('everyone','following','none') NOT NULL DEFAULT 'everyone',
allow_direct_messages ENUM('everyone','friends','none') NOT NULL DEFAULT 'friends',
show_followers TINYINT(1) NOT NULL DEFAULT 1, show_following TINYINT(1) NOT NULL DEFAULT 1,
update_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_direct_message (
id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, sender_id INT NOT NULL, receiver_id INT NOT NULL, content TEXT NOT NULL,
read_time DATETIME NULL, create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (id),
KEY idx_direct_message_sender (sender_id), KEY idx_direct_message_receiver (receiver_id),
KEY idx_direct_message_pair_time (sender_id, receiver_id, create_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS article_view_dedup (
article_id INT NOT NULL, viewer_hash CHAR(64) NOT NULL, view_bucket BIGINT NOT NULL,
create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (article_id, viewer_hash, view_bucket),
KEY idx_article_view_create_time (create_time)
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
