<template>
    <section class="card-hot" :aria-busy="loading">
        <header class="hot-heading">
            <span class="hot-flame" aria-hidden="true">♨</span>
            <h2>热门推荐</h2>
            <span class="hot-star" aria-hidden="true">☆</span>
        </header>

        <a-skeleton :loading="loading" active :paragraph="{ rows: 6 }">
            <ol v-if="hotList.length > 0" class="hot-list">
                <li v-for="(article, index) in hotList" :key="article.id">
                    <router-link :to="`/article/${article.id}`">
                        <span class="hot-rank">{{ String(index + 1).padStart(2, "0") }}</span>
                        <span class="hot-title" :title="article.article_name">{{ article.article_name }}</span>
                    </router-link>
                </li>
            </ol>

            <div v-else class="hot-empty">
                <img :src="EmptyMascot" alt="暂无热门文章" />
                <span>暂无热门文章</span>
            </div>
        </a-skeleton>
    </section>
</template>

<script setup lang="ts">
import { ref } from "vue";

import type { ArticleDTO } from "@/bean/dto";
import EmptyMascot from "@/assets/illustrations/empty-mascot.webp";
import { useAsyncLoading } from "@/hooks/async";
import { articleService } from "@/services/article";

const hotList = ref<ArticleDTO[]>([]);

const handleGetHotList = async () => {
    const res = await articleService.topRead({ count: 8 });
    hotList.value = res.data || [];
};

const { trigger: getHotList, loading } = useAsyncLoading(handleGetHotList);
getHotList();
</script>

<style lang="scss" scoped>
.card-hot {
    min-width: 0;
}

.hot-heading {
    position: relative;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 11px 0 13px;
    border-bottom: 1px solid var(--xy-line);
}

.hot-heading h2 {
    margin: 0;
    color: var(--xy-ink);
    font-size: 18px;
    font-weight: 950;
    text-decoration: underline wavy var(--xy-coral) 2px;
    text-underline-offset: 8px;
}

.hot-flame {
    color: var(--xy-coral);
    font-size: 23px;
}

.hot-star {
    position: absolute;
    right: 2px;
    top: 2px;
    color: var(--xy-ink);
    font-size: 28px;
    transform: rotate(12deg);
}

.hot-list {
    margin: 0;
    padding: 0;
    list-style: none;
}

.hot-list li {
    border-bottom: 1px solid var(--xy-line);
}

.hot-list a {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 13px 0;
}

.hot-rank {
    color: var(--xy-muted);
    font-size: 14px;
    font-weight: 900;
}

.hot-list li:nth-child(1) .hot-rank {
    color: var(--xy-coral);
}

.hot-list li:nth-child(2) .hot-rank {
    color: #e4a900;
}

.hot-title {
    overflow: hidden;
    color: var(--xy-ink);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.hot-list a:hover .hot-title {
    color: #169c75;
}

.hot-empty {
    min-height: 280px;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 4px;
    margin-top: 34px;
    border: 1px dashed var(--xy-line);
    border-radius: 12px;
    color: var(--xy-muted);
    font-size: 12px;
}

.hot-empty img {
    width: 150px;
}
</style>
