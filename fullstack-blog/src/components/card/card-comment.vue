<template>
    <div class="comment__wrapper">
        <el-image class="comment__avatar" :src="formattedComment.avatar" lazy>
            <template #error>
                <el-image :src="avatarFallback" />
            </template>
        </el-image>

        <div class="comment__info">
            <a
                v-if="formattedComment.site_url"
                class="comment__user"
                target="_blank"
                rel="nofollow"
                :href="formattedComment.jumpoutMiddleLink"
            >
                {{ formattedComment.nick_name }}
            </a>
            <span v-else class="comment__user">{{ formattedComment.nick_name }}</span>

            <span class="comment__time">{{ formattedComment.formattedTime }}</span>
            <div class="comment__content">{{ formattedComment.content }}</div>

            <my-button class="btn-reply" icon="reply" size="small" @click="showReplyRoot">回复</my-button>

            <div v-if="isActive && isShowReplyInput" class="reply-form">
                <a-input
                    ref="rootReplyInputRef"
                    v-model:value="replyRootContent"
                    size="small"
                    :placeholder="replyPlaceHolder"
                />
                <a-button
                    class="btn-confirm-reply"
                    type="primary"
                    size="small"
                    :loading="isReplyRootLoading"
                    @click="onClickReplyRoot"
                >
                    发布
                </a-button>
            </div>

            <div v-if="formattedComment.replies.length > 0" class="reply__list">
                <div v-for="reply in formattedComment.replies" :key="reply.id" class="reply__card">
                    <div class="reply__header">
                        <el-image class="reply__avatar" :src="reply.avatar" lazy>
                            <template #error>
                                <el-image :src="replyAvatarFallback" />
                            </template>
                        </el-image>

                        <div class="reply__subinfo">
                            <span class="reply__info">
                                {{ reply.nick_name }} 回复 {{ reply.reply_name || formattedComment.nick_name }}
                            </span>
                            <span class="reply__time">{{ reply.formattedTime }}</span>
                        </div>
                    </div>

                    <div class="reply__content">{{ reply.content }}</div>
                    <my-button class="btn-reply" icon="reply" size="small" @click="showReplySub(reply)">回复</my-button>

                    <div v-if="isActive && reply.id === activeSubId && isShowSubReplyInput" class="reply-form">
                        <a-input
                            ref="subReplyInputRef"
                            v-model:value="subReplyForm.content"
                            size="small"
                            :placeholder="replyPlaceHolder"
                        />
                        <a-button
                            class="btn-confirm-reply"
                            type="primary"
                            size="small"
                            :loading="isReplySubLoading"
                            @click="onClickReplySub"
                        >
                            发布
                        </a-button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref } from "vue";

import dayjs from "dayjs";
import { message, Modal } from "ant-design-vue";
import DOMPurify from "dompurify";

import { CommentDTO, ReplyDTO } from "@/bean/dto";
import { useAsyncLoading } from "@/hooks/async";
import { replyService } from "@/services/reply";
import { useStore } from "@/stores";
import { format } from "@/utils/date-utils";

const props = withDefaults(
    defineProps<{
        comment: CommentDTO;
        isActive?: boolean;
    }>(),
    {
        isActive: false,
    }
);

const emit = defineEmits<{
    "user-info-empty": [];
    "set-active": [id: number];
}>();

const store = useStore();

const commentUserInfo = computed(() => store.commentUserInfo);

const replyRootContent = ref("");
const replyPlaceHolder = ref("");
const isShowReplyInput = ref(false);
const isShowSubReplyInput = ref(false);
const rootReplyInputRef = ref();
const subReplyInputRef = ref();
const activeSubId = ref(-1);

const subReplyForm = reactive({
    content: "",
    parent_id: -1,
});

const ensureUserInfo = () => {
    if (!commentUserInfo.value) {
        emit("user-info-empty");
        return false;
    }
    return true;
};

const showReplyRoot = () => {
    if (!ensureUserInfo()) {
        return;
    }

    emit("set-active", props.comment.id);
    replyPlaceHolder.value = `@ ${props.comment.nick_name}`;
    isShowReplyInput.value = true;
    isShowSubReplyInput.value = false;

    nextTick(() => {
        rootReplyInputRef.value?.focus?.();
    });
};

const validateReplyContent = (rawContent: string) => {
    if (!rawContent.trim()) {
        message.warning("您还未输入任何内容。");
        return "";
    }

    const purifiedContent = DOMPurify.sanitize(rawContent);
    if (!purifiedContent.trim()) {
        message.warning("输入内容无效，请重新输入合法内容。");
        return "";
    }

    return purifiedContent;
};

