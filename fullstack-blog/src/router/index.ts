import { createRouter, createWebHistory, RouteRecordRaw } from "vue-router";

import { useStore } from "@/stores";

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
    if (!store.isAuthed) {
        try {
            await store.fetchCurrent(true);
        } catch (_error) {
            // ignore fetch errors here; handled by response interceptor
        }
    }

    if (store.isAuthed) {
        next();
        return;
    }

    store.clearUserSession();
    next("/login");
});

export default router;
