<template>
    <base-layout>
        <section class="login-page">
            <div class="login-card">
                <DoodleIcon name="mascot" class="login-mascot" />
                <h2 class="login-title">{{ isLogin ? "登录后台" : "注册账号" }}</h2>
                <p class="login-subtitle">
                    {{ isLogin ? "使用账号密码进入管理后台" : "创建一个新的账号以发布和管理内容" }}
                </p>

                <a-form ref="formRef" class="login-form" :model="formModel" :rules="rules" :wrapper-col="{ span: 24 }">
                    <a-form-item name="userName">
                        <a-input
                            v-model:value="formModel.userName"
                            placeholder="请输入用户名"
                            autocomplete="username"
                            @keyup.enter="handleSubmit"
                        >
                            <template #prefix>
                                <UserOutlined style="color: rgba(0, 0, 0, 0.25)" />
                            </template>
                        </a-input>
                    </a-form-item>

                    <a-form-item name="password">
                        <a-input
                            v-model:value="formModel.password"
                            type="password"
                            placeholder="请输入密码"
                            autocomplete="current-password"
                            @keyup.enter="handleSubmit"
                        >
                            <template #prefix>
                                <LockOutlined style="color: rgba(0, 0, 0, 0.25)" />
                            </template>
                        </a-input>
                    </a-form-item>

                    <a-form-item v-if="!isLogin" name="confirmPassword">
                        <a-input
                            v-model:value="formModel.confirmPassword"
                            type="password"
                            placeholder="请再次输入密码"
                            autocomplete="new-password"
                            @keyup.enter="handleSubmit"
                        >
                            <template #prefix>
                                <LockOutlined style="color: rgba(0, 0, 0, 0.25)" />
                            </template>
                        </a-input>
                    </a-form-item>

                    <a-form-item v-if="!isLogin" name="nickName">
                        <a-input
                            v-model:value="formModel.nickName"
                            placeholder="请输入昵称"
                            autocomplete="nickname"
                            @keyup.enter="handleSubmit"
                        >
                            <template #prefix>
                                <UserOutlined style="color: rgba(0, 0, 0, 0.25)" />
                            </template>
                        </a-input>
                    </a-form-item>

                    <a-form-item v-if="isLogin" name="captcha">
                        <a-input
                            v-model:value="formModel.captcha"
                            class="input-code"
                            placeholder="请输入验证码"
                            autocomplete="off"
                            @keyup.enter="handleSubmit"
                        >
                            <template #prefix>
                                <LockOutlined style="color: rgba(0, 0, 0, 0.25)" />
                            </template>
                            <template #suffix>
                                <div class="verify-code" v-html="svgHtml" @click="getVerifyCode"></div>
                            </template>
                        </a-input>
                    </a-form-item>

                    <a-form-item class="align-center">
                        <a-button type="primary" size="large" block :loading="loading" @click="handleSubmit">
                            {{ isLogin ? "登录" : "注册" }}
                        </a-button>
                    </a-form-item>

                    <a-form-item class="align-center">
                        <button type="button" class="switch-btn" @click="toggleForm">
                            {{ isLogin ? "没有账号？立即注册" : "已有账号？立即登录" }}
                        </button>
                    </a-form-item>
                </a-form>
            </div>
        </section>
    </base-layout>
</template>

<script setup lang="ts">
import Hashes from "jshashes";
import { computed, reactive, ref } from "vue";
import { UserOutlined, LockOutlined } from "@ant-design/icons-vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";

import { useAsyncLoading } from "@/hooks/async";
import { validatorService } from "@/services/validator";
import { useStore } from "@/stores";
import { REQUIRED_VALIDATOR_BLUR } from "@/utils/validator";
import DoodleIcon from "@/components/doodle-icon.vue";

const store = useStore();
const router = useRouter();
const formRef = ref();
const isLogin = ref(true);
const svgHtml = ref("");

const formModel = reactive({
    userName: "",
    password: "",
    confirmPassword: "",
    nickName: "",
    captcha: "",
});

