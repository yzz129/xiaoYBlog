<template>
    <section class="base-layout__wrapper">
        <header class="base-layout__header">
            <div class="header-shell">
                <div class="header-glow header-glow--left"></div>
                <div class="header-glow header-glow--right"></div>

                <div class="header-left">
                    <button class="icon-button icon-button--ghost" type="button" aria-label="打开菜单" @click="onToggleMenu">
                        <MenuOutlined />
                    </button>
                    <router-link to="/" class="logo-wrap" aria-label="返回首页">
                        <span class="brand-mascot" aria-hidden="true"><DoodleIcon name="mascot" /></span>
                        <strong>小Y博客</strong>
                    </router-link>
                    <!-- 桌面端主导航：沿用原有路由，只调整信息层级与视觉呈现。 -->
                    <nav class="site-nav" aria-label="主导航">
                        <router-link to="/"><DoodleIcon name="plane" />发现</router-link>
                        <router-link to="/categories"><DoodleIcon name="folder" />分类</router-link>
                        <router-link to="/tags"><DoodleIcon name="tag" />标签</router-link>
                        <router-link to="/timeline"><DoodleIcon name="clock" />时间轴</router-link>
                        <router-link to="/messages"><DoodleIcon name="message" />留言</router-link>
                        <!-- 聊天室入口使用茶杯手绘图标，与留言板区分并保持清新风格。 -->
                        <router-link to="/chat"><DoodleIcon name="cup" />聊天室</router-link>
                    </nav>
                </div>

                <div class="header-center">
                    <a-input-search
                        v-model:value="searchKeyword"
                        class="site-search"
                        placeholder="搜索博客、用户"
                        allow-clear
                        aria-label="搜索博客文章和用户"
                        @search="onSearch"
                    >
                        <template #enterButton>
                            <span class="search-button">
                                <SearchOutlined />
                                <span class="search-button__text">搜索</span>
                            </span>
                        </template>
                    </a-input-search>
                </div>

                <div class="header-right" :class="{ 'header-right--guest': !isAuthed }">
                    <router-link v-if="!isAuthed" to="/login" class="header-pill header-pill--primary" title="登录">
                        <UserOutlined />
                        <span>登录</span>
                    </router-link>

                    <template v-else>
                        <a-dropdown placement="bottomRight">
                            <a-badge :count="unreadTotal" :overflow-count="99" class="dm-badge">
                                <a class="icon-button icon-button--ghost" @click.prevent="goToChat" title="消息">
                                    <MessageOutlined />
                                </a>
                            </a-badge>
                            <template #overlay>
                                <a-menu @click="onClickUnreadMenu">
                                    <a-menu-item v-if="!unreadConversations.length" key="__empty" disabled>
                                        暂无未读私聊
                                    </a-menu-item>
                                    <a-menu-item v-for="item in unreadConversations" :key="String(item.user_id)">
                                        <div class="dm-menu-item">
                                            <img :src="resolveAvatar(item.avatar)" :alt="item.nick_name" width="40" height="40" />
                                            <div class="dm-menu-item__meta">
                                                <div class="dm-menu-item__name">{{ item.nick_name }}</div>
                                                <div class="dm-menu-item__time">{{ formatUnreadTime(item.latest_time) }}</div>
                                            </div>
                                            <a-badge :count="item.unread_count" :overflow-count="99" />
                                        </div>
                                    </a-menu-item>
                                </a-menu>
                            </template>
                        </a-dropdown>

                        <router-link to="/me" class="header-pill header-pill--light" title="我的主页">
                            <HomeOutlined />
                            <span>我的主页</span>
                        </router-link>
                        <router-link to="/backend" class="header-pill header-pill--primary" title="进入后台">
                            <AppstoreOutlined />
                            <span>进入后台</span>
                        </router-link>
                    </template>
                </div>
            </div>
        </header>

        <!-- 首页报头只承担内容定位，不改变文章列表的数据与交互。 -->
        <section v-if="isHome" class="home-masthead">
            <div>
                <h1>发现<span>值得读</span>的内容</h1>
            </div>
            <span class="masthead-doodle" aria-hidden="true"><DoodleIcon name="plane" /></span>
        </section>

        <main class="base-layout__main">
            <slot />
        </main>

        <hot-column />
        <base-footer />

        <div v-show="isMenuVisible" class="mask" @click="onClickMask" />
        <base-menu :is-visible="isMenuVisible" />

        <aside class="aside-icons">
            <slot name="aside" />
            <button v-show="isShowGoTopIcon" type="button" class="icon-button icon-button--floating" aria-label="返回顶部" @click="goToTop">
                <ArrowUpOutlined />
            </button>
        </aside>
    </section>
