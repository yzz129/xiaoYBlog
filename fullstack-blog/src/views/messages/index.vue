<template>
    <base-layout>
        <section class="messages-page">
            <PageHeading title="留言板" description="把想说的话留在这里，每一条都来自真实访客。" icon="message" />
            <div class="stats-info">
                <div class="msgs-stats">已有 <strong class="user-count">{{ userCount }}</strong> 位访客在这里留下足迹</div>
                <div class="msgs-stats">留言总数：<strong class="user-count">{{ messageTotal }}</strong> 条</div>

                <button v-if="commentUserInfo" type="button" class="modify-info" @click="showUserInfoForm">
                    个人信息有误？点击修改
                    <EditOutlined style="margin-left: 6px" />
                </button>
            </div>

            <Comments ref="commentsRef" topic="留言" :auto-load="false" place-top />
        </section>
    </base-layout>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { EditOutlined } from "@ant-design/icons-vue";

import Comments from "@/views/article/comments.vue";
import { commentService } from "@/services/comment";
import { useStore } from "@/stores";
import PageHeading from "@/components/page-heading.vue";

const store = useStore();
const commentUserInfo = computed(() => store.commentUserInfo);
const userCount = ref(0);
const messageTotal = ref(0);
const commentsRef = ref<InstanceType<typeof Comments>>();

const getMessageUserCount = async () => {
    try {
        const res = await commentService.numberOfPeople();
        userCount.value = res.data;
    } catch (error) {
        console.error("获取留言人数失败:", error);
    }
};

const getMessageTotal = async () => {
    try {
        const res = await commentService.total();
        messageTotal.value = res.data;
    } catch (error) {
        console.error("获取留言总数失败:", error);
    }
};

void getMessageUserCount();
void getMessageTotal();

const showUserInfoForm = () => {
    if (commentsRef.value) {
        commentsRef.value.isEditUserInfoVisible = true;
    }
};
</script>

<style lang="scss" scoped>
.messages-page {
    padding: 6px 0 0;
}

.stats-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 26px;
    padding: 16px 0;
    border-block: 1px solid var(--xy-line);
    border-radius: 0;
    background: #fff;
    box-shadow: none;
}

.msgs-stats {
    padding: 0;
    text-align: left;
    font-size: 14px;
    color: #6b7280;
}

.user-count {
    font-size: 18px;
    font-weight: 800;
    color: #10233d;
}

.modify-info {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: auto;
    margin-left: auto;
    border: 0;
    background: transparent;
    color: #1761c5;
    cursor: pointer;
    font-size: 13px;
    margin-bottom: 0;
}

:deep(.comment__wrapper) {
    margin-top: 18px;
    border-radius: 22px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    overflow: hidden;
}
</style>
