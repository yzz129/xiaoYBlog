-- 简化版数据库初始化脚本

-- 创建数据库
CREATE DATABASE IF NOT EXISTS blog DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 使用数据库
USE blog;

-- 创建用户表
CREATE TABLE IF NOT EXISTS user (
  id INT(11) NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password VARCHAR(255) NOT NULL,
  nick_name VARCHAR(100) NOT NULL,
  avatar VARCHAR(255) DEFAULT NULL,
  email VARCHAR(100) DEFAULT NULL,
  intro TEXT,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建分类表
CREATE TABLE IF NOT EXISTS category (
  id INT(11) NOT NULL AUTO_INCREMENT,
  category_name VARCHAR(50) NOT NULL,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY category_name (category_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建标签表
CREATE TABLE IF NOT EXISTS tag (
  id INT(11) NOT NULL AUTO_INCREMENT,
  tag_name VARCHAR(50) NOT NULL,
  create_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY tag_name (tag_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建文章表
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

-- 创建文章分类关联表
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

-- 创建文章标签关联表
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

-- 创建评论表
CREATE TABLE IF NOT EXISTS comments (
  id INT(11) NOT NULL AUTO_INCREMENT,
  article_id INT(11) DEFAULT NULL,
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
  CONSTRAINT comments_ibfk_1 FOREIGN KEY (article_id) REFERENCES article (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 创建回复表
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

-- 插入管理员用户
INSERT INTO user (username, password, nick_name, email, intro) VALUES
('admin', '$2b$10$e3q3QZ9V8Q0e3q3QZ9V8Qe3q3QZ9V8Qe3q3QZ9V8Qe3q3QZ9V8Qe', '管理员', 'admin@example.com', '网站管理员');

-- 插入默认分类
INSERT INTO category (category_name) VALUES
('前端'),
('后端'),
('生活'),
('技术');

-- 插入默认标签
INSERT INTO tag (tag_name) VALUES
('Vue'),
('React'),
('Node.js'),
('Express'),
('MySQL'),
('JavaScript'),
('TypeScript');

-- 插入示例文章
INSERT INTO article (article_name, content, summary, author_id) VALUES
('欢迎使用博客系统', '<h1>欢迎使用博客系统</h1><p>这是一篇示例文章，用于测试博客系统的功能。</p>', '欢迎使用博客系统，这是一篇示例文章。', 1);

-- 关联文章分类和标签
INSERT INTO article_category (article_id, category_id) VALUES (1, 1);
INSERT INTO article_tag (article_id, tag_id) VALUES (1, 1), (1, 6);

COMMIT;