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
        tavilyApiKey: process.env.TAVILY_API_KEY || "",
        baiduSearchApiKey: process.env.BAIDU_SEARCH_API_KEY || process.env.BAIDU_API_KEY || "",
        baiduSearchBaseUrl: process.env.BAIDU_SEARCH_BASE_URL || "https://qianfan.baidubce.com",
        baiduSearchModel: process.env.BAIDU_SEARCH_MODEL || "",
        knowledgeCutoff: process.env.AI_KNOWLEDGE_CUTOFF || "2024-12",
        sessionTtlSeconds: toNumber(process.env.AI_SESSION_TTL_SECONDS, 21600),
        requestTimeoutMs: toNumber(process.env.AI_REQUEST_TIMEOUT_MS, 45000),
    },
    petAgent: {
        providerOrder: toArray(process.env.PET_AGENT_PROVIDER_ORDER, ["agnes", "openrouter", "openai"]),
        openRouterApiKey: process.env.OPENROUTER_API_KEY || "",
        openRouterBaseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
        openRouterModel: process.env.OPENROUTER_AGENT_MODEL || "openrouter/free",
        agnesApiKey: process.env.AGNES_API_KEY || "",
        agnesBaseUrl: process.env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1",
        agnesModel: process.env.AGNES_AGENT_MODEL || "agnes-2.5-flash",
        agnesImageModel: process.env.AGNES_IMAGE_MODEL || "agnes-image-2.1-flash",
        pollinationsApiKey: process.env.POLLINATIONS_API_KEY || "",
        pollinationsBaseUrl: process.env.POLLINATIONS_BASE_URL || "https://gen.pollinations.ai",
        pollinationsImageModel: process.env.POLLINATIONS_IMAGE_MODEL || "",
        requestTimeoutMs: toNumber(process.env.PET_AGENT_REQUEST_TIMEOUT_MS, 120000),
        maxConcurrency: toNumber(process.env.PET_AGENT_MAX_CONCURRENCY, 3),
        maxActiveTasksPerUser: toNumber(process.env.PET_AGENT_MAX_ACTIVE_TASKS_PER_USER, 5),
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
        multipleStatements: toBoolean(process.env.MYSQL_MULTIPLE_STATEMENTS, false),
        waitForConnections: toBoolean(process.env.MYSQL_WAIT_FOR_CONNECTIONS, true),
        connectionLimit: toNumber(process.env.MYSQL_CONNECTION_LIMIT, 8),
        queueLimit: toNumber(process.env.MYSQL_QUEUE_LIMIT, 100),
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
    session: {
        secret: process.env.SESSION_SECRET || "blog-session-development-only",
        cookieName: process.env.SESSION_COOKIE_NAME || "blog_session",
        sameSite: process.env.SESSION_COOKIE_SAMESITE || "Lax",
        secure: toBoolean(process.env.SESSION_COOKIE_SECURE, false),
        maxAgeMs: toNumber(process.env.SESSION_COOKIE_MAX_AGE_MS, 21600000),
        store: process.env.SESSION_STORE || (nodeEnv === "test" ? "memory" : "redis"),
        prefix: process.env.SESSION_REDIS_PREFIX || "blog:session:",
    },
};
