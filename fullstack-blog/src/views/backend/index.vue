<template>
    <a-layout class="backend-layout">
        <a-layout-sider
            v-model:collapsed="menuState.collapsed"
            :trigger="null"
            collapsible
            breakpoint="lg"
            :width="244"
            :collapsed-width="72"
            class="backend-sider"
            @collapse="onSiderCollapse"
        >
            <div class="sider-brand">
                <span class="admin-brand__mascot" aria-hidden="true"><DoodleIcon name="mascot" /></span>
                <span class="admin-brand__text"><strong>小Y博客</strong><small>管理后台</small></span>
            </div>

            <a-menu
                v-model:openKeys="menuState.openKeys"
                theme="light"
                mode="inline"
                :selected-keys="selectedKeys"
                @click="onClickMenu"
            >
                <a-sub-menu v-for="sub in navs" :key="sub.key">
                    <template #title>
                        <span>
                            <DoodleIcon :name="backendIconFor(sub.key)" class="backend-nav-doodle" />
                            <span>{{ sub.title }}</span>
                        </span>
                    </template>
                    <a-menu-item v-for="child in sub.children" :key="child.key">
                        <DoodleIcon :name="backendIconFor(child.key)" class="backend-nav-doodle" />
                        {{ child.title }}
                    </a-menu-item>
                </a-sub-menu>
            </a-menu>

            <div class="sider-doodle" aria-hidden="true">
                <DoodleIcon name="cup" />
            </div>
        </a-layout-sider>

        <a-layout class="backend-shell">
            <a-layout-header class="right-header">
                <div class="header-left">
                    <button class="header-icon" type="button" aria-label="切换菜单" @click="toggleMenu">
                        <MenuUnfoldOutlined v-if="menuState.collapsed" />
                        <MenuFoldOutlined v-else />
                    </button>
                    <button class="header-icon" type="button" aria-label="返回首页" @click="goHome">
                        <HomeOutlined />
                    </button>
                    <strong class="backend-page-title">{{ currentPageTitle }}</strong>
                </div>

                <div class="header-actions">
                    <a-dropdown placement="bottomRight">
                        <a-badge :count="unreadTotal" :overflow-count="99">
                            <button class="header-icon header-icon--message" type="button" aria-label="私聊消息">
                                <MessageOutlined />
                            </button>
                        </a-badge>
                        <template #overlay>
                            <a-menu @click="onClickUnreadMenu">
                                <a-menu-item key="__all__">进入私聊</a-menu-item>
                                <a-menu-divider />
                                <a-menu-item v-if="!unreadConversations.length" key="__empty" disabled>
                                    暂无未读私聊
                                </a-menu-item>
                                <a-menu-item v-for="item in unreadConversations" :key="String(item.user_id)">
                                    <div class="dm-menu-item">
                                        <img :src="resolveAvatar(item.avatar)" :alt="item.nick_name" />
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

                    <div class="header-user">
                        <div class="header-user__meta">
                            <div class="header-user__name">{{ displayName }}</div>
                            <div class="header-user__role">{{ userRoleLabel }}</div>
                        </div>

                        <a-dropdown v-model:open="isDropdownVisible" placement="bottomRight">
                            <a-avatar class="admin-avatar" :src="userAvatar || undefined">
                                <template v-if="!userAvatar">{{ avatarText }}</template>
                            </a-avatar>

                            <template #overlay>
                                <a-menu @click="handleDropdownMenuClick">
                                    <a-menu-item key="profile">个人资料</a-menu-item>
                                    <a-menu-item key="write">开始创作</a-menu-item>
                                    <a-menu-item key="logout">退出登录</a-menu-item>
                                </a-menu>
                            </template>
                        </a-dropdown>
                    </div>
                </div>
            </a-layout-header>

            <a-layout-content class="right-main">
                <header class="backend-content-heading">
                    <h1>{{ currentPageTitle }}</h1>
                    <DoodleIcon name="plane" />
                </header>
                <router-view />
            </a-layout-content>
        </a-layout>
    </a-layout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { HomeOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MessageOutlined } from "@ant-design/icons-vue";

import { useDmNotification } from "@/composables/use-dm-notification";
import { useStore } from "@/stores";
import { resolveAvatar } from "@/utils/avatar";
import { format } from "@/utils/date-utils";
import { tree2Arr } from "@/utils/tree";

