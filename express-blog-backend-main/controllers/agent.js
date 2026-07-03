const express = require("express");
const router = express.Router();
const BlogWritingWorkflow = require("../agents/langchain-agent");

const agentSessions = BlogWritingWorkflow.sessionStore;
const activeStartJobs = new Map();

async function getSession(sessionId) {
    const snapshot = await agentSessions.get(sessionId);
    if (!snapshot) {
        return null;
    }

    return new BlogWritingWorkflow(snapshot);
}

async function requireSession(sessionId, res) {
    const agent = await getSession(sessionId);

    if (!agent) {
        res.status(404).json({
            success: false,
            message: "会话不存在",
        });
        return null;
    }

    return agent;
}

async function persistSession(agent) {
    const state = agent.getState();
    await agentSessions.set(state.sessionId, agent.exportSession());
}

function launchStartJob(agent) {
    const sessionId = agent.getState().sessionId;

    if (activeStartJobs.has(sessionId)) {
        return;
    }

    const job = (async () => {
        try {
            await agent.runStartPipeline();
        } catch (error) {
            console.error("[Agent] start pipeline failed:", error);
            agent.failStart(error);
        } finally {
            await persistSession(agent);
            activeStartJobs.delete(sessionId);
        }
    })();

    activeStartJobs.set(sessionId, job);
}

function writeStreamEvent(res, event, data) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    if (res.flush) {
        res.flush();
    }
}

router.post("/start", async function(req, res) {
    const { sessionId, prompt, fileContent } = req.body;

    if (!sessionId || !prompt) {
        return res.status(400).json({
            success: false,
            message: "缺少必要参数",
        });
    }

    try {
        const agent = new BlogWritingWorkflow();
        const result = agent.initializeStart(sessionId, prompt, fileContent);
        await persistSession(agent);
        launchStartJob(agent);

        res.json({
            success: true,
            state: result.state,
        });
    } catch (error) {
        console.error("[Agent] 启动失败:", error);
        res.status(500).json({
            success: false,
            message: error.message || "启动失败",
        });
    }
});

router.post("/stream-start", async function(req, res) {
    const { sessionId, prompt, fileContent } = req.body;

    if (!sessionId || !prompt) {
        return res.status(400).json({
            success: false,
            message: "缺少必要参数",
        });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const agent = new BlogWritingWorkflow();
        const initial = agent.initializeStart(sessionId, prompt, fileContent);
        await persistSession(agent);
        writeStreamEvent(res, "state", initial.state);

        const result = await agent.runStartPipeline({
            onStatus: async (statusMessage) => {
                const currentState = agent.getState();
                currentState.statusMessage = statusMessage;
                writeStreamEvent(res, "status", { statusMessage });
            },
            onOutlineChunk: async (chunk) => {
                writeStreamEvent(res, "outline_delta", { content: chunk });
            },
        });

        await persistSession(agent);
        writeStreamEvent(res, "state", result.state);
        writeStreamEvent(res, "done", { success: true });
        res.end();
    } catch (error) {
        console.error("[Agent] stream start failed:", error);
        writeStreamEvent(res, "error", {
            message: error.message || "流式启动失败",
        });
        res.end();
    }
});

router.get("/state/:sessionId", async function(req, res) {
    const agent = await requireSession(req.params.sessionId, res);
    if (!agent) {
        return;
    }

    res.json({
        success: true,
        state: agent.getState(),
    });
});

router.post("/confirm-outline", async function(req, res) {
    const agent = await requireSession(req.body.sessionId, res);
    if (!agent) {
        return;
    }

    try {
        const result = await agent.confirmOutline();
        await persistSession(agent);

        res.json({
            success: true,
            state: result.state,
        });
    } catch (error) {
        console.error("[Agent] 确认大纲失败:", error);
        res.status(500).json({
            success: false,
            message: error.message || "确认大纲失败",
        });
    }
});

router.post("/next-section", async function(req, res) {
    const agent = await requireSession(req.body.sessionId, res);
    if (!agent) {
        return;
    }

    try {
        const result = await agent.nextSection();
        await persistSession(agent);

        res.json({
            success: true,
            state: result.state,
        });
    } catch (error) {
        console.error("[Agent] 切换下一节失败:", error);
        res.status(500).json({
            success: false,
            message: error.message || "无法进入下一节",
        });
    }
});

