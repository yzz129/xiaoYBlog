<template>
    <a-form ref="formRef" :rules="rules" :model="formModel" :label-col="{ style: { width: '140px' } }">
        <a-form-item label="昵称" name="nick_name">
            <a-input v-model:value="formModel.nick_name" placeholder="Hi，期待与你的互动" />
        </a-form-item>
        <a-form-item label="邮箱" name="email">
            <a-input
                v-model:value="formModel.email"
                placeholder="邮箱不会被公开，仅用于反馈与你相关的消息"
            />
        </a-form-item>
        <a-form-item label="个人网址" name="site_url">
            <a-input
                v-model:value="formModel.site_url"
                placeholder="个人网址会被公开，便于他人与你交流互动"
            />
        </a-form-item>
        <a-form-item class="align-center" :wrapper-col="{ span: 24 }">
            <a-space>
                <a-button @click="onClickCancel">取消</a-button>
                <a-button type="primary" @click="onClickSave">保存</a-button>
            </a-space>
        </a-form-item>
    </a-form>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";

import { message } from "ant-design-vue";

import { CommentUserInfo } from "@/bean/dto";
import { useStore } from "@/stores";
import { EMAIL_VALIDATOR, REQUIRED_VALIDATOR_BLUR, URL_VALIDATOR } from "@/utils/validator";

const props = withDefaults(
    defineProps<{
        topic?: string;
    }>(),
    {
        topic: "评论",
    }
);

const emit = defineEmits<{
    cancel: [];
    success: [];
}>();

const store = useStore();

const commentUserInfo = computed(() => store.commentUserInfo);

const formModel = reactive<CommentUserInfo>({
    nick_name: commentUserInfo.value?.nick_name || "",
    email: commentUserInfo.value?.email || "",
    site_url: commentUserInfo.value?.site_url || "",
});

const rules = reactive({
    nick_name: [REQUIRED_VALIDATOR_BLUR],
    email: [REQUIRED_VALIDATOR_BLUR, EMAIL_VALIDATOR],
    site_url: [URL_VALIDATOR],
});

const formRef = ref();

const onClickCancel = () => {
    emit("cancel");
};

const onClickSave = async () => {
    await formRef.value?.validate();

    store.setCommentUserInfo({ ...formModel });
    message.success(`信息已保存，现在可以去创建${props.topic}了。`);

    emit("success");
};
</script>