import { type NavItem, navs } from "./navs";
import DoodleIcon from "@/components/doodle-icon.vue";

interface MenuState {
    collapsed: boolean;
    openKeys: string[];
    preOpenKeys: string[];
}

const store = useStore();
const route = useRoute();
const router = useRouter();
const { unreadTotal, unreadConversations } = useDmNotification();
const flatNavs = tree2Arr<NavItem>(navs);

const calcOpenKeys = () => {
    const activeNav = flatNavs.find((item) => item.key === route.path);
    return activeNav?.parentKeys || [];
};

const initOpenKeys = calcOpenKeys();
const menuState = reactive<MenuState>({
    collapsed: false,
    openKeys: initOpenKeys,
    preOpenKeys: initOpenKeys,
});

const isDropdownVisible = ref(false);

const selectedKeys = computed(() => [route.path]);
const currentPageTitle = computed(() => flatNavs.find((item) => item.key === route.path)?.title || "管理后台");
const userInfo = computed(() => store.userInfo);
const displayName = computed(() => userInfo.value?.nick_name || userInfo.value?.user_name || "管理员");
const userAvatar = computed(() => userInfo.value?.avatar || "");
const avatarText = computed(() => displayName.value.slice(0, 1).toUpperCase());
const userRoleLabel = computed(() => (userInfo.value?.role_name === "admin" ? "管理员" : "普通用户"));

// 路由与现有导航结构不变，只把通用图标替换成概念图中的手绘笔触。
const backendIconFor = (key: string) => {
    if (key.includes("write")) return "pen" as const;
    if (key.includes("category") || key === "sub4") return "folder" as const;
    if (key.includes("tag") || key === "sub5") return "tag" as const;
    if (key.includes("msg") || key === "sub2") return "message" as const;
    if (key.includes("comment") || key === "sub3") return "message" as const;
    return "article" as const;
};

watch(
    () => menuState.openKeys,
    (_value, oldValue) => {
        menuState.preOpenKeys = oldValue;
    }
);

watch(
    () => route.path,
    () => {
        menuState.openKeys = calcOpenKeys();
    }
);

onMounted(() => {
    void store.fetchCurrent();
});

const toggleMenu = () => {
    menuState.collapsed = !menuState.collapsed;
    menuState.openKeys = menuState.collapsed ? [] : menuState.preOpenKeys;
};

const onSiderCollapse = (collapsed: boolean) => {
    menuState.collapsed = collapsed;
    menuState.openKeys = collapsed ? [] : menuState.preOpenKeys;
};

const onClickMenu = ({ key }: { key: string }) => {
    router.push(key);
};

const handleDropdownMenuClick = async ({ key }: { key: string }) => {
    switch (key) {
        case "profile":
            router.push("/backend/profile");
            break;
        case "write":
            router.push("/backend/write");
            break;
        case "logout":
            await store.logout();
            router.push("/");
            break;
    }
};

const onClickUnreadMenu = ({ key }: { key: string }) => {
    if (key === "__empty") {
        return;
    }

    if (key === "__all__") {
        router.push("/chat");
        return;
    }

    router.push(`/chat?mode=direct&userId=${key}`);
};

const goHome = () => {
    router.push("/");
};

const formatUnreadTime = (value: string) => format(new Date(value), "MM-dd HH:mm");
</script>

