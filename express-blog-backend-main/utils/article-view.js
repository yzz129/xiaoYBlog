const crypto = require("crypto");

const config = require("../config");
const dbUtils = require("./db");

const VIEW_WINDOW_MS = Math.max(Number(process.env.ARTICLE_VIEW_WINDOW_MS) || 6 * 60 * 60 * 1000, 60 * 1000);
let schemaPromise;

async function ensureArticleViewSchema() {
    schemaPromise ||= dbUtils.query({
        sql: `CREATE TABLE IF NOT EXISTS article_view_dedup (
            article_id INT NOT NULL,
            viewer_hash CHAR(64) NOT NULL,
            view_bucket BIGINT NOT NULL,
            create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (article_id, viewer_hash, view_bucket),
            KEY idx_article_view_create_time (create_time)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    }).catch((error) => {
        schemaPromise = null;
        throw error;
    });
    return schemaPromise;
}

function getViewerIdentity(req) {
    if (req.session?.user?.id) return `user:${req.session.user.id}`;
    if (!req.session.viewVisitorId) req.session.viewVisitorId = crypto.randomUUID();
    return `visitor:${req.session.viewVisitorId}`;
}

async function recordArticleView(req, articleId) {
    await ensureArticleViewSchema();
    const id = Number(articleId);
    if (!Number.isInteger(id) || id <= 0) return { counted: false };

    const identity = getViewerIdentity(req);
    const viewerHash = crypto.createHmac("sha256", config.session.secret).update(identity).digest("hex");
    const viewBucket = Math.floor(Date.now() / VIEW_WINDOW_MS);
    const connection = await dbUtils.pool.getConnection();
    try {
        await connection.beginTransaction();
        const [insertResult] = await connection.query(
            `INSERT IGNORE INTO article_view_dedup (article_id, viewer_hash, view_bucket, create_time)
             SELECT id, ?, ?, ? FROM article WHERE id = ? AND private = 0 AND deleted = 0`,
            [viewerHash, viewBucket, new Date(), id]
        );
        if (insertResult.affectedRows === 1) {
            await connection.query("UPDATE article SET read_num = read_num + 1 WHERE id = ? AND private = 0 AND deleted = 0", [id]);
        }
        await connection.commit();
        return { counted: insertResult.affectedRows === 1 };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { ensureArticleViewSchema, recordArticleView };
