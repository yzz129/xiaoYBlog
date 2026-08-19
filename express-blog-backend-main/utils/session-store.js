const { createClient } = require("redis");
const RedisStore = require("connect-redis").default;

const config = require("../config");

let lastErrorAt = 0;

function createSessionStore() {
    if (String(config.session.store).toLowerCase() !== "redis") {
        return undefined;
    }

    const client = createClient({
        socket: {
            host: config.redis.host,
            port: config.redis.port,
            connectTimeout: config.redis.connectTimeoutMs,
            reconnectStrategy(retries) {
                return Math.min(100 * 2 ** Math.min(retries, 5), 3000);
            },
        },
        password: config.redis.password || undefined,
        database: config.redis.db,
    });

    client.on("error", (error) => {
        const now = Date.now();
        if (now - lastErrorAt > 30000) {
            console.error("[Session Redis] connection error:", error.message);
            lastErrorAt = now;
        }
    });
    client.connect().catch((error) => {
        console.error("[Session Redis] initial connection failed:", error.message);
    });

    return new RedisStore({
        client,
        prefix: config.session.prefix,
        ttl: Math.max(60, Math.floor(config.session.maxAgeMs / 1000)),
        disableTouch: false,
    });
}

module.exports = { createSessionStore };
