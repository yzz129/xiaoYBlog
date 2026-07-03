const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const nodeEnv = process.env.NODE_ENV || "development";
const rootDir = path.resolve(__dirname, "..");

[
    ".env",
    `.env.${nodeEnv}`,
    ".env.local",
    `.env.${nodeEnv}.local`,
].forEach((fileName) => {
    const filePath = path.join(rootDir, fileName);
    if (fs.existsSync(filePath)) {
        dotenv.config({
            path: filePath,
            override: true,
            quiet: true,
        });
    }
});

function toNumber(value, fallback) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
}

function toBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") {
        return fallback;
    }

    return ["true", "1", "yes", "on"].includes(String(value).toLowerCase());
}

function toArray(value, fallback = []) {
    if (!value) {
        return fallback;
    }

    return String(value)
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
}

module.exports = {
    allowClient: toArray(process.env.ALLOW_CLIENT, []),
    email: {
        service: process.env.EMAIL_SERVICE || "163",
        port: toNumber(process.env.EMAIL_PORT, 465),
        secureConnection: toBoolean(process.env.EMAIL_SECURE_CONNECTION, true),
        auth: {
            user: process.env.EMAIL_AUTH_USER || "",
            pass: process.env.EMAIL_AUTH_PASS || "",
        },
    },
    authorEmail: process.env.AUTHOR_EMAIL || "",
    blogName: process.env.BLOG_NAME || "小Y 博客",
    siteURL: process.env.SITE_URL || "",
    chatgpt: {
        key: process.env.OPENAI_API_KEY || "",
    },
    aiWriter: {
        deepseekApiKey: process.env.DEEPSEEK_API_KEY || "",
        tavilyApiKey: process.env.TAVILY_API_KEY || "",
        deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        knowledgeCutoff: process.env.AI_KNOWLEDGE_CUTOFF || "2024-12",
        sessionTtlSeconds: toNumber(process.env.AI_SESSION_TTL_SECONDS, 21600),
        requestTimeoutMs: toNumber(process.env.AI_REQUEST_TIMEOUT_MS, 45000),
    },
    redis: {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: toNumber(process.env.REDIS_PORT, 6379),
        password: process.env.REDIS_PASSWORD || "",
        db: toNumber(process.env.REDIS_DB, 0),
        connectTimeoutMs: toNumber(process.env.REDIS_CONNECT_TIMEOUT_MS, 2000),
        retryAfterMs: toNumber(process.env.REDIS_RETRY_AFTER_MS, 30000),
    },
    mysql: {
        host: process.env.MYSQL_HOST || "127.0.0.1",
        port: toNumber(process.env.MYSQL_PORT, 3306),
        user: process.env.MYSQL_USER || "root",
        password: process.env.MYSQL_PASSWORD || "",
        database: process.env.MYSQL_DATABASE || "blog",
        multipleStatements: toBoolean(process.env.MYSQL_MULTIPLE_STATEMENTS, true),
        waitForConnections: toBoolean(process.env.MYSQL_WAIT_FOR_CONNECTIONS, true),
        charset: process.env.MYSQL_CHARSET || "UTF8MB4_UNICODE_CI",
    },
    minio: {
        endPoint: process.env.MINIO_ENDPOINT || "127.0.0.1",
        port: toNumber(process.env.MINIO_PORT, 9000),
        useSSL: toBoolean(process.env.MINIO_USE_SSL, false),
        accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
        secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
        bucket: process.env.MINIO_BUCKET || "blog-assets",
        region: process.env.MINIO_REGION || "us-east-1",
        publicBaseUrl: process.env.MINIO_PUBLIC_BASE_URL || "",
    },
    auth: {
        cookieName: process.env.AUTH_COOKIE_NAME || "blog_token",
        csrfCookieName: process.env.AUTH_CSRF_COOKIE_NAME || "blog_csrf",
        sameSite: process.env.AUTH_COOKIE_SAMESITE || "Lax",
        secure: toBoolean(process.env.AUTH_COOKIE_SECURE, false),
    },
    jwt: {
        secret: process.env.JWT_SECRET || "blog-secret-key",
        expireDays: toNumber(process.env.JWT_EXPIRE_DAYS, 3),
    },
};
