<template>
    <base-layout>
        <section class="chat-room" :class="{ 'chat-room--direct': isDirectMode }">
            <a-card class="card-chat" hoverable>
                <template #title>
                    <div class="chat-header">
                        <div class="chat-title-wrap">
                            <div class="chat-title">
                                <template v-if="isDirectMode">
                                    <ThunderboltOutlined />
                                    <span>私聊会话</span>
                                </template>
                                <template v-else>
                                    <MessageOutlined />
                                    <span>在线聊天室</span>
                                </template>
                            </div>
                            <div class="chat-subtitle">{{ connectionText }}</div>
                        </div>
                        <template v-if="isDirectMode">
                            <a-button v-if="targetUser" type="link" @click="goToUserProfile(targetUser.id)">
                                <UserOutlined />
                                <span>查看资料</span>
                            </a-button>
                        </template>
                        <template v-else>
                            <a-tag :color="isConnected ? 'green' : 'orange'">
                                <TeamOutlined />
                                <span>在线 {{ onlineUsers.length }}</span>
                            </a-tag>
                        </template>
                    </div>
                </template>

                <div v-if="isDirectMode && targetUser" class="direct-user-card">
                    <router-link :to="`/user/${targetUser.id}`" class="direct-user-card__avatar">
                        <img :src="resolveAvatar(targetUser.avatar)" :alt="targetUser.nick_name || targetUser.user_name" />
                    </router-link>
                    <div class="direct-user-card__meta">
                        <router-link :to="`/user/${targetUser.id}`" class="direct-user-card__name">
                            {{ targetUser.nick_name || targetUser.user_name }}
                        </router-link>
                        <p>{{ targetUser.intro || "这个用户还没有填写个人简介。" }}</p>
                    </div>
                </div>

                <ul ref="msgBoxRef" class="msg-box">
                    <li v-for="messageItem in messageList" :key="messageItem.id" :class="messageItem.type">
                        <div v-if="messageItem.type === 'system'" class="system-message">
                            <span class="content">{{ messageItem.content }}</span>
                        </div>

                        <div v-else class="chat-item-wrap">
                            <div class="txt-wrap">
                                <div class="chat-meta">
                                    <router-link v-if="messageItem.userId" :to="`/user/${messageItem.userId}`" class="chat-user-name">
                                        {{ messageItem.userName }}
                                    </router-link>
                                    <span v-else class="chat-user-name">{{ messageItem.userName }}</span>
                                    <span class="chat-time">{{ formatMessageTime(messageItem.createdAt) }}</span>
                                </div>
                                <div class="chat-text">
                                    <span>{{ messageItem.content }}</span>
                                </div>
                            </div>
                            <router-link v-if="messageItem.userId" :to="`/user/${messageItem.userId}`" class="chat-user-link">
                                <img :src="messageItem.avatar" alt="avatar" />
                            </router-link>
                            <img v-else :src="messageItem.avatar" alt="avatar" />
                        </div>
                    </li>
                </ul>

                <div v-if="!isDirectMode" class="online-users">
                    <span class="online-users__label">
                        <TeamOutlined />
                        <span>当前在线：</span>
                    </span>
                    <router-link v-for="user in onlineUsers" :key="user.userId" :to="`/user/${user.userId}`" class="online-user">
                        <img :src="resolveAvatar(user.avatar)" :alt="user.name" />
                        <a-tag color="blue">
                            {{ user.name }}<span v-if="user.userId === selfId">（我）</span>
                        </a-tag>
                    </router-link>
                </div>

                <a-form ref="chatFormRef" :model="chatForm" :rules="chatRules" class="form-chat">
                    <a-form-item name="chatContent" class="form-item--content" :wrapper-col="{ span: 24 }">
                        <a-textarea
                            v-model:value="chatForm.chatContent"
                            :placeholder="inputPlaceholder"
                            :auto-size="{ minRows: 2, maxRows: 4 }"
                            @keydown="onKeydownChat"
                        />
                    </a-form-item>
                    <a-form-item class="form-item--btn">
                        <a-button type="primary" :loading="isSending" :disabled="sendDisabled" @click="sendChatContent">
                            <SendOutlined />
                            <span>发送</span>
                        </a-button>
                    </a-form-item>
                </a-form>
            </a-card>
        </section>
    </base-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { message } from "ant-design-vue";
