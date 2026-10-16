const { BaseCheckpointSaver, WRITES_IDX_MAP } = require("@langchain/langgraph-checkpoint");

/** One task per saver; checkpoint writes share the task's fenced MySQL lease. */
class MySqlTaskSaver extends BaseCheckpointSaver {
    constructor({ db, taskId, workerId, generation }) {
        super();
        Object.assign(this, { db, taskId, workerId, generation });
    }

    async setup() {
        // Explicitly called by the graph worker, never on module import.
        await this.db.query({ sql: `CREATE TABLE IF NOT EXISTS agent_graph_checkpoint (
            task_id VARCHAR(64) NOT NULL, namespace VARCHAR(128) NOT NULL,
            checkpoint_id VARCHAR(64) NOT NULL, parent_id VARCHAR(64) NULL,
            checkpoint_type VARCHAR(32) NOT NULL, checkpoint LONGBLOB NOT NULL,
            metadata_type VARCHAR(32) NOT NULL, metadata LONGBLOB NOT NULL,
            PRIMARY KEY (task_id, namespace, checkpoint_id),
            CONSTRAINT fk_graph_checkpoint_task FOREIGN KEY (task_id) REFERENCES agent_task(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` });
        await this.db.query({ sql: `CREATE TABLE IF NOT EXISTS agent_graph_write (
            task_id VARCHAR(64) NOT NULL, namespace VARCHAR(128) NOT NULL, checkpoint_id VARCHAR(64) NOT NULL,
            node_task_id VARCHAR(128) NOT NULL, write_idx INT NOT NULL, channel VARCHAR(128) NOT NULL,
            value_type VARCHAR(32) NOT NULL, value LONGBLOB NOT NULL,
            PRIMARY KEY (task_id, namespace, checkpoint_id, node_task_id, write_idx),
            CONSTRAINT fk_graph_write_task FOREIGN KEY (task_id) REFERENCES agent_task(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4` });
    }

    keys(config) {
        const c = config.configurable || {};
        if (c.thread_id !== this.taskId || (c.checkpoint_ns || "").length > 128) throw new Error("Invalid graph checkpoint scope");
        return [this.taskId, c.checkpoint_ns || ""];
    }

    async guarded(operation) {
        const connection = await this.db.pool.getConnection();
        try {
            await connection.beginTransaction();
            const [rows] = await connection.query(`SELECT id FROM agent_task WHERE id = ? AND locked_by = ?
                AND attempt_count = ? AND status = 'running' AND lock_expires_at > NOW() FOR UPDATE`,
            [this.taskId, this.workerId, this.generation]);
            if (!rows.length) {
                const error = new Error("Graph checkpoint lease lost");
                error.code = "GRAPH_EXECUTION_STOPPED";
                throw error;
            }
            const result = await operation(connection);
            await connection.commit();
            return result;
        } catch (error) {
            await connection.rollback().catch(() => undefined);
            throw error;
        } finally {
            connection.release();
        }
    }

    async getTuple(config) {
        const keys = this.keys(config);
        const id = config.configurable?.checkpoint_id;
        const { results } = await this.db.query({
            sql: `SELECT * FROM agent_graph_checkpoint WHERE task_id = ? AND namespace = ? ${id ? "AND checkpoint_id = ?" : ""} ORDER BY checkpoint_id DESC LIMIT 1`,
            values: [...keys, ...(id ? [id] : [])],
        });
        const row = results[0];
        if (!row) return undefined;
        const { results: writes } = await this.db.query({
            sql: "SELECT * FROM agent_graph_write WHERE task_id = ? AND namespace = ? AND checkpoint_id = ? ORDER BY node_task_id, write_idx",
            values: [...keys, row.checkpoint_id],
        });
        return {
            config: { configurable: { thread_id: keys[0], checkpoint_ns: keys[1], checkpoint_id: row.checkpoint_id } },
            checkpoint: await this.serde.loadsTyped(row.checkpoint_type, row.checkpoint),
            metadata: await this.serde.loadsTyped(row.metadata_type, row.metadata),
            ...(row.parent_id ? { parentConfig: { configurable: { thread_id: keys[0], checkpoint_ns: keys[1], checkpoint_id: row.parent_id } } } : {}),
            pendingWrites: await Promise.all(writes.map(async (w) => [w.node_task_id, w.channel, await this.serde.loadsTyped(w.value_type, w.value)])),
        };
    }

    async put(config, checkpoint, metadata) {
        const keys = this.keys(config);
        const [type, bytes] = await this.serde.dumpsTyped(checkpoint);
        const [metaType, metaBytes] = await this.serde.dumpsTyped(metadata);
        await this.guarded((c) => c.query(`INSERT INTO agent_graph_checkpoint
            (task_id, namespace, checkpoint_id, parent_id, checkpoint_type, checkpoint, metadata_type, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE checkpoint = VALUES(checkpoint), metadata = VALUES(metadata)`,
        [...keys, checkpoint.id, config.configurable?.checkpoint_id || null, type, Buffer.from(bytes), metaType, Buffer.from(metaBytes)]));
        return { configurable: { thread_id: keys[0], checkpoint_ns: keys[1], checkpoint_id: checkpoint.id } };
    }

    async putWrites(config, writes, taskId) {
        const keys = this.keys(config);
        const serialized = await Promise.all(writes.map(async ([channel, value], index) => {
            const [type, bytes] = await this.serde.dumpsTyped(value);
            return { channel, index: WRITES_IDX_MAP[channel] ?? index, type, bytes: Buffer.from(bytes) };
        }));
        await this.guarded(async (c) => {
            for (const write of serialized) {
                const replace = write.index < 0;
                await c.query(`INSERT ${replace ? "" : "IGNORE"} INTO agent_graph_write
                    (task_id, namespace, checkpoint_id, node_task_id, write_idx, channel, value_type, value)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?) ${replace ? "ON DUPLICATE KEY UPDATE value_type = VALUES(value_type), value = VALUES(value)" : ""}`,
                [...keys, config.configurable.checkpoint_id, taskId, write.index, write.channel, write.type, write.bytes]);
            }
        });
    }

    async *list(config, options = {}) {
        const keys = this.keys(config);
        if (options.filter && Object.keys(options.filter).length) throw new Error("Checkpoint metadata filtering is not supported");
        const before = options.before?.configurable?.checkpoint_id;
        const { results } = await this.db.query({
            sql: `SELECT checkpoint_id FROM agent_graph_checkpoint WHERE task_id = ? AND namespace = ? ${before ? "AND checkpoint_id < ?" : ""} ORDER BY checkpoint_id DESC LIMIT ?`,
            values: [...keys, ...(before ? [before] : []), Math.min(Math.max(Number(options.limit) || 50, 1), 100)],
        });
        for (const row of results) yield await this.getTuple({ configurable: { ...config.configurable, checkpoint_id: row.checkpoint_id } });
    }

    async deleteThread() {
        throw new Error("Delete the owning task through the task lifecycle; checkpoints cascade with it");
    }
}

module.exports = { MySqlTaskSaver };
