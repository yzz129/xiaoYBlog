const path = require("path");

const config = require("../../config");
const { getFetch } = require("../../utils/fetch");
const { uploadImage } = require("../../utils/minio");

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function numericPrices(pricing) {
    if (!pricing || typeof pricing !== "object") return [];
    return Object.entries(pricing)
        .filter(([key]) => key !== "currency")
        .map(([, value]) => Number(value))
        .filter(Number.isFinite);
}

function isZeroPrice(pricing) {
    const prices = numericPrices(pricing);
    return prices.length > 0 && prices.every((value) => value === 0);
}

function imageExtension(contentType, sourceUrl = "") {
    const mime = String(contentType || "").split(";")[0].toLowerCase();
    const byMime = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
    return byMime[mime] || path.extname(new URL(sourceUrl || "https://local/image.png").pathname) || ".png";
}

async function storeImageResponse(response, folder = "article-cover") {
    if (!response.ok) throw new Error(`图片生成失败 (${response.status})`);
    const contentType = String(response.headers.get("content-type") || "").split(";")[0];
    if (!contentType.startsWith("image/")) throw new Error("图片服务返回了非图片内容");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("生成图片为空或超过 12MB 限制");
    return uploadImage({ buffer, folder, extension: imageExtension(contentType, response.url), mimeType: contentType });
}

async function downloadAndStore(url, folder = "article-cover") {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") throw new Error("图片服务返回了不安全的地址");
    const fetch = await getFetch();
    return storeImageResponse(await fetch(parsed, { redirect: "follow" }), folder);
}

async function generateWithAgnes(prompt, options = {}) {
    const agent = config.petAgent || {};
    if (!agent.agnesApiKey) return null;
    const fetch = await getFetch();
    const response = await fetch(`${agent.agnesBaseUrl.replace(/\/$/, "")}/images/generations`, {
        method: "POST",
        headers: { Authorization: `Bearer ${agent.agnesApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
            model: agent.agnesImageModel,
            prompt,
            size: options.size || "1024x768",
        }),
    });
    if (!response.ok) throw new Error(`Agnes 图片生成失败 (${response.status})`);
    const payload = await response.json();
    const item = payload?.data?.[0];
    if (item?.b64_json) {
        return {
            ...(await uploadImage({ buffer: Buffer.from(item.b64_json, "base64"), folder: "article-cover", extension: ".png", mimeType: "image/png" })),
            provider: "agnes",
            model: agent.agnesImageModel,
        };
    }
    if (item?.url) return { ...(await downloadAndStore(item.url)), provider: "agnes", model: agent.agnesImageModel };
    throw new Error("Agnes 没有返回可用图片");
}

async function getFreePollinationsModel(modelName) {
    const agent = config.petAgent || {};
    if (!agent.pollinationsApiKey || !modelName) return null;
    const fetch = await getFetch();
    const response = await fetch(`${agent.pollinationsBaseUrl.replace(/\/$/, "")}/image/models`);
    if (!response.ok) throw new Error(`无法核验 Pollinations 模型价格 (${response.status})`);
    const models = await response.json();
    const model = (Array.isArray(models) ? models : models?.data || []).find((item) => item.name === modelName || item.id === modelName);
    if (!model) throw new Error(`Pollinations 模型 ${modelName} 不存在`);
    if (!isZeroPrice(model.pricing)) throw new Error(`Pollinations 模型 ${modelName} 当前不是零价模型，已阻止调用`);
    return model.name || model.id;
}

async function generateWithPollinations(prompt, options = {}) {
    const agent = config.petAgent || {};
    const model = await getFreePollinationsModel(agent.pollinationsImageModel);
    if (!model) return null;
    const [width, height] = String(options.size || "1024x768").split("x").map(Number);
    const url = new URL(`${agent.pollinationsBaseUrl.replace(/\/$/, "")}/image/${encodeURIComponent(prompt)}`);
    url.searchParams.set("model", model);
    url.searchParams.set("width", String(width || 1024));
    url.searchParams.set("height", String(height || 768));
    url.searchParams.set("nologo", "true");
    const fetch = await getFetch();
    const result = await storeImageResponse(await fetch(url, {
        headers: { Authorization: `Bearer ${agent.pollinationsApiKey}` },
    }));
    return { ...result, provider: "pollinations", model };
}

async function generateImage(prompt, options = {}) {
    const failures = [];
    for (const generator of [generateWithPollinations, generateWithAgnes]) {
        try {
            const result = await generator(prompt, options);
            if (result) return result;
        } catch (error) {
            failures.push(error.message);
        }
    }
    throw new Error(failures.length
        ? `没有可用的零成本图片生成路径：${failures.join("；")}`
        : "未配置图片生成服务；可使用搜索结果图片或配置 Agnes");
}

module.exports = {
    generateImage,
    isZeroPrice,
};
