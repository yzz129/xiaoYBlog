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
                        <img src="@/assets/img/logo.webp" alt="小Y博客" width="180" height="50" />
                    </router-link>
                </div>

                <div class="header-center">
                    <div class="site-badge">
                        <FireOutlined />
                        <span>博客分享交流平台</span>
                    </div>
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

                <div class="header-right">
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
    FireOutlined,
    HomeOutlined,
    MenuOutlined,
    MessageOutlined,
    SearchOutlined,
    UserOutlined,
} from "@ant-design/icons-vue";

import BaseFooter from "./base-footer.vue";
import BaseMenu from "./base-menu.vue";
import HotColumn from "./hot-column.vue";
import { useDmNotification } from "@/composables/use-dm-notification";
import { useStore } from "@/stores";
import { resolveAvatar } from "@/utils/avatar";
import { format } from "@/utils/date-utils";
import { setScrollTop } from "@/utils/dom";

const store = useStore();
const router = useRouter();
const route = useRoute();
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
        radial-gradient(circle at top left, rgba(34, 197, 94, 0.08), transparent 26%),
        radial-gradient(circle at top right, rgba(59, 130, 246, 0.12), transparent 24%),
        linear-gradient(180deg, #eff5fb 0%, #e8eef7 100%);
}

.base-layout__header {
    position: sticky;
    top: 0;
    z-index: 30;
    padding: 18px 20px 0;
    background: linear-gradient(180deg, rgba(242, 249, 255, 0.98) 0%, rgba(242, 249, 255, 0.78) 100%);
    backdrop-filter: blur(14px);
    will-change: transform;
    transform: translateZ(0);
}

.header-shell {
    position: relative;
    overflow: hidden;
    width: min(1240px, 100%);
    margin: 0 auto;
    padding: 18px 22px;
    border: 1px solid rgba(155, 205, 238, 0.78);
    border-radius: 28px;
    background:
        linear-gradient(135deg, rgba(217, 236, 251, 0.98) 0%, rgba(198, 226, 247, 0.99) 50%, rgba(185, 219, 241, 0.98) 100%);
    box-shadow:
        0 18px 34px rgba(98, 149, 188, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.82);
    display: grid;
    grid-template-columns: auto minmax(420px, 620px) auto;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
}

.header-glow {
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

.header-right {
    justify-content: flex-end;
}

.header-center {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
}

.site-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    align-self: center;
    padding: 6px 12px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(239, 248, 255, 0.92), rgba(205, 229, 246, 0.96));
    color: #3e7197;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    box-shadow: inset 0 0 0 1px rgba(159, 203, 233, 0.88);
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
    width: min(1240px, calc(100vw - 32px));
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
    height: 50px;
    filter: drop-shadow(0 8px 18px rgba(109, 163, 203, 0.18));
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
    border-radius: 16px;
    color: #336b93;
    background: linear-gradient(180deg, rgba(245, 251, 255, 0.88), rgba(210, 233, 247, 0.94));
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
    border-radius: 16px;
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
}

@media screen and (max-width: 860px) {
    .base-layout__header {
        padding: 12px 12px 0;
    }

    .header-shell {
        grid-template-columns: 1fr;
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
        order: 3;
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

    .header-center {
        gap: 10px;
    }

    .site-badge {
        max-width: 100%;
        padding: 6px 10px;
        font-size: 12px;
        letter-spacing: 0.02em;
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

    .site-badge {
        width: 100%;
        font-size: 11px;
        line-height: 1.4;
        text-align: center;
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