import type { Rule } from "ant-design-vue/es/form";
import { io, type Socket } from "socket.io-client";
import { useRoute, useRouter } from "vue-router";
import {
    MessageOutlined,
    SendOutlined,
    TeamOutlined,
    ThunderboltOutlined,
    UserOutlined,
} from "@ant-design/icons-vue";

import type { DirectMessageDTO, UserDTO } from "@/bean/dto";
import { userService } from "@/services/user";
import { useStore } from "@/stores";
import { defaultAvatar, resolveAvatar } from "@/utils/avatar";
import { format } from "@/utils/date-utils";
import { setScrollTop } from "@/utils/dom";
import { eventBus } from "@/utils/eventbus";

interface ChatUser {
    socketId: string;
    userId: string;
    name: string;
    avatar?: string;
    joinedAt: string;
}

interface ChatMessage {
    id: string;
    type: "system" | "mine" | "others";
    userId?: string;
    userName: string;
    avatar: string;
    content: string;
    createdAt: string;
}

interface ServerChatMessage {
    id: string;
    userId: string;
    userName: string;
    avatar?: string;
    content: string;
    createdAt: string;
}

const store = useStore();
const route = useRoute();
const router = useRouter();

const socket = ref<Socket | null>(null);
const pollingTimer = ref<number | null>(null);
const selfId = ref("");
const isConnected = ref(false);
const isSending = ref(false);
const msgBoxRef = ref<HTMLElement | null>(null);
const chatFormRef = ref();
const onlineUsers = ref<ChatUser[]>([]);
const messageList = ref<ChatMessage[]>([]);
const targetUser = ref<UserDTO | null>(null);

const chatForm = reactive({
    chatContent: "",
});

const targetUserId = computed(() => Number(route.query.userId || 0));
const isDirectMode = computed(() => route.query.mode === "direct" && targetUserId.value > 0);
const currentDisplayName = computed(() => {
    const userInfo = store.userInfo;
    return userInfo?.nick_name || userInfo?.user_name || userInfo?.username || "";
});

const chatRules: Record<string, Rule[]> = {
    chatContent: [{ required: true, message: "请输入聊天内容", trigger: "blur" }],
};

const connectionText = computed(() => {
    if (isDirectMode.value) {
        return targetUser.value
            ? `当前正在与 ${targetUser.value.nick_name || targetUser.value.user_name} 私聊`
            : "正在加载私聊对象...";
    }

    if (isConnected.value) {
        return `已连接，当前身份：${currentDisplayName.value}`;
    }

    return "连接已断开，聊天室暂不可用";
});

const inputPlaceholder = computed(() =>
    isDirectMode.value ? "输入私聊消息，Enter 发送，Ctrl+Enter 换行" : "输入消息后发送，Enter 发送，Ctrl+Enter 换行"
);

const sendDisabled = computed(() => (isDirectMode.value ? !targetUser.value : !isConnected.value));

const resolveSocketEndpoint = () => {
    if (import.meta.env.VITE_SOCKET_SERVER) {
        return import.meta.env.VITE_SOCKET_SERVER;
    }

    return import.meta.env.DEV ? "http://127.0.0.1:8002" : window.location.origin;
};

const appendMessage = (chatMessage: ChatMessage) => {
    messageList.value.push(chatMessage);
};

const hasMessage = (id: string) => messageList.value.some((item) => item.id === id);

const scrollToBottom = async () => {
    await nextTick();
    const target = msgBoxRef.value;
    if (!target) {
        return;
    }

    const scrollTop = target.scrollHeight - target.clientHeight;
    setScrollTop({
        target,
        useAnimation: true,
        targetValue: Math.max(scrollTop, 0),
    });
};

