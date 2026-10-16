const { defaultOptionalRedisClient } = require("./redis-client");
const config = require("../../config");

class ProviderCircuitBreaker {
    constructor(options = {}) {
        this.failureThreshold = Math.max(1, Number(options.failureThreshold || 3));
        this.openMs = Math.max(1000, Number(options.openMs || 60000));
        this.clock = options.clock || (() => Date.now());
        this.states = new Map();
    }

    state(name) {
        if (!this.states.has(name)) this.states.set(name, { consecutiveFailures: 0, openedAt: 0, openUntil: 0, lastErrorCode: "" });
        return this.states.get(name);
    }

    isAvailable(name) {
        return this.state(name).openUntil <= this.clock();
    }

    recordSuccess(name) {
        this.states.set(name, { consecutiveFailures: 0, openedAt: 0, openUntil: 0, lastErrorCode: "" });
    }

    recordFailure(name, error) {
        const current = this.state(name);
        current.consecutiveFailures += 1;
        current.lastErrorCode = String(error?.status || error?.code || "MODEL_ERROR");
        if (current.consecutiveFailures >= this.failureThreshold) {
            current.openedAt = this.clock();
            current.openUntil = current.openedAt + this.openMs;
        }
    }

    select(providers) {
        return providers.filter((provider) => this.isAvailable(provider.name));
    }

    nextRetryAfterMs(providers) {
        const now = this.clock();
        const waits = providers.map((provider) => Math.max(0, this.state(provider.name).openUntil - now)).filter(Boolean);
        return waits.length ? Math.min(...waits) : 0;
    }

    snapshot() {
        const now = this.clock();
        return Object.fromEntries([...this.states.entries()].map(([name, state]) => [name, {
            status: state.openUntil > now ? "open" : state.consecutiveFailures ? "recovering" : "closed",
            consecutiveFailures: state.consecutiveFailures,
            retryAfterMs: Math.max(0, state.openUntil - now),
            lastErrorCode: state.lastErrorCode,
        }]));
    }
}

class RedisCircuitStateStore {
    constructor(options = {}) {
        this.redis = options.redis || defaultOptionalRedisClient;
        this.prefix = options.prefix || "blog:agent:circuit:";
    }

    key(name) {
        return `${this.prefix}${String(name).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    }

    async load(names) {
        return this.redis.run(async (client) => {
            const rows = await Promise.all(names.map(async (name) => [name, await client.hGetAll(this.key(name))]));
            return Object.fromEntries(rows.map(([name, row]) => [name, {
                consecutiveFailures: Number(row.consecutiveFailures || 0),
                openedAt: Number(row.openedAt || 0),
                openUntil: Number(row.openUntil || 0),
                lastErrorCode: row.lastErrorCode || "",
            }]));
        }, null);
    }

    async clear(name) {
        return this.redis.run((client) => client.del(this.key(name)), null);
    }

    async recordFailure(name, errorCode, options) {
        const script = `
            local failures = redis.call('HINCRBY', KEYS[1], 'consecutiveFailures', 1)
            redis.call('HSET', KEYS[1], 'lastErrorCode', ARGV[1])
            local openedAt = tonumber(redis.call('HGET', KEYS[1], 'openedAt') or '0')
            local openUntil = tonumber(redis.call('HGET', KEYS[1], 'openUntil') or '0')
            if failures >= tonumber(ARGV[2]) then
                openedAt = tonumber(ARGV[3])
                openUntil = openedAt + tonumber(ARGV[4])
                redis.call('HSET', KEYS[1], 'openedAt', openedAt, 'openUntil', openUntil)
            end
            redis.call('PEXPIRE', KEYS[1], math.max(tonumber(ARGV[4]) * 4, 3600000))
            return { failures, openedAt, openUntil }
        `;
        return this.redis.run(async (client) => {
            const result = await client.eval(script, {
                keys: [this.key(name)],
                arguments: [String(errorCode), String(options.failureThreshold), String(options.now), String(options.openMs)],
            });
            return {
                consecutiveFailures: Number(result?.[0] || 0),
                openedAt: Number(result?.[1] || 0),
                openUntil: Number(result?.[2] || 0),
                lastErrorCode: errorCode,
            };
        }, null);
    }
}

class DistributedProviderCircuitBreaker extends ProviderCircuitBreaker {
    constructor(options = {}) {
        super(options);
        this.store = options.store || new RedisCircuitStateStore(options);
    }

    async refresh(names) {
        const shared = await this.store.load(names);
        if (!shared) return;
        for (const name of names) this.states.set(name, shared[name] || this.state(name));
    }

    async select(providers) {
        await this.refresh(providers.map((provider) => provider.name));
        return super.select(providers);
    }

    async recordSuccess(name) {
        super.recordSuccess(name);
        await this.store.clear(name);
    }

    async recordFailure(name, error) {
        super.recordFailure(name, error);
        const errorCode = String(error?.status || error?.code || "MODEL_ERROR");
        const shared = await this.store.recordFailure(name, errorCode, {
            failureThreshold: this.failureThreshold,
            openMs: this.openMs,
            now: this.clock(),
        });
        if (shared) this.states.set(name, shared);
    }
}

const BreakerClass = config.petAgent?.distributedCircuit ? DistributedProviderCircuitBreaker : ProviderCircuitBreaker;
const defaultProviderCircuitBreaker = new BreakerClass({
    failureThreshold: Number(config.petAgent?.providerFailureThreshold || 3),
    openMs: Number(config.petAgent?.providerCircuitOpenMs || 60000),
});

module.exports = { DistributedProviderCircuitBreaker, ProviderCircuitBreaker, RedisCircuitStateStore, defaultProviderCircuitBreaker };
