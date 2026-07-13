<template>
    <section class="illustrated-empty-state">
        <img :src="EmptyMascot" alt="" aria-hidden="true" />
        <h2>{{ title }}</h2>
        <p v-if="description">{{ description }}</p>
        <slot />
    </section>
</template>

<script setup lang="ts">
import EmptyMascot from "@/assets/illustrations/empty-mascot.webp";

withDefaults(
    defineProps<{
        title?: string;
        description?: string;
    }>(),
    {
        title: "这里暂时还是空的",
        description: "有新内容后会自动出现在这里。",
    }
);
</script>

<style scoped>
.illustrated-empty-state {
    min-height: 310px;
    display: grid;
    place-items: center;
    align-content: center;
    padding: 28px;
    border: 1px dashed #cbdbe5;
    border-radius: 14px;
    text-align: center;
    background:
        linear-gradient(var(--xy-line) 1px, transparent 1px),
        linear-gradient(90deg, var(--xy-line) 1px, transparent 1px),
        #fff;
    background-size: 30px 30px;
}

.illustrated-empty-state img {
    width: 190px;
    margin-bottom: -8px;
}

.illustrated-empty-state h2 {
    margin: 0;
    color: var(--xy-ink);
    font-size: 18px;
}

.illustrated-empty-state p {
    margin: 7px 0 0;
    color: var(--xy-muted);
    font-size: 13px;
}
</style>
