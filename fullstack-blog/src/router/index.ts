import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

import { useStore } from "@/stores";
import { setSeo } from "@/utils/seo";

import { BACKEND_ROUTE } from "./backend";
import { FALLBACK_ROUTE, NOT_FOUND_ROUTE } from "./not-found";

const routes: Array<RouteRecordRaw> = [
    {
        path: "/",
        name: "Home",
        component: () => import("@/views/home/index.vue"),
        meta: {
            auth: false,
            title: "首页",
        },
    },
    {
        path: "/categories",
        name: "Categoryies",
        component: () => import("@/views/categories/index.vue"),
        meta: {
            auth: false,
            title: "全部分类",
        },
    },
    {
        path: "/category/:name",
        name: "Category",
        component: () => import("@/views/category/index.vue"),
        meta: {
            auth: false,
            title: "分类",
        },
    },
    {
        path: "/tags",
        name: "Tags",
        component: () => import("@/views/tags/index.vue"),
        meta: {
            auth: false,
            title: "全部标签",
        },
    },
    {
        path: "/tag/:name",
        name: "Tag",
        component: () => import("@/views/tag/index.vue"),
        meta: {
            auth: false,
            title: "标签",
        },
    },
    {
        path: "/timeline",
        name: "Timeline",
        component: () => import("@/views/timeline/index.vue"),
        meta: {
            auth: false,
            title: "时间轴",
        },
    },
    {
        path: "/article/:id",
        name: "Article",
        component: () => import("@/views/article/index.vue"),
        meta: {
            auth: false,
            title: "文章详情",
        },
    },
    {
        path: "/search",
        name: "Search",
        component: () => import("@/views/search/index.vue"),
        meta: {
            auth: false,
            title: "搜索结果",
        },
    },
    {
        path: "/user/:id",
        name: "UserProfile",
        component: () => import("@/views/user/index.vue"),
        meta: {
            auth: false,
            title: "用户详情",
        },
    },
    {
        path: "/me",
        name: "MyProfile",
        component: () => import("@/views/me/index.vue"),
        meta: {
            auth: true,
            title: "我的主页",
        },
    },
    {
        path: "/jumpout/:target",
        name: "Jumpout",
        component: () => import("@/views/jumpout/index.vue"),
        meta: {
            auth: false,
            title: "即将离开博客",
        },
    },
    {
        path: "/messages",
        name: "Messages",
        component: () => import("@/views/messages/index.vue"),
        meta: {
            auth: false,
            title: "留言",
        },
    },
    {
        path: "/chat",
        name: "Chat",
        component: () => import("@/views/chat/index.vue"),
        meta: {
            auth: false,
            title: "在线聊天室",
        },
    },
    {
        path: "/login",
        name: "Login",
        component: () => import("@/views/login/index.vue"),
        meta: {
            auth: false,
            title: "登录",
        },
    },
    BACKEND_ROUTE,
    NOT_FOUND_ROUTE,
    FALLBACK_ROUTE,
];

const router = createRouter({
    history: createWebHistory("/"),
    routes,
    scrollBehavior(_to, _from, savedPosition) {
        if (savedPosition) {
            return savedPosition;
        }

        return { top: 0 };
    },
});

router.beforeEach(async (to, _from, next) => {
    if (!to.meta.auth) {
        next();
        return;
    }

    const store = useStore();
    if (!store.token) {
        store.clearUserSession();
        next("/login");
        return;
    }

    try {
        await store.fetchCurrent(true);
    } catch (_error) {
        // A stale or invalid token is cleared by the response interceptor.
    }

    if (store.isAuthed && store.userInfo) {
        next();
        return;
    }

    store.clearUserSession();
    next("/login");
});

router.afterEach((to) => {
    const routeName = String(to.name || "");
    const parameterName = String(to.params.name || "").trim();
    const noIndex = "noindex, follow";

    if (to.meta.isAdmin || ["Login", "MyProfile", "Jumpout", "Search", "Chat"].includes(routeName)) {
        setSeo({
            title: String(to.meta.title || "页面"),
            description: `${String(to.meta.title || "当前页面")}属于小Y博客的功能页面。`,
            path: to.path,
            robots: noIndex,
        });
        return;
    }

    const routeSeo = {
        Home: {
            title: "技术分享、AI 创作与全栈开发",
            description: "发现值得阅读的前端、后端、工程化、AI 创作与智能 Agent 中文技术文章。",
            path: "/",
        },
        Categoryies: {
            title: "文章分类",
            description: "按前端、后端、AI、工程化等技术方向浏览小Y博客文章。",
            path: "/categories",
        },
        Tags: {
            title: "技术标签",
            description: "通过 Vue、Node.js、AI、Agent 等标签快速发现相关技术内容。",
            path: "/tags",
        },
        Timeline: {
            title: "文章时间轴",
            description: "按照发布时间浏览小Y博客持续更新的技术文章与创作记录。",
            path: "/timeline",
        },
        Messages: {
            title: "留言交流",
            description: "在小Y博客留言板分享建议、问题与技术交流。",
            path: "/messages",
        },
    } as const;

    if (routeName === "Category") {
        setSeo({
            title: `${parameterName || "文章"}分类`,
            description: `浏览小Y博客“${parameterName || "技术"}”分类下的最新文章与实践内容。`,
            path: to.path,
            keywords: [parameterName, "技术分类", "技术博客"].filter(Boolean),
        });
        return;
    }

    if (routeName === "Tag") {
        setSeo({
            title: `${parameterName || "技术"}相关文章`,
            description: `汇总小Y博客中带有“${parameterName || "技术"}”标签的文章与开发经验。`,
            path: to.path,
            keywords: [parameterName, "技术标签", "开发实践"].filter(Boolean),
        });
        return;
    }

    if (routeName === "Article") {
        setSeo({
            title: "文章详情",
            description: "正在加载小Y博客文章内容。",
            path: to.path,
            type: "article",
            robots: noIndex,
        });
        return;
    }

    if (routeName === "UserProfile") {
        setSeo({
            title: "作者主页",
            description: "浏览小Y博客作者资料与公开发布的技术文章。",
            path: to.path,
            type: "profile",
        });
        return;
    }

    const config = routeSeo[routeName as keyof typeof routeSeo];
    if (config) {
        setSeo(config);
        return;
    }

    setSeo({
        title: String(to.meta.title || "页面不存在"),
        path: to.path,
        robots: noIndex,
    });
});

export default router;
