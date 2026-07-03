const { formatResearchPackets, rebuildArticleContent } = require("./helpers");

/**
 * Review and revision stage.
 */
class Reviewer {
    constructor(options) {
        this.llm = options.llm;
        this.knowledgeCutoff = options.knowledgeCutoff;
    }

    async reviseSection(state, sectionIndex, feedback) {
        const section = state.outline.sections[sectionIndex];
        const researchPackets = state.research.sectionPackets[sectionIndex] || [];

        const messages = [
            {
                role: "system",
                content: [
                    "你是多步写作智能体中的评审与改写执行器。",
                    `模型知识截止时间是 ${this.knowledgeCutoff}。`,
                    "请根据用户反馈重写当前章节，保留 Markdown 格式，并继续依赖提供的研究资料。",
                    "输出只包含修改后的章节正文。",
                ].join("\n"),
            },
            {
                role: "user",
                content: [
                    `文章标题：${state.outline.title}`,
                    `当前章节标题：${section.title}`,
                    `当前章节关键点：${section.keyPoints.join("；")}`,
                    `用户反馈：${feedback}`,
                    `原始章节内容：\n${section.content || ""}`,
                    `章节研究资料：\n${formatResearchPackets(researchPackets)}`,
                ].join("\n\n"),
            },
        ];

        const revisedContent = await this.llm.chat({
            messages,
            temperature: 0.35,
            maxTokens: 2600,
        });

        section.content = revisedContent.trim();
        section.status = "revised";
        section.revisionCount = (section.revisionCount || 0) + 1;
        state.feedback = feedback;
        state.content = rebuildArticleContent(state.outline);
        state.updatedAt = new Date().toISOString();

        return section.content;
    }

    async evaluateArticle(state) {
        if (!state.content) {
            return null;
        }

        const messages = [
            {
                role: "system",
                content: "你是文章质量评审器。请只输出 JSON。",
            },
            {
                role: "user",
                content: [
                    `写作主题：${state.prompt}`,
                    `文章标题：${state.outline.title}`,
                    `文章内容：\n${state.content.slice(0, 5000)}`,
                    "请输出如下 JSON：",
                    JSON.stringify(
                        {
                            summary: "",
                            strengths: [""],
                            risks: [""],
                            score: 0,
                        },
                        null,
                        2
                    ),
                ].join("\n\n"),
            },
        ];

        try {
            const text = await this.llm.chat({
                messages,
                temperature: 0.2,
                maxTokens: 800,
            });
            return JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");
        } catch (error) {
            return null;
        }
    }
}

module.exports = Reviewer;
