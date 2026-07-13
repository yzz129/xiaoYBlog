<template>
    <base-layout>
        <PageHeading title="时间轴" description="沿着日期，回看每一篇真实发布的文章。" icon="clock" />

        <a-skeleton :loading="loading" active :paragraph="{ rows: 8 }">
            <ol v-if="articleList.length > 0" class="timeline-index">
                <li v-for="(article, index) in articleList" :key="article.id">
                    <time>{{ article.formattedCreateTime }}</time>
                    <span class="timeline-index__dot" :class="`timeline-index__dot--${index % 4}`" />
                    <router-link :to="`/article/${article.id}`" class="timeline-index__article">
                        <DoodleIcon :name="timelineDoodles[index % timelineDoodles.length]" />
                        <span>
                            <strong>{{ article.article_name }}</strong>
                            <small>
                                {{ article.categories?.map((category) => category.categoryName).join(" · ") || "未分类" }}
                            </small>
                        </span>
                        <span class="timeline-index__arrow">→</span>
                    </router-link>
                </li>
            </ol>

            <IllustratedEmpty v-else-if="!loading" title="时间轴还是空的" description="发布文章后，时间会替你把它们排列好。" />
        </a-skeleton>

        <bottom-tips v-if="articleList.length">
            <a-button type="primary" @click="loadMore" v-if="articleList.length < total">加载更多</a-button>
            <span v-else>已经看到全部文章啦</span>
        </bottom-tips>
    </base-layout>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";

import type { ArticleDTO } from "@/bean/dto";
import BottomTips from "@/components/bottom-tips/index.vue";
import DoodleIcon from "@/components/doodle-icon.vue";
import IllustratedEmpty from "@/components/illustrated-empty.vue";
import PageHeading from "@/components/page-heading.vue";
import { useAsyncLoading } from "@/hooks/async";
import { articleService } from "@/services/article";
import { format } from "@/utils/date-utils";

const timelineDoodles = ["laptop", "api", "note", "browser", "cup"] as const;
const articleList = ref<Array<ArticleDTO & { formattedCreateTime: string }>>([]);
const pageInfo = reactive({ pageNo: 1, pageSize: 6 });
const total = ref(0);

const handleGetArticleList = async (isLoadMore = false) => {
    const res = await articleService.page(pageInfo);
    const mappedData = (res.data || []).map((item) => ({ ...item, formattedCreateTime: format(item.create_time, "YYYY年MM月DD日") }));
    articleList.value = isLoadMore ? [...articleList.value, ...mappedData] : mappedData;
    total.value = res.total || 0;
};

const { trigger: getPageList, loading } = useAsyncLoading(handleGetArticleList);
getPageList();

const loadMore = () => {
    if (articleList.value.length < total.value) {
        pageInfo.pageNo += 1;
        getPageList(true);
    }
};
</script>

<style scoped>
.timeline-index {
    margin: 0;
    padding: 0;
    list-style: none;
}

.timeline-index li {
    display: grid;
    grid-template-columns: 145px 22px minmax(0, 1fr);
    gap: 14px;
    min-height: 112px;
}

.timeline-index time {
    padding-top: 26px;
    color: var(--xy-muted);
    font-size: 13px;
    text-align: right;
}

.timeline-index__dot {
    position: relative;
    margin-top: 30px;
    width: 12px;
    height: 12px;
    border: 2px solid var(--xy-ink);
    border-radius: 50%;
    background: var(--xy-mint);
}

.timeline-index__dot::after {
    content: "";
    position: absolute;
    top: 12px;
    left: 3px;
    width: 2px;
    height: 82px;
    background: var(--xy-line);
}

.timeline-index li:last-child .timeline-index__dot::after { display: none; }
.timeline-index__dot--1 { background: var(--xy-yellow); }
.timeline-index__dot--2 { background: var(--xy-blue); }
.timeline-index__dot--3 { background: var(--xy-coral); }

.timeline-index__article {
    display: grid;
    grid-template-columns: 78px minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    min-height: 92px;
    padding: 12px 8px;
    border-bottom: 1px solid var(--xy-line);
}

.timeline-index__article:hover {
    background: var(--xy-yellow-soft);
}

.timeline-index__article :deep(svg) {
    width: 70px;
    height: 60px;
}

.timeline-index__article span:not(.timeline-index__arrow) {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.timeline-index__article strong { color: var(--xy-ink); font-size: 17px; }
.timeline-index__article small { color: var(--xy-muted); }
.timeline-index__arrow { color: var(--xy-coral); font-size: 22px; }

@media (max-width: 700px) {
    .timeline-index li {
        grid-template-columns: 12px minmax(0, 1fr);
        gap: 10px;
    }

    .timeline-index time { display: none; }
    .timeline-index__article { grid-template-columns: 60px minmax(0, 1fr); }
    .timeline-index__article :deep(svg) { width: 55px; height: 50px; }
    .timeline-index__arrow { display: none; }
}
</style>
