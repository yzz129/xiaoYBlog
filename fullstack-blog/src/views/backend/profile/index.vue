<template>
    <section class="profile-page admin-page-wrapper">
        <!-- 资料页采用开放式工作台布局，表单字段和保存流程保持不变。 -->
        <div class="admin-page-heading">
            <div>
                <span class="admin-page-heading__eyebrow">MY LITTLE CORNER</span>
                <h1>我的资料角</h1>
                <p>整理头像、昵称与账号安全，给个人空间添一点自己的颜色。</p>
            </div>
            <DoodleIcon name="user" :size="54" />
        </div>
        <a-row :gutter="24">
            <a-col :xs="24" :lg="10">
                <a-card title="头像与资料" :bordered="false">
                    <div class="profile-avatar">
                        <a-avatar :size="96" :src="profileForm.avatar || undefined">
                            <template v-if="!profileForm.avatar">{{ avatarText }}</template>
                        </a-avatar>
                        <div class="profile-avatar__actions">
                            <a-upload :show-upload-list="false" accept="image/*" :before-upload="handleAvatarUpload">
                                <a-button :loading="avatarUploading">
                                    <UploadOutlined />
                                    上传头像
                                </a-button>
                            </a-upload>
                            <span class="profile-avatar__tip">支持 JPG、PNG、WEBP，大小不超过 5MB</span>
                        </div>
                    </div>

                    <a-form layout="vertical" :model="profileForm">
                        <a-form-item label="昵称">
                            <a-input v-model:value="profileForm.nickName" placeholder="请输入昵称" autocomplete="nickname" />
                        </a-form-item>
                        <a-form-item label="邮箱">
                            <a-input v-model:value="profileForm.email" placeholder="请输入邮箱" autocomplete="email" />
                        </a-form-item>
                        <a-form-item label="个人简介">
                            <a-textarea
                                v-model:value="profileForm.intro"
                                :auto-size="{ minRows: 4, maxRows: 6 }"
                                placeholder="请输入个人简介"
                            />
                        </a-form-item>
                        <a-form-item>
                            <a-button type="primary" :loading="profileSaving" @click="saveProfile">保存资料</a-button>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>

            <a-col :xs="24" :lg="14">
                <a-card title="账号安全" :bordered="false">
                    <div class="account-info">
                        <div class="account-info__item">
                            <span>用户名</span>
                            <strong>{{ currentUser?.user_name || "-" }}</strong>
                        </div>
                        <div class="account-info__item">
                            <span>角色</span>
                            <strong>{{ currentUser?.role_name === "admin" ? "管理员" : "普通用户" }}</strong>
                        </div>
                    </div>

                    <a-divider />

                    <a-form layout="vertical" :model="passwordForm">
                        <a-form-item label="当前密码">
                            <a-input-password
                                v-model:value="passwordForm.currentPassword"
                                placeholder="请输入当前密码"
                                autocomplete="current-password"
                            />
                        </a-form-item>
                        <a-form-item label="新密码">
                            <a-input-password
                                v-model:value="passwordForm.newPassword"
                                placeholder="请输入新密码"
                                autocomplete="new-password"
                            />
                        </a-form-item>
                        <a-form-item label="确认新密码">
                            <a-input-password
                                v-model:value="passwordForm.confirmPassword"
                                placeholder="请再次输入新密码"
                                autocomplete="new-password"
                            />
                        </a-form-item>
                        <a-form-item>
                            <a-button type="primary" :loading="passwordSaving" @click="savePassword">修改密码</a-button>
                        </a-form-item>
                    </a-form>
                </a-card>
            </a-col>
        </a-row>
    </section>
</template>

<script setup lang="ts">
import Hashes from "jshashes";
import { computed, onMounted, reactive, ref } from "vue";
import { message } from "ant-design-vue";
import { UploadOutlined } from "@ant-design/icons-vue";
import DoodleIcon from "@/components/doodle-icon.vue";

import { useAsyncLoading } from "@/hooks/async";
import { uploadService } from "@/services/upload";
import { userService } from "@/services/user";
import { useStore } from "@/stores";

const store = useStore();

const currentUser = computed(() => store.userInfo);
const avatarUploading = ref(false);

const profileForm = reactive({
    nickName: "",
    email: "",
    intro: "",
    avatar: "",
});

const passwordForm = reactive({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
});

const avatarText = computed(() => (profileForm.nickName || currentUser.value?.user_name || "U").slice(0, 1).toUpperCase());

const init = async () => {
    const user = await store.fetchCurrent(true);
    profileForm.nickName = user?.nick_name || "";
    profileForm.email = user?.email || "";
    profileForm.intro = user?.intro || "";
    profileForm.avatar = user?.avatar || "";
};

onMounted(() => {
    void init();
});

const handleSaveProfile = async () => {
    if (!profileForm.nickName.trim()) {
        message.warning("昵称不能为空");
        return;
    }

    const response = await userService.updateProfile({
        nickName: profileForm.nickName.trim(),
        email: profileForm.email.trim(),
        intro: profileForm.intro.trim(),
        avatar: profileForm.avatar.trim(),
    });

    store.setUserInfo(response.data || null);
    message.success("资料已更新");
};

const { trigger: saveProfile, loading: profileSaving } = useAsyncLoading(handleSaveProfile);

const handleSavePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        message.warning("请完整填写密码信息");
        return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        message.warning("两次输入的新密码不一致");
        return;
    }

    const sha256 = new Hashes.SHA256();
    await userService.updatePassword({
        currentPassword: sha256.hex(passwordForm.currentPassword),
        newPassword: sha256.hex(passwordForm.newPassword),
    });

    passwordForm.currentPassword = "";
    passwordForm.newPassword = "";
    passwordForm.confirmPassword = "";
    message.success("密码已更新，请牢记新密码");
};

const { trigger: savePassword, loading: passwordSaving } = useAsyncLoading(handleSavePassword);

const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith("image/")) {
        message.error("头像仅支持图片文件");
        return false;
    }

    if (file.size / 1024 / 1024 > 5) {
        message.error("头像大小不能超过 5MB");
        return false;
    }

    avatarUploading.value = true;
    try {
        const response = await uploadService.uploadImage(file, "avatar");
        profileForm.avatar = response.data?.url || "";
        message.success("头像上传成功");
    } finally {
        avatarUploading.value = false;
    }

    return false;
};
</script>

<style lang="scss" scoped>
.profile-page :deep(.ant-card) {
    border-radius: 12px;
}

.profile-avatar {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 24px;
}

.profile-avatar__actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.profile-avatar__tip {
    color: #8c8c8c;
    font-size: 12px;
}

.account-info {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
}

.account-info__item {
    padding: 16px;
    border-radius: 10px;
    background: #fafafa;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

@media (max-width: 991px) {
    .profile-avatar {
        flex-direction: column;
        align-items: flex-start;
    }

    .account-info {
        grid-template-columns: 1fr;
    }
}
</style>
