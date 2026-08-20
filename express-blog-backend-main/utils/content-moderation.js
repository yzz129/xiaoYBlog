const xss = require("xss");

const DEFAULT_BLOCKED_TERMS = ["赌博", "博彩", "裸聊", "代开发票", "枪支交易", "毒品交易"];

function configuredTerms() {
    return String(process.env.CHAT_BLOCKED_TERMS || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
}

function normalizeContent(value, maxLength = 2000) {
    return xss(String(value || ""), { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ["script", "style"] })
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
        .replace(/\s{8,}/g, " ")
        .trim()
        .slice(0, maxLength);
}

function moderateContent(value, options = {}) {
    const content = normalizeContent(value, options.maxLength || 2000);
    if (!content) return { allowed: false, content: "", reason: "消息不能为空" };

    const normalized = content.toLowerCase().replace(/\s+/g, "");
    const blocked = [...DEFAULT_BLOCKED_TERMS, ...configuredTerms()].find((term) => normalized.includes(term.replace(/\s+/g, "")));
    if (blocked) return { allowed: false, content: "", reason: "消息包含不允许发布的内容" };

    if (/(.)\1{24,}/u.test(content)) return { allowed: false, content: "", reason: "消息包含大量重复字符" };
    return { allowed: true, content, reason: "" };
}

module.exports = { moderateContent, normalizeContent };
