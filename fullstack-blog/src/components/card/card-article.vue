<template>
    <article class="article-card" :class="{ 'article-card--featured': featured }">
        <section class="article-card__body">
            <router-link :to="`/article/${article.id}`" class="article-visual" :aria-label="article.article_name">
                <el-image v-if="featured" :src="coverSource" fit="cover" class="article-poster" lazy />
                <DoodleIcon v-else :name="illustrationName" class="article-doodle" />
                <span v-if="featured" class="featured-note">Featured</span>
            </router-link>
        </section>

        <header class="article-card__header">
            <span v-if="featured" class="article-pin">置顶</span>
            <router-link :to="`/article/${article.id}`" class="title-link">
                <h2 class="article-title">{{ article.article_name }}</h2>
            </router-link>
            <p class="article-summary">{{ article.summary }}</p>

            <div class="author-bar">
                <router-link v-if="authorRoute" :to="authorRoute" class="author-link">
                    <img class="author-avatar" :src="authorAvatar" :alt="article.author" width="28" height="28" />
                </router-link>
                <img v-else class="author-avatar" :src="authorAvatar" :alt="article.author" width="28" height="28" />
                <router-link v-if="authorRoute" :to="authorRoute" class="author-name">{{ article.author }}</router-link>
                <span v-else class="author-name">{{ article.author }}</span>
                <span class="meta-dot">·</span>
                <time>{{ createTime }}</time>
                <template v-if="article.categories?.length">
                    <span class="meta-dot">·</span>
                    <router-link
                        v-for="category in article.categories"
                        :key="category.id"
                        :to="{ name: 'Category', params: { name: category.categoryName } }"
                        class="category"
                    >
                        {{ category.categoryName }}
                    </router-link>
                </template>
            </div>
        </header>

        <div class="article-card__footer">
            <router-link class="read-more" :to="`/article/${article.id}`">
                <span>{{ featured ? "继续阅读" : article.tags?.[0]?.tagName ? `# ${article.tags[0].tagName}` : "阅读全文" }}</span>
                <span v-if="featured" aria-hidden="true">→</span>
            </router-link>
            <button v-if="!featured" class="bookmark-doodle" type="button" title="阅读文章" @click="$router.push(`/article/${article.id}`)">
                ♡
            </button>
        </div>
    </article>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { ArticleDTO } from "@/bean/dto";
import DoodleIcon from "@/components/doodle-icon.vue";
import EditorialDesk from "@/assets/illustrations/editorial-desk.webp";
import { resolveAvatar } from "@/utils/avatar";
import { format } from "@/utils/date-utils";

const props = withDefaults(
    defineProps<{
        article: ArticleDTO;
        featured?: boolean;
        visualIndex?: number;
    }>(),
    {
        featured: false,
        visualIndex: 0,
    }
);

const doodles = ["laptop", "api", "note", "browser", "cup"] as const;
const illustrationName = computed(() => doodles[Math.abs(props.visualIndex) % doodles.length]);
const coverSource = computed(() => props.article.poster || EditorialDesk);
const createTime = computed(() => format(props.article.create_time, "YYYY-MM-DD"));
const authorAvatar = computed(() => resolveAvatar(props.article.author_avatar));
const authorRoute = computed(() => (props.article.author_user_id ? `/user/${props.article.author_user_id}` : ""));
</script>

<style lang="scss" scoped>
.article-card {
    position: relative;
    display: grid;
    grid-template-columns: 164px minmax(0, 1fr) auto;
    gap: 22px;
    align-items: center;
    padding: 17px 0;
    border-bottom: 1px solid var(--xy-line);
}

.article-card__body,
.article-card__header {
    min-width: 0;
}

.article-visual {
    position: relative;
    display: grid;
    place-items: center;
}

.article-doodle {
    width: 118px;
    height: 78px;
}

.article-title {
    margin: 0;
    color: var(--xy-ink);
    font-size: 18px;
    font-weight: 900;
    line-height: 1.45;
}

.article-summary {
    margin: 6px 0 8px;
    overflow: hidden;
    color: var(--xy-text);
    font-size: 13px;
    line-height: 1.65;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.author-bar {
    display: flex;
    align-items: center;
    gap: 7px;
    color: var(--xy-muted);
    font-size: 12px;
}

.author-avatar {
    width: 24px;
    height: 24px;
    border: 1px solid var(--xy-line);
    border-radius: 50%;
    object-fit: cover;
}

.author-name,
.category {
    color: var(--xy-text);
}

.article-card__footer {
    display: flex;
    align-items: center;
    gap: 14px;
}

.read-more {
    color: var(--xy-blue);
    font-size: 12px;
    white-space: nowrap;
}

.bookmark-doodle {
    padding: 2px;
    color: var(--xy-ink);
    border: 0;
    background: transparent;
    font-size: 22px;
    cursor: pointer;
}

.article-card--featured {
    grid-template-columns: minmax(300px, 42%) minmax(0, 1fr);
    gap: 0;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--xy-line);
    border-radius: 0 0 16px 0;
    background: #fffefa;
    box-shadow: 7px 7px 0 rgb(22 50 79 / 8%);
}

.article-card--featured .article-poster {
    width: 100%;
    height: 224px;
}

.article-card--featured .article-card__header {
    padding: 24px 28px 22px;
}

.article-card--featured .article-title {
    margin-top: 8px;
    font-size: clamp(20px, 2vw, 26px);
}

.article-card--featured .article-summary {
    margin: 12px 0 18px;
    display: -webkit-box;
    white-space: normal;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}

.article-card--featured .article-card__footer {
    position: absolute;
    right: 28px;
    bottom: 22px;
}

.article-card--featured .read-more {
    display: flex;
    gap: 8px;
    color: var(--xy-coral);
    font-size: 14px;
    font-weight: 800;
}

.featured-note {
    position: absolute;
    top: 14px;
    left: 14px;
    padding: 6px 10px;
    color: var(--xy-ink);
    background: var(--xy-yellow);
    font-family: "Comic Sans MS", cursive;
    font-size: 12px;
    transform: rotate(-4deg);
}

.article-pin {
    display: inline-block;
    padding: 3px 7px;
    color: #fff;
    border-radius: 3px;
    background: var(--xy-coral);
    font-size: 11px;
}

@media (max-width: 700px) {
    .article-card {
        grid-template-columns: 88px minmax(0, 1fr);
        gap: 12px;
    }

    .article-doodle {
        width: 78px;
        height: 62px;
    }

    .article-summary,
    .article-card__footer {
        display: none;
    }

    .article-title {
        font-size: 15px;
    }

    .article-card--featured {
        display: block;
    }

    .article-card--featured .article-poster {
        height: 190px;
    }

    .article-card--featured .article-card__header {
        padding: 20px;
    }

    .article-card--featured .article-summary {
        display: -webkit-box;
    }
}
</style>
