module.exports = {
    // 查询所有被关联的标签及其数量
    GetArticleSum: 'SELECT t.id, t.tag_name, COUNT(*) AS blog_count FROM tag t\n        LEFT JOIN article_tag a_t ON t.id = a_t.tag_id\n        GROUP BY t.id',
    QueryAllTags: 'SELECT * FROM tag',
    QueryTagAndCount: 'SELECT t.*, COUNT(a.id) AS tag_count FROM tag t\n        INNER JOIN article_tag a_t ON t.id = a_t.tag_id\n        INNER JOIN article a ON a.id = a_t.article_id AND a.private = 0 AND a.deleted = 0\n        GROUP BY t.id',
    // 根据用户ID查询标签
    QueryTagsByUserID: 'SELECT DISTINCT t.* FROM tag t\n        INNER JOIN article_tag a_t ON t.id = a_t.tag_id\n        INNER JOIN article a ON a.id = a_t.article_id AND a.author_id = ?\n        GROUP BY t.id',
    // 根据用户ID查询标签及其文章数量
    QueryTagAndCountByUserID: 'SELECT t.*, COUNT(a.id) AS tag_count FROM tag t\n        INNER JOIN article_tag a_t ON t.id = a_t.tag_id\n        INNER JOIN article a ON a.id = a_t.article_id AND a.author_id = ?\n        GROUP BY t.id',
    // 插入标签表
    AddTags: 'INSERT ignore into tag (tag_name) values (?)',
    // 检查标签是否存在
    CheckTag: 'SELECT * FROM tag WHERE tag_name = ?',
    GetTagAdminPage: 'SELECT SQL_CALC_FOUND_ROWS t.*, GROUP_CONCAT(a_t.article_id) AS article_ids FROM tag t\n        INNER JOIN article_tag a_t ON a_t.tag_id = t.id\n        GROUP BY t.id\n        LIMIT ?, ?;\n        SELECT FOUND_ROWS() AS total;',
}
