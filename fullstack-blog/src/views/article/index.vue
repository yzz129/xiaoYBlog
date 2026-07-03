<template>
    <base-layout>
        <template #default>
            <a-skeleton :loading="loading" active avatar :paragraph="{ rows: 18 }">
                <article v-if="article" class="article-page">
                    <header class="article-header">
                        <router-link v-if="authorRoute" :to="authorRoute" class="author-link">
                            <img class="avatar" :src="authorAvatar" :alt="article.author" width="56" height="56" />
                        </router-link>
                        <img v-else class="avatar" :src="authorAvatar" :alt="article.author" width="56" height="56" />

                        <div class="article-infos">
                            <div class="author-row">
                                <router-link v-if="authorRoute" :to="authorRoute" class="author-link author-name">
                                    {{ article.author }}
                                </router-link>
                                <span v-else class="author-name">{{ article.author }}</span>
                                <sup class="role-tag">博主</sup>
                            </div>
                            <div class="meta-row">
                                <time>发布于 {{ formattedTime }}</time>
                                <span class="read-total">阅读 {{ article.read_num }}</span>
                            </div>
                        </div>
                    </header>

                    <main class="article-main">
                        <el-image :src="article.poster" class="article-poster" fit="cover" />
                        <h1 class="article-title">{{ article.article_name }}</h1>
                        <section class="md-preview" v-html="purifiedContent"></section>
                    </main>

                    <div class="copyright">
                        <p>
                            本文链接：<a :href="postLink">{{ postLink }}</a>
                            <br />
                            版权声明：本文由 <strong>{{ article.author }}</strong> 原创发布于 {{ formattedTime }}，转载请注明出处。
                        </p>
                    </div>

                    <div class="relation-info">
                        <div class="relation-row">
                            <span class="relation-label">分类：</span>
                            <router-link
                                v-for="item in article.categories"
                                :key="item.id"
                                :to="`/category/${item.categoryName}`"
                            >
                                <a-tag>{{ item.categoryName }}</a-tag>
                            </router-link>
                        </div>

                        <div class="relation-row">
                            <span class="relation-label">标签：</span>
                            <router-link v-for="item in article.tags" :key="item.id" :to="`/tag/${item.tagName}`">
                                <a-tag>{{ item.tagName }}</a-tag>
                            </router-link>
                        </div>
                    </div>

                    <div class="reward-wrapper">
                        <p class="reward-tips">你的支持会鼓励我继续创作。</p>
                        <a-button type="primary" @click="isRewardVisible = true">赞赏</a-button>
                    </div>
                </article>

                <a-empty v-else description="文章不存在或当前不可见" />
            </a-skeleton>

            <div class="pre-next-wrap">
                <div v-if="prevArticle" class="prev">
                    <SwapLeftOutlined />
                    <span>上一篇：</span>
                    <router-link :to="`/article/${prevArticle.id}`">
                        <span>{{ prevArticle.article_name }}</span>
                    </router-link>
                </div>
                <div v-if="nextArticle" class="next">
                    <SwapRightOutlined />
                    <span>下一篇：</span>
                    <router-link :to="`/article/${nextArticle.id}`">
                        <span>{{ nextArticle.article_name }}</span>
                    </router-link>
                </div>
            </div>

            <div class="comment-trigger">
                <a-button type="primary" @click="isCommentVisible = true">查看评论</a-button>
            </div>

            <a-modal v-model:open="isRewardVisible" :footer="null">
                <div class="reward-popup-wrapper">
                    <p class="reward-tips">感谢你的赞赏支持。</p>
                    <div class="reward-placeholder">赞赏码暂未配置</div>
                </div>
            </a-modal>

            <a-drawer :width="commentDrawerWidth" class="drawer-comment" :open="isCommentVisible" @close="isCommentVisible = false">
                <template #title>
                    <span>评论区</span>
                    <EditOutlined style="margin-left: 10px" @click="showUserInfoForm" />
                </template>

                <Comments ref="commentsRef" :article-id="articleId" />
            </a-drawer>
        </template>

        <template #aside>
            <icon-svg v-if="isAuthed" class="icon--aside" icon="edit" @click="goToEdit"></icon-svg>
            <icon-svg class="icon--aside icon-message" icon="leave-message" @click="isCommentVisible = true"></icon-svg>
        </template>
    </base-layout>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { EditOutlined, SwapLeftOutlined, SwapRightOutlined } from "@ant-design/icons-vue";
