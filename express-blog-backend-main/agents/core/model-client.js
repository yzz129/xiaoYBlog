const OpenAI = require("openai");
const { jsonrepair } = require("jsonrepair");

const config = require("../../config");
const { defaultProviderCircuitBreaker } = require("./provider-health");
const { withAgentSpan } = require("./telemetry");

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
        };
        this.providers = (options.providerOrder || agent.providerOrder || ["agnes", "openrouter", "openai"])
            .map((name) => providerMap[String(name).toLowerCase()]).filter(Boolean)
            .filter((provider) => provider.name !== "openrouter" || isFreeOpenRouterModel(provider.model));
        this.requestTimeoutMs = options.requestTimeoutMs || agent.requestTimeoutMs || 120000;
        this.circuitBreaker = options.circuitBreaker || defaultProviderCircuitBreaker;
        this.lastProvider = null;
        this.lastCall = null;
    }

    get isConfigured() { return this.providers.length > 0; }
    get hasVisionProvider() { return this.providers.some((provider) => provider.vision); }

    async selectProviders(options = {}) {
        const providers = options.visionRequired ? this.providers.filter((provider) => provider.vision) : this.providers;
        if (!providers.length) throw new Error(options.visionRequired ? "未配置可处理图片的多模态模型" : "未配置可用的 Agent 模型提供方");
        const available = await this.circuitBreaker.select(providers);
        if (!available.length) {
            const error = new Error(`模型提供方熔断中，请在 ${this.circuitBreaker.nextRetryAfterMs(providers)}ms 后重试`);
            error.code = "MODEL_CIRCUIT_OPEN";
            throw error;
        }
        return available;
    }

    createClient(provider) {
        return new OpenAI({ apiKey: provider.apiKey, baseURL: provider.baseURL, defaultHeaders: provider.headers, timeout: this.requestTimeoutMs });
    }

    async complete(messages, options = {}) {
        const startedAt = Date.now();
        const errors = [];
        const attempts = [];
        for (const provider of await this.selectProviders(options)) {
            const attemptStartedAt = Date.now();
            try {
                const response = await withAgentSpan("agent.model.complete", {
                    "agent.model.provider": provider.name,
                    "gen_ai.request.model": provider.model,
                    "agent.model.json": Boolean(options.json),
                }, () => this.createClient(provider).chat.completions.create({
                    model: provider.model, messages: normalizeMessages(messages), temperature: options.temperature ?? 0.25,
                    max_tokens: options.maxTokens || 2200, ...(options.json ? { response_format: { type: "json_object" } } : {}),
                }));
                const text = responseText(response).trim();
                if (!text) throw new Error("模型返回了空内容");
                await this.circuitBreaker.recordSuccess(provider.name);
                this.lastProvider = { name: provider.name, model: response.model || provider.model };
                attempts.push({ provider: provider.name, status: "completed", durationMs: Date.now() - attemptStartedAt });
                this.lastCall = {
                    status: "completed",
                    provider: this.lastProvider,
                    durationMs: Date.now() - startedAt,
                    attempts,
                    usage: response.usage ? {
                        promptTokens: Number(response.usage.prompt_tokens || 0),
                        completionTokens: Number(response.usage.completion_tokens || 0),
                        totalTokens: Number(response.usage.total_tokens || 0),
                    } : null,
                };
                return text;
            } catch (error) {
                await this.circuitBreaker.recordFailure(provider.name, error);
                attempts.push({ provider: provider.name, status: "failed", durationMs: Date.now() - attemptStartedAt, code: String(error?.status || error?.code || "MODEL_ERROR") });
                errors.push(`${provider.name}: ${error?.status ? `HTTP ${error.status}` : error?.code || error.message}`);
            }
        }
        this.lastCall = { status: "failed", durationMs: Date.now() - startedAt, attempts };
        throw new Error(`所有模型提供方均不可用（${errors.join("；")}）`);
    }

    async chat({ messages, temperature = 0.4, maxTokens = 4096 }) {
        return this.complete(messages, { temperature, maxTokens });
    }

    async streamChat({ messages, temperature = 0.5, maxTokens = 4096, onToken }) {
        const startedAt = Date.now();
        const errors = [];
        const attempts = [];
        for (const provider of await this.selectProviders()) {
            const attemptStartedAt = Date.now();
            try {
                const stream = await withAgentSpan("agent.model.stream", {
                    "agent.model.provider": provider.name,
                    "gen_ai.request.model": provider.model,
                }, () => this.createClient(provider).chat.completions.create({
                    model: provider.model, messages: normalizeMessages(messages), temperature, max_tokens: maxTokens, stream: true,
                }));
                let fullText = "";
                for await (const chunk of stream) {
                    const token = chunk?.choices?.[0]?.delta?.content || "";
                    if (!token) continue;
                    fullText += token;
                    if (onToken) await onToken(token);
                }
                await this.circuitBreaker.recordSuccess(provider.name);
                this.lastProvider = { name: provider.name, model: provider.model };
                attempts.push({ provider: provider.name, status: "completed", durationMs: Date.now() - attemptStartedAt });
                this.lastCall = {
                    status: "completed",
                    provider: this.lastProvider,
                    durationMs: Date.now() - startedAt,
                    attempts,
                    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, streamedCharacters: fullText.length },
                };
                return fullText;
            } catch (error) {
                await this.circuitBreaker.recordFailure(provider.name, error);
                attempts.push({ provider: provider.name, status: "failed", durationMs: Date.now() - attemptStartedAt, code: String(error?.status || error?.code || "MODEL_ERROR") });
                errors.push(`${provider.name}: ${error?.status ? `HTTP ${error.status}` : error?.code || error.message}`);
            }
        }
        this.lastCall = { status: "failed", durationMs: Date.now() - startedAt, attempts };
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
