module.exports = {
    // 检查分类是否存在
    CheckCategory: 'SELECT * FROM category WHERE category_name = ?',
    // 查询所有分类
    QueryAllCategories: 'SELECT * FROM category',
    GetCategoryCount: 'SELECT COUNT(*) AS count FROM category',
    // 查询所有被关联的分类及其数量
    QueryCategoryAndCount: 'SELECT c.*, COUNT(a.id) AS category_count FROM category c\n        INNER JOIN article_category a_c ON c.id = a_c.category_id\n        INNER JOIN article a ON a.id = a_c.article_id AND a.private = 0 AND a.deleted = 0\n        GROUP BY c.id',
    // 根据用户ID查询分类
    QueryCategoriesByUserID: 'SELECT DISTINCT c.* FROM category c\n        INNER JOIN article_category a_c ON c.id = a_c.category_id\n        INNER JOIN article a ON a.id = a_c.article_id AND a.author_id = ?\n        GROUP BY c.id',
    // 根据用户ID查询分类及其文章数量
    QueryCategoryAndCountByUserID: 'SELECT c.*, COUNT(a.id) AS category_count FROM category c\n        INNER JOIN article_category a_c ON c.id = a_c.category_id\n        INNER JOIN article a ON a.id = a_c.article_id AND a.author_id = ?\n        GROUP BY c.id',
    // 插入分类表
    AddCategories: 'INSERT ignore into category (category_name) values (?)',
    GetCategoryAdminPage: 'SELECT SQL_CALC_FOUND_ROWS c.*, GROUP_CONCAT(a_c.article_id) AS article_ids FROM category c\n        INNER JOIN article_category a_c ON a_c.category_id = c.id\n        GROUP BY c.id\n        LIMIT ?, ?;\n        SELECT FOUND_ROWS() AS total;',
    AdminUpdateCategory: 'UPDATE category SET ? WHERE id = ?',
}
