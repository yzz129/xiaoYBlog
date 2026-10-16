const { createClient } = require("redis");

const config = require("../../config");

class OptionalRedisClient {
    constructor(options = {}) {
        this.options = options;
        this.client = null;
        this.connecting = null;
        this.lastFailureAt = 0;
        this.retryAfterMs = Number(options.retryAfterMs || config.redis?.retryAfterMs || 30000);
    }

    connectionOptions() {
        const redis = config.redis || {};
        return {
            socket: {
                host: this.options.host || redis.host || "127.0.0.1",
                port: Number(this.options.port || redis.port || 6379),
                connectTimeout: Number(this.options.connectTimeoutMs || redis.connectTimeoutMs || 2000),
                reconnectStrategy: false,
            },
            ...(this.options.password || redis.password ? { password: this.options.password || redis.password } : {}),
            database: Number(this.options.db ?? redis.db ?? 0),
        };
    }

    canRetry() {
        return !this.lastFailureAt || Date.now() - this.lastFailureAt >= this.retryAfterMs;
    }

    async close() {
        const client = this.client;
        this.client = null;
        this.connecting = null;
        if (!client?.isOpen) return;
        try {
            await client.quit();
        } catch {
            client.destroy?.();
        }
    }

    async getClient() {
        if (!this.canRetry()) return null;
        if (this.client?.isOpen) return this.client;
        if (this.connecting) return this.connecting;

        const client = createClient(this.connectionOptions());
        client.on("error", () => {});
        this.client = client;
        this.connecting = client.connect()
            .then(() => {
                this.lastFailureAt = 0;
                this.connecting = null;
                return client;
            })
            .catch(async () => {
                this.lastFailureAt = Date.now();
                this.connecting = null;
                await this.close();
                return null;
            });
        return this.connecting;
    }

    async run(operation, fallback = null) {
        const client = await this.getClient();
        if (!client) return fallback;
        try {
            return await operation(client);
        } catch {
            this.lastFailureAt = Date.now();
            await this.close();
            return fallback;
        }
    }
}

const defaultOptionalRedisClient = new OptionalRedisClient();

module.exports = { OptionalRedisClient, defaultOptionalRedisClient };
