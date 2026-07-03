const mysql = require("mysql2/promise");
const config = require("../config");

const pool = mysql.createPool({
    host: config.mysql.host,
    port: config.mysql.port,
    user: config.mysql.user,
    password: config.mysql.password,
    database: config.mysql.database,
    charset: config.mysql.charset,
    waitForConnections: config.mysql.waitForConnections,
    multipleStatements: config.mysql.multipleStatements,
    connectionLimit: 10,
    queueLimit: 0,
});

function normalizeOptions(options) {
    if (typeof options === "string") {
        return {
            sql: options,
            values: [],
        };
    }

    return {
        sql: options?.sql || "",
        values: options?.values ?? [],
    };
}

async function getConnection(res) {
    try {
        return await pool.getConnection();
    } catch (error) {
        if (res?.send) {
            res.send({
                code: "500000",
                msg: "数据库连接失败",
            });
        }

        throw error;
    }
}

async function query(options, connection = null, autoRelease = true) {
    const queryOptions = normalizeOptions(options);
    const executor = connection || pool;

    try {
        const [results, fields] = await executor.query(queryOptions.sql, queryOptions.values);
        return { results, fields };
    } finally {
        if (connection && autoRelease) {
            connection.release();
        }
    }
}

module.exports = {
    pool,
    getConnection,
    query,
};
