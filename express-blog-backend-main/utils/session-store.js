const RedisStore = require("connect-redis").default;

const config = require("../config");
const { createConfiguredClient } = require("./redis");

function createSessionStore() {
    if (String(config.session.store).toLowerCase() !== "redis") {
        return undefined;
    }

    const client = createConfiguredClient();
    client.connect().catch((error) => {
        console.error("[Session Redis] initial connection failed:", error.message);
    });

    const store = new RedisStore({
        client,
        prefix: config.session.prefix,
        ttl: Math.max(60, Math.floor(config.session.maxAgeMs / 1000)),
        disableTouch: false,
    });
    // Exposed for graceful shutdown in tests and maintenance scripts.
    store.redisClient = client;
    return store;
}

module.exports = { createSessionStore };