const rules = computed(() => ({
    userName: [{ ...REQUIRED_VALIDATOR_BLUR, message: "请输入用户名" }],
    password: [{ ...REQUIRED_VALIDATOR_BLUR, message: "请输入密码" }],
    confirmPassword: isLogin.value
        ? []
        : [
              { ...REQUIRED_VALIDATOR_BLUR, message: "请再次输入密码" },
              {
                  validator: (_rule: unknown, value: string) => {
                      if (value !== formModel.password) {
                          return Promise.reject(new Error("两次输入的密码不一致"));
                      }
                      return Promise.resolve();
                  },
              },
          ],
    nickName: isLogin.value ? [] : [{ ...REQUIRED_VALIDATOR_BLUR, message: "请输入昵称" }],
    captcha: isLogin.value ? [{ ...REQUIRED_VALIDATOR_BLUR, message: "请输入验证码" }] : [],
}));

const getVerifyCode = async () => {
    const res = await validatorService.imgCode();
    svgHtml.value = res.data;
};

void getVerifyCode();

const resetForm = () => {
    formModel.userName = "";
    formModel.password = "";
    formModel.confirmPassword = "";
    formModel.nickName = "";
    formModel.captcha = "";
    formRef.value?.clearValidate?.();
};

const toggleForm = () => {
    isLogin.value = !isLogin.value;
    resetForm();
    if (isLogin.value) {
        void getVerifyCode();
    }
};

const handleLogin = async () => {
    await formRef.value?.validate();

    const sha256 = new Hashes.SHA256();
    const params = {
        ...formModel,
        password: sha256.hex(formModel.password),
    };

    try {
        await store.login(params);
        message.success("登录成功，欢迎回来");
        router.push("/backend");
    } catch (error) {
        void getVerifyCode();
        throw error;
    }
};

const handleRegister = async () => {
    await formRef.value?.validate();

    const sha256 = new Hashes.SHA256();
    const params = {
        userName: formModel.userName,
        password: sha256.hex(formModel.password),
        nickName: formModel.nickName,
    };

    await store.register(params);
    message.success("注册成功，请登录");
    isLogin.value = true;
    resetForm();
    void getVerifyCode();
};

const { loading: loginLoading, trigger: triggerLogin } = useAsyncLoading(handleLogin);
const { loading: registerLoading, trigger: triggerRegister } = useAsyncLoading(handleRegister);

const handleSubmit = async () => {
    try {
        if (isLogin.value) {
            await triggerLogin();
            return;
        }

        await triggerRegister();
    } catch {
        if (!isLogin.value) {
            message.error("注册失败，请稍后重试");
        }
    }
};

const loading = computed(() => loginLoading.value || registerLoading.value);
</script>

<style lang="scss" scoped>
.login-page {
    display: flex;
    justify-content: center;
    padding: 36px 0 12px;
}

.login-card {
    width: min(100%, 460px);
    padding: 32px 28px;
    border-radius: 24px;
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 18px 48px rgba(15, 23, 42, 0.12);
    backdrop-filter: blur(14px);
}

.login-title {
    margin: 0;
    font-size: 30px;
    font-weight: 800;
    text-align: center;
    color: #10233d;
}

.login-subtitle {
    margin: 10px 0 28px;
    text-align: center;
    font-size: 14px;
    color: #607089;
}

.switch-btn {
    border: 0;
    background: transparent;
    color: #1761c5;
    cursor: pointer;
}

:deep(.login-form .ant-form-item:last-child) {
    margin-bottom: 0;
}

:deep(.input-code) {
    padding-right: 96px;
}

$verifyimg-height: 32px;

.verify-code {
    position: absolute;
    right: 0;
    top: 0;
    height: $verifyimg-height;
    cursor: pointer;

    > :deep(svg) {
        width: 96px;
        height: $verifyimg-height;
    }
}

@media screen and (max-width: 767px) {
    .login-page {
        padding-top: 12px;
    }

    .login-card {
        padding: 24px 18px;
        border-radius: 20px;
    }

    .login-title {
        font-size: 24px;
    }
}
</style>
