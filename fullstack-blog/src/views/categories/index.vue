<template>
    <base-layout>
        <PageHeading title="文章分类" description="按主题整理每一次思考与记录。" icon="folder" />

        <a-skeleton :loading="loading" active :paragraph="{ rows: 10 }">
            <section v-if="categoryList.length > 0" class="category-index">
                <router-link
                    v-for="(category, index) in categoryList"
                    :key="category.id"
                    :to="{ name: 'Category', params: { name: category.category_name } }"
                    class="category-index__item"
                >
                    <span class="category-index__art" :class="`category-index__art--${index % 4}`">
                        <DoodleIcon name="folder" />
                    </span>
                    <span class="category-index__copy">
                        <strong>{{ category.category_name }}</strong>
                        <small>{{ category.category_count || 0 }} 篇文章</small>
                    </span>
                    <span class="category-index__arrow" aria-hidden="true">→</span>
                </router-link>
            </section>

            <IllustratedEmpty v-else title="还没有文章分类" description="创建分类后会自动显示在这里。" />
        </a-skeleton>
    </base-layout>
</template>

<script setup lang="ts">
import { ref } from "vue";

import type { CategoryDTO } from "@/bean/dto";
import DoodleIcon from "@/components/doodle-icon.vue";
import IllustratedEmpty from "@/components/illustrated-empty.vue";
import PageHeading from "@/components/page-heading.vue";
import { useAsyncLoading } from "@/hooks/async";
import { categoryService } from "@/services/category";

const categoryList = ref<CategoryDTO[]>([]);

const handleGetAllCategory = async () => {
    const res = await categoryService.all({ getCount: true });
    categoryList.value = res.data || [];
};

const { trigger: getCategoryList, loading } = useAsyncLoading(handleGetAllCategory);
getCategoryList();
</script>

<style scoped>
.category-index {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    border-top: 1px solid var(--xy-line);
}

.category-index__item {
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr) auto;
    gap: 18px;
    align-items: center;
    min-height: 128px;
    padding: 20px;
    border-right: 1px solid var(--xy-line);
    border-bottom: 1px solid var(--xy-line);
    transition: background var(--xy-ease), transform var(--xy-ease);
}

.category-index__item:nth-child(2n) {
    border-right: 0;
}

.category-index__item:hover {
    background: var(--xy-yellow-soft);
    transform: translateY(-2px);
}

.category-index__art {
    width: 76px;
    height: 76px;
    display: grid;
    place-items: center;
    color: var(--xy-ink);
    border: 1px solid var(--xy-line);
    border-radius: 48% 52% 46% 54%;
    background: var(--xy-mint-soft);
    transform: rotate(-3deg);
}

.category-index__art :deep(svg) {
    width: 52px;
    height: 52px;
}

.category-index__art--1 { background: var(--xy-yellow-soft); }
.category-index__art--2 { background: var(--xy-blue-soft); }
.category-index__art--3 { background: var(--xy-coral-soft); }

.category-index__copy {
    display: flex;
    flex-direction: column;
    gap: 7px;
}

.category-index__copy strong {
    color: var(--xy-ink);
    font-size: 18px;
}

.category-index__copy small {
    color: var(--xy-muted);
}

.category-index__arrow {
    color: var(--xy-coral);
    font-size: 22px;
}

@media (max-width: 700px) {
    .category-index {
        grid-template-columns: 1fr;
    }

    .category-index__item,
    .category-index__item:nth-child(2n) {
        min-height: 104px;
        padding: 14px 8px;
        border-right: 0;
    }

    .category-index__art {
        width: 66px;
        height: 66px;
    }
}
</style>
