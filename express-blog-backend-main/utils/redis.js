const { createClient } = require("redis");

const config = require("../config");

let commandClient = null;
let connectPromise = null;
let lastErrorAt = 0;

function createConfiguredClient() {
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
            console.error("[Redis] connection error:", error.message);
            lastErrorAt = now;
        }
    });

    return client;
}

async function getRedisClient() {
    if (!commandClient) {
        commandClient = createConfiguredClient();
    }
    if (!commandClient.isOpen) {
        connectPromise ||= commandClient.connect().finally(() => {
            connectPromise = null;
        });
        await connectPromise;
    }
    return commandClient;
}

async function createRedisDuplicate() {
    const client = await getRedisClient();
    const duplicate = client.duplicate();
    duplicate.on("error", (error) => console.error("[Redis duplicate] error:", error.message));
    await duplicate.connect();
    return duplicate;
}

module.exports = { createConfiguredClient, createRedisDuplicate, getRedisClient };
