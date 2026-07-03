<template>
    <my-icon
        class="icon-svg"
        :type="iconType"
        :style="{
            fontSize: size && `${size}px`,
            color: color,
        }"
        v-bind="$attrs"
    />
</template>

<script setup lang="ts">
import { createFromIconfontCN } from "@ant-design/icons-vue";

import { computed } from "vue";

const MyIcon = createFromIconfontCN({
    // 每次在 iconfont 修改了图标，需要重新生成链接，复制到这里
    scriptUrl: "//at.alicdn.com/t/font_1570300_zwupv8bc2lp.js",
});

const iconPrefix = "icon-";

const fallbackIcon = "home";

const props = defineProps({
        icon: {
            type: String,
        },
        size: {
            type: Number,
        },
        // 只对单色图标有用
        color: {
            type: String,
            default: "",
        },
    });

const iconType = computed(() => `${iconPrefix}${props.icon || fallbackIcon}`);
</script>

<style lang="scss" scoped>
.icon-svg {
    font-size: 16px;
}
.icon-svg + .icon-svg {
    margin-left: 10px;
}
</style>
