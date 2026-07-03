<template>
    <a-button class="my-button" v-bind="$attrs">
        <slot name="icon">
            <icon-svg v-if="icon" :icon="icon" :size="iconSize" :color="iconColor" />
        </slot>
        <slot />
    </a-button>
</template>

<script setup lang="ts">
defineOptions({
    name: "MyButton",
    inheritAttrs: false,
});

defineProps({
    icon: {
        type: String,
    },
    iconSize: {
        type: Number,
        default: 14,
    },
    iconColor: {
        type: String,
    },
});
</script>
