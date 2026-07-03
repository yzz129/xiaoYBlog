/**
 * Node 22 has global fetch. Fallback to dynamic import for environments that do not.
 */
async function getFetch() {
    if (typeof globalThis.fetch === "function") {
        return globalThis.fetch.bind(globalThis);
    }

    const module = await import("node-fetch");
    return module.default;
}

module.exports = {
    getFetch,
};
