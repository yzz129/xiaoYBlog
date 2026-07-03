const { Tool } = require('@langchain/core/tools');
const TavilySearchTool = require('./tavily-search');

/**
 * Tavily 搜索工具
 */
class SearchTool extends Tool {
    constructor(apiKey) {
        super();
        this.tavilySearch = new TavilySearchTool(apiKey);
    }

    name = "tavily_search";
    description = "用于搜索实时信息，获取最新数据。参数: query (搜索关键词)";

    async _call(query) {
        console.log('[SearchTool] 搜索:', query);
        const result = await this.tavilySearch.search(query);
        if (result.success) {
            return JSON.stringify({
                success: true,
                results: result.data.results.slice(0, 3) // 只返回前3个结果
            });
        } else {
            return JSON.stringify({
                success: false,
                error: result.error
            });
        }
    }
}

module.exports = SearchTool;