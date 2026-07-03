-- 为user表添加role字段
ALTER TABLE `user` ADD COLUMN `role` VARCHAR(20) NOT NULL DEFAULT 'user' COMMENT '用户角色：admin/user';

-- 更新现有管理员用户的角色
UPDATE `user` SET `role` = 'admin' WHERE `username` = 'admin';
