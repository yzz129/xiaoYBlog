const config = require("../../config");
const dbUtils = require("../../utils/db");
const { getFetch } = require("../../utils/fetch");
const PetAgentModelClient = require("./model-client");

const TOOL_DEFINITIONS = [
    { name: "search_blog", description: "按关键词搜索站内公开博客", input: { query: "string" } },
    { name: "get_blog", description: "读取指定 ID 的博客全文与作者", input: { articleId: "number" } },
    { name: "search_users", description: "搜索站内用户", input: { keyword: "string" } },
    { name: "follow_user", description: "关注一个站内用户；这是可撤销动作", input: { userId: "number" } },
    { name: "web_search", description: "搜索公开网页；需要 TAVILY_API_KEY", input: { query: "string" } },
    { name: "draft_blog", description: "根据主题和已收集资料撰写博客草稿，不会发布", input: { topic: "string", instructions: "string" } },
    { name: "publish_blog", description: "发布当前草稿；始终需要用户批准", input: { title: "string?" } },
    { name: "update_blog", description: "覆盖更新已有博客；始终需要用户批准", input: { articleId: "number", title: "string", content: "string", summary: "string" } },
];

function compactText(value, max = 240) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

async function ensureFollowTable() {
    await dbUtils.query({
        sql: `CREATE TABLE IF NOT EXISTS user_follow (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            follower_id INT NOT NULL,
            following_id INT NOT NULL,
            create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uk_user_follow (follower_id, following_id),
            KEY idx_user_follow_following (following_id),
            KEY idx_user_follow_follower (follower_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    });
}

async function searchBlog(args) {
    const query = compactText(args.query, 80);
    if (!query) throw new Error("搜索关键词不能为空");
    const like = `%${query}%`;
    const { results } = await dbUtils.query({
        sql: `SELECT a.id, a.article_name, a.summary, a.content, a.create_time,
                     u.id AS author_user_id, COALESCE(u.nick_name, u.username) AS author
              FROM article a
              LEFT JOIN user u ON u.id = a.author_id
              WHERE a.private = 0 AND a.deleted = 0
                AND (a.article_name LIKE ? OR a.summary LIKE ? OR a.content LIKE ?)
              ORDER BY a.create_time DESC LIMIT 8`,
        values: [like, like, like],
    });
    const items = results.map((item) => ({
        id: Number(item.id),
        title: item.article_name,
        summary: compactText(item.summary || item.content, 320),
        authorId: Number(item.author_user_id || 0),
        author: item.author || "未知作者",
        createdAt: item.create_time,
    }));
    return { summary: `找到 ${items.length} 篇与“${query}”相关的站内博客`, data: { query, items } };
}

async function getBlog(args) {
    const articleId = Number(args.articleId || 0);
    const { results } = await dbUtils.query({
        sql: `SELECT a.id, a.article_name, a.summary, a.content, a.create_time,
                     u.id AS author_user_id, COALESCE(u.nick_name, u.username) AS author
              FROM article a LEFT JOIN user u ON u.id = a.author_id
              WHERE a.id = ? AND a.deleted = 0 LIMIT 1`,
        values: [articleId],
    });
    const item = results[0];
    if (!item) throw new Error(`没有找到 ID 为 ${articleId} 的博客`);
    return {
        summary: `已读取《${item.article_name}》及作者信息`,
        data: {
            id: Number(item.id), title: item.article_name, summary: item.summary || "", content: String(item.content || "").slice(0, 12000),
            authorId: Number(item.author_user_id || 0), author: item.author || "未知作者", createdAt: item.create_time,
        },
    };
}

async function searchUsers(args) {
    await ensureFollowTable();
    const keyword = compactText(args.keyword, 80);
    const like = `%${keyword}%`;
    const { results } = await dbUtils.query({
        sql: `SELECT u.id, u.username, u.nick_name, u.intro,
                     (SELECT COUNT(*) FROM article a WHERE a.author_id = u.id AND a.private = 0 AND a.deleted = 0) AS article_count
              FROM user u WHERE u.username LIKE ? OR u.nick_name LIKE ? OR u.intro LIKE ?
              ORDER BY article_count DESC LIMIT 8`,
        values: [like, like, like],
    });
    const items = results.map((item) => ({
        id: Number(item.id), username: item.username, name: item.nick_name || item.username,
        intro: item.intro || "", articleCount: Number(item.article_count || 0),
    }));
    return { summary: `找到 ${items.length} 位相关用户`, data: { keyword, items } };
}

async function followUser(args, actor) {
    const userId = Number(args.userId || 0);
    if (!userId || userId === actor.userId) throw new Error("不能关注该用户");
    await ensureFollowTable();
    const { results: users } = await dbUtils.query({
        sql: "SELECT id, COALESCE(nick_name, username) AS name FROM user WHERE id = ? LIMIT 1",
        values: [userId],
    });
    if (!users[0]) throw new Error("要关注的用户不存在");
    const { results } = await dbUtils.query({
        sql: "INSERT IGNORE INTO user_follow (follower_id, following_id, create_time) VALUES (?, ?, NOW())",
        values: [actor.userId, userId],
    });
    return {
        summary: results.affectedRows ? `已关注 ${users[0].name}` : `你已经关注了 ${users[0].name}`,
        data: { userId, name: users[0].name, alreadyFollowing: !results.affectedRows },
    };
}

async function webSearch(args) {
    if (!config.aiWriter?.tavilyApiKey) throw new Error("未配置 TAVILY_API_KEY，无法搜索公开网页");
    const query = compactText(args.query, 180);
    const fetch = await getFetch();
    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: config.aiWriter.tavilyApiKey, query, max_results: 5, search_depth: "basic" }),
    });
    if (!response.ok) throw new Error(`网页搜索失败 (${response.status})`);
    const payload = await response.json();
    const items = (payload.results || []).slice(0, 5).map((item) => ({
        title: item.title, url: item.url, summary: compactText(item.content, 420),
    }));
    return { summary: `从公开网页找到 ${items.length} 条资料`, data: { query, items } };
}

function buildReferenceText(context) {
    return (context.observations || []).slice(-6).map((item) => {
        return `${item.tool}: ${JSON.stringify(item.data || {}).slice(0, 3500)}`;
    }).join("\n\n");
}

function offlineDraft(topic, context) {
    const searchObservation = [...(context.observations || [])].reverse().find((item) => item.tool === "search_blog");
    const source = searchObservation?.data?.items?.[0];
    const title = compactText(topic, 90) || `关于${source?.title || "这个主题"}的实践笔记`;
    const sourceLine = source ? `本文参考了站内文章《${source.title}》的讨论，并结合实际使用场景重新梳理。` : "本文从实际使用场景出发，整理关键思路与可执行建议。";
    const content = `# ${title}\n\n${sourceLine}\n\n## 为什么值得关注\n\n这个主题真正重要的地方，不是追逐概念，而是把复杂问题拆成可验证、可维护的步骤。\n\n## 核心思路\n\n1. 先明确目标和边界，避免在实现中不断漂移。\n2. 把流程拆成可观察的阶段，为每一步保留结果与错误信息。\n3. 对发布、覆盖等高影响动作设置人工确认。\n\n## 实践建议\n\n从一个最小闭环开始：读取真实数据、完成一次处理、展示过程，再逐步加入重试、调度和审计。这样得到的系统不仅“能演示”，也更接近长期可用的产品。\n\n## 结语\n\n好的实现会把自动化能力和人的控制权同时保留下来。先让流程可靠，再让它变得更聪明。`;
    return { title, summary: compactText(sourceLine, 180), content, tags: [] };
}

async function draftBlog(args, actor) {
    const topic = compactText(args.topic || actor.task.goal, 160);
    const model = new PetAgentModelClient();
    let draft;
    if (model.isConfigured) {
        const response = await model.json([
            { role: "system", content: "你是中文博客编辑。根据主题、用户要求和研究资料写一篇完整原创 Markdown 博客。返回严格 JSON：{\"title\":string,\"summary\":string,\"content\":string,\"tags\":string[]}。不要照抄资料，不得虚构来源。" },
            { role: "user", content: `主题：${topic}\n要求：${compactText(args.instructions || actor.task.goal, 500)}\n资料：\n${buildReferenceText(actor.task.context)}` },
        ], { maxTokens: 5200, temperature: 0.45 });
        draft = {
            title: compactText(response.title, 120),
            summary: compactText(response.summary, 260),
            content: String(response.content || "").trim(),
            tags: Array.isArray(response.tags) ? response.tags.slice(0, 6).map((tag) => compactText(tag, 30)) : [],
        };
    } else {
        draft = offlineDraft(topic, actor.task.context);
    }
    if (!draft.title || !draft.content) throw new Error("草稿生成失败：内容为空");
    return {
        summary: `博客草稿《${draft.title}》已完成，等待你查看`,
        data: { title: draft.title, summary: draft.summary, excerpt: compactText(draft.content, 360), tags: draft.tags },
        contextPatch: { artifacts: { ...(actor.task.context.artifacts || {}), draft } },
        event: { type: "artifact", title: "博客草稿已生成", content: draft.summary, status: "completed", data: { draft } },
    };
}

function buildApproval(toolName, args, actor) {
    if (toolName === "publish_blog") {
        const draft = actor.task.context?.artifacts?.draft;
        if (!draft) throw new Error("当前没有可发布的草稿");
        return {
            summary: `发布《${args.title || draft.title}》前需要你的确认`,
            action: { type: "publish_blog", label: `发布文章《${args.title || draft.title}》`, payload: { ...draft, title: args.title || draft.title } },
        };
    }
    if (toolName === "update_blog") {
        return {
            summary: `覆盖更新文章 #${Number(args.articleId)} 前需要你的确认`,
            action: { type: "update_blog", label: `更新文章 #${Number(args.articleId)}`, payload: args },
        };
    }
    throw new Error("未知的审批动作");
}

async function executeTool(toolName, args, actor) {
    if (toolName === "publish_blog" || toolName === "update_blog") {
        const approval = buildApproval(toolName, args, actor);
        return { requiresApproval: true, ...approval };
    }
    const handlers = { search_blog: searchBlog, get_blog: getBlog, search_users: searchUsers, follow_user: followUser, web_search: webSearch, draft_blog: draftBlog };
    const handler = handlers[toolName];
    if (!handler) throw new Error(`不支持的工具：${toolName}`);
    return handler(args || {}, actor);
}

async function performApprovedAction(action, actor) {
    if (action.type === "publish_blog") {
        const payload = action.payload || {};
        const { results } = await dbUtils.query({
            sql: "INSERT INTO article (article_name, content, summary, author_id, poster, private, deleted) VALUES (?, ?, ?, ?, ?, 0, 0)",
            values: [compactText(payload.title, 255), String(payload.content || ""), compactText(payload.summary, 1000), actor.userId, String(payload.poster || "")],
        });
        return { summary: `文章《${payload.title}》已发布`, data: { articleId: Number(results.insertId), title: payload.title } };
    }
    if (action.type === "update_blog") {
        const payload = action.payload || {};
        const articleId = Number(payload.articleId || 0);
        const { results: owned } = await dbUtils.query({
            sql: "SELECT id FROM article WHERE id = ? AND author_id = ? LIMIT 1",
            values: [articleId, actor.userId],
        });
        if (!owned[0]) throw new Error("无权更新这篇文章");
        await dbUtils.query({
            sql: "UPDATE article SET article_name = ?, content = ?, summary = ?, update_time = NOW() WHERE id = ?",
            values: [compactText(payload.title, 255), String(payload.content || ""), compactText(payload.summary, 1000), articleId],
        });
        return { summary: `文章 #${articleId} 已更新`, data: { articleId, title: payload.title } };
    }
    throw new Error("未知的审批动作");
}

module.exports = { TOOL_DEFINITIONS, executeTool, performApprovedAction };