const createClientMessage = (messagePayload: ServerChatMessage): ChatMessage => ({
    id: messagePayload.id,
    type: messagePayload.userId === selfId.value ? "mine" : "others",
    userId: messagePayload.userId,
    userName: messagePayload.userName,
    avatar: resolveAvatar(messagePayload.avatar, defaultAvatar),
    content: messagePayload.content,
    createdAt: messagePayload.createdAt,
});

const createDirectMessage = (messagePayload: DirectMessageDTO): ChatMessage => ({
    id: String(messagePayload.id),
    type: String(messagePayload.sender_id) === selfId.value ? "mine" : "others",
    userId: String(messagePayload.sender_id),
    userName: messagePayload.sender_name,
    avatar: resolveAvatar(messagePayload.sender_avatar, defaultAvatar),
    content: messagePayload.content,
    createdAt: messagePayload.create_time,
});

const stopSocket = () => {
    socket.value?.close();
    socket.value = null;
    isConnected.value = false;
    onlineUsers.value = [];
};

const stopPolling = () => {
    if (pollingTimer.value) {
        window.clearInterval(pollingTimer.value);
        pollingTimer.value = null;
    }
};

const connectSocket = () => {
    if (!store.isAuthed) {
        isConnected.value = false;
        message.warning("请先登录后再进入聊天室");
        return;
    }

    const endpoint = resolveSocketEndpoint();
    socket.value = io(`${endpoint}/chatroom`, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        auth: {
            token: store.token,
        },
    });

    socket.value.on("connect", () => {
        isConnected.value = true;
    });

    socket.value.on("disconnect", () => {
        isConnected.value = false;
    });

    socket.value.on("connect_error", (error) => {
        isConnected.value = false;
        message.error(error.message || "聊天室连接失败");
    });

    socket.value.on("chat:init", (payload: { selfId: string; history: ServerChatMessage[]; onlineUsers: ChatUser[] }) => {
        selfId.value = payload.selfId;
        onlineUsers.value = payload.onlineUsers || [];
        messageList.value = (payload.history || []).map(createClientMessage);
        void scrollToBottom();
    });

    socket.value.on("chat:presence", (payload: { onlineUsers: ChatUser[] }) => {
        onlineUsers.value = payload.onlineUsers || [];
    });

    socket.value.on("chat:system", (payload: { id: string; content: string; createdAt: string }) => {
        appendMessage({
            id: payload.id,
            type: "system",
            userName: "系统通知",
            avatar: defaultAvatar,
            content: payload.content,
            createdAt: payload.createdAt,
        });
        void scrollToBottom();
    });

    socket.value.on("chat:message", (payload: ServerChatMessage) => {
        appendMessage(createClientMessage(payload));
        void scrollToBottom();
    });
};

const loadDirectMessages = async () => {
    if (!targetUserId.value) {
        targetUser.value = null;
        messageList.value = [];
        eventBus.emit("dmUnreadRefresh");
        return;
    }

    const response = await userService.getDirectMessages(targetUserId.value);
    targetUser.value = response.data?.target_user || null;
    selfId.value = String(store.userInfo?.id || "");
    messageList.value = (response.data?.messages || []).map(createDirectMessage);
    eventBus.emit("dmUnreadRefresh");
    await scrollToBottom();
};

const startDirectPolling = () => {
    stopPolling();
    pollingTimer.value = window.setInterval(() => {
        void loadDirectMessages();
    }, 15000);
};

const initializePage = async () => {
    try {
        await store.fetchCurrent(true);
    } catch (_error) {
        // ignore
    }

    stopSocket();
    stopPolling();
    messageList.value = [];

    if (isDirectMode.value) {
        await loadDirectMessages();
        startDirectPolling();
        return;
    }

    targetUser.value = null;
    connectSocket();
};

const sendPublicMessage = async () => {
    if (!socket.value || !isConnected.value) {
        message.warning("聊天室未连接");
        return;
    }

    socket.value.emit("chat:send", { content: chatForm.chatContent.trim() }, (response: { success: boolean; message?: string }) => {
        isSending.value = false;

        if (!response?.success) {
            message.error(response?.message || "消息发送失败");
            return;
        }

        chatForm.chatContent = "";
        chatFormRef.value?.clearValidate?.();
    });
};

