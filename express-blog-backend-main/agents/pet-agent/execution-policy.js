/** Pin an engine when a task is created; never migrate an in-flight task. */
function selectExecution(goal, enabled = process.env.PET_AGENT_GRAPH_WRITING_ENABLED !== "false") {
    const writing = /写|撰写|创作|草稿|\b(?:write|draft)\b/i.test(goal || "");
    const article = /博客|文章|图文|\b(?:blog|article|post)\b/i.test(goal || "");
    return { engine: enabled && writing && article ? "langgraph" : "legacy", version: 1 };
}

function isGraphTask(task) {
    return task?.context?.execution?.engine === "langgraph";
}

module.exports = { isGraphTask, selectExecution };
