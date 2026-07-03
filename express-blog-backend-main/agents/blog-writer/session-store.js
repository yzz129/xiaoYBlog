const { createClient } = require("redis");
const config = require("../../config");

const SESSION_KEY_PREFIX = "blog:ai-writer:session:";
const DEFAULT_TTL_SECONDS = 60 * 60 * 6;
const DEFAULT_CONNECT_TIMEOUT_MS = 2000;
const DEFAULT_RETRY_AFTER_MS = 30000;

class MemorySessionStore {
    constructor() {
        this.sessions = new Map();
    }

    async set(sessionId, snapshot) {
        this.sessions.set(sessionId, JSON.stringify(snapshot));
    }

    async get(sessionId) {
        const raw = this.sessions.get(sessionId);
        return raw ? JSON.parse(raw) : null;
    }

    async delete(sessionId) {
        this.sessions.delete(sessionId);
    }

    async has(sessionId) {
        return this.sessions.has(sessionId);
    }
}

/**
 * Persist workflow sessions in Redis when available.
 * If Redis is unavailable, fall back to in-memory storage so the UI does not hang.
 */
class RedisSessionStore {
    constructor() {
        this.client = null;
        this.connecting = null;
        this.memoryStore = new MemorySessionStore();
        this.ttlSeconds = config.aiWriter?.sessionTtlSeconds || DEFAULT_TTL_SECONDS;
        this.connectTimeoutMs = config.redis?.connectTimeoutMs || DEFAULT_CONNECT_TIMEOUT_MS;
        this.retryAfterMs = config.redis?.retryAfterMs || DEFAULT_RETRY_AFTER_MS;
        this.redisAvailable = true;
        this.lastRedisFailureAt = 0;
    }

    _getRedisOptions() {
        const redisConfig = config.redis || {};
        const socket = {
            connectTimeout: this.connectTimeoutMs,
            reconnectStrategy: false,
        };

        if (redisConfig.host) {
            socket.host = redisConfig.host;
        }
        if (redisConfig.port) {
            socket.port = redisConfig.port;
        }

        const options = {
            socket,
        };

        if (redisConfig.password) {
            options.password = redisConfig.password;
        }
        if (typeof redisConfig.db === "number") {
            options.database = redisConfig.db;
        }

        return options;
    }

    _buildKey(sessionId) {
        return `${SESSION_KEY_PREFIX}${sessionId}`;
    }

    _shouldRetryRedis() {
        if (this.redisAvailable) {
            return true;
        }

        return Date.now() - this.lastRedisFailureAt >= this.retryAfterMs;
    }

    _markRedisAvailable() {
        this.redisAvailable = true;
        this.lastRedisFailureAt = 0;
    }

    _markRedisUnavailable(error) {
        this.redisAvailable = false;
        this.lastRedisFailureAt = Date.now();
        console.error("[AI Writer Redis] unavailable, using memory fallback:", error.message || error);
    }

    async _disconnectClient() {
        if (!this.client) {
            return;
        }

        const currentClient = this.client;
        this.client = null;
        this.connecting = null;

        if (currentClient.isOpen) {
            try {
                await currentClient.quit();
            } catch (error) {
                currentClient.destroy();
            }
        }
    }

    async _getClient() {
        if (!this._shouldRetryRedis()) {
            return null;
        }

        if (this.client?.isOpen) {
            return this.client;
        }

        if (this.connecting) {
            return this.connecting;
        }

        this.client = createClient(this._getRedisOptions());
        this.client.on("error", (error) => {
            this._markRedisUnavailable(error);
        });

        this.connecting = this.client
            .connect()
            .then(() => {
                this.connecting = null;
                this._markRedisAvailable();
                return this.client;
            })
            .catch(async (error) => {
                this._markRedisUnavailable(error);
                await this._disconnectClient();
                return null;
            });

        return this.connecting;
    }

    async _withStore(operation, fallbackOperation) {
        try {
            const client = await this._getClient();
            if (!client) {
                return await fallbackOperation(this.memoryStore);
            }

            return await operation(client);
        } catch (error) {
            this._markRedisUnavailable(error);
            await this._disconnectClient();
            return await fallbackOperation(this.memoryStore);
        }
    }

    async set(sessionId, snapshot) {
        await this.memoryStore.set(sessionId, snapshot);

        await this._withStore(
            async (client) => {
                await client.set(this._buildKey(sessionId), JSON.stringify(snapshot), {
                    EX: this.ttlSeconds,
                });
            },
            async () => {}
        );
    }

    async get(sessionId) {
        return this._withStore(
            async (client) => {
                const raw = await client.get(this._buildKey(sessionId));
                if (!raw) {
                    return null;
                }

                const snapshot = JSON.parse(raw);
                await this.memoryStore.set(sessionId, snapshot);
                return snapshot;
            },
            async (store) => store.get(sessionId)
        );
    }

    async delete(sessionId) {
        await this.memoryStore.delete(sessionId);

        await this._withStore(
            async (client) => {
                await client.del(this._buildKey(sessionId));
            },
            async () => {}
        );
    }

    async has(sessionId) {
        return this._withStore(
            async (client) => (await client.exists(this._buildKey(sessionId))) > 0,
            async (store) => store.has(sessionId)
        );
    }
}

module.exports = new RedisSessionStore();
