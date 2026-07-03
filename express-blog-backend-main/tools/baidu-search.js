const fetch = require('node-fetch');

/**
 * 百度搜索工具
 * 用于搜索全网实时信息
 */
class BaiduSearchTool {
    constructor(apiKey) {
        this.apiKey = apiKey || process.env.BAIDU_API_KEY || '';
        this.baseUrl = 'https://qianfan.baidubce.com/v2/ai_search/web_search';
    }

    /**
     * 搜索相关信息
     * @param {string} query 搜索关键词
     * @returns {Promise<{ success: boolean; data?: any; error?: string }>}
     */
    async search(query) {
        try {
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    query: query,
                    limit: 5, // 限制返回结果数量
                    type: 'web' // 搜索类型
                })
            });

            const data = await response.json();

            if (data.code === 0) {
                return {
                    success: true,
                    data: data.data
                };
            } else {
                return {
                    success: false,
                    error: data.message || '搜索失败'
                };
            }
        } catch (error) {
            console.error('百度搜索失败:', error);
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
                name: 'baidu_search',
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

module.exports = BaiduSearchTool;