const sendDirectMessage = async () => {
    if (!targetUser.value) {
        message.warning("私聊对象不可用");
        return;
    }

    await userService.sendDirectMessage(targetUser.value.id, chatForm.chatContent.trim());
    chatForm.chatContent = "";
    chatFormRef.value?.clearValidate?.();
};

const sendChatContent = async () => {
    await chatFormRef.value?.validate();
    const content = chatForm.chatContent.trim();
    if (!content) {
        return;
    }

    isSending.value = true;
    try {
        if (isDirectMode.value) {
            await sendDirectMessage();
        } else {
            await sendPublicMessage();
            return;
        }
    } finally {
        isSending.value = false;
    }
};

const onKeydownChat = (event: KeyboardEvent) => {
    if (event.key === "Enter" && !event.ctrlKey && !event.shiftKey) {
        event.preventDefault();
        void sendChatContent();
    }
};

const formatMessageTime = (value: string) => format(new Date(value), "HH:mm:ss");

const goToUserProfile = (id: number) => {
    router.push(`/user/${id}`);
};

const handleRealtimeDirectMessage = (payload: DirectMessageDTO) => {
    if (!isDirectMode.value || !targetUserId.value) {
        return;
    }

    const currentUserId = Number(store.userInfo?.id || 0);
    const isCurrentConversation =
        (payload.sender_id === targetUserId.value && payload.receiver_id === currentUserId) ||
        (payload.sender_id === currentUserId && payload.receiver_id === targetUserId.value);

    if (!isCurrentConversation || hasMessage(String(payload.id))) {
        return;
    }

    appendMessage(createDirectMessage(payload));

    if (payload.sender_id === targetUserId.value) {
        void loadDirectMessages();
        return;
    }

    void scrollToBottom();
};

onMounted(() => {
    eventBus.on("dmMessage", handleRealtimeDirectMessage);
    void initializePage();
});

onBeforeUnmount(() => {
    eventBus.off("dmMessage", handleRealtimeDirectMessage);
    stopSocket();
    stopPolling();
});

watch(
    () => [route.query.mode, route.query.userId],
    () => {
        void initializePage();
    }
);

watch(
    () => messageList.value.length,
    () => {
        void scrollToBottom();
    }
);
</script>

<style lang="scss" scoped>
.chat-room {
    padding: 12px 0;
}

.chat-room :deep(.ant-card-body) {
    min-height: 0;
}

.chat-room--direct {
    height: calc(100vh - 140px);
    min-height: calc(100vh - 140px);
    max-height: calc(100vh - 140px);
}

:deep(.card-chat) {
    overflow: hidden;
    border: 1px solid rgba(226, 232, 240, 0.9);
    border-radius: 28px;
    background: rgba(255, 255, 255, 0.88);
    box-shadow: 0 20px 46px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(16px);

    .ant-card-head {
        background: linear-gradient(135deg, rgba(214, 240, 245, 0.9), rgba(233, 247, 255, 0.84));
    }

    .ant-card-body {
        padding: 14px;
    }
}

.chat-room--direct :deep(.card-chat) {
    position: sticky;
    top: 12px;
    height: 100%;

    .ant-card-head {
        flex: 0 0 auto;
    }

    .ant-card-body {
        height: calc(100% - 57px);
        display: flex;
        flex-direction: column;
        padding: 12px 14px;
    }
}

.chat-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}

.chat-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.chat-title {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 26px;
    font-weight: 800;
    color: #10233d;
}

.chat-subtitle {
    font-size: 14px;
    color: #4b5563;
}

.direct-user-card {
    display: flex;
    gap: 14px;
    align-items: center;
    margin: 0 4px 12px;
    padding: 14px;
    border-radius: 18px;
    background: linear-gradient(135deg, rgba(248, 250, 252, 0.98), rgba(240, 249, 255, 0.88));
    box-shadow: inset 0 0 0 1px rgba(226, 232, 240, 0.9);
}

.direct-user-card__avatar img {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    object-fit: cover;
    box-shadow: 0 10px 18px rgba(15, 23, 42, 0.12);
}

