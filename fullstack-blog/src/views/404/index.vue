<template>
    <a-result status="404" title="404" sub-title="抱歉，您访问的页面不存在！">
        <template #extra>
            <a-space>
                <a-button type="primary" @click="backHome">返回首页</a-button>
                <a-button type="primary" @click="goBack">返回上一页</a-button>
            </a-space>
        </template>
    </a-result>
</template>

<script setup lang="ts">
import { useRouter } from "vue-router";

import { Result } from "ant-design-vue";

const router = useRouter();

const backHome = () => {
            router.push("/");
        };

const goBack = () => {
            router.back();
        };
</script>
