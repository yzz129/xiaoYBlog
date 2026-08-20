const AgentModelClient = require("./model-client");

/** Shared execution facade for every Agent experience. */
class AgentExecutionKernel {
    constructor(options = {}) {
        this.model = options.modelClient || new AgentModelClient(options);
    }

    get isConfigured() { return this.model.isConfigured; }
    get hasVisionProvider() { return this.model.hasVisionProvider; }
    get lastProvider() { return this.model.lastProvider; }

    complete(messages, options) { return this.model.complete(messages, options); }
    json(messages, options) { return this.model.json(messages, options); }
    chat(options) { return this.model.chat(options); }
    streamChat(options) { return this.model.streamChat(options); }

    async runStage({ name, operation, onEvent }) {
        const startedAt = Date.now();
        await onEvent?.({ type: "stage", name, status: "running", startedAt });
        try {
            const result = await operation(this);
            await onEvent?.({ type: "stage", name, status: "completed", durationMs: Date.now() - startedAt });
            return result;
        } catch (error) {
            await onEvent?.({ type: "stage", name, status: "failed", durationMs: Date.now() - startedAt, error: error.message });
            throw error;
        }
    }
}

module.exports = AgentExecutionKernel;