.direct-user-card__meta {
    flex: 1;

    p {
        margin: 6px 0 0;
        color: #6b7280;
    }
}

.direct-user-card__name {
    font-size: 16px;
    font-weight: 800;
    color: #111827;
}

.msg-box {
    position: relative;
    padding: 8px 12px 12px;
    min-height: 420px;
    max-height: min(720px, calc(100vh - 280px));
    overflow: auto;

    &::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }

    &::-webkit-scrollbar-thumb {
        border-radius: 999px;
        background-color: rgba(148, 163, 184, 0.66);
    }

    &::-webkit-scrollbar-track {
        background: rgba(240, 244, 248, 0.8);
    }

    > li + li {
        margin-top: 12px;
    }

    > li {
        display: flex;
        width: 100%;
    }
}

.chat-room--direct .msg-box {
    flex: 1;
    min-height: 0;
    max-height: none;
}

.system-message {
    width: 100%;
    text-align: center;

    .content {
        display: inline-block;
        padding: 0 15px;
        line-height: 32px;
        border-radius: 999px;
        background: rgba(226, 232, 240, 0.7);
        color: #4b5563;
        font-size: 13px;
        animation: fadeSlideIn 0.28s ease;
    }
}

.mine {
    justify-content: flex-end;

    .chat-item-wrap {
        margin-left: auto;
        flex-direction: row;
    }

    .txt-wrap {
        align-items: flex-end;
    }

    .chat-meta {
        justify-content: flex-end;
    }

    .chat-text {
        justify-content: flex-end;
    }

    .chat-text span {
        background: linear-gradient(135deg, #37b87a, #5ecb8c);
        color: #fff;
        box-shadow: 0 12px 20px rgba(55, 184, 122, 0.2);

        &::after {
            right: -10px;
            border-color: #51c586 transparent transparent;
        }
    }
}

.others {
    justify-content: flex-start;

    .chat-item-wrap {
        margin-right: auto;
        flex-direction: row-reverse;
    }

    .txt-wrap {
        align-items: flex-start;
    }

    .chat-meta {
        justify-content: flex-start;
    }

    .chat-text {
        justify-content: flex-start;
    }

    .chat-text span {
        background: #eef2f7;
        color: #111827;
        box-shadow: 0 10px 16px rgba(15, 23, 42, 0.06);

        &::after {
            left: -10px;
            border-color: #eef2f7 transparent transparent;
        }
    }
}

.chat-item-wrap {
    display: inline-flex;
    align-items: flex-start;
    gap: 10px;
    max-width: 100%;
    animation: fadeSlideIn 0.24s ease;

    .txt-wrap {
        display: flex;
        flex-direction: column;
        line-height: 1.4;
        font-size: 12px;
        color: #6b7280;
        max-width: calc(100% - 44px);
    }

    img {
        width: 36px;
        height: 36px;
        border-radius: 100%;
        object-fit: cover;
        flex: 0 0 36px;
        margin-top: 22px;
        box-shadow: 0 10px 16px rgba(15, 23, 42, 0.12);
    }
}

.chat-user-link {
    display: inline-flex;
    flex: 0 0 36px;
}

.chat-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
}

.chat-user-name {
    color: #374151;
    font-weight: 700;
    line-height: 1.2;
}

.chat-time {
    color: #6b7280;
    line-height: 1.2;
}

.chat-text {
    display: flex;
    width: 100%;
    margin-top: 6px;
}

.chat-text span {
    position: relative;
    display: inline-block;
    max-width: min(100%, 560px);
    padding: 10px 16px;
    border-radius: 16px;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 14px;

    &::after {
        content: "";
        position: absolute;
        top: 10px;
        width: 0;
        height: 0;
        overflow: hidden;
        border-style: solid dashed dashed;
        border-width: 10px;
    }
}

.online-users {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin: 8px 0 12px;
    padding: 0 12px;
}

.online-user {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    transition: transform 0.2s ease;

    &:hover {
        transform: translateY(-1px);
    }

    img {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        object-fit: cover;
        box-shadow: 0 8px 14px rgba(15, 23, 42, 0.1);
    }
}

