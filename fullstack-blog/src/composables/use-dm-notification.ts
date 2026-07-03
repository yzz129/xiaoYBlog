import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { io, Socket } from "socket.io-client";
import { useStore } from "@/stores";
import { userService } from "@/services/user";
import { DirectMessageDTO, DirectMessageUnreadConversationDTO } from "@/bean/dto";
import { eventBus } from "@/utils/eventbus";

const POLL_INTERVAL_MS = 10000;

function resolveSocketEndpoint() {
    if (import.meta.env.VITE_SOCKET_SERVER) {
        return import.meta.env.VITE_SOCKET_SERVER;
    }

    return import.meta.env.DEV ? "http://127.0.0.1:8002" : window.location.origin;
}

export function useDmNotification() {
    const store = useStore();
    const unreadTotal = ref(0);
    const unreadConversations = ref<DirectMessageUnreadConversationDTO[]>([]);
    const socket = ref<Socket | null>(null);
    let timer: number | null = null;

    const isAuthed = computed(() => store.isAuthed);

    const clearState = () => {
        unreadTotal.value = 0;
        unreadConversations.value = [];
    };

    const fetchUnreadSummary = async () => {
        if (!isAuthed.value) {
            clearState();
            return;
        }

        try {
            const response = await userService.getUnreadDirectMessageSummary();
            unreadTotal.value = Number(response.data?.total_unread || 0);
            unreadConversations.value = response.data?.conversations || [];
        } catch (_error) {
            clearState();
        }
    };

    const stopPolling = () => {
        if (timer) {
            window.clearInterval(timer);
            timer = null;
        }
    };

    const disconnectSocket = () => {
        socket.value?.close();
        socket.value = null;
    };

    const connectSocket = () => {
        disconnectSocket();
        if (!isAuthed.value) {
            return;
        }

        const endpoint = resolveSocketEndpoint();
        socket.value = io(`${endpoint}/notify`, {
            path: "/socket.io",
            transports: ["websocket", "polling"],
            auth: {
                token: store.token,
            },
        });

        socket.value.on("dm:unread-summary", (payload: { total_unread: number; conversations: DirectMessageUnreadConversationDTO[] }) => {
            unreadTotal.value = Number(payload?.total_unread || 0);
            unreadConversations.value = payload?.conversations || [];
        });

        socket.value.on("dm:new", (payload: DirectMessageDTO) => {
            eventBus.emit("dmMessage", payload);
            void fetchUnreadSummary();
        });
    };

    const startPolling = () => {
        stopPolling();
        if (!isAuthed.value) {
            clearState();
            disconnectSocket();
            return;
        }

        void fetchUnreadSummary();
        connectSocket();
        timer = window.setInterval(() => {
            void fetchUnreadSummary();
        }, POLL_INTERVAL_MS);
    };

    const handleRefresh = () => {
        void fetchUnreadSummary();
    };

    watch(
        () => isAuthed.value,
        () => {
            startPolling();
        },
        { immediate: true }
    );

    onMounted(() => {
        eventBus.on("dmUnreadRefresh", handleRefresh);
    });

    onBeforeUnmount(() => {
        eventBus.off("dmUnreadRefresh", handleRefresh);
        stopPolling();
        disconnectSocket();
    });

    return {
        unreadTotal,
        unreadConversations,
        refreshUnreadSummary: fetchUnreadSummary,
    };
}
