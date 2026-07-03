const { getFetch } = require('../utils/fetch');

/**
 * Tavily 搜索工具
 * 用于搜索全网实时信息
 */
class TavilySearchTool {
    constructor(apiKey) {
        this.apiKey = apiKey || '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';
        this.baseUrl = 'https://api.tavily.com/search';
        this.requestTimeoutMs = 20000;
    }

    /**
     * 搜索相关信息
     * @param {string} query 搜索关键词
     * @returns {Promise<{ success: boolean; data?: any; error?: string }>}
     */
    async search(query) {
        try {
            const fetch = await getFetch();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
            const response = await fetch(`${this.baseUrl}?api_key=${this.apiKey}&query=${encodeURIComponent(query)}&limit=5`, {
                signal: controller.signal,
            }).finally(() => clearTimeout(timeout));

            const data = await response.json();

            if (data.results) {
                return {
                    success: true,
                    data: { results: data.results.map(item => ({
                        title: item.title,
                        url: item.url,
                        summary: item.content
                    })) }
                };
            } else {
                return {
                    success: false,
                    error: data.error || '搜索失败'
                };
            }
        } catch (error) {
            console.error('Tavily 搜索失败:', error);
            return {
                success: false,
                error: '网络错误'
            };
        }
    }

    /**
     * 搜索工具描述（用于 LangChain）
     */
    get description() {
        return {
            type: 'function',
            function: {
                name: 'tavily_search',
                description: '搜索全网实时信息，返回摘要和网址',
                parameters: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description: '搜索关键词'
                        }
                    },
                    required: ['query']
                }
            }
        };
    }

    /**
     * 执行搜索（用于 LangChain）
     * @param {Object} args 搜索参数
     * @returns {Promise<string>}
     */
    async execute(args) {
        const { query } = args;
        const result = await this.search(query);
        
        if (result.success) {
            const data = result.data;
            // 格式化搜索结果
            const formattedResults = data.results.map(item => {
                return `标题: ${item.title}\n链接: ${item.url}\n摘要: ${item.summary}\n`;
            }).join('\n');
            return `搜索结果:\n${formattedResults}`;
        } else {
            return `搜索失败: ${result.error}`;
        }
    }
}

module.exports = TavilySearchTool;
