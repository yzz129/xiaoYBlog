<template>
    <base-layout>
        <PageHeading :title="String($route.params.name || '文章分类')" description="这个分类下的全部公开文章。" icon="folder" />

        <a-skeleton :loading="loading" active :paragraph="{ rows: 12 }">
            <template v-if="articleList.length > 0">
                <section class="article-list">
                    <card-article v-for="article in articleList" :key="article.id" :article="article" />
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

            <template v-else>
                <IllustratedEmpty title="这个分类暂时没有文章" description="新文章发布后会自动出现在这里。" />
            </template>
        </a-skeleton>
    </base-layout>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from "vue";

import { LocationQuery, useRoute, useRouter } from "vue-router";

import { Breadcrumb, Divider, Pagination } from "ant-design-vue";

import { ArticleDTO } from "@/bean/dto";

import { articleService } from "@/services/article";

import { useAsyncLoading } from "@/hooks/async";

import CardArticle from "@/components/card/card-article.vue";
import IllustratedEmpty from "@/components/illustrated-empty.vue";
import PageHeading from "@/components/page-heading.vue";

import { setScrollTop } from "@/utils/dom";

const route = useRoute();

const router = useRouter();

const articleList = ref<ArticleDTO[]>([]);

const pageInfo = reactive({
            pageNo: 1,
            pageSize: 6,
        });

const total = ref(0);

const handleGetArticleList = async (isChangePage: boolean) => {
            const res = await articleService.pageByCategory({
                ...pageInfo,
                keyword: route.params.name as string,
            });
            articleList.value = res.data;
            total.value = res.total;
            setScrollTop({
                useAnimation: isChangePage,
                duration: 0.3,
            });
        };

const { trigger: getPageList, loading } = useAsyncLoading(handleGetArticleList);

watch(
            () => route.query,
            (val: LocationQuery, oldVal) => {
                const { pageNo } = val;
                if (pageNo) {
                    pageInfo.pageNo = Number(pageNo);
                } else {
                    pageInfo.pageNo = 1;
                }
                const isChangePage = pageNo !== oldVal?.pageNo;
                getPageList(isChangePage);
            },
            {
                immediate: true,
            }
        );

const onPageNoChange = (page: number) => {
            router.push({ query: { pageNo: String(page) } });
        };
</script>
