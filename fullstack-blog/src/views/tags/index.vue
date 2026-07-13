<template>
    <base-layout>
        <PageHeading title="文章标签" description="用轻巧的关键词，找到感兴趣的内容。" icon="tag" />

        <a-skeleton :loading="loading" active :paragraph="{ rows: 10 }">
            <section v-if="tagList.length > 0" class="tag-cloud">
                <router-link
                    v-for="(tag, index) in tagList"
                    :key="tag.id"
                    :to="`/tag/${tag.tag_name}`"
                    class="tag-cloud__item"
                    :class="`tag-cloud__item--${index % 4}`"
                >
                    <DoodleIcon name="tag" />
                    <strong># {{ tag.tag_name }}</strong>
                    <span>{{ tag.tag_count || 0 }}</span>
                </router-link>
            </section>

            <IllustratedEmpty v-else title="还没有文章标签" description="添加标签后会自动显示在这里。" />
        </a-skeleton>
    </base-layout>
</template>

<script setup lang="ts">
import { ref } from "vue";

import type { TagDTO } from "@/bean/dto";
import DoodleIcon from "@/components/doodle-icon.vue";
import IllustratedEmpty from "@/components/illustrated-empty.vue";
import PageHeading from "@/components/page-heading.vue";
import { useAsyncLoading } from "@/hooks/async";
import { tagService } from "@/services/tag";

const tagList = ref<TagDTO[]>([]);

const handleGetAllTag = async () => {
    const res = await tagService.all({ getCount: true });
    tagList.value = res.data || [];
};

const { trigger: getTagList, loading } = useAsyncLoading(handleGetAllTag);
getTagList();
</script>

<style scoped>
.tag-cloud {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-content: flex-start;
    min-height: 340px;
    padding: 28px 0;
}

.tag-cloud__item {
    min-height: 52px;
    display: inline-flex;
    align-items: center;
    gap: 9px;
    padding: 10px 16px 10px 12px;
    color: var(--xy-ink);
    border: 1px solid var(--xy-line);
    border-radius: 10px 10px 10px 2px;
    background: var(--xy-mint-soft);
    box-shadow: 3px 3px 0 rgb(22 50 79 / 7%);
    transform: rotate(-1deg);
    transition: transform var(--xy-ease);
}

.tag-cloud__item:hover {
    transform: rotate(0) translateY(-3px);
}

.tag-cloud__item :deep(svg) {
    width: 27px;
    height: 27px;
}

.tag-cloud__item span {
    min-width: 24px;
    padding: 2px 6px;
    border-radius: 5px;
    background: #fff;
    color: var(--xy-muted);
    text-align: center;
    font-size: 11px;
}

.tag-cloud__item--1 { background: var(--xy-yellow-soft); transform: rotate(1deg); }
.tag-cloud__item--2 { background: var(--xy-blue-soft); }
.tag-cloud__item--3 { background: var(--xy-coral-soft); transform: rotate(1.5deg); }
</style>
