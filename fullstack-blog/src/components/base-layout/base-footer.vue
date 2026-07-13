<template>
    <footer class="base-footer__wrapper">
        <div class="base-footer__inner">
            <div class="footer-brand">
                <strong>小Y博客</strong>
                <span>记录分享技术博客，聊天交流。</span>
            </div>
            <div class="footer-meta">
                <span>© 2026 小Y博客</span>
                <span>保持好奇，持续创造与分享。</span>
            </div>
        </div>
    </footer>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.base-footer__wrapper {
    margin-top: 48px;
    background: rgb(255 255 255 / 82%);
    color: var(--ui-text);
    border-top: 1px solid var(--ui-line);
}

.base-footer__inner {
    width: min(1180px, calc(100vw - 32px));
    margin: 0 auto;
    padding: 18px 0 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.footer-brand {
    display: flex;
    flex-direction: column;
    gap: 6px;

    strong {
        color: var(--ui-primary-strong);
        font-size: 16px;
        font-weight: 800;
    }

    span {
        color: var(--ui-muted);
        font-size: 13px;
    }
}

.footer-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 12px;
    color: var(--ui-muted);
    font-size: 13px;
}

@media screen and (max-width: 768px) {
    .base-footer__inner {
        width: min(100vw - 20px, 100%);
        padding: 16px 0 18px;
        flex-direction: column;
        align-items: flex-start;
    }

    .footer-meta {
        justify-content: flex-start;
    }
}
</style>