.online-users__label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #4b5563;
    font-size: 14px;
}

:deep(.form-chat) {
    display: flex;
    align-items: flex-end;
    padding: 10px 4px 0;
    border-top: 1px solid #eef2f7;

    .form-item--content {
        flex: 1;
        margin: 0 16px 0 0;
    }

    .form-item--btn {
        margin-bottom: 0;

        .ant-form-item-control {
            line-height: 1;
        }
    }

    .ant-btn {
        height: 42px;
        border-radius: 14px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 700;
    }
}

@keyframes fadeSlideIn {
    0% {
        opacity: 0;
        transform: translateY(8px);
    }

    100% {
        opacity: 1;
        transform: translateY(0);
    }
}

@media screen and (max-width: 768px) {
    .chat-room {
        padding: 4px 0;
    }

    .chat-room--direct {
        height: calc(100vh - 116px);
        min-height: calc(100vh - 116px);
        max-height: calc(100vh - 116px);
    }

    :deep(.card-chat) {
        border-radius: 22px;

        .ant-card-head {
            min-height: 54px;
            padding: 0 14px;
        }

        .ant-card-body {
            padding: 12px;
        }
    }

    .chat-header {
        flex-direction: column;
        align-items: flex-start;
    }

    .chat-title {
        font-size: 22px;
    }

    .direct-user-card {
        align-items: flex-start;
        padding: 12px;
        margin-inline: 0;
    }

    .msg-box {
        min-height: 360px;
        max-height: calc(100vh - 300px);
        padding: 6px 4px 8px;
    }

    .chat-item-wrap .txt-wrap {
        max-width: calc(100% - 38px);
    }

    .chat-text span {
        max-width: min(100%, 72vw);
    }

    .online-users {
        margin: 6px 0 10px;
        padding: 0 4px;
    }

    :deep(.form-chat) {
        flex-direction: column;
        gap: 10px;
        padding: 10px 0 0;

        .form-item--content {
            margin-right: 0;
            margin-bottom: 0;
            width: 100%;
        }

        .form-item--btn {
            width: 100%;
        }

        .ant-btn {
            width: 100%;
            justify-content: center;
        }
    }
}

@media screen and (max-width: 480px) {
    .chat-room--direct {
        height: calc(100vh - 104px);
        min-height: calc(100vh - 104px);
        max-height: calc(100vh - 104px);
    }

    :deep(.card-chat) {
        border-radius: 18px;

        .ant-card-head {
            padding: 0 12px;
        }

        .ant-card-body {
            padding: 10px;
        }
    }

    .chat-title {
        font-size: 19px;
        gap: 8px;
    }

    .chat-subtitle {
        font-size: 13px;
        line-height: 1.5;
    }

    .direct-user-card {
        gap: 10px;
        padding: 10px;
        border-radius: 16px;
    }

    .direct-user-card__avatar img {
        width: 44px;
        height: 44px;
    }

    .direct-user-card__meta p {
        margin-top: 4px;
        font-size: 13px;
        line-height: 1.5;
    }

    .msg-box {
        min-height: 300px;
        max-height: calc(100vh - 270px);
        padding-inline: 2px;
    }

    .system-message .content {
        padding: 0 12px;
        line-height: 28px;
        font-size: 12px;
    }

    .chat-item-wrap {
        gap: 8px;
    }

    .chat-item-wrap img {
        width: 32px;
        height: 32px;
        flex-basis: 32px;
        margin-top: 18px;
    }

    .chat-user-link {
        flex-basis: 32px;
    }

    .chat-item-wrap .txt-wrap {
        max-width: calc(100% - 34px);
    }

    .chat-meta {
        gap: 6px 8px;
        font-size: 12px;
    }

    .chat-text span {
        max-width: min(100%, 78vw);
        padding: 9px 12px;
        font-size: 13px;
        border-radius: 14px;
    }

    .online-users {
        gap: 6px;
    }

    .online-users__label {
        width: 100%;
        font-size: 13px;
    }

    :deep(.form-chat) {
        gap: 8px;

        .ant-btn {
            height: 40px;
            border-radius: 12px;
        }
    }
}
</style>
