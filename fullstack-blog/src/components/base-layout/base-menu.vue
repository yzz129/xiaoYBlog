<template>
    <section class="base-menu" :class="{ 'is-visible': isVisible }">
        <div class="menu-bg menu-bg--top"></div>
        <div class="menu-bg menu-bg--bottom"></div>

        <ul class="menu__list">
            <li class="menu__header">
                <div class="menu__brand">
                    <CrownOutlined />
                    <h2>小Y博客</h2>
                </div>
                <div class="avatar-wrap">
                    <div class="avatar-ring avatar-ring--outer"></div>
                    <div class="avatar-ring avatar-ring--inner"></div>
                    <img class="avatar" :src="menuAvatar" alt="avatar" width="96" height="96" />
                </div>
            </li>

            <li class="menu__item">
                <router-link to="/">
                    <HomeOutlined />
                    <span>首页</span>
                    <RightOutlined class="menu__arrow" />
                </router-link>
            </li>
            <li class="menu__item">
                <router-link to="/categories">
                    <FolderOpenOutlined />
                    <span>分类</span>
                    <RightOutlined class="menu__arrow" />
                </router-link>
            </li>
            <li class="menu__item">
                <router-link to="/tags">
                    <TagsOutlined />
                    <span>标签</span>
                    <RightOutlined class="menu__arrow" />
                </router-link>
            </li>
            <li class="menu__item">
                <router-link to="/timeline">
                    <HistoryOutlined />
                    <span>时间轴</span>
                    <RightOutlined class="menu__arrow" />
                </router-link>
            </li>
            <li class="menu__item">
                <router-link to="/messages">
                    <MessageOutlined />
                    <span>留言</span>
                    <RightOutlined class="menu__arrow" />
                </router-link>
            </li>
            <li class="menu__item">
                <router-link to="/chat">
                    <CommentOutlined />
                    <span>在线交流</span>
                    <RightOutlined class="menu__arrow" />
                </router-link>
            </li>
        </ul>
    </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import {
    CommentOutlined,
    CrownOutlined,
    FolderOpenOutlined,
    HistoryOutlined,
    HomeOutlined,
    MessageOutlined,
    RightOutlined,
    TagsOutlined,
} from "@ant-design/icons-vue";

import { useStore } from "@/stores";
import { resolveAvatar } from "@/utils/avatar";

defineProps({
    isVisible: {
        type: Boolean,
        default: false,
    },
});

const store = useStore();
const menuAvatar = computed(() => resolveAvatar(store.userInfo?.avatar));
</script>

<style lang="scss" scoped>
.base-menu {
    position: fixed;
    top: 0;
    left: 0;
    z-index: 99;
    overflow: hidden;
    width: 276px;
    max-width: calc(100vw - 30px);
    height: 100vh;
    background: linear-gradient(180deg, #071a2d 0%, #0e2b45 42%, #174866 100%);
    transform: translate3d(-100%, 0, 0);
    transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.24s ease;

    &.is-visible {
        transform: translate3d(0, 0, 0);
        box-shadow: 0 28px 48px rgba(15, 23, 42, 0.34);
    }
}

.menu-bg {
    position: absolute;
    border-radius: 50%;
    filter: blur(6px);
    pointer-events: none;
    opacity: 0.8;
    will-change: transform;
    animation: menuFloat 9s ease-in-out infinite alternate;
}

.menu-bg--top {
    top: -44px;
    left: -34px;
    width: 180px;
    height: 180px;
    background: radial-gradient(circle, rgba(122, 216, 255, 0.24), transparent 72%);
}

.menu-bg--bottom {
    right: -60px;
    bottom: -40px;
    width: 210px;
    height: 210px;
    background: radial-gradient(circle, rgba(88, 220, 208, 0.22), transparent 74%);
    animation-delay: 1.4s;
}

.menu__list {
    position: relative;
    z-index: 1;
    height: 100%;
    padding: 0;
    margin: 0;
    list-style: none;
}

.menu__header {
    padding: 24px 22px 18px;
    background: linear-gradient(180deg, rgba(241, 250, 255, 0.06), rgba(255, 255, 255, 0.02));
    border-bottom: 1px solid rgba(174, 223, 245, 0.1);
    text-align: center;
}

.menu__brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
    color: #edf8ff;
    text-shadow: 0 2px 10px rgba(84, 193, 225, 0.24);

    h2 {
        margin: 0;
        font-size: 26px;
        font-weight: 800;
        letter-spacing: 0.04em;
    }
}

.avatar-wrap {
    position: relative;
    width: 96px;
    height: 96px;
    margin: 0 auto;
}

.avatar-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
}

.avatar-ring--outer {
    inset: -7px;
    border: 1px solid rgba(142, 220, 236, 0.32);
    animation: pulseRing 2.8s ease-in-out infinite;
}

.avatar-ring--inner {
    inset: -13px;
    background: radial-gradient(circle, rgba(138, 215, 248, 0.18), transparent 70%);
}

.avatar {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(255, 255, 255, 0.14);
    box-shadow: 0 12px 24px rgba(0, 0, 0, 0.18);
}

.menu__item {
    padding: 0 12px;
    margin-top: 6px;
    font-size: 15px;

    > a {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 14px;
        min-height: 48px;
        color: #d4dde7;
        border-radius: 14px;
        transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;

        .menu__arrow {
            margin-left: auto;
            font-size: 12px;
            opacity: 0.5;
            transition: transform 0.2s ease, opacity 0.2s ease;
        }

        &.router-link-active {
            background: linear-gradient(135deg, #2a74ba, #58c4c0);
            color: #fff;
            box-shadow: 0 14px 28px rgba(22, 83, 132, 0.28);
        }
    }

    &:hover > a {
        transform: translateX(4px);
        background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(132, 209, 230, 0.07));
        color: #fff;

        .menu__arrow {
            transform: translateX(2px);
            opacity: 1;
        }
    }
}

@keyframes pulseRing {
    0%,
    100% {
        transform: scale(1);
        opacity: 0.6;
    }

    50% {
        transform: scale(1.04);
        opacity: 1;
    }
}

@keyframes menuFloat {
    0% {
        transform: translate3d(0, 0, 0);
    }

    100% {
        transform: translate3d(10px, 12px, 0);
    }
}

@media screen and (max-width: 576px) {
    .base-menu {
        width: 250px;
        max-width: calc(100vw - 24px);
    }

    .menu__header {
        padding: 20px 18px 18px;
    }

    .menu__brand h2 {
        font-size: 22px;
    }

    .avatar-wrap {
        width: 88px;
        height: 88px;
    }
}
</style>
