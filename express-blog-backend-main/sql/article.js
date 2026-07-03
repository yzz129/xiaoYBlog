module.exports = {
    GetPagedArticle:
        'SELECT SQL_CALC_FOUND_ROWS a.id, a.article_name, a.poster, a.read_num, a.summary, a.create_time, a.update_time, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        WHERE a.private = 0 AND a.deleted = 0\
        GROUP BY a.id\
        ORDER BY a.create_time DESC LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    GetArticlePageAdmin:
        'SELECT SQL_CALC_FOUND_ROWS a.id, a.article_name, a.poster, a.read_num, a.create_time, a.update_time, a.private, a.deleted, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        GROUP BY a.id\
        ORDER BY a.create_time DESC LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    GetArticleByID:
        'SELECT a.*, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, u.intro AS author_intro, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        WHERE a.id = ?\
        GROUP BY a.id',
    GetPagedArticleByAuthor:
        'SELECT SQL_CALC_FOUND_ROWS a.id, a.article_name, a.poster, a.read_num, a.summary, a.create_time, a.update_time, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        WHERE a.private = 0 AND a.deleted = 0 AND a.author_id = ?\
        GROUP BY a.id\
        ORDER BY a.create_time DESC LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    GetPagedArticleByAuthorWithKeyword:
        'SELECT SQL_CALC_FOUND_ROWS a.id, a.article_name, a.poster, a.read_num, a.summary, a.create_time, a.update_time, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        WHERE a.private = 0 AND a.deleted = 0 AND a.author_id = ? AND (a.article_name LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)\
        GROUP BY a.id\
        ORDER BY a.create_time DESC LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    SearchPagedArticle:
        'SELECT SQL_CALC_FOUND_ROWS a.id, a.article_name, a.poster, a.read_num, a.summary, a.create_time, a.update_time, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        WHERE a.private = 0 AND a.deleted = 0 AND (a.article_name LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)\
        GROUP BY a.id\
        ORDER BY a.create_time DESC LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    GetPagedArticleByTag:
        'SELECT SQL_CALC_FOUND_ROWS a.id, a.article_name, a.poster, a.read_num, a.summary, a.create_time, a.update_time, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        WHERE a.private = 0 AND a.deleted = 0\
        GROUP BY a.id\
        HAVING a.id = ANY (SELECT article_id FROM article_tag WHERE tag_id = (SELECT id FROM tag WHERE tag_name = ?))\
        ORDER BY a.create_time DESC LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    GetPagedArticleByCategory:
        'SELECT SQL_CALC_FOUND_ROWS a.id, a.article_name, a.poster, a.read_num, a.summary, a.create_time, a.update_time, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        WHERE a.private = 0 AND a.deleted = 0\
        GROUP BY a.id\
        HAVING a.id = ANY (SELECT article_id FROM article_category WHERE category_id = (SELECT id FROM category WHERE category_name = ?))\
        ORDER BY a.create_time DESC LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    PublishArticle: "INSERT INTO article (article_name, content, summary, author_id, poster) values (?, ?, ?, ?, ?)",
    UpdateReadSum: "UPDATE article SET read_num = read_num + 1 WHERE id = ?",
    UpdateArticle: "UPDATE article SET ? WHERE id = ?",
    GetTopRead: "SELECT id, article_name, read_num, poster FROM article WHERE private = 0 AND deleted = 0 ORDER BY `read_num` DESC LIMIT ?",
    QueryPreAndNextArticleIds:
        "SELECT id, article_name FROM article WHERE id in ((SELECT id FROM article WHERE private = 0 AND deleted = 0 AND id < ? ORDER BY id DESC limit 1), (SELECT id FROM article WHERE private = 0 AND deleted = 0 AND id > ? ORDER BY id asc limit 1))",
    AddArticleCategory: "INSERT INTO article_category (article_id, category_id) VALUES (?, ?)",
    AddArticleTag: "INSERT INTO article_tag (article_id, tag_id) VALUES (?, ?)",
    DeleteArticleTag: "DELETE FROM article_tag WHERE article_id = ? AND tag_id = ?",
    DeleteArticleCategory: "DELETE FROM article_category WHERE article_id = ? AND category_id = ?",
    UpdateArticlePrivate: "UPDATE article SET private = ? WHERE id = ?",
    UpdateArticleDeleted: "UPDATE article SET deleted = ? WHERE id = ?",
    DeleteArticleById: "DELETE FROM article WHERE id = ?",
    GetUserArticlePage:
        'SELECT SQL_CALC_FOUND_ROWS a.id, a.article_name, a.poster, a.read_num, a.create_time, a.update_time, a.private, a.deleted, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        WHERE a.author_id = ?\
        GROUP BY a.id\
        ORDER BY a.create_time DESC LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    GetUserArticlePageWithKeyword:
        'SELECT SQL_CALC_FOUND_ROWS a.id, a.article_name, a.poster, a.read_num, a.create_time, a.update_time, a.private, a.deleted, u.id AS author_user_id, u.nick_name AS author, u.avatar AS author_avatar, GROUP_CONCAT(DISTINCT c.id SEPARATOR " ") AS categoryIDs, GROUP_CONCAT(DISTINCT c.category_name SEPARATOR " ") AS categoryNames, GROUP_CONCAT(DISTINCT t.id SEPARATOR " ") AS tagIDs, GROUP_CONCAT(DISTINCT t.tag_name SEPARATOR " ") AS tagNames FROM article a\
        LEFT JOIN user u ON a.author_id = u.id\
        LEFT JOIN article_category a_c ON a.id = a_c.article_id\
        LEFT JOIN category c ON a_c.category_id = c.id\
        LEFT JOIN article_tag a_t ON a.id = a_t.article_id\
        LEFT JOIN tag t ON a_t.tag_id = t.id\
        WHERE a.author_id = ? AND (a.article_name LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)\
        GROUP BY a.id\
        ORDER BY a.create_time DESC LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    GetArticleByIdAndAuthorId: "SELECT * FROM article WHERE id = ? AND author_id = ?",
};
