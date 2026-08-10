const OpenAI = require("openai");

const config = require("../../config");
const DeepSeekChatClient = require("../blog-writer/llm-client");
const { extractJson } = require("../blog-writer/helpers");

class PetAgentModelClient {
    constructor() {
        this.openAiKey = config.chatgpt?.key || "";
        this.deepSeekKey = config.aiWriter?.deepseekApiKey || "";
        this.openAiModel = process.env.OPENAI_AGENT_MODEL || "gpt-5-mini";
    }

    get isConfigured() {
        return Boolean(this.openAiKey || this.deepSeekKey);
    }

    async complete(messages, options = {}) {
        if (this.openAiKey) {
            const client = new OpenAI({ apiKey: this.openAiKey });
            const response = await client.responses.create({
                model: this.openAiModel,
                input: messages.map((message) => ({ role: message.role, content: message.content })),
                max_output_tokens: options.maxTokens || 2200,
            });
            return response.output_text || "";
        }

        if (this.deepSeekKey) {
            const client = new DeepSeekChatClient({
                deepseekApiKey: this.deepSeekKey,
                deepseekBaseUrl: config.aiWriter.deepseekBaseUrl,
                model: config.aiWriter.model,
                requestTimeoutMs: config.aiWriter.requestTimeoutMs,
            });
            return client.chat({
                messages,
                temperature: options.temperature ?? 0.25,
                maxTokens: options.maxTokens || 2200,
            });
        }

        throw new Error("未配置 OPENAI_API_KEY 或 DEEPSEEK_API_KEY");
    }

    async json(messages, options = {}) {
        return extractJson(await this.complete(messages, options));
    }
}

module.exports = PetAgentModelClient;
