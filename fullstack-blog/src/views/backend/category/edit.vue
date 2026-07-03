<template>
    <div style="padding: 20px;">
        <h2 style="margin-bottom: 20px;">编辑分类</h2>
        <div style="margin-bottom: 10px;">
            <strong>当前编辑的分类ID:</strong> {{ formModel.id }}
        </div>
        <div style="margin-bottom: 10px;">
            <strong>分类名称:</strong> {{ formModel.category_name }}
        </div>
        <div style="margin-bottom: 10px;">
            <strong>海报:</strong> {{ formModel.poster }}
        </div>
        <div style="margin-top: 20px;">
            <button style="margin-right: 10px; padding: 5px 10px; background-color: #1890ff; color: white; border: none; border-radius: 4px;">保存</button>
            <button style="padding: 5px 10px; background-color: #f0f0f0; color: #000; border: 1px solid #d9d9d9; border-radius: 4px;">取消</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { PropType, reactive, ref } from "vue";

import { message } from "ant-design-vue";

import axios from "axios";

import { CategoryDTO } from "@/bean/dto";

const props = defineProps({
        row: {
            type: Object as PropType<CategoryDTO>,
            required: true,
        },
    });

const emit = defineEmits(["success", "cancel"]);

const safeRow = props.row || { id: 0, category_name: '默认分类名称', poster: '默认海报' };

const formModel = reactive({
            id: safeRow.id || 0,
            category_name: safeRow.category_name || '默认分类名称',
            poster: safeRow.poster || '默认海报',
        });

const loading = ref(false);

const getToken = () => {
    if (typeof document === "undefined") {
        return "";
    }
    return localStorage.getItem("token") || "";
};

const handleCancel = () => {
            emit('cancel');
        };

const handleSave = async () => {
            if (!formModel.id) {
                message.error('保存失败：无效的分类ID');
                return;
            }
            if (!formModel.category_name) {
                message.error('保存失败：分类名称不能为空');
                return;
            }
            if (!formModel.poster) {
                message.error('保存失败：海报不能为空');
                return;
            }
            try {
                loading.value = true;
                const token = getToken();
                const response = await axios.put('/api/category/admin/update', formModel, {
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': token ? `Bearer ${token}` : ""
                    },
                });
                message.success("保存成功");
                emit("success");
            } catch (error) {
                message.error("保存失败");
            } finally {
                loading.value = false;
            }
        };
</script>
