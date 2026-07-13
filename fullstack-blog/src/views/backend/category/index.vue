<template>
    <section class="admin-page-wrapper">
        <!-- 后台也使用同一套清新视觉语言，表格仍绑定真实分类接口。 -->
        <div class="admin-page-heading">
            <div>
                <span class="admin-page-heading__eyebrow">CONTENT GARDEN</span>
                <h1>分类花园</h1>
                <p>整理文章的生长方向，让每篇内容都容易被找到。</p>
            </div>
            <DoodleIcon name="folder" :size="54" />
        </div>
        <a-table
            row-key="id"
            :data-source="categoryList"
            :columns="columns"
            :loading="loading"
            :scroll="{ x: 1500 }"
            :pagination="pagination"
        >
            <template #bodyCell="{ column, record }">
                <template v-if="column.key === 'action'">
                    <a-space>
                        <a-button size="small" type="primary" ghost @click.stop="onClickEdit(record)">编辑</a-button>
                        <a-button size="small" type="primary" ghost @click.stop="onViewArticles(record)">查看文章</a-button>
                    </a-space>
                </template>
                <template v-else-if="column.dataIndex === 'poster'">
                    <a-image :src="record.poster" :fallback="LogoFallback" class="category-poster" />
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

    <a-modal v-model:open="isEditVisible" title="编辑分类" width="640px">
        <div class="edit-panel">
            <h2 class="edit-panel__title">编辑分类</h2>
            <div class="edit-panel__content">
                <div class="edit-row">
                    <strong>分类 ID：</strong>
                    <span>{{ editForm.id }}</span>
                </div>
                <div class="edit-row">
                    <strong>分类名称：</strong>
                    <input v-model="editForm.category_name" type="text" class="edit-input" />
                </div>
                <div class="edit-row">
                    <strong>封面地址：</strong>
                    <input v-model="editForm.poster" type="text" class="edit-input" />
                </div>
                <div class="edit-row edit-row--preview">
                    <strong>封面预览：</strong>
                    <div class="poster-preview">
                        <img v-if="editForm.poster" :src="editForm.poster" alt="封面预览" />
                        <span v-else>请输入封面图片地址</span>
                    </div>
                </div>
            </div>
        </div>
        <template #footer>
            <div class="modal-footer">
                <a-button @click="handleCancel">取消</a-button>
                <a-button type="primary" @click="onEditSuccess">保存</a-button>
            </div>
        </template>
    </a-modal>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import { useRouter } from "vue-router";

import { CategoryDTO } from "@/bean/dto";
import DoodleIcon from "@/components/doodle-icon.vue";
import { useAsyncLoading } from "@/hooks/async";
import { categoryService } from "@/services/category";
import { format } from "@/utils/date-utils";

import LogoFallback from "@/assets/img/logo2.webp";

const router = useRouter();
const categoryList = ref<CategoryDTO[]>([]);

const pagination = reactive({
    current: 1,
    pageSize: 10,
    total: 0,
    showTotal: (total: number) => `共计 ${total} 条`,
    onChange: () => {
        void search();
    },
});

const handleGetCategories = async () => {
    try {
        const userInfo = JSON.parse(localStorage.getItem("userInfo") || "null");
        if (userInfo && userInfo.role_name === "admin") {
            const res = await categoryService.adminPage({
                pageNo: pagination.current,
                pageSize: pagination.pageSize,
            });
            categoryList.value = res.data || [];
            pagination.total = res.total || 0;
            return;
        }

        const res = await categoryService.my({ getCount: true });
        categoryList.value = res.data || [];
        pagination.total = res.data.length;
    } catch (_error) {
        categoryList.value = [];
    }
};

const { trigger: search, loading } = useAsyncLoading(handleGetCategories);
void search();

const isEditVisible = ref(false);
const editForm = reactive({
    id: 0,
    category_name: "",
    poster: "",
});

const onClickEdit = (record: CategoryDTO) => {
    if (!record?.id) {
        return;
    }

    editForm.id = record.id;
    editForm.category_name = record.category_name;
    editForm.poster = record.poster;
    isEditVisible.value = true;
};

const onViewArticles = (record: CategoryDTO) => {
    router.push(`/category/${record.category_name}`);
};

const onEditSuccess = async () => {
    await categoryService.adminUpdate(editForm);
    isEditVisible.value = false;
    void search();
};

const handleCancel = () => {
    isEditVisible.value = false;
};

const columns = ref([
    {
        title: "分类名称",
        width: "160px",
        dataIndex: "category_name",
        ellipsis: true,
        fixed: "left",
    },
    {
        title: "封面",
        width: "140px",
        dataIndex: "poster",
    },
    {
        title: "文章数量",
        width: "120px",
        dataIndex: "category_count",
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
        width: "200px",
        key: "action",
        fixed: "right",
    },
]);
</script>

<style lang="scss" scoped>
:deep(.ant-table-wrapper) {
    .category-poster {
        width: 160px;
        height: 92px;
        object-fit: contain;
    }
}

.edit-panel {
    padding: 20px;
}

.edit-panel__title {
    margin-bottom: 20px;
    color: #333;
    font-size: 18px;
}

.edit-panel__content {
    color: #666;
}

.edit-row {
    margin-bottom: 10px;
}

.edit-row--preview {
    margin-left: 90px;
}

.edit-input {
    margin-left: 10px;
    padding: 4px 8px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    width: 300px;
}

.poster-preview {
    margin-top: 10px;
    border: 1px solid #d9d9d9;
    border-radius: 4px;
    padding: 10px;
    width: 300px;
    height: 160px;
    display: flex;
    align-items: center;
    justify-content: center;

    img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }

    span {
        color: #999;
    }
}

.modal-footer {
    display: flex;
    justify-content: flex-end;
}
</style>