const showReplySuccess = () => {
    Modal.success({
        title: "温馨提示",
        content: "你的回复已提交成功，待审核后即可生效。",
    });
};

const handleReplyRoot = async () => {
    const purifiedContent = validateReplyContent(replyRootContent.value);
    if (!purifiedContent || !commentUserInfo.value) {
        return;
    }

    await replyService.add({
        comment_id: props.comment.id,
        parent_id: null,
        approved: 0,
        jump_url: window.location.href,
        article_id: props.comment.article_id,
        content: purifiedContent,
        ...commentUserInfo.value,
    });

    showReplySuccess();
    isShowReplyInput.value = false;
    replyRootContent.value = "";
};

const { trigger: onClickReplyRoot, loading: isReplyRootLoading } = useAsyncLoading(handleReplyRoot);

const showReplySub = (parentReply: ReplyDTO) => {
    if (!ensureUserInfo()) {
        return;
    }

    emit("set-active", props.comment.id);
    activeSubId.value = parentReply.id;
    replyPlaceHolder.value = `@ ${parentReply.nick_name}`;
    isShowReplyInput.value = false;
    isShowSubReplyInput.value = true;
    subReplyForm.content = "";
    subReplyForm.parent_id = parentReply.id;

    nextTick(() => {
        subReplyInputRef.value?.focus?.();
    });
};

const handleReplySub = async () => {
    const purifiedContent = validateReplyContent(subReplyForm.content);
    if (!purifiedContent || !commentUserInfo.value) {
        return;
    }

    await replyService.add({
        comment_id: props.comment.id,
        parent_id: subReplyForm.parent_id,
        approved: 0,
        jump_url: window.location.href,
        article_id: props.comment.article_id,
        content: purifiedContent,
        ...commentUserInfo.value,
    });

    showReplySuccess();
    isShowSubReplyInput.value = false;
    subReplyForm.content = "";
    subReplyForm.parent_id = -1;
};

const { trigger: onClickReplySub, loading: isReplySubLoading } = useAsyncLoading(handleReplySub);

const avatarFallback = new URL("@/assets/img/comment-avatar.svg", import.meta.url).href;
const replyAvatarFallback = new URL("@/assets/img/reply-avatar.svg", import.meta.url).href;

const formattedComment = computed(() => ({
    ...props.comment,
    avatar: props.comment.avatar || avatarFallback,
    formattedTime: format(props.comment.create_time, "YYYY年M月D日 HH:mm:ss"),
    jumpoutMiddleLink: props.comment.site_url ? `/jumpout/${encodeURIComponent(props.comment.site_url)}` : "",
    replies: props.comment.replies.map((reply) => ({
        ...reply,
        avatar: reply.avatar || replyAvatarFallback,
        formattedTime: dayjs(reply.create_time).fromNow(),
    })),
}));
</script>

<style lang="scss" scoped>
.comment__wrapper {
    display: flex;
    padding: 8px 12px;
    background-color: #fff;
    border-radius: 4px;
    box-shadow: 0 2px 26px rgb(7 17 27 / 12%);
}

:deep(.comment__avatar) {
    width: 40px;
    height: 40px;

    > img {
        height: 100%;
        border-radius: 100%;
        object-fit: cover;
    }
}

.comment__info {
    flex: 1;
    margin-left: 6px;
}

.comment__user {
    color: #5079b7;
    font-size: 16px;
}

.comment__time {
    display: block;
    font-size: 12px;
    color: #999;
}

.comment__content {
    color: #333;
    font-size: 16px;
    padding-bottom: 4px;
}

.reply__list {
    margin-top: 10px;
    border-top: 1px solid #ccc;
}

.reply__card {
    text-align: left;
    padding: 10px 0;
    border-bottom: 1px solid #eee;
}

.reply__header {
    display: flex;
}

:deep(.reply__avatar) {
    width: 24px;
    height: 24px;

    > img {
        height: 100%;
        border-radius: 100%;
        object-fit: cover;
    }
}

.reply__subinfo {
    margin-left: 4px;
    padding-top: 4px;
    display: flex;
    font-size: 12px;
}

.reply__info {
    flex: 1;
    @include one-line-ellipsis;
}

.reply__time {
    margin-left: 4px;
    color: #999;
}

.reply__content {
    margin-bottom: 4px;
    color: #333;
    font-size: 16px;
}

:deep(.btn-reply) {
    font-size: 12px;
}

.reply-form {
    margin-top: 10px;
    display: flex;
    align-items: center;
}

:deep(.btn-confirm-reply) {
    margin: 0 0 0 10px;
    font-size: 12px;
    height: 20px;
    padding: 0 4px;
}
</style>
