const { SpanStatusCode, isSpanContextValid, trace } = require("@opentelemetry/api");

const tracer = trace.getTracer("ai-blog-agent", "1.0.0");

function safeAttributes(attributes = {}) {
    return Object.fromEntries(Object.entries(attributes).filter(([, value]) => ["string", "number", "boolean"].includes(typeof value)));
}

function traceContext(span = trace.getActiveSpan()) {
    const context = span?.spanContext?.();
    if (!context || !isSpanContextValid(context)) return {};
    return { traceId: context.traceId, spanId: context.spanId };
}

async function withAgentSpan(name, attributes, operation) {
    return tracer.startActiveSpan(name, { attributes: safeAttributes(attributes) }, async (span) => {
        try {
            const result = await operation(span);
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
        } catch (error) {
            span.recordException(error);
            span.setAttribute("error.code", String(error?.code || error?.status || "UNKNOWN"));
            span.setStatus({ code: SpanStatusCode.ERROR, message: String(error?.message || error) });
            throw error;
        } finally {
            span.end();
        }
    });
}

module.exports = { safeAttributes, traceContext, withAgentSpan };
