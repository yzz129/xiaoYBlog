module.exports = {
    // 查询未审核的留言下的回复
    GetReplyOfMsgWaitReview: 'SELECT r1.*, c1.content AS comment_content FROM reply r1\
        LEFT JOIN comments c1 ON r1.comment_id = c1.id\
        WHERE (r1.approved = 0 AND c1.article_id IS NULL)',
    // 分页查询未审核的留言下的回复
    QueryUnreviewedMessageReplyPage: 'SELECT SQL_CALC_FOUND_ROWS r1.*, c1.content AS comment_content FROM reply r1\
        LEFT JOIN comments c1 ON r1.comment_id = c1.id\
        WHERE (r1.approved = 0 AND c1.article_id IS NULL)\
        ORDER BY create_time DESC\
    LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    // 查询未审核的评论下的回复
    GetReplyOfCommentWaitReview: 'SELECT r1.*, c1.content AS comment_content, a1.article_name FROM reply r1\
        LEFT JOIN comments c1 ON r1.comment_id = c1.id\
        LEFT JOIN article a1 ON a1.id = c1.article_id\
        WHERE (r1.approved = 0 AND c1.article_id IS NOT NULL)',
    // 分页查询未审核的评论下的回复
    QueryUnreviewedCommentReplyPage: 'SELECT SQL_CALC_FOUND_ROWS r1.*, c1.content AS comment_content, a1.article_name FROM reply r1\
        LEFT JOIN comments c1 ON r1.comment_id = c1.id\
        LEFT JOIN article a1 ON a1.id = c1.article_id\
        WHERE (r1.approved = 0 AND c1.article_id IS NOT NULL)\
    ORDER BY create_time DESC\
    LIMIT ?, ?;\
    SELECT FOUND_ROWS() AS total;',
    // 插入回复表
    AddReply: 'INSERT IGNORE INTO reply SET ?',
    // 根据评论id查询所有审核通过的回复，这里ASC升序是为了让最早的回复在上面显示
    QueryReplyByCommentID: 'SELECT a.id, a.comment_id, a.content, a.create_time, a.nick_name, a.site_url, a.device, a.avatar FROM reply a\
        WHERE (a.comment_id = ? AND a.approved = 1)\
        ORDER BY create_time ASC',
    // 审核回复
    UpdateApprovedByReplyID: 'UPDATE reply SET approved = ? WHERE id = ?'
}
