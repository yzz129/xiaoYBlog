/**
 * Shared helpers for the blog writing workflow.
 */

function getCurrentDateLabel() {
    return new Date().toISOString().slice(0, 10);
}

function extractJson(text) {
    if (!text || typeof text !== "string" || !text.trim()) {
        throw new Error("LLM 返回内容为空");
    }

    const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    const candidate = fencedMatch ? fencedMatch[1] : text;
    const firstBrace = candidate.indexOf("{");
    const lastBrace = candidate.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error("未找到有效的 JSON 内容");
    }

    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
}

function normalizeReferenceText(text, maxChars = 6000) {
    if (!text || typeof text !== "string") {
        return "";
    }

    const normalized = text
        .replace(/\u0000/g, "")
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        .replace(/[ \u00A0]{2,}/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    if (normalized.length <= maxChars) {
        return normalized;
    }

    return `${normalized.slice(0, maxChars)}\n\n[参考文件内容过长，已截断]`;
}

function formatResearchPackets(packets = []) {
    if (!Array.isArray(packets) || packets.length === 0) {
        return "没有可用的外部研究资料。";
    }

    return packets
        .map((packet, index) => {
            const results = (packet.results || [])
                .map((item, itemIndex) => {
                    return [
                        `  ${itemIndex + 1}. 标题: ${item.title || "未知标题"}`,
                        `     链接: ${item.url || "无链接"}`,
                        `     摘要: ${item.summary || "无摘要"}`,
                    ].join("\n");
                })
                .join("\n");

            return `查询 ${index + 1}: ${packet.query}\n${results || "  无结果"}`;
        })
        .join("\n\n");
}

function chunkText(text, chunkSize = 120) {
    const content = text || "";
    const chunks = [];

    for (let index = 0; index < content.length; index += chunkSize) {
        chunks.push(content.slice(index, index + chunkSize));
    }

    return chunks;
}

function rebuildArticleContent(outline) {
    if (!outline || !Array.isArray(outline.sections)) {
        return "";
    }

    return outline.sections
        .map((section) => (section.content || "").trim())
        .filter(Boolean)
        .join("\n\n");
}

function sanitizeOutline(outline) {
    const safeOutline = outline || {};
    const sections = Array.isArray(safeOutline.sections) ? safeOutline.sections.slice(0, 5) : [];

    return {
        title: (safeOutline.title || "").trim().slice(0, 120),
        summary: (safeOutline.summary || "").trim().slice(0, 220),
        sections: sections.map((section, index) => ({
            title: (section.title || `第 ${index + 1} 节`).trim().slice(0, 120),
            keyPoints: Array.isArray(section.keyPoints)
                ? section.keyPoints.filter(Boolean).slice(0, 3).map((item) => String(item).trim().slice(0, 120))
                : [],
            researchQueries: Array.isArray(section.researchQueries)
                ? section.researchQueries.filter(Boolean).slice(0, 2).map((item) => String(item).trim().slice(0, 120))
                : [],
            writingGoal: (section.writingGoal || "").trim().slice(0, 160),
            content: section.content || "",
            status: section.status || "pending",
            sources: Array.isArray(section.sources) ? section.sources : [],
            revisionCount: typeof section.revisionCount === "number" ? section.revisionCount : 0,
        })),
    };
}

module.exports = {
    chunkText,
    extractJson,
    formatResearchPackets,
    getCurrentDateLabel,
    normalizeReferenceText,
    rebuildArticleContent,
    sanitizeOutline,
};
