<template>
    <section class="comments__wrapper">
        <div v-if="placeTop" class="leave-comment">
            <a-input ref="commentInputRef" v-model:value="content" :placeholder="`发表${topic}`" />
            <a-button class="btn-publish" type="primary" size="small" :loading="isPublishLoading" @click="onClickPublish">
                发布
            </a-button>
        </div>

        <el-scrollbar height="100%" @end-reached="handleEndReached" :distance="50">
            <ul v-if="comments.length > 0" class="comments__list">
                <li v-for="comment in comments" :key="comment.id">
                    <CardComment
                        :comment="comment"
                        :is-active="activeId === comment.id"
                        @user-info-empty="onUserInfoEmpty"
                        @set-active="onSetActive"
                    />
                </li>
            </ul>

            <a-empty v-else-if="!isFetchLoading">
                <template #description>
                    暂无{{ topic }}，快来说两句吧！
                    <a-button class="btn-add" type="primary" @click="createComment">创建{{ topic }}</a-button>
                </template>
            </a-empty>

            <a-skeleton :loading="isFetchLoading" active avatar :paragraph="{ rows: 6 }" />

            <BottomTips v-if="isAllLoaded" content="没有更多了" />

            <BottomTips v-else-if="comments.length > 0">
                <a-button shape="round" type="primary" @click="loadMore">加载更多</a-button>
            </BottomTips>
        </el-scrollbar>

        <div v-if="!placeTop" class="leave-comment">
            <a-input ref="commentInputRef" v-model:value="content" :placeholder="`发表${topic}`" />
            <a-button class="btn-publish" type="primary" size="small" :loading="isPublishLoading" @click="onClickPublish">
                发布
            </a-button>
        </div>

        <a-modal v-model:open="isEditUserInfoVisible" :footer="null">
            <CommentUserInfo :topic="topic" @cancel="isEditUserInfoVisible = false" @success="isEditUserInfoVisible = false" />
        </a-modal>
    </section>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";

import { message } from "ant-design-vue";
import DOMPurify from "dompurify";

import { CommentDTO } from "@/bean/dto";
import BottomTips from "@/components/bottom-tips/index.vue";
import CardComment from "@/components/card/card-comment.vue";
import { useAsyncLoading } from "@/hooks/async";
import { commentService } from "@/services/comment";
import { useStore } from "@/stores";

import CommentUserInfo from "./comment-user-info.vue";

const props = withDefaults(
    defineProps<{
        articleId?: number;
        topic?: string;
        autoLoad?: boolean;
        placeTop?: boolean;
    }>(),
    {
        topic: "评论",
        autoLoad: true,
        placeTop: false,
    }
);

const store = useStore();

const comments = ref<CommentDTO[]>([]);
const activeId = ref(-1);
const total = ref(0);
const content = ref("");
const commentInputRef = ref();
const isEditUserInfoVisible = ref(false);

const pageInfo = reactive({
    pageNo: 1,
    pageSize: 6,
});

const isAllLoaded = computed(() => total.value > 0 && total.value === comments.value.length);
const commentUserInfo = computed(() => store.commentUserInfo);

const onSetActive = (id: number) => {
    activeId.value = id;
};

const handleGetComments = async (isLoadMore = false) => {
    const res = await commentService.page({
        ...pageInfo,
        id: props.articleId,
    });

    comments.value = isLoadMore ? [...comments.value, ...res.data] : res.data;
    total.value = res.total;
};

const { trigger: getComments, loading: isFetchLoading } = useAsyncLoading(handleGetComments);

getComments();

const loadMore = () => {
    if (isFetchLoading.value || comments.value.length >= total.value) {
        return;
    }

    pageInfo.pageNo += 1;
    getComments(true);
};

const handleEndReached = () => {
    if (props.autoLoad) {
        loadMore();
    }
};

const remindCreateUserInfo = () => {
    message.warning(`请先在${props.topic}前填写必要信息，我们不会公开你的隐私信息。`);
    isEditUserInfoVisible.value = true;
};

const onUserInfoEmpty = () => {
    remindCreateUserInfo();
};

const createComment = () => {
    commentInputRef.value?.focus?.();
};

const handlePublish = async () => {
    if (!commentUserInfo.value) {
        remindCreateUserInfo();
        return;
    }

    if (!content.value.trim()) {
        message.warning("您还未输入任何内容。");
        return;
    }

    const purifiedContent = DOMPurify.sanitize(content.value);
    if (!purifiedContent.trim()) {
        message.warning("输入内容无效，请重新输入合法内容。");
        return;
    }

    await commentService.add({
        article_id: props.articleId,
        content: purifiedContent,
        approved: 0,
        jump_url: window.location.href,
        ...commentUserInfo.value,
    });

    content.value = "";
    pageInfo.pageNo = 1;
    await getComments(false);
    message.success(`你的${props.topic}已提交成功，待审核后即可生效。`);
};

const { trigger: onClickPublish, loading: isPublishLoading } = useAsyncLoading(handlePublish);

defineExpose({
    isEditUserInfoVisible,
});
</script>

<style lang="scss" scoped>
.comments__wrapper {
    display: flex;
    flex-direction: column;
    flex: 1;
}

.comments__body {
    flex: 1;
    padding: 20px;
}

.comments__list {
    > li + li {
        margin-top: 20px;
    }
}

:deep(.btn-add) {
    margin: 20px auto;
    display: block;
}

.leave-comment {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    box-shadow: 0 -1px 10px 0 rgba(0, 0, 0, 0.1);
    z-index: 2;
}

:deep(.btn-publish) {
    margin-left: 10px;
}
</style>
