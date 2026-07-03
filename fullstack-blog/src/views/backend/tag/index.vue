<template>
    <section class="admin-page-wrapper">
        <a-table
            row-key="id"
            :data-source="tagList"
            :columns="columns"
            :loading="loading"
            :scroll="{ x: 1500 }"
            :pagination="pagination"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                    <a-space>
                        <a-button size="small" type="primary" ghost @click="onViewArticles(record)">查看标签文章</a-button>
                    </a-space>
                </template>
            </template>
        </a-table>
    </section>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";

import { TagDTO } from "@/bean/dto";
import { useAsyncLoading } from "@/hooks/async";
import { tagService } from "@/services/tag";
import { format } from "@/utils/date-utils";

const router = useRouter();
const tagList = ref<TagDTO[]>([]);

const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showTotal: (total: number) => `共计 ${total} 条`,
    onChange: () => {
        void search();
    },
});

const handleGetTags = async () => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
    let res;

    if (userInfo && userInfo.role_name === "admin") {
        res = await tagService.adminPage({
            pageNo: pagination.current,
            pageSize: pagination.pageSize,
        });
        tagList.value = res.data || [];
        pagination.total = res.total || 0;
        return;
    }

    res = await tagService.my({ getCount: true });
    tagList.value = res.data || [];
    pagination.total = res.data.length;
};

const { trigger: search, loading } = useAsyncLoading(handleGetTags);
void search();

const onViewArticles = (record: TagDTO) => {
    router.push(`/tag/${record.tag_name}`);
};

const columns = ref([
    {
        title: "标签名称",
        width: "160px",
        dataIndex: "tag_name",
        ellipsis: true,
        fixed: "left",
    },
    {
        title: "文章数量",
        width: "120px",
        dataIndex: "article_count",
        ellipsis: true,
    },
    {
        title: "创建时间",
        width: "140px",
        dataIndex: "create_time",
        customRender: ({ text }: { text: string }) => format(text),
    },
    {
        title: "更新时间",
        width: "140px",
        dataIndex: "update_time",
        customRender: ({ text }: { text: string }) => (text ? format(text) : "-"),
    },
    {
        title: "操作",
        width: "140px",
        key: "action",
        fixed: "right",
    },
]);
</script>
