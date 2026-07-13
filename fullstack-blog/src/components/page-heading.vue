<template>
    <header class="page-heading">
        <div class="page-heading__copy">
            <h1>{{ title }}</h1>
            <p v-if="description">{{ description }}</p>
        </div>
        <DoodleIcon :name="icon" class="page-heading__icon" />
    </header>
</template>

<script setup lang="ts">
import DoodleIcon from "@/components/doodle-icon.vue";

withDefaults(
    defineProps<{
        title: string;
        description?: string;
        icon?: "plane" | "folder" | "tag" | "clock" | "message" | "article" | "pen" | "user";
    }>(),
    {
        description: "",
        icon: "plane",
    }
);
</script>

<style scoped>
.page-heading {
    min-height: 112px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 28px;
    margin-bottom: 28px;
    padding: 20px 0 24px;
    border-bottom: 1px solid var(--xy-line);
}

.page-heading h1 {
    position: relative;
    margin: 0;
    color: var(--xy-ink);
    font-size: clamp(30px, 4vw, 46px);
    font-weight: 950;
    line-height: 1.15;
    letter-spacing: 0.025em;
}

.page-heading h1::after {
    content: "";
    position: absolute;
    left: 0;
    bottom: -9px;
    width: min(150px, 70%);
    height: 7px;
    border-top: 3px solid var(--xy-yellow);
    border-radius: 50%;
    transform: rotate(-1deg);
}

.page-heading p {
    margin: 18px 0 0;
    color: var(--xy-muted);
    font-size: 14px;
}

.page-heading__icon {
    width: 78px;
    height: 78px;
    flex: 0 0 auto;
    transform: rotate(-5deg);
}

@media (max-width: 700px) {
    .page-heading {
        min-height: 88px;
        margin-bottom: 18px;
        padding: 16px 0 18px;
    }

    .page-heading h1 {
        font-size: 30px;
    }

    .page-heading__icon {
        width: 54px;
        height: 54px;
    }
}
</style>
