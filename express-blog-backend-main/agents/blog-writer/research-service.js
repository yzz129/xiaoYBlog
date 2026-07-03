const TavilySearchTool = require("../../tools/tavily-search");
const { getCurrentDateLabel } = require("./helpers");

/**
 * Fetches current web information so the workflow is not limited by the model cutoff.
 */
class ResearchService {
    constructor(options) {
        this.tavilySearch = new TavilySearchTool(options.tavilyApiKey);
        this.maxQueries = 3;
    }

    async runQueries(queries = [], topic = "") {
        const dedupedQueries = [...new Set((queries || []).map((item) => (item || "").trim()).filter(Boolean))].slice(0, this.maxQueries);
        const currentDate = getCurrentDateLabel();

        return Promise.all(
            dedupedQueries.map(async (query) => {
                const finalQuery = `${query} ${currentDate}`;
                const result = await this.tavilySearch.search(finalQuery);

                return {
                    query: finalQuery,
                    topic,
                    results: result.success ? result.data.results.slice(0, 3) : [],
                    error: result.success ? null : result.error,
                };
            })
        );
    }
}

module.exports = ResearchService;
