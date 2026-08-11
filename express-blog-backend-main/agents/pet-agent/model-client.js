const OpenAI = require("openai");
const { jsonrepair } = require("jsonrepair");

const config = require("../../config");

function isFreeOpenRouterModel(model) {
    return model === "openrouter/free" || String(model || "").endsWith(":free");
}

function normalizeMessages(messages) {
    return (messages || []).map((message) => ({
        role: message.role,
        content: message.content,
    }));
}

function responseText(response) {
    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content.map((part) => part?.text || part?.content || "").join("");
    }
    return "";
}

function parseModelJson(text) {
    const raw = String(text || "").trim();
    if (!raw) throw new Error("LLM 返回内容为空");
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace === -1 || lastBrace <= firstBrace) throw new Error("未找到有效的 JSON 内容");
    const candidate = raw.slice(firstBrace, lastBrace + 1);
    try {
        return JSON.parse(candidate);
    } catch (_error) {
        return JSON.parse(jsonrepair(candidate));
    }
}

class PetAgentModelClient {
    constructor() {
        const agent = config.petAgent || {};
        const providerMap = {
            openrouter: agent.openRouterApiKey ? {
                name: "openrouter",
                apiKey: agent.openRouterApiKey,
                baseURL: agent.openRouterBaseUrl,
                model: agent.openRouterModel,
                vision: true,
                headers: {
                    "HTTP-Referer": config.siteURL || "http://localhost",
                    "X-Title": encodeURIComponent(config.blogName || "XiaoY Blog"),
                },
            } : null,
            agnes: agent.agnesApiKey ? {
                name: "agnes",
                apiKey: agent.agnesApiKey,
                baseURL: agent.agnesBaseUrl,
                model: agent.agnesModel,
                vision: true,
            } : null,
            openai: config.chatgpt?.key ? {
                name: "openai",
                apiKey: config.chatgpt.key,
                baseURL: undefined,
                model: process.env.OPENAI_AGENT_MODEL || "gpt-5-mini",
                vision: true,
            } : null,
            deepseek: config.aiWriter?.deepseekApiKey ? {
                name: "deepseek",
                apiKey: config.aiWriter.deepseekApiKey,
                baseURL: config.aiWriter.deepseekBaseUrl,
                model: config.aiWriter.model,
                vision: false,
            } : null,
        };

        this.providers = (agent.providerOrder || [])
            .map((name) => providerMap[String(name).toLowerCase()])
            .filter(Boolean)
            .filter((provider) => provider.name !== "openrouter" || isFreeOpenRouterModel(provider.model));
        this.requestTimeoutMs = agent.requestTimeoutMs || 120000;
        this.lastProvider = null;
    }

    get isConfigured() {
        return this.providers.length > 0;
    }

    get hasVisionProvider() {
        return this.providers.some((provider) => provider.vision);
    }

    async complete(messages, options = {}) {
        const providers = options.visionRequired
            ? this.providers.filter((provider) => provider.vision)
            : this.providers;
        if (!providers.length) {
            throw new Error(options.visionRequired
                ? "未配置可处理图片的多模态模型"
                : "未配置可用的 Agent 模型提供方");
        }

        const errors = [];
        for (const provider of providers) {
            try {
                const client = new OpenAI({
                    apiKey: provider.apiKey,
                    baseURL: provider.baseURL,
                    defaultHeaders: provider.headers,
                    timeout: this.requestTimeoutMs,
                });
                const response = await client.chat.completions.create({
                    model: provider.model,
                    messages: normalizeMessages(messages),
                    temperature: options.temperature ?? 0.25,
                    max_tokens: options.maxTokens || 2200,
                    ...(options.json ? { response_format: { type: "json_object" } } : {}),
                });
                const text = responseText(response).trim();
                if (!text) throw new Error("模型返回了空内容");
                this.lastProvider = { name: provider.name, model: response.model || provider.model };
                return text;
            } catch (error) {
                const status = error?.status ? `HTTP ${error.status}` : error?.code || "请求失败";
                errors.push(`${provider.name}: ${status}`);
            }
        }

        throw new Error(`所有模型提供方均不可用（${errors.join("；")}）`);
    }

    async json(messages, options = {}) {
        const raw = await this.complete(messages, { ...options, json: true });
        try {
            return parseModelJson(raw);
        } catch (_error) {
            const repaired = await this.complete([
                { role: "system", content: "把用户给出的内容转换为语义等价的严格 JSON。只输出 JSON 对象，不要 Markdown，不要解释；所有属性名和字符串必须使用双引号。" },
                { role: "user", content: raw.slice(0, 16000) },
            ], { ...options, json: true, temperature: 0, maxTokens: options.maxTokens || 2200 });
            return parseModelJson(repaired);
        }
    }
}

module.exports = PetAgentModelClient;
module.exports.isFreeOpenRouterModel = isFreeOpenRouterModel;
module.exports.parseModelJson = parseModelJson;
