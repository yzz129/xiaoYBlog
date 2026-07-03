const config = require("../../config");

function getAiWriterConfig() {
    const aiWriterConfig = config.aiWriter || {};

    return {
        deepseekApiKey: process.env.DEEPSEEK_API_KEY || aiWriterConfig.deepseekApiKey,
        tavilyApiKey: process.env.TAVILY_API_KEY || aiWriterConfig.tavilyApiKey,
        deepseekBaseUrl: process.env.DEEPSEEK_BASE_URL || aiWriterConfig.deepseekBaseUrl || "https://api.deepseek.com/v1",
        model: process.env.DEEPSEEK_MODEL || aiWriterConfig.model || "deepseek-chat",
        knowledgeCutoff: aiWriterConfig.knowledgeCutoff || "2024-12",
        requestTimeoutMs: aiWriterConfig.requestTimeoutMs || 45000,
    };
}

module.exports = {
    getAiWriterConfig,
};
