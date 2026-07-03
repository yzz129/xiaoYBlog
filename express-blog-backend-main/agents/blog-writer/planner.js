const { extractJson, formatResearchPackets, getCurrentDateLabel, normalizeReferenceText, sanitizeOutline } = require("./helpers");

const ANALYSIS_SCHEMA = {
    topic: "",
    audience: "",
    writingGoal: "",
    searchQueries: ["", ""],
    risks: [""],
    outlineSeed: [
        {
            title: "",
            keyPoints: ["", ""],
            researchQueries: ["", ""],
            writingGoal: "",
        },
    ],
};

const OUTLINE_SCHEMA = {
    title: "",
    summary: "",
    sections: [
        {
            title: "",
            keyPoints: ["", ""],
            researchQueries: ["", ""],
            writingGoal: "",
        },
    ],
};

/**
 * Planning stage: analyze, research, and produce a grounded outline.
 */
class Planner {
    constructor(options) {
        this.llm = options.llm;
        this.researchService = options.researchService;
        this.knowledgeCutoff = options.knowledgeCutoff;
    }

    async createPlan({ prompt, fileContent }, streamHooks = {}) {
        const { onStatus = null, onOutlineChunk = null } = streamHooks;
        const currentDate = getCurrentDateLabel();
        const referenceText = normalizeReferenceText(fileContent);

        if (onStatus) {
            await onStatus("Analyzing topic...");
        }

        const analysisMessages = [
            {
                role: "system",
                content: [
                    "你是一个多步写作智能体的规划器。",
                    `今天的参考日期是 ${currentDate}，模型知识截止时间是 ${this.knowledgeCutoff}。`,
                    "如果主题可能涉及 2025 年及之后的事实、版本、政策、数据或趋势，必须优先依赖外部搜索，而不是假设自己知道最新信息。",
                    "只返回 JSON，不要输出 Markdown，不要添加解释。",
                    "保持结果精简：最多 3 个搜索查询、最多 5 个章节、每节最多 3 个要点。",
                ].join("\n"),
            },
            {
                role: "user",
                content: [
                    `写作主题：${prompt}`,
                    referenceText ? `参考文件内容：\n${referenceText}` : "参考文件内容：无",
                    "请输出如下 JSON：",
                    JSON.stringify(ANALYSIS_SCHEMA, null, 2),
                ].join("\n\n"),
            },
        ];

        const analysisText = await this.llm.chat({
            messages: analysisMessages,
            temperature: 0.2,
            maxTokens: 1200,
        });
        const analysis = await this.parseJsonWithRepair(analysisText, ANALYSIS_SCHEMA, "analysis");

        if (onStatus) {
            await onStatus("Researching latest information...");
        }
        const globalResearch = await this.researchService.runQueries(analysis.searchQueries, prompt);

        const outlineMessages = [
            {
                role: "system",
                content: [
                    "你是专业技术写作的文章规划器。",
                    `今天是 ${currentDate}，模型知识截止时间是 ${this.knowledgeCutoff}。`,
                    "必须优先使用提供的最新外部研究资料，不要伪造超出资料支持范围的最新事实。",
                    "只返回稳定、可解析的 JSON，不要输出说明。",
                    "输出简洁：最多 5 个章节，每节最多 3 个要点、2 个研究查询，摘要尽量短。",
                ].join("\n"),
            },
            {
                role: "user",
                content: [
                    `用户主题：${prompt}`,
                    referenceText ? `参考文件内容：\n${referenceText}` : "参考文件内容：无",
                    `任务分析：\n${JSON.stringify(analysis, null, 2)}`,
                    `最新研究资料：\n${formatResearchPackets(globalResearch)}`,
                    "请输出如下 JSON：",
                    JSON.stringify(OUTLINE_SCHEMA, null, 2),
                ].join("\n\n"),
            },
        ];

        if (onStatus) {
            await onStatus("Generating outline...");
        }

        let outlineText = "";
        if (onOutlineChunk) {
            outlineText = await this.llm.streamChat({
                messages: outlineMessages,
                temperature: 0.3,
                maxTokens: 1600,
                onToken: onOutlineChunk,
            });
        } else {
            outlineText = await this.llm.chat({
                messages: outlineMessages,
                temperature: 0.3,
                maxTokens: 1600,
            });
        }

        const outline = await this.parseJsonWithRepair(outlineText, OUTLINE_SCHEMA, "outline");

        return {
            analysis,
            globalResearch,
            outline: sanitizeOutline(outline),
        };
    }

    async parseJsonWithRepair(rawText, schema, label) {
        try {
            return extractJson(rawText);
        } catch (error) {
            const repairedText = await this.repairJson(rawText, schema, label, error);
            return extractJson(repairedText);
        }
    }

    async repairJson(rawText, schema, label, originalError) {
        console.error(`[Planner] ${label} JSON parse failed, attempting repair:`, originalError?.message || originalError);

        const repaired = await this.llm.chat({
            messages: [
                {
                    role: "system",
                    content: [
                        "你是一个 JSON 修复器。",
                        "你的任务是把输入中的不合法 JSON 修复为合法 JSON。",
                        "只能输出修复后的 JSON，不要输出 Markdown，不要解释。",
                        "不得补充与原文明显无关的字段。",
                    ].join("\n"),
                },
                {
                    role: "user",
                    content: [
                        `目标结构：\n${JSON.stringify(schema, null, 2)}`,
                        `原始输出：\n${String(rawText || "").slice(0, 12000)}`,
                    ].join("\n\n"),
                },
            ],
            temperature: 0,
            maxTokens: 1800,
        });

        return repaired;
    }
}

module.exports = Planner;
