const SITE_NAME = "小Y博客";
const SITE_URL = String(import.meta.env.VITE_SITE_URL || "https://blog.wbjiang.cn").replace(/\/+$/, "");
const DEFAULT_DESCRIPTION = "小Y博客专注技术分享、AI 创作与全栈开发实践，提供前端、后端、工程化与智能 Agent 等高质量中文内容。";
const DEFAULT_IMAGE = `${SITE_URL}/icon-512.png`;

export interface SeoConfig {
    title?: string;
    description?: string;
    path?: string;
    image?: string;
    type?: "website" | "article" | "profile";
    robots?: string;
    keywords?: string[];
    author?: string;
    publishedTime?: string;
    modifiedTime?: string;
    section?: string;
    jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

const toAbsoluteUrl = (value = "/") => {
    if (/^https?:\/\//i.test(value)) return value;
    return `${SITE_URL}${value.startsWith("/") ? value : `/${value}`}`;
};

const upsertMeta = (attribute: "name" | "property", key: string, content: string) => {
    let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
    if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
    }
    element.content = content;
};

const removeMeta = (attribute: "name" | "property", key: string) => {
    document.head.querySelector(`meta[${attribute}="${key}"]`)?.remove();
};

const upsertCanonical = (href: string) => {
    let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!element) {
        element = document.createElement("link");
        element.rel = "canonical";
        document.head.appendChild(element);
    }
    element.href = href;
};

const upsertJsonLd = (value?: SeoConfig["jsonLd"]) => {
    const id = "route-jsonld";
    const existing = document.getElementById(id);
    if (!value) {
        existing?.remove();
        return;
    }

    const script = existing || document.createElement("script");
    script.id = id;
    script.setAttribute("type", "application/ld+json");
    script.textContent = JSON.stringify(value);
    if (!existing) document.head.appendChild(script);
};

export const setSeo = (config: SeoConfig = {}) => {
    const rawTitle = config.title?.trim();
    const fullTitle = rawTitle ? `${rawTitle}｜${SITE_NAME}` : `${SITE_NAME}｜技术分享、AI 创作与全栈开发`;
    const description = (config.description || DEFAULT_DESCRIPTION).replace(/\s+/g, " ").trim().slice(0, 160);
    const canonical = toAbsoluteUrl(config.path || window.location.pathname);
    const image = toAbsoluteUrl(config.image || DEFAULT_IMAGE);
    const type = config.type || "website";

    document.title = fullTitle;
    upsertCanonical(canonical);
    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", config.robots || "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1");
    upsertMeta("name", "author", config.author || SITE_NAME);
    upsertMeta("name", "keywords", (config.keywords || ["技术博客", "前端开发", "后端开发", "AI 创作", "Agent", "全栈开发"]).join(", "));

    upsertMeta("property", "og:locale", "zh_CN");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:image:alt", `${rawTitle || SITE_NAME} - 分享预览图`);

    upsertMeta("name", "twitter:card", "summary");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", image);
    upsertMeta("name", "twitter:image:alt", `${rawTitle || SITE_NAME} - 分享预览图`);

    const articleProperties: Array<[string, string | undefined]> = [
        ["article:published_time", config.publishedTime],
        ["article:modified_time", config.modifiedTime],
        ["article:author", config.author],
        ["article:section", config.section],
    ];
    articleProperties.forEach(([key, value]) => (value ? upsertMeta("property", key, value) : removeMeta("property", key)));

    upsertJsonLd(config.jsonLd);
};

export const seoSite = {
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    image: DEFAULT_IMAGE,
    absoluteUrl: toAbsoluteUrl,
};
