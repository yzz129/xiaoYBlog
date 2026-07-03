<template>
    <section class="admin-page-wrapper">
        <a-table
            row-key="id"
            :data-source="articleList"
            :columns="columns"
            :loading="loading"
            :scroll="{ x: 1500 }"
            :pagination="pagination"
        >
            <template #bodyCell="{ column, record, index }">
                <template v-if="column.key === 'action'">
                    <a-space>
                        <a-button
                            size="small"
                            type="primary"
                            ghost
                            :loading="index === activeIndex && isPrivateLoading"
                            @click="onClickPrivate(record, index)"
                        >
                            {{ record.private === 1 ? "公开" : "私密" }}
                        </a-button>
                        <a-button size="small" type="primary" ghost @click="onClickEdit(record)">编辑</a-button>
                        <a-button size="small" :type="record.deleted === 1 ? 'primary' : 'default'" ghost @click="onClickLogicDel(record)">
                            {{ record.deleted === 1 ? "恢复删除" : "逻辑删除" }}
                        </a-button>
                        <a-button size="small" danger ghost @click="onClickDel(record)">彻底删除</a-button>
                    </a-space>
                </template>
                <template v-else-if="column.dataIndex === 'article_name'">
                    <router-link :to="`/article/${record.id}`">{{ record.article_name }}</router-link>
                </template>
                <template v-else-if="column.dataIndex === 'poster'">
                    <a-image :src="record.poster" :fallback="LogoFallback" :width="80" :height="60" />
                </template>
                <template v-else-if="column.dataIndex === 'categories'">
                    <a-space size="2" style="flex-wrap: wrap; row-gap: 10px">
                        <router-link v-for="(item, idx) in record.categories" :key="idx" :to="`/category/${item.categoryName}`">
                            <a-tag color="blue" style="cursor: pointer">{{ item.categoryName }}</a-tag>
                        </router-link>
                    </a-space>
                </template>
                <template v-else-if="column.dataIndex === 'tags'">
                    <a-space size="2" style="flex-wrap: wrap; row-gap: 10px">
                        <router-link v-for="(item, idx) in record.tags" :key="idx" :to="`/tag/${item.tagName}`">
                            <a-tag color="green" style="cursor: pointer">{{ item.tagName }}</a-tag>
                        </router-link>
                    </a-space>
                </template>
                <template v-else-if="column.dataIndex === 'create_time'">
                    {{ format(record.create_time) }}
                </template>
                <template v-else-if="column.dataIndex === 'update_time'">
                    {{ record.update_time ? format(record.update_time) : "-" }}
                </template>
            </template>
        </a-table>
    </section>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { message, Modal } from "ant-design-vue";
import type { TablePaginationConfig } from "ant-design-vue";
import { useRouter } from "vue-router";

import type { ArticleDTO } from "@/bean/dto";
import LogoFallback from "@/assets/img/logo2.webp";
import { useAsyncLoading } from "@/hooks/async";
import { articleService } from "@/services/article";
import { format } from "@/utils/date-utils";

type ArticleTableColumn = {
    title: string;
    width?: string;
    dataIndex?: string;
    ellipsis?: boolean;
    key?: string;
    fixed?: "left" | "right";
};

const router = useRouter();
const articleList = ref<ArticleDTO[]>([]);
const activeIndex = ref(-1);

const pagination = reactive<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showTotal: (total) => `共计 ${total} 条`,
    onChange: (page: number) => {
        pagination.current = page;
        void search();
    },
});

const handleGetArticles = async () => {
    const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
    const response =
        userInfo && userInfo.role_name === "admin"
            ? await articleService.pageAdmin({
                  pageNo: Number(pagination.current || 1),
                  pageSize: Number(pagination.pageSize || 10),
              })
            : await articleService.pageUser({
                  pageNo: Number(pagination.current || 1),
                  pageSize: Number(pagination.pageSize || 10),
              });

    articleList.value = response.data || [];
    pagination.total = response.total || 0;
};

const { trigger: search, loading } = useAsyncLoading(handleGetArticles);
void search();

const handlePrivate = async (record: ArticleDTO, index: number) => {
    activeIndex.value = index;
    await articleService.updatePrivate({
        id: record.id,
        private: record.private === 0 ? 1 : 0,
    });
    message.success("操作成功");
    void search();
};

const { trigger: onClickPrivate, loading: isPrivateLoading } = useAsyncLoading(handlePrivate);

const onClickLogicDel = (record: ArticleDTO) => {
    const isDeleted = record.deleted === 1;
    Modal.confirm({
        title: `确认要执行${isDeleted ? "恢复删除" : "逻辑删除"}吗？`,
        onOk: async () => {
            await articleService.updateDeleted({
                id: record.id,
                deleted: isDeleted ? 0 : 1,
            });
            message.success("操作成功");
            void search();
        },
    });
};

const onClickDel = (record: ArticleDTO) => {
    Modal.confirm({
        title: "确认要彻底删除吗？",
        onOk: async () => {
            await articleService.delete(record.id);
            message.success("操作成功");
            pagination.current = 1;
            void search();
        },
    });
};

const onClickEdit = (record: ArticleDTO) => {
    router.push(`/backend/article/edit/${record.id}`);
};

const columns = ref<ArticleTableColumn[]>([
    {
        title: "文章标题",
        width: "160px",
        dataIndex: "article_name",
        ellipsis: true,
    },
    {
        title: "封面",
        width: "110px",
        dataIndex: "poster",
    },
    {
        title: "作者",
        width: "80px",
        dataIndex: "author",
    },
    {
        title: "阅读量",
        width: "80px",
        dataIndex: "read_num",
    },
    {
        title: "分类",
        width: "200px",
        dataIndex: "categories",
    },
    {
        title: "标签",
        width: "200px",
        dataIndex: "tags",
    },
    {
        title: "创建时间",
        width: "140px",
        dataIndex: "create_time",
    },
    {
        title: "更新时间",
        width: "140px",
        dataIndex: "update_time",
    },
    {
        title: "操作",
        width: "300px",
        key: "action",
        fixed: "right",
    },
]);
</script>