</template>

<script setup lang="ts">
defineOptions({
    name: "BaseLayout",
});

import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { throttle } from "lodash-es";
import {
    AppstoreOutlined,
    ArrowUpOutlined,
    HomeOutlined,
    MenuOutlined,
    MessageOutlined,
    SearchOutlined,
    UserOutlined,
} from "@ant-design/icons-vue";

import BaseFooter from "./base-footer.vue";
import BaseMenu from "./base-menu.vue";
import HotColumn from "./hot-column.vue";
import DoodleIcon from "@/components/doodle-icon.vue";
import { useDmNotification } from "@/composables/use-dm-notification";
import { useStore } from "@/stores";
import { resolveAvatar } from "@/utils/avatar";
import { format } from "@/utils/date-utils";
import { setScrollTop } from "@/utils/dom";

const store = useStore();
const router = useRouter();
const route = useRoute();
const isHome = computed(() => route.name === "Home");
const { unreadTotal, unreadConversations } = useDmNotification();

const isAuthed = computed(() => Boolean(store.isAuthed));
const isMenuVisible = computed(() => store.isMenuVisible);
const isShowGoTopIcon = ref(false);
const searchKeyword = ref("");

let hideTimer: number | null = null;

const hideMenu = () => {
    store.isMenuVisible = false;
};

const onToggleMenu = () => {
    if (isMenuVisible.value) {
        hideMenu();
        return;
    }

    store.isMenuVisible = true;
    document.body.style.overflow = "hidden";
};

const onClickMask = () => {
    hideMenu();
    document.body.style.overflow = "";
};

const clearHideTimer = () => {
    if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
    }
};

const setHideTimer = () => {
    clearHideTimer();
    hideTimer = window.setTimeout(() => {
        isShowGoTopIcon.value = false;
    }, 5000);
};

const onScroll = () => {
    const currScrollTop = document.body.scrollTop || document.documentElement.scrollTop;
    if (currScrollTop > 0) {
        isShowGoTopIcon.value = true;
        setHideTimer();
        return;
    }

    isShowGoTopIcon.value = false;
};

const onScrollThrottle = throttle(onScroll, 300, { leading: true });

const goToTop = () => {
    setScrollTop({ useAnimation: true });
};

const goToChat = () => {
    router.push("/chat");
};

const onClickUnreadMenu = ({ key }: { key: string }) => {
    if (!key || key === "__empty") {
        return;
    }

    router.push(`/chat?mode=direct&userId=${key}`);
};

const formatUnreadTime = (value: string) => format(new Date(value), "MM-dd HH:mm");

const onSearch = () => {
    const keyword = searchKeyword.value.trim();
    if (!keyword) {
        return;
    }

    router.push({
        path: "/search",
        query: {
            q: keyword,
            tab: "users",
        },
    });
};

watch(
    () => route.query.q,
    (value) => {
        searchKeyword.value = typeof value === "string" ? value : "";
    },
    { immediate: true }
);

onMounted(() => {
    document.addEventListener("scroll", onScrollThrottle, { passive: true });
    setHideTimer();
});

onBeforeUnmount(() => {
    hideMenu();
    document.body.style.overflow = "";
    document.removeEventListener("scroll", onScrollThrottle);
    clearHideTimer();
});
</script>

