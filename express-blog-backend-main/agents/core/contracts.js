class AgentContractError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = "AgentContractError";
        this.code = "AGENT_CONTRACT_VIOLATION";
        this.details = details;
    }
}

function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(path, message) {
    throw new AgentContractError(`${path} ${message}`, { path, message });
}

function validateSchema(value, schema, path = "value") {
    if (!schema || typeof schema !== "object") fail(path, "缺少有效 Schema");

    if (schema.type === "object") {
        if (!isPlainObject(value)) fail(path, "必须是对象");
        const properties = schema.properties || {};
        for (const key of schema.required || []) {
            if (!(key in value) || value[key] === undefined || value[key] === null || value[key] === "") {
                fail(`${path}.${key}`, "是必填字段");
            }
        }
        if (schema.additionalProperties === false) {
            const unknown = Object.keys(value).filter((key) => !(key in properties));
            if (unknown.length) fail(path, `包含未知字段：${unknown.join(", ")}`);
        }
        const output = {};
        for (const [key, childSchema] of Object.entries(properties)) {
            if (value[key] !== undefined) output[key] = validateSchema(value[key], childSchema, `${path}.${key}`);
        }
        return output;
    }

    if (schema.type === "array") {
        if (!Array.isArray(value)) fail(path, "必须是数组");
        if (schema.minItems !== undefined && value.length < schema.minItems) fail(path, `至少需要 ${schema.minItems} 项`);
        if (schema.maxItems !== undefined && value.length > schema.maxItems) fail(path, `最多允许 ${schema.maxItems} 项`);
        return value.map((item, index) => validateSchema(item, schema.items, `${path}[${index}]`));
    }

    if (schema.type === "string") {
        if (typeof value !== "string") fail(path, "必须是字符串");
        const output = schema.trim === false ? value : value.trim();
        if (schema.minLength !== undefined && output.length < schema.minLength) fail(path, `长度不能少于 ${schema.minLength}`);
        if (schema.maxLength !== undefined && output.length > schema.maxLength) fail(path, `长度不能超过 ${schema.maxLength}`);
        if (schema.enum && !schema.enum.includes(output)) fail(path, `必须是以下值之一：${schema.enum.join(", ")}`);
        return output;
    }

    if (schema.type === "number" || schema.type === "integer") {
        if (typeof value !== "number" || !Number.isFinite(value)) fail(path, "必须是有限数字");
        if (schema.type === "integer" && !Number.isInteger(value)) fail(path, "必须是整数");
        if (schema.minimum !== undefined && value < schema.minimum) fail(path, `不能小于 ${schema.minimum}`);
        if (schema.maximum !== undefined && value > schema.maximum) fail(path, `不能大于 ${schema.maximum}`);
        return value;
    }

    if (schema.type === "boolean") {
        if (typeof value !== "boolean") fail(path, "必须是布尔值");
        return value;
    }

    fail(path, `使用了不支持的类型：${schema.type}`);
}

function validateToolArguments(toolName, args, toolDefinitions) {
    const definition = (toolDefinitions || []).find((tool) => tool.name === toolName);
    if (!definition) throw new AgentContractError(`未知工具：${toolName}`, { path: "decision.tool", toolName });
    return validateSchema(args || {}, definition.inputSchema, `tools.${toolName}.args`);
}

const planSchema = {
    type: "array",
    maxItems: 12,
    items: {
        type: "object",
        additionalProperties: false,
        required: ["title"],
        properties: { title: { type: "string", minLength: 1, maxLength: 120 } },
    },
};

function validateAgentDecision(value, toolDefinitions) {
    if (!isPlainObject(value)) fail("decision", "必须是对象");
    if (!["tool", "complete", "ask_user"].includes(value.kind)) {
        fail("decision.kind", "必须是 tool、complete 或 ask_user");
    }

    const allowedByKind = {
        tool: new Set(["kind", "tool", "args", "reason", "plan"]),
        complete: new Set(["kind", "summary"]),
        ask_user: new Set(["kind", "question"]),
    };
    const unknown = Object.keys(value).filter((key) => !allowedByKind[value.kind].has(key));
    if (unknown.length) fail("decision", `包含未知字段：${unknown.join(", ")}`);

    if (value.kind === "tool") {
        const tool = validateSchema(value.tool, { type: "string", minLength: 1, maxLength: 80 }, "decision.tool");
        const args = validateToolArguments(tool, value.args || {}, toolDefinitions);
        const decision = {
            kind: "tool",
            tool,
            args,
            reason: validateSchema(value.reason === undefined ? `执行 ${tool}` : value.reason, { type: "string", minLength: 1, maxLength: 300 }, "decision.reason"),
        };
        if (value.plan !== undefined) {
            const compatiblePlan = Array.isArray(value.plan)
                ? value.plan.map((item) => typeof item === "string" ? { title: item } : item)
                : value.plan;
            decision.plan = validateSchema(compatiblePlan, planSchema, "decision.plan");
        }
        return decision;
    }

    if (value.kind === "ask_user") {
        return {
            kind: "ask_user",
            question: validateSchema(value.question, { type: "string", minLength: 1, maxLength: 600 }, "decision.question"),
        };
    }

    return {
        kind: "complete",
        summary: validateSchema(value.summary, { type: "string", minLength: 1, maxLength: 1200 }, "decision.summary"),
    };
}

module.exports = {
    AgentContractError,
    validateAgentDecision,
    validateSchema,
    validateToolArguments,
};
