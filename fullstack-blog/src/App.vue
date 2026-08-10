<template>
    <a-config-provider :locale="zhCN">
        <section :class="{ 'hidden-x': isMenuVisible, 'is-admin': isAdmin }">
            <router-view :key="$route.path" />
        </section>
        <AgentPet :visible="showAgentPet" :preview="agentPreview" />
    </a-config-provider>
</template>

<script setup lang="ts">
import { computed } from "vue";

import zhCN from "ant-design-vue/es/locale/zh_CN";

import { useRoute } from "vue-router";

import { ConfigProvider } from "ant-design-vue";

import { eventBus } from "./utils/eventbus";

import { useStore } from "@/stores";
import AgentPet from "@/components/agent-pet/index.vue";

const store = useStore();

const route = useRoute();

const handleEvents = () => {
            eventBus.on("sessionInvalid", () => {
                store.clearUserSession();
            });
        };

handleEvents();

const isAdmin = computed(() => route.meta.isAdmin as boolean);

const isMenuVisible = computed(() => store.isMenuVisible);

const agentPreview = computed(() => import.meta.env.DEV && route.query.agentPreview === "1");

const showAgentPet = computed(() => (store.isAuthed && route.name !== "Login") || agentPreview.value);
</script>

<style lang="scss" scoped>
.hidden-x {
    overflow-x: hidden;
}
.is-admin {
    height: 100vh;
    width: 100vw;
    overflow: hidden;
}
</style>