<style lang="scss" scoped>
.base-layout__wrapper {
    min-height: 100vh;
    background:
        radial-gradient(circle at 8% 12%, rgb(113 205 184 / 10%), transparent 24%),
        radial-gradient(circle at 92% 8%, rgb(76 155 232 / 12%), transparent 28%),
        linear-gradient(180deg, #f4faff 0%, #eef7fd 58%, #f8fcff 100%);
}

.base-layout__header {
    position: sticky;
    top: 0;
    z-index: 30;
    padding: 14px 20px 0;
    background: linear-gradient(180deg, rgb(244 250 255 / 96%), rgb(244 250 255 / 78%));
    backdrop-filter: blur(14px);
    will-change: transform;
    transform: translateZ(0);
}

.header-shell {
    position: relative;
    overflow: hidden;
    width: min(1240px, 100%);
    margin: 0 auto;
    padding: 12px 16px;
    border: 1px solid var(--ui-line);
    border-radius: 18px;
    background: rgb(255 255 255 / 94%);
    box-shadow:
        0 14px 36px rgb(63 111 151 / 10%),
        inset 0 1px 0 rgb(255 255 255 / 86%);
    display: grid;
    grid-template-columns: minmax(440px, 1fr) minmax(300px, 460px) auto;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
}

.header-glow {
    display: none;
    position: absolute;
    border-radius: 50%;
    filter: blur(8px);
    opacity: 0.7;
    pointer-events: none;
    will-change: transform;
    animation: drift 9s ease-in-out infinite alternate;
}

.header-glow--left {
    top: -48px;
    left: -36px;
    width: 180px;
    height: 180px;
    background: radial-gradient(circle, rgba(155, 214, 255, 0.14), transparent 70%);
}

.header-glow--right {
    right: -52px;
    bottom: -64px;
    width: 210px;
    height: 210px;
    background: radial-gradient(circle, rgba(171, 223, 255, 0.12), transparent 72%);
    animation-delay: 1.6s;
}

.header-left,
.header-right {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    gap: 12px;
}

.site-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;

    a {
        position: relative;
        padding: 9px 10px;
        border-radius: 12px;
        color: #4a6178;
        font-size: 14px;
        font-weight: 650;
        white-space: nowrap;
        transition: color 0.2s ease, background 0.2s ease, transform 0.2s ease;

        &:hover,
        &.router-link-active {
            color: #2f80c5;
            background: #eef7ff;
            transform: translateY(-1px);
        }
    }
}

.header-right {
    justify-content: flex-end;
}

.header-center {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
}

.site-search {
    width: 100%;
    max-width: 620px;
    margin: 0;

    :deep(.ant-input-group) {
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 12px 24px rgba(98, 149, 188, 0.14);
    }

    :deep(.ant-input) {
        height: 50px;
        padding-inline: 18px;
        border: none;
        font-size: 15px;
        background: rgba(250, 253, 255, 0.98);
        color: #1f4f75;
    }

    :deep(.ant-input-search-button) {
        height: 50px;
        padding-inline: 20px;
        background: linear-gradient(135deg, #5aaee0, #4199cf);
        border-color: transparent;
    }
}

.search-button {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
}

.base-layout__main {
    width: min(1180px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 28px 0 0;
}

.logo-wrap {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
}

.logo-wrap img {
    display: block;
    height: 42px;
    filter: none;
}

.icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;

    &:hover {
        transform: translateY(-2px);
    }
}

.icon-button--ghost,
.icon-button--light {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    color: #336b93;
    background: #f2f8fd;
    box-shadow:
        inset 0 0 0 1px rgba(165, 209, 236, 0.9),
        0 8px 16px rgba(98, 149, 188, 0.14);
}

.icon-button--floating {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    color: #2d78ab;
    background: linear-gradient(180deg, #ffffff, #e7f5ff);
    box-shadow: 0 18px 34px rgba(102, 157, 196, 0.22);
}

.header-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    height: 44px;
    padding: 0 18px;
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
        transform: translateY(-2px);
    }
}

.header-pill--light {
    color: #366f96;
    background: linear-gradient(180deg, rgba(245, 251, 255, 0.9), rgba(212, 234, 247, 0.95));
    box-shadow:
        inset 0 0 0 1px rgba(166, 209, 236, 0.9),
        0 8px 16px rgba(98, 149, 188, 0.12);
}