<style lang="scss" scoped>
.backend-layout {
    min-height: 100vh;
    background:
        radial-gradient(circle at top right, rgb(113 205 184 / 12%), transparent 30%),
        linear-gradient(180deg, #f4faff 0%, #edf6fc 100%);
}

.backend-sider {
    background: #fff;
    border-right: 1px solid var(--ui-line);
    box-shadow: 8px 0 28px rgb(63 111 151 / 8%);

    :deep(.ant-layout-sider-children) {
        display: flex;
        flex-direction: column;
    }

    :deep(.ant-menu-dark) {
        color: var(--ui-text);
        background: #fff;
    }

    :deep(.ant-menu-inline .ant-menu-item),
    :deep(.ant-menu-inline .ant-menu-submenu-title) {
        margin-inline: 10px;
        width: calc(100% - 20px);
        border-radius: 12px;
    }

    :deep(.ant-menu-dark .ant-menu-item-selected) {
        color: var(--ui-primary-strong);
        background: var(--ui-primary-soft);
        box-shadow: none;
    }

    :deep(.ant-menu-dark .ant-menu-submenu-title),
    :deep(.ant-menu-dark .ant-menu-item) {
        color: var(--ui-text);
    }

    :deep(.ant-menu-dark .ant-menu-submenu-title:hover),
    :deep(.ant-menu-dark .ant-menu-item:hover) {
        color: var(--ui-primary-strong);
        background: #f3f9fe;
    }
}

.sider-brand {
    padding: 18px 16px 12px;
    background: #fff;
    border-bottom: 1px solid var(--ui-line);
}

.logo {
    display: block;
    max-width: 84%;
    height: 38px;
    margin: 0 auto;
    padding: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
}

.backend-shell {
    min-width: 0;
}

.right-header {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 72px;
    padding: 0 18px;
    background: rgb(255 255 255 / 92%);
    backdrop-filter: blur(14px);
    border-bottom: 1px solid var(--ui-line);
    box-shadow: 0 10px 26px rgb(63 111 151 / 8%);
}

.header-left,
.header-actions,
.header-user {
    display: flex;
    align-items: center;
}

.header-left,
.header-actions {
    gap: 10px;
}

.header-icon {
    width: 42px;
    height: 42px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 12px;
    font-size: 18px;
    line-height: 1;
    color: #246693;
    background: linear-gradient(180deg, #ffffff, #edf7fd);
    box-shadow:
        inset 0 0 0 1px rgba(190, 223, 243, 0.86),
        0 10px 22px rgb(102 157 196 / 16%);
    cursor: pointer;
    transition: transform 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

    &:hover {
        color: #2b7aae;
        transform: translateY(-1px);
        box-shadow:
            inset 0 0 0 1px rgba(166, 214, 240, 0.92),
            0 14px 26px rgb(99 155 198 / 22%);
    }
}

.header-icon :deep(svg) {
    display: block;
}

.header-icon--message {
    color: #2f81bf;
}

.header-user {
    gap: 12px;
    padding-left: 6px;
}

.header-user__meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    line-height: 1.15;
}

.header-user__name {
    font-size: 15px;
    font-weight: 700;
    color: #1c5680;
}

.header-user__role {
    margin-top: 4px;
    font-size: 12px;
    color: #64748b;
}

.dm-menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 240px;

    img {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
    }
}

.dm-menu-item__meta {
    flex: 1;
    min-width: 0;
}

.dm-menu-item__name {
    color: #111827;
    font-weight: 600;
}

.dm-menu-item__time {
    color: #6b7280;
    font-size: 12px;
}

:deep(.admin-avatar) {
    color: #2f81bf;
    background: linear-gradient(180deg, #ffffff, #e5f4ff);
    box-shadow:
        inset 0 0 0 1px rgba(190, 223, 243, 0.82),
        0 10px 22px rgb(102 157 196 / 16%);
}

.right-main {
    padding: 20px;
    min-height: calc(100vh - 72px);
}

:deep(.admin-page-wrapper) {
    padding: 18px;
    background: rgb(255 255 255 / 92%);
    border: 1px solid rgb(226 232 240 / 80%);
    border-radius: 20px;
    box-shadow: 0 20px 42px rgb(15 23 42 / 8%);
}

@media screen and (max-width: 992px) {
    .right-header {
        height: 64px;
        padding: 0 14px;
    }

    .right-main {
        padding: 14px;
        min-height: calc(100vh - 64px);
    }

    :deep(.admin-page-wrapper) {
        padding: 14px;
        border-radius: 16px;
    }
}

@media screen and (max-width: 640px) {
    .right-header {
        gap: 10px;
        align-items: flex-start;
        flex-direction: column;
        height: auto;
        padding: 12px;
    }

    .header-left,
    .header-actions {
        width: 100%;
        justify-content: space-between;
    }

    .header-user {
        margin-left: auto;
    }

    .header-user__meta {
        display: none;
    }

    .dm-menu-item {
        min-width: 220px;
    }

    .right-main {
        padding: 12px;
    }
}
</style>