import { maxBy, minBy } from "lodash-es";

import type { ArticleDTO } from "@/bean/dto";
import { useAsyncLoading } from "@/hooks/async";
import { articleService } from "@/services/article";
import { useStore } from "@/stores";
import { resolveAvatar } from "@/utils/avatar";
import { format } from "@/utils/date-utils";
import { setScrollTop } from "@/utils/dom";

import Comments from "./comments.vue";

const store = useStore();
const route = useRoute();
const router = useRouter();

const isAuthed = computed(() => !!store.isAuthed);
const articleId = computed(() => Number(route.params.id));
const article = ref<ArticleDTO | null>(null);
const purifiedContent = ref("");
const prevArticle = ref<ArticleDTO | null>(null);
const nextArticle = ref<ArticleDTO | null>(null);
const isRewardVisible = ref(false);
const isCommentVisible = ref(false);
const commentsRef = ref();
const viewportWidth = ref(typeof window !== "undefined" ? window.innerWidth : 1280);

const formattedTime = computed(() => (article.value ? format(article.value.create_time, "YYYY年M月D日") : ""));
const authorAvatar = computed(() => resolveAvatar(article.value?.author_avatar));
const authorRoute = computed(() => (article.value?.author_user_id ? `/user/${article.value.author_user_id}` : ""));
const postLink = window.location.href;
const commentDrawerWidth = computed(() => {
    if (viewportWidth.value <= 480) return "100%";
    if (viewportWidth.value <= 767) return "94%";
    return "84%";
});

let reportTimer: number | null = null;
let cachedMarked: typeof import("marked").marked | null = null;
let cachedDOMPurify: import("dompurify").default | null = null;

async function loadMarkdownLibs() {
    if (cachedMarked && cachedDOMPurify) {
        return { marked: cachedMarked, DOMPurify: cachedDOMPurify };
    }

    const [markedMod, dompurifyMod, hljsMod, hljsCss, hljsJs, hljsHtml, hljsShell, hljsJson, hljsPlain] =
        await Promise.all([
            import("marked"),
            import("dompurify"),
            import("highlight.js/lib/core"),
            import("highlight.js/styles/atom-one-dark.css"),
            import("highlight.js/lib/languages/javascript"),
            import("highlight.js/lib/languages/xml"),
            import("highlight.js/lib/languages/css"),
            import("highlight.js/lib/languages/shell"),
            import("highlight.js/lib/languages/json"),
            import("highlight.js/lib/languages/plaintext"),
        ]);

    const hljs = hljsMod.default;
    hljs.registerLanguage("javascript", hljsJs.default);
    hljs.registerLanguage("html", hljsHtml.default);
    hljs.registerLanguage("css", hljsCss.default);
    hljs.registerLanguage("shell", hljsShell.default);
    hljs.registerLanguage("json", hljsJson.default);
    hljs.registerLanguage("plaintext", hljsPlain.default);

    const renderer = new markedMod.marked.Renderer();
    renderer.link = function customLink(href: string | null, title: string | null, text: string) {
        return `<a class="link" href="${href}" target="_blank" title="${title || text}" rel="nofollow noopener noreferrer">${text}</a>`;
    };
    renderer.image = function customImage(href: string | null, title: string | null, text: string) {
        return (
            `<a class="img-wrapper" href="${href}" target="_blank" rel="nofollow noopener noreferrer" title="${title || text}">` +
            `<img src="${href}" alt="${text}">` +
            "</a>"
        );
    };

    markedMod.marked.setOptions({
        renderer,
        highlight(code: string, lang: string) {
            const language = hljs.getLanguage(lang) ? lang : "plaintext";
            return hljs.highlight(code, { language }).value;
        },
        gfm: true,
        breaks: false,
    });

    cachedMarked = markedMod.marked;
    cachedDOMPurify = dompurifyMod.default;

    return { marked: cachedMarked, DOMPurify: cachedDOMPurify };
}

