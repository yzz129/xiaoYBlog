let sdk = null;
let started = false;

function enabled() {
    return process.env.OTEL_ENABLED === "true" || Boolean(process.env.OTEL_EXPORTER_OTLP_ENDPOINT);
}

function traceEndpoint() {
    const base = String(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || "http://127.0.0.1:4318").replace(/\/$/, "");
    return base.endsWith("/v1/traces") ? base : `${base}/v1/traces`;
}

function start() {
    if (started || !enabled()) return false;
    const { NodeSDK } = require("@opentelemetry/sdk-node");
    const { OTLPTraceExporter } = require("@opentelemetry/exporter-trace-otlp-http");
    const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
    sdk = new NodeSDK({
        serviceName: process.env.OTEL_SERVICE_NAME || "ai-blog-agent",
        traceExporter: new OTLPTraceExporter({ url: traceEndpoint() }),
        instrumentations: [getNodeAutoInstrumentations({
            "@opentelemetry/instrumentation-fs": { enabled: false },
        })],
    });
    const result = sdk.start();
    if (result?.catch) result.catch((error) => console.error("[Telemetry] startup failed:", error.message));
    started = true;
    return true;
}

async function shutdown() {
    if (!sdk) return;
    const current = sdk;
    sdk = null;
    started = false;
    await current.shutdown();
}

module.exports = { enabled, shutdown, start, traceEndpoint };
