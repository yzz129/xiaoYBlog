const { getFetch } = require("../../utils/fetch");

/**
 * Minimal DeepSeek chat client.
 */
class DeepSeekChatClient {
    constructor(options) {
        this.apiKey = options.deepseekApiKey;
        this.baseUrl = options.deepseekBaseUrl;
        this.model = options.model;
        this.requestTimeoutMs = options.requestTimeoutMs || 45000;
    }

    _createTimeoutSignal() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
        return { controller, timeout };
    }

    _buildPayload({ messages, temperature = 0.4, maxTokens = 4096, stream = false }) {
        return {
            model: this.model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream,
        };
    }

    async chat({ messages, temperature = 0.4, maxTokens = 4096 }) {
        const fetch = await getFetch();
        const { controller, timeout } = this._createTimeoutSignal();
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify(this._buildPayload({ messages, temperature, maxTokens })),
        }).finally(() => clearTimeout(timeout));

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek 请求失败: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        return data?.choices?.[0]?.message?.content || "";
    }

    async streamChat({ messages, temperature = 0.5, maxTokens = 4096, onToken }) {
        const fetch = await getFetch();
        const { controller, timeout } = this._createTimeoutSignal();
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            signal: controller.signal,
            body: JSON.stringify(this._buildPayload({ messages, temperature, maxTokens, stream: true })),
        }).finally(() => clearTimeout(timeout));

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek 流式请求失败: ${response.status} ${errorText}`);
        }

        let buffer = "";
        let fullText = "";
        const decoder = new TextDecoder("utf-8");

        for await (const chunk of response.body) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data:")) {
                    continue;
                }

                const payload = trimmed.slice(5).trim();
                if (!payload || payload === "[DONE]") {
                    continue;
                }

                const data = JSON.parse(payload);
                const token = data?.choices?.[0]?.delta?.content || "";
                if (!token) {
                    continue;
                }

                fullText += token;
                if (onToken) {
                    await onToken(token);
                }
            }
        }

        buffer += decoder.decode();

        return fullText;
    }
}

module.exports = DeepSeekChatClient;