const clearReportTimer = () => {
    if (reportTimer) {
        clearTimeout(reportTimer);
        reportTimer = null;
    }
};

const startReportTimer = () => {
    clearReportTimer();
    reportTimer = window.setTimeout(() => {
        if (article.value?.id) {
            void articleService.updateReadNum(article.value.id);
        }
    }, 5000);
};

const getArticleDetail = async () => {
    const { marked, DOMPurify } = await loadMarkdownLibs();
    const res = await articleService.detail(articleId.value);
    article.value = res.data;
    purifiedContent.value = DOMPurify.sanitize(marked.parse((res.data as any).content || ""));
    startReportTimer();
};

const { trigger: getDetail, loading } = useAsyncLoading(getArticleDetail);

const getPreAndNextArticle = async () => {
    const res = await articleService.neighbors(articleId.value);
    const results = (res.data || []) as ArticleDTO[];

    if (results.length === 1) {
        const singleArticle = results[0];
        if (singleArticle.id < articleId.value) {
            prevArticle.value = singleArticle;
        } else {
            nextArticle.value = singleArticle;
        }
        return;
    }

    if (results.length >= 2) {
        prevArticle.value = minBy(results, "id") || null;
        nextArticle.value = maxBy(results, "id") || null;
    }
};

const showUserInfoForm = () => {
    if (commentsRef.value) {
        commentsRef.value.isEditUserInfoVisible = true;
    }
};

const goToEdit = () => {
    router.push(`/backend/article/edit/${articleId.value}`);
};

const onResize = () => {
    viewportWidth.value = window.innerWidth;
};

onMounted(() => {
    setScrollTop();
    window.addEventListener("resize", onResize, { passive: true });
    void getDetail();
    void getPreAndNextArticle();
});

onBeforeUnmount(() => {
    window.removeEventListener("resize", onResize);
    clearReportTimer();
});
</script>

<style lang="scss" scoped>
.article-page {
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.92);
    padding: 26px 20px;
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.1);
}

.article-header {
    display: flex;
    align-items: center;
    gap: 14px;
}

.avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(0, 0, 0, 0.08);
}

.author-link {
    display: inline-flex;
    align-items: center;
}

.article-infos {
    color: #64748b;
    font-size: 14px;
    min-width: 0;
}

.author-row {
    display: flex;
    align-items: center;
    gap: 8px;
}

.author-name {
    color: #10233d;
    font-size: 18px;
    font-weight: 800;
}

.meta-row {
    margin-top: 6px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px 12px;
}

.role-tag {
    background: #1989fa;
    padding: 0 6px;
    border-radius: 4px;
    color: #fff;
    font-size: 12px;
    line-height: 1.6;
}

.read-total {
    margin-left: 10px;
}

.article-main > .article-title {
    margin: 20px 0 0.8em;
    color: #10233d;
    font-size: clamp(2rem, 5vw, 2.8rem);
    font-weight: 800;
    line-height: 1.2;
}

.relation-info {
    padding-bottom: 26px;

    .ant-tag {
        cursor: pointer;
        border-radius: 999px;
        padding: 4px 10px;
        margin-bottom: 8px;
    }
}

.relation-row + .relation-row {
    margin-top: 18px;
}

.relation-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 8px;
}

.relation-label {
    margin-right: 6px;
    color: #475569;
    font-weight: 600;
}

:deep(.icon-svg + .icon-svg) {
    margin-left: 0;
}

:deep(.article-poster) {
    margin: 24px 0 20px;
    width: 100%;
    height: 220px;
    border-radius: 22px;
    transition: transform 0.2s ease-in-out;
    box-shadow: 0 16px 44px rgba(59, 130, 246, 0.16);

    &:hover {
        transform: scale(1.01);
    }
}

@keyframes pulse {
    0% {
        transform: scale(1);
    }

    100% {
        transform: scale(1.1);
    }
}

.anim-pulse {
    will-change: transform;
    animation: pulse 0.6s ease-in-out infinite alternate;
}

