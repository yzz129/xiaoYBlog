<template>
    <footer class="base-footer__wrapper">
        <div class="base-footer__inner">
            <div class="footer-brand">
                <strong>小Y博客</strong>
                <span>记录分享技术博客，聊天交流。</span>
            </div>
            <div class="footer-meta">
                <span>Built with Vue 3 + Express</span>
                <span>Mobile Ready</span>
            </div>
        </div>
    </footer>
</template>

<script setup lang="ts"></script>

<style lang="scss" scoped>
.base-footer__wrapper {
    margin-top: 32px;
    background: #0d1b28;
    color: #d6dbe1;
    border-top: 1px solid rgb(255 255 255 / 6%);
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
        color: #fff8d6;
        font-size: 16px;
        font-weight: 800;
    }

    span {
        color: #9fb0bf;
        font-size: 13px;
    }
}

.footer-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 12px;
    color: #9fb0bf;
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
