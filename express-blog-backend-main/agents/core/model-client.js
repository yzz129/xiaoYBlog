const OpenAI = require("openai");
const { jsonrepair } = require("jsonrepair");

const config = require("../../config");

function isFreeOpenRouterModel(model) {
    return model === "openrouter/free" || String(model || "").endsWith(":free");
}

function normalizeMessages(messages) {
    return (messages || []).map(({ role, content }) => ({ role, content }));
}

function responseText(response) {
    const content = response?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.map((part) => part?.text || part?.content || "").join("");
    return "";
}

function parseModelJson(text) {
    const raw = String(text || "").trim();
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (!raw || firstBrace === -1 || lastBrace <= firstBrace) throw new Error("模型未返回有效 JSON");
    const candidate = raw.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(candidate); } catch (_error) { return JSON.parse(jsonrepair(candidate)); }
}

class AgentModelClient {
    constructor(options = {}) {
        const agent = config.petAgent || {};
        const providerMap = {
            openrouter: agent.openRouterApiKey ? {
                name: "openrouter", apiKey: agent.openRouterApiKey, baseURL: agent.openRouterBaseUrl,
                model: agent.openRouterModel, vision: true,
                headers: { "HTTP-Referer": config.siteURL || "http://localhost", "X-Title": encodeURIComponent(config.blogName || "XiaoY Blog") },
            } : null,
            agnes: agent.agnesApiKey ? { name: "agnes", apiKey: agent.agnesApiKey, baseURL: agent.agnesBaseUrl, model: agent.agnesModel, vision: true } : null,
            openai: config.chatgpt?.key ? { name: "openai", apiKey: config.chatgpt.key, model: process.env.OPENAI_AGENT_MODEL || "gpt-5-mini", vision: true } : null,
            deepseek: config.aiWriter?.deepseekApiKey ? { name: "deepseek", apiKey: config.aiWriter.deepseekApiKey, baseURL: config.aiWriter.deepseekBaseUrl, model: config.aiWriter.model, vision: false } : null,
        };
        this.providers = (options.providerOrder || agent.providerOrder || ["openrouter", "agnes", "deepseek"])
            .map((name) => providerMap[String(name).toLowerCase()]).filter(Boolean)
            .filter((provider) => provider.name !== "openrouter" || isFreeOpenRouterModel(provider.model));
        this.requestTimeoutMs = options.requestTimeoutMs || agent.requestTimeoutMs || 120000;
        this.lastProvider = null;
    }

    get isConfigured() { return this.providers.length > 0; }
    get hasVisionProvider() { return this.providers.some((provider) => provider.vision); }

    selectProviders(options = {}) {
        const providers = options.visionRequired ? this.providers.filter((provider) => provider.vision) : this.providers;
        if (!providers.length) throw new Error(options.visionRequired ? "未配置可处理图片的多模态模型" : "未配置可用的 Agent 模型提供方");
        return providers;
    }

    createClient(provider) {
        return new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL, defaultHeaders: provider.headers, timeout: this.requestTimeoutMs });
    }

    async complete(messages, options = {}) {
        const errors = [];
        for (const provider of this.selectProviders(options)) {
            try {
                const response = await this.createClient(provider).chat.completions.create({
                    model: provider.model, messages: normalizeMessages(messages), temperature: options.temperature ?? 0.25,
                    max_tokens: options.maxTokens || 2200, ...(options.json ? { response_format: { type: "json_object" } } : {}),
                });
                const text = responseText(response).trim();
                if (!text) throw new Error("模型返回了空内容");
                this.lastProvider = { name: provider.name, model: response.model || provider.model };
                return text;
            } catch (error) {
                errors.push(`${provider.name}: ${error?.status ? `HTTP ${error.status}` : error?.code || error.message}`);
            }
        }
        throw new Error(`所有模型提供方均不可用（${errors.join("；")}）`);
    }

    async chat({ messages, temperature = 0.4, maxTokens = 4096 }) {
        return this.complete(messages, { temperature, maxTokens });
    }

    async streamChat({ messages, temperature = 0.5, maxTokens = 4096, onToken }) {
        const errors = [];
        for (const provider of this.selectProviders()) {
            try {
                const stream = await this.createClient(provider).chat.completions.create({
                    model: provider.model, messages: normalizeMessages(messages), temperature, max_tokens: maxTokens, stream: true,
                });
                let fullText = "";
                for await (const chunk of stream) {
                    const token = chunk?.choices?.[0]?.delta?.content || "";
                    if (!token) continue;
                    fullText += token;
                    if (onToken) await onToken(token);
                }
                this.lastProvider = { name: provider.name, model: provider.model };
                return fullText;
            } catch (error) {
                errors.push(`${provider.name}: ${error?.status ? `HTTP ${error.status}` : error?.code || error.message}`);
            }
        }
        throw new Error(`所有模型提供方均不可用（${errors.join("；")}）`);
    }

    async json(messages, options = {}) {
        const raw = await this.complete(messages, { ...options, json: true });
        try { return parseModelJson(raw); } catch (_error) {
            const repaired = await this.complete([
                { role: "system", content: "把内容转换为语义等价的严格 JSON，只输出 JSON 对象。" },
                { role: "user", content: raw.slice(0, 16000) },
            ], { ...options, json: true, temperature: 0 });
            return parseModelJson(repaired);
        }
    }
}

module.exports = AgentModelClient;
module.exports.isFreeOpenRouterModel = isFreeOpenRouterModel;
module.exports.parseModelJson = parseModelJson;
