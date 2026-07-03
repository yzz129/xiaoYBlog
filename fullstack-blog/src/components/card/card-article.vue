<template>
    <article class="article-card">
        <header class="article-card__header">
            <div class="author-bar">
                <router-link v-if="authorRoute" :to="authorRoute" class="author-link">
                    <img class="author-avatar" :src="authorAvatar" :alt="article.author" width="52" height="52" />
                </router-link>
                <img v-else class="author-avatar" :src="authorAvatar" :alt="article.author" width="52" height="52" />

                <div class="author-meta">
                    <div class="author-row">
                        <router-link v-if="authorRoute" :to="authorRoute" class="author-link author-name">
                            {{ article.author }}
                        </router-link>
                        <span v-else class="author-name">{{ article.author }}</span>
                    </div>

                    <ul class="article-infolist">
                        <li title="发布时间">
                            <icon-svg class="align-middle" icon="time" />
                            <time class="align-middle">{{ createTime }}</time>
                        </li>
                        <li title="文章分类">
                            <icon-svg class="align-middle" icon="folder" />
                            <router-link
                                v-for="category in article.categories"
                                :key="category.id"
                                :to="{ name: 'Category', params: { name: category.categoryName } }"
                                class="category align-middle"
                            >
                                <span>{{ category.categoryName }}</span>
                            </router-link>
                        </li>
                        <li title="阅读量">
                            <icon-svg class="align-middle" icon="eye" />
                            <span class="align-middle">{{ article.read_num }}</span>
                        </li>
                    </ul>
                </div>
            </div>

            <router-link :to="`/article/${article.id}`" class="title-link">
                <h2 class="article-title">{{ article.article_name }}</h2>
            </router-link>
        </header>

        <section class="article-card__body">
            <router-link :to="`/article/${article.id}`">
                <el-image :src="article.poster" fit="cover" class="article-poster" lazy />
            </router-link>
            <p class="article-summary">{{ article.summary }}</p>
        </section>

        <div class="article-card__footer">
            <router-link class="read-more" :to="`/article/${article.id}`">
                <span class="read-more-text">继续阅读</span>
                <icon-svg icon="read" class="align-middle" />
            </router-link>
        </div>
    </article>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { ArticleDTO } from "@/bean/dto";
import { resolveAvatar } from "@/utils/avatar";
import { format } from "@/utils/date-utils";

const props = defineProps<{
    article: ArticleDTO;
}>();

const createTime = computed(() => format(props.article.create_time, "YYYY年M月D日"));
const authorAvatar = computed(() => resolveAvatar(props.article.author_avatar));
const authorRoute = computed(() => (props.article.author_user_id ? `/user/${props.article.author_user_id}` : ""));
</script>

<style lang="scss" scoped>
.article-card {
    padding: 26px 28px 30px;
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.9);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
    border: 1px solid rgba(226, 232, 240, 0.8);

    + .article-card {
        margin-top: 28px;
    }
}

.article-card__header {
    color: #64748b;
}

.author-bar {
    display: flex;
    align-items: center;
    gap: 14px;
}

.author-link {
    display: inline-flex;
    align-items: center;
}

.author-avatar {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(15, 23, 42, 0.08);
}

.author-meta {
    flex: 1;
    min-width: 0;
}

.author-row {
    margin-bottom: 6px;
}

.author-name {
    color: #0f172a;
    font-size: 18px;
    font-weight: 800;
}

.article-infolist {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    font-size: 13px;

    > li {
        display: inline-flex;
        align-items: center;
    }
}

.category + .category::before {
    content: ", ";
}

.icon-svg {
    margin-right: 4px;
}

.title-link {
    display: block;
}

.article-title {
    margin: 18px 0 0;
    color: #0f172a;
    font-size: clamp(1.8rem, 3vw, 2.5rem);
    font-weight: 800;
    line-height: 1.2;
}

.article-card__body {
    margin-top: 18px;
}

.article-summary {
    margin: 18px 0 0;
    font-size: 16px;
    color: #334155;
    line-height: 1.9;
}

:deep(.article-poster) {
    width: 100%;
    height: 360px;
    overflow: hidden;
    border-radius: 24px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.article-card__footer {
    margin-top: 22px;
}

.read-more {
    display: inline-flex;
    align-items: center;
    padding: 10px 14px;
    border-radius: 999px;
    background: #edf4ff;
    color: #1d4ed8;
    font-weight: 700;
}

.read-more-text {
    margin-right: 6px;
    font-size: 15px;
}

@media screen and (max-width: 767px) {
    .article-card {
        padding: 18px 16px 22px;
        border-radius: 22px;
    }

    .author-bar {
        align-items: flex-start;
        gap: 12px;
    }

    .author-avatar {
        width: 44px;
        height: 44px;
    }

    .author-name {
        font-size: 16px;
    }

    .article-infolist {
        gap: 10px 12px;
        font-size: 12px;
    }

    .article-title {
        margin-top: 14px;
        font-size: 1.65rem;
    }

    :deep(.article-poster) {
        height: 220px;
        border-radius: 18px;
    }

    .article-summary {
        font-size: 15px;
    }
}

@media screen and (max-width: 480px) {
    .article-card {
        padding: 16px 14px 20px;
        border-radius: 20px;

        + .article-card {
            margin-top: 20px;
        }
    }

    .author-bar {
        gap: 10px;
    }

    .author-avatar {
        width: 40px;
        height: 40px;
    }

    .author-row {
        margin-bottom: 4px;
    }

    .author-name {
        font-size: 15px;
    }

    .article-infolist {
        gap: 8px 10px;
    }

    .article-title {
        margin-top: 12px;
        font-size: 1.45rem;
        line-height: 1.28;
    }

    .article-card__body {
        margin-top: 14px;
    }

    :deep(.article-poster) {
        height: 180px;
        border-radius: 16px;
    }

    .article-summary {
        margin-top: 14px;
        font-size: 14px;
        line-height: 1.8;
    }

    .article-card__footer {
        margin-top: 18px;
    }

    .read-more {
        padding: 9px 12px;
    }

    .read-more-text {
        font-size: 14px;
    }
}
</style>
