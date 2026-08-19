const dbUtils = require("./db");

let contentSchemaReadyPromise;

const hasColumn = async (tableName, columnName) => {
    const { results } = await dbUtils.query({
        sql: `SELECT 1
              FROM information_schema.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
              LIMIT 1`,
        values: [tableName, columnName],
    });

    return results.length > 0;
};

const hasIndexForColumn = async (tableName, columnName) => {
    const { results } = await dbUtils.query({
        sql: `SELECT 1
              FROM information_schema.STATISTICS
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
              LIMIT 1`,
        values: [tableName, columnName],
    });

    return results.length > 0;
};

const ensureAuthorColumn = async (tableName, indexName) => {
    if (!(await hasColumn(tableName, "author_id"))) {
        await dbUtils.query({
            sql: `ALTER TABLE ${tableName} ADD COLUMN author_id INT(11) NULL AFTER article_id`,
        });
    }

    if (!(await hasIndexForColumn(tableName, "author_id"))) {
        await dbUtils.query({
            sql: `ALTER TABLE ${tableName} ADD INDEX ${indexName} (author_id)`,
        });
    }
};

const ensureContentAuthorColumns = async () => {
    if (!contentSchemaReadyPromise) {
        contentSchemaReadyPromise = (async () => {
            // These tables are linked by a foreign key. Keep DDL ordering stable to
            // avoid metadata-lock deadlocks while upgrading an existing database.
            await ensureAuthorColumn("comments", "idx_comments_author_id");
            await ensureAuthorColumn("reply", "idx_reply_author_id");
        })().catch((error) => {
            contentSchemaReadyPromise = null;
            throw error;
        });
    }

    return contentSchemaReadyPromise;
};

module.exports = {
    ensureContentAuthorColumns,
};
