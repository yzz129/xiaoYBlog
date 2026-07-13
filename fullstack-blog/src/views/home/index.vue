<template>
    <base-layout>
        <a-skeleton :loading="loading" active :paragraph="{ rows: 12 }">
            <template v-if="articleList.length > 0">
                <!-- 第一篇真实文章自动成为特写，标题、作者、封面和摘要仍全部来自接口。 -->
                <CardArticle :article="articleList[0]" featured />

                <section v-if="articleList.length > 1" class="latest-section">
                    <header class="section-hand-title">
                        <span class="section-title-icon"><DoodleIcon name="article" /></span>
                        <h2>最新文章</h2>
                    </header>
                    <div class="article-list">
                        <CardArticle
                            v-for="(article, index) in articleList.slice(1)"
                            :key="article.id"
                            :article="article"
                            :visual-index="index"
                        />
                    </div>
                </section>

                <a-pagination
                    class="pagination-common"
                    v-model:current="pageInfo.pageNo"
                    v-model:pageSize="pageInfo.pageSize"
                    :total="total"
                    show-less-items
                    simple
                    @change="onPageNoChange"
                />
            </template>

            <section v-else class="illustrated-empty">
                <img :src="EmptyMascot" alt="暂无内容" />
                <h2>这里还没有内容哦</h2>
                <p>发布文章后，它们会从接口自动出现在这里。</p>
            </section>
        </a-skeleton>
    </base-layout>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import type { LocationQuery } from "vue-router";
import { useRoute, useRouter } from "vue-router";

import type { ArticleDTO } from "@/bean/dto";
import CardArticle from "@/components/card/card-article.vue";
import DoodleIcon from "@/components/doodle-icon.vue";
import EmptyMascot from "@/assets/illustrations/empty-mascot.webp";
import { useAsyncLoading } from "@/hooks/async";
import { articleService } from "@/services/article";
import { setScrollTop } from "@/utils/dom";

const route = useRoute();
const router = useRouter();
const articleList = ref<ArticleDTO[]>([]);
const pageInfo = reactive({ pageNo: 1, pageSize: 6 });
const total = ref(0);

const handleGetArticleList = async (isChangePage: boolean) => {
    const res = await articleService.page(pageInfo);
    articleList.value = res.data || [];
    total.value = res.total || 0;
    if (isChangePage) {
        setScrollTop({ useAnimation: true, duration: 0.3 });
    }
};

const { trigger: getPageList, loading } = useAsyncLoading(handleGetArticleList);

watch(
    () => route.query,
    (value: LocationQuery, oldValue) => {
        pageInfo.pageNo = value.pageNo ? Number(value.pageNo) : 1;
        getPageList(value.pageNo !== oldValue?.pageNo);
    },
    { immediate: true }
);

const onPageNoChange = (page: number) => {
    router.push({ query: { pageNo: String(page) } });
};
</script>

<style lang="scss" scoped>
.latest-section {
    margin-top: 34px;
}

.section-hand-title {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 4px;
}

.section-title-icon {
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    color: #24b889;
    border: 2px solid var(--xy-mint);
    border-radius: 5px;
    transform: rotate(-3deg);
}

.section-title-icon :deep(svg) {
    width: 18px;
    height: 18px;
}

.section-hand-title h2 {
    margin: 0;
    color: var(--xy-ink);
    font-size: 20px;
    font-weight: 950;
    text-decoration: underline wavy var(--xy-mint) 2px;
    text-underline-offset: 8px;
}

.illustrated-empty {
    min-height: 410px;
    display: grid;
    place-items: center;
    align-content: center;
    padding: 32px;
    border: 1px dashed #cbdbe5;
    border-radius: 14px;
    text-align: center;
}

.illustrated-empty img {
    width: min(250px, 72vw);
}

.illustrated-empty h2 {
    margin: -14px 0 4px;
    font-size: 18px;
}

.illustrated-empty p {
    margin: 0;
    color: var(--xy-muted);
    font-size: 13px;
}
</style>
