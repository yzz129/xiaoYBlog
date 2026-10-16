const { Queue, Worker } = require("bullmq");
const net = require("net");

const config = require("../../config");

function connectionOptions(overrides = {}) {
    const redis = config.redis || {};
    return {
        host: overrides.host || redis.host || "127.0.0.1",
        port: Number(overrides.port || redis.port || 6379),
        ...(overrides.password || redis.password ? { password: overrides.password || redis.password } : {}),
        db: Number(overrides.db ?? redis.db ?? 0),
        connectTimeout: Number(overrides.connectTimeoutMs || redis.connectTimeoutMs || 2000),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        retryStrategy: () => null,
    };
}

function withTimeout(promise, timeoutMs, message) {
    let timer;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(message)), timeoutMs);
            timer.unref?.();
        }),
    ]).finally(() => clearTimeout(timer));
}

function canConnect(connection, timeoutMs) {
    return new Promise((resolve) => {
        const socket = net.createConnection({ host: connection.host, port: connection.port });
        let settled = false;
        const finish = (value) => {
            if (settled) return;
            settled = true;
            socket.destroy();
            resolve(value);
        };
        socket.once("connect", () => finish(true));
        socket.once("error", () => finish(false));
        socket.setTimeout(timeoutMs, () => finish(false));
    });
}

class DurableTaskQueue {
    constructor(options = {}) {
        this.driver = options.driver || config.petAgent?.queueDriver || "poll";
        this.name = options.name || config.petAgent?.queueName || "blog-pet-agent";
        this.prefix = options.prefix || config.petAgent?.queuePrefix || "blog-agent";
        this.concurrency = Math.max(1, Number(options.concurrency || config.petAgent?.maxConcurrency || 3));
        this.connectTimeoutMs = Math.max(500, Number(options.connectTimeoutMs || config.redis?.connectTimeoutMs || 2000));
        this.connection = options.connection || connectionOptions(options.redis);
        this.QueueClass = options.QueueClass || Queue;
        this.WorkerClass = options.WorkerClass || Worker;
        this.preflight = options.preflight ?? !(options.QueueClass || options.WorkerClass);
        this.queue = null;
        this.worker = null;
        this.state = "inactive";
        this.lastError = "";
    }

    get ready() {
        return this.state === "ready" && Boolean(this.queue && this.worker);
    }

    status() {
        return { driver: this.driver, state: this.state, queue: this.name, lastError: this.lastError };
    }

    async start(handler) {
        if (this.driver !== "redis") {
            this.state = "polling";
            return false;
        }

        this.state = "connecting";
        try {
            if (this.preflight && !(await canConnect(this.connection, this.connectTimeoutMs))) {
                throw new Error("Redis 任务队列连接失败");
            }
            this.queue = new this.QueueClass(this.name, { connection: this.connection, prefix: this.prefix });
            this.worker = new this.WorkerClass(this.name, async (job) => handler(job.data.taskId, job), {
                connection: this.connection,
                prefix: this.prefix,
                concurrency: this.concurrency,
            });
            this.queue.on?.("error", (error) => {
                this.lastError = String(error?.message || error);
            });
            this.worker.on?.("error", (error) => {
                this.lastError = String(error?.message || error);
            });
            await withTimeout(Promise.all([this.queue.waitUntilReady(), this.worker.waitUntilReady()]), this.connectTimeoutMs + 500, "Redis 任务队列连接超时");
            this.state = "ready";
            this.lastError = "";
            return true;
        } catch (error) {
            this.lastError = String(error?.message || error);
            this.state = "fallback";
            await this.close({ preserveState: true });
            return false;
        }
    }

    async enqueue(taskId, options = {}) {
        if (!this.ready) return false;
        const delay = Math.max(0, Number(options.delay || 0));
        try {
            await this.queue.add("run-task", { taskId }, {
                jobId: `task-${String(taskId).replace(/[^a-zA-Z0-9_-]/g, "-")}`,
                delay,
                attempts: Math.max(1, Number(config.petAgent?.queueAttempts || 3)),
                backoff: { type: "exponential", delay: Math.max(1000, Number(config.petAgent?.queueBackoffMs || 5000)) },
                removeOnComplete: true,
                removeOnFail: { age: 7 * 24 * 3600, count: 2000 },
            });
            return true;
        } catch (error) {
            this.lastError = String(error?.message || error);
            return false;
        }
    }

    async close(options = {}) {
        const worker = this.worker;
        const queue = this.queue;
        this.worker = null;
        this.queue = null;
        await Promise.allSettled([worker?.close?.(), queue?.close?.()]);
        if (!options.preserveState) this.state = "closed";
    }
}

module.exports = { DurableTaskQueue, canConnect, connectionOptions, withTimeout };
