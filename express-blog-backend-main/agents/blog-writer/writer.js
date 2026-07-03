const { formatResearchPackets, rebuildArticleContent, getCurrentDateLabel } = require("./helpers");

/**
 * Writing stage for a single section.
 */
class Writer {
    constructor(options) {
        this.llm = options.llm;
        this.researchService = options.researchService;
        this.knowledgeCutoff = options.knowledgeCutoff;
    }

    async ensureSectionResearch(state, sectionIndex) {
        const section = state.outline.sections[sectionIndex];
        const cachedResearch = state.research.sectionPackets[sectionIndex];

        if (cachedResearch && cachedResearch.length > 0) {
            return cachedResearch;
        }

        const fallbackQuery = `${state.outline.title} ${section.title}`;
        const queries = section.researchQueries && section.researchQueries.length > 0 ? section.researchQueries : [fallbackQuery];
        const researchPackets = await this.researchService.runQueries(queries, section.title);

        state.research.sectionPackets[sectionIndex] = researchPackets;
        state.updatedAt = new Date().toISOString();
        return researchPackets;
    }

    async draftSection(state, sectionIndex, onToken) {
        const section = state.outline.sections[sectionIndex];
        const currentDate = getCurrentDateLabel();
        const sectionResearch = await this.ensureSectionResearch(state, sectionIndex);

        const messages = [
            {
                role: "system",
                content: [
                    "你是多步写作智能体中的写作执行器。",
                    `今天是 ${currentDate}，模型知识截止时间是 ${this.knowledgeCutoff}。`,
                    "如果涉及最新信息，必须以提供的外部研究资料为准。",
                    "请直接输出 Markdown，不要解释推理过程。",
                    "写作要求：",
                    "1. 以二级标题 ## 开始。",
                    "2. 内容完整、结构清晰，必要时使用列表和代码块。",
                    "3. 对最新事实保持保守，只写研究资料明确支持的内容。",
                ].join("\n"),
            },
            {
                role: "user",
                content: [
                    `文章标题：${state.outline.title}`,
                    `文章摘要：${state.outline.summary}`,
                    `全局写作目标：${state.analysis?.writingGoal || state.prompt}`,
                    `当前章节标题：${section.title}`,
                    `当前章节写作目标：${section.writingGoal || "围绕章节要点展开"}`,
                    `当前章节关键点：${section.keyPoints.join("；")}`,
                    state.fileContent ? `参考文件内容：\n${state.fileContent}` : "参考文件内容：无",
                    state.content ? `已完成内容（节选）：\n${state.content.slice(-1200)}` : "已完成内容：当前是第一章节",
                    `当前章节研究资料：\n${formatResearchPackets(sectionResearch)}`,
                ].join("\n\n"),
            },
        ];

        let fullContent = "";

        await this.llm.streamChat({
            messages,
            temperature: 0.55,
            maxTokens: 2600,
            onToken: async (token) => {
                fullContent += token;
                if (onToken) {
                    await onToken(token);
                }
            },
        });

        section.content = fullContent.trim();
        section.status = "written";
        section.sources = sectionResearch.flatMap((packet) => packet.results || []);
        state.currentSection = sectionIndex;
        state.content = rebuildArticleContent(state.outline);
        state.updatedAt = new Date().toISOString();

        return section.content;
    }
}

module.exports = Writer;