router.post("/revise-section", async function(req, res) {
    const { sessionId, feedback } = req.body;
    if (!sessionId || !feedback) {
        return res.status(400).json({
            success: false,
            message: "缺少必要参数",
        });
    }

    const agent = await requireSession(sessionId, res);
    if (!agent) {
        return;
    }

    try {
        const result = await agent.reviseSection(feedback);
        await persistSession(agent);

        res.json({
            success: true,
            state: result.state,
        });
    } catch (error) {
        console.error("[Agent] 修订失败:", error);
        res.status(500).json({
            success: false,
            message: error.message || "修订失败",
        });
    }
});

router.post("/skip-section", async function(req, res) {
    const agent = await requireSession(req.body.sessionId, res);
    if (!agent) {
        return;
    }

    try {
        const result = await agent.nextSection();
        await persistSession(agent);

        res.json({
            success: true,
            state: result.state,
        });
    } catch (error) {
        console.error("[Agent] 跳过失败:", error);
        res.status(500).json({
            success: false,
            message: error.message || "无法跳过当前章节",
        });
    }
});

router.post("/complete", async function(req, res) {
    const { sessionId } = req.body;
    const agent = await requireSession(sessionId, res);
    if (!agent) {
        return;
    }

    try {
        const result = await agent.complete();
        activeStartJobs.delete(sessionId);
        await agentSessions.delete(sessionId);

        res.json({
            success: true,
            result: result.result,
        });
    } catch (error) {
        console.error("[Agent] 完成失败:", error);
        res.status(500).json({
            success: false,
            message: error.message || "完成失败",
        });
    }
});

router.post("/stream-complete", async function(req, res) {
    const { sessionId } = req.body;
    const agent = await requireSession(sessionId, res);
    if (!agent) {
        return;
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        const result = await agent.completeStream({
            onStatus: async (statusMessage) => {
                writeStreamEvent(res, "status", { statusMessage });
            },
            onArticleChunk: async (chunk) => {
                writeStreamEvent(res, "article_delta", { content: chunk });
            },
        });

        writeStreamEvent(res, "state", { state: result.state });
        writeStreamEvent(res, "result", { result: result.result });
        writeStreamEvent(res, "done", { success: true });

        activeStartJobs.delete(sessionId);
        await agentSessions.delete(sessionId);
        res.end();
    } catch (error) {
        console.error("[Agent] stream complete failed:", error);
        writeStreamEvent(res, "error", {
            message: error.message || "Failed to complete writing",
        });
        res.end();
    }
});

router.post("/feedback", async function(req, res) {
    const { sessionId, feedback } = req.body;
    const agent = await requireSession(sessionId, res);
    if (!agent) {
        return;
    }

    try {
        const result = await agent.handleFeedback(feedback);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: result.error || "处理反馈失败",
            });
        }

        await persistSession(agent);
        res.json({
            success: true,
            state: result.state,
        });
    } catch (error) {
        console.error("[Agent] 处理反馈失败:", error);
        res.status(500).json({
            success: false,
            message: error.message || "处理反馈失败",
        });
    }
});

router.post("/reset", async function(req, res) {
    const { sessionId } = req.body;
    if (!sessionId) {
        return res.status(400).json({
            success: false,
            message: "缺少会话 ID",
        });
    }

    const agent = await requireSession(sessionId, res);
    if (!agent) {
        return;
    }

    try {
        await agent.reset();
        activeStartJobs.delete(sessionId);
        await agentSessions.delete(sessionId);

        res.json({
            success: true,
            message: "重置成功",
        });
    } catch (error) {
        console.error("[Agent] 重置失败:", error);
        res.status(500).json({
            success: false,
            message: error.message || "重置失败",
        });
    }
});

router.get("/stream-section/:sessionId/:sectionIndex", async function(req, res) {
    const { sessionId, sectionIndex } = req.params;
    const agent = await requireSession(sessionId, res);
    if (!agent) {
        return;
    }

    try {
        const index = Number(sectionIndex);
        if (Number.isNaN(index)) {
            return res.status(400).json({
                success: false,
                message: "章节索引无效",
            });
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        await agent.streamSection(index, async (chunk) => {
            res.write(
                "data: " +
                    JSON.stringify({
                        choices: [
                            {
                                delta: {
                                    content: chunk,
                                },
                            },
                        ],
                    }) +
                    "\n\n"
            );

            if (res.flush) {
                res.flush();
            }
        });

        await persistSession(agent);
        res.write("data: [DONE]\n\n");
        res.end();
    } catch (error) {
        console.error("[Agent] 流式输出失败:", error);
        res.status(500).json({
            success: false,
            message: error.message || "流式输出失败",
        });
    }
});

module.exports = router;