.header-pill--primary {
    color: #2f6489;
    background: linear-gradient(135deg, #fefefe, #ecf7ff 48%, #dcefff 100%);
    box-shadow:
        inset 0 0 0 1px rgba(166, 209, 236, 0.9),
        0 8px 18px rgba(98, 149, 188, 0.14);
}

.dm-badge {
    display: inline-flex;
}

.dm-menu-item {
    min-width: 260px;
    display: flex;
    align-items: center;
    gap: 12px;
}

.dm-menu-item img {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    object-fit: cover;
}

.dm-menu-item__meta {
    min-width: 0;
    flex: 1;
}

.dm-menu-item__name {
    color: #111827;
    font-weight: 600;
}

.dm-menu-item__time {
    margin-top: 4px;
    color: #6b7280;
    font-size: 12px;
}

.aside-icons {
    position: fixed;
    right: 18px;
    bottom: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    z-index: 20;
}

.mask {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.42);
    z-index: 98;
}

@keyframes drift {
    0% {
        transform: translate3d(0, 0, 0) scale(1);
    }

    100% {
        transform: translate3d(14px, 10px, 0) scale(1.08);
    }
}

@media screen and (max-width: 1040px) {
    .header-shell {
        grid-template-columns: auto 1fr auto;
    }

    .site-nav {
        display: none;
    }
}

@media screen and (max-width: 860px) {
    .base-layout__header {
        padding: 12px 12px 0;
    }

    .header-shell {
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 14px;
        padding: 16px;
    }

    .header-left,
    .header-right {
        justify-content: space-between;
    }

    .header-right {
        width: 100%;
        flex-wrap: wrap;
        gap: 10px;
    }

    .header-center {
        grid-column: 1 / -1;
        order: 3;
    }

    .header-right--guest {
        width: auto;
        justify-content: flex-end;
    }

    .base-layout__main {
        width: min(100vw - 20px, 100%);
        padding-top: 18px;
    }

    .logo-wrap img {
        height: 44px;
    }
}

@media screen and (max-width: 576px) {
    .base-layout__header {
        padding: 8px 8px 0;
    }

    .header-shell {
        gap: 12px;
        padding: 14px 12px;
        border-radius: 22px;
    }

    .header-left {
        gap: 10px;
    }

    .header-right {
        display: grid;
        width: 100%;
        grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr);
        align-items: center;
        gap: 8px;
    }

    .header-right--guest {
        display: flex;
        width: auto;
        grid-template-columns: none;
    }

    .header-right--guest .header-pill {
        width: auto;
        min-width: 78px;
    }

    .header-center {
        gap: 10px;
    }

    .header-pill {
        width: 100%;
        min-width: 0;
        padding: 0 12px;
        font-size: 13px;
    }

    .header-pill span {
        @include one-line-ellipsis;
    }

    .site-search {
        max-width: 100%;

        :deep(.ant-input),
        :deep(.ant-input-search-button) {
            height: 44px;
        }

        :deep(.ant-input) {
            padding-inline: 14px;
            font-size: 14px;
        }

        :deep(.ant-input-search-button) {
            padding-inline: 14px;
        }
    }

    .dm-menu-item {
        min-width: 220px;
    }

    .aside-icons {
        right: 12px;
        bottom: 12px;
    }

    .icon-button--floating {
        width: 46px;
        height: 46px;
    }
}

@media screen and (max-width: 420px) {
    .header-shell {
        padding: 12px 10px;
        border-radius: 20px;
    }

    .header-left {
        align-items: flex-start;
    }

    .logo-wrap img {
        height: 38px;
    }

    .icon-button--ghost,
    .icon-button--light {
        width: 42px;
        height: 42px;
        border-radius: 14px;
    }

    .header-right {
        grid-template-columns: 42px minmax(0, 1fr) minmax(0, 1fr);
    }

    .header-pill {
        height: 42px;
        padding: 0 10px;
        border-radius: 14px;
        gap: 6px;
        font-size: 12px;
    }

    .site-search {
        :deep(.ant-input-group) {
            border-radius: 16px;
        }

        :deep(.ant-input),
        :deep(.ant-input-search-button) {
            height: 42px;
        }

        :deep(.ant-input) {
            padding-inline: 12px;
            font-size: 13px;
        }

        :deep(.ant-input-search-button) {
            min-width: 52px;
            padding-inline: 12px;
        }
    }

    .search-button {
        gap: 0;
    }

    .search-button__text {
        display: none;
    }

    .base-layout__main {
        width: min(100vw - 12px, 100%);
        padding-top: 14px;
    }

    .aside-icons {
        right: 10px;
        bottom: 10px;
        gap: 10px;
    }
}
</style>