:deep(.icon-message > svg) {
    @extend .anim-pulse;
}

.copyright {
    padding: 20px 0;

    > p {
        padding: 14px 16px;
        color: $color-black;
        background: $color-bg--secondary;
        border-left: 6px solid $color-black;
        border-radius: 12px;
        line-height: 1.8;
    }

    strong {
        font-size: 18px;
        color: $color-primary;
        margin: 0 4px;
    }
}

.reward-wrapper {
    text-align: center;
    padding: 20px 0 8px;

    :deep(.ant-btn) {
        width: 52px;
        height: 52px;
        margin-top: 10px;
        font-size: 18px;
        font-weight: 600;
        border: 0;
        border-radius: 100%;
        line-height: 52px;
        text-align: center;
        padding: 0;
    }
}

.reward-tips {
    position: relative;
    color: $color-info;
    font-weight: 600;
    padding: 0 24px;

    &::before {
        content: "\201C";
        position: absolute;
        left: 0;
        bottom: 0;
        color: #392570;
        font-size: 45px;
    }

    &::after {
        content: "\201D";
        position: absolute;
        right: 0;
        top: 0;
        color: #392570;
        font-size: 45px;
    }
}

.pre-next-wrap {
    margin-top: 18px;
}

.prev,
.next {
    padding: 10px 12px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.prev + .next {
    margin-top: 16px;
}

.reward-popup-wrapper {
    padding: 50px 0 20px;
    text-align: center;
}

.reward-placeholder {
    margin-top: 20px;
    padding: 24px 16px;
    border: 1px dashed #d9d9d9;
    border-radius: 8px;
    color: #999;
}

.comment-trigger {
    text-align: center;
    margin-top: 36px;
}

:deep(.drawer-comment .ant-drawer-body) {
    padding: 0;
}

@media screen and (min-width: 576px) {
    :deep(.article-poster) {
        height: 320px;
    }
}

@media screen and (min-width: 1200px) {
    :deep(.base-layout__main) {
        width: 1000px;
    }

    :deep(.article-poster) {
        height: 420px;
    }
}

@media screen and (max-width: 767px) {
    .article-page {
        padding: 22px 14px;
        border-radius: 22px;
    }

    .article-header {
        align-items: flex-start;
    }

    .avatar {
        width: 48px;
        height: 48px;
    }

    .author-name {
        font-size: 16px;
    }

    .meta-row {
        gap: 4px 10px;
        font-size: 13px;
    }

    .read-total {
        margin-left: 0;
    }

    .article-main > .article-title {
        font-size: clamp(1.65rem, 9vw, 2rem);
    }

    .copyright > p {
        padding: 12px 14px;
    }

    .reward-wrapper {
        padding-top: 12px;
    }

    .comment-trigger {
        margin-top: 24px;
    }

    :deep(.article-poster) {
        height: 200px;
        border-radius: 18px;
    }
}

@media screen and (max-width: 480px) {
    .article-page {
        padding: 18px 12px 20px;
        border-radius: 20px;
    }

    .article-header {
        gap: 10px;
    }

    .avatar {
        width: 42px;
        height: 42px;
    }

    .author-row {
        gap: 6px;
        flex-wrap: wrap;
    }

    .author-name {
        font-size: 15px;
    }

    .role-tag {
        font-size: 11px;
    }

    .article-main > .article-title {
        margin-top: 16px;
        font-size: clamp(1.45rem, 8.2vw, 1.8rem);
        line-height: 1.25;
    }

    .relation-info {
        padding-bottom: 18px;
    }

    .relation-row {
        gap: 6px;
    }

    .relation-label {
        width: 100%;
        margin-right: 0;
    }

    :deep(.article-poster) {
        margin: 18px 0 16px;
        height: 170px;
        border-radius: 16px;
    }

    .prev,
    .next {
        padding: 10px;
        font-size: 13px;
    }

    .reward-wrapper :deep(.ant-btn) {
        width: 48px;
        height: 48px;
        line-height: 48px;
        font-size: 16px;
    }
}
</style>

<style lang="scss" scoped src="./md-render.scss"></style>
