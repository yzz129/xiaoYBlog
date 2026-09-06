const config = require("../../config");

function getAiWriterConfig() {
    const aiWriterConfig = config.aiWriter || {};

    return {
        tavilyApiKey: process.env.TAVILY_API_KEY || aiWriterConfig.tavilyApiKey,
        knowledgeCutoff: aiWriterConfig.knowledgeCutoff || "2024-12",
        requestTimeoutMs: aiWriterConfig.requestTimeoutMs || 45000,
    };
}

module.exports = {
    getAiWriterConfig,
};
