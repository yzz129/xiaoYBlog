<template>
    <!-- 统一的手绘图标：所有线条共用同一笔触，避免混入风格不一致的通用图标。 -->
    <svg class="doodle-icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <g v-if="name === 'mascot'">
            <path d="M18 45c-7-1-10-6-8-12 1-4 4-6 8-6-1-8 5-14 13-13 5-5 14-2 14 5 7 0 11 5 10 11 5 2 7 7 4 12-3 5-10 6-17 4-5 5-14 5-19 1Z" fill="#fff" />
            <path d="M18 45c-7-1-10-6-8-12 1-4 4-6 8-6-1-8 5-14 13-13 5-5 14-2 14 5 7 0 11 5 10 11 5 2 7 7 4 12-3 5-10 6-17 4-5 5-14 5-19 1Z" stroke="currentColor" />
            <circle cx="26" cy="33" r="1.8" fill="currentColor" />
            <circle cx="42" cy="33" r="1.8" fill="currentColor" />
            <path d="M29 39c3 3 7 3 10 0M29 22c2 4 7 5 10 1" />
            <path d="M16 35l-3 1m34-1 3 1" stroke="#ff806d" />
        </g>

        <g v-else-if="name === 'plane'">
            <path d="m8 29 46-17-15 40-9-14-10 7 3-12-15-4Z" fill="#edf7ff" />
            <path d="m8 29 46-17-15 40-9-14-10 7 3-12-15-4Zm15 4 31-21-24 26" />
        </g>

        <g v-else-if="name === 'laptop'">
            <rect x="12" y="12" width="40" height="31" rx="3" fill="#edf7ff" />
            <path d="M12 43h40V12H12v31Zm-6 8h52l-5 4H11l-5-4Z" fill="#fff" />
            <path d="m25 24-5 5 5 5m14-10 5 5-5 5m-9 2 4-15" />
            <path d="M49 41c2-5 4-9 7-12m-5 4 6 2m-8 4 6 1" stroke="#45cfa4" />
        </g>

        <g v-else-if="name === 'api'">
            <path d="M16 44h34c7 0 10-9 4-13 2-9-11-14-17-7-4-10-20-7-20 4-11-1-13 16-1 16Z" fill="#fff" />
            <path d="M16 44h34c7 0 10-9 4-13 2-9-11-14-17-7-4-10-20-7-20 4-11-1-13 16-1 16Z" />
            <path d="M22 49v6m20-6v6M32 44v11M18 55h8m12 0h8" />
            <text x="22" y="38" fill="currentColor" stroke="none" font-size="12" font-family="XY Rounded, sans-serif">API</text>
        </g>

        <g v-else-if="name === 'note'">
            <path d="M14 9h34v46H14z" fill="#fff8dc" />
            <path d="M14 9h34v46H14zM20 19h20M20 27h16M20 35h20M20 43h13" />
            <path d="M11 14h6m-6 8h6m-6 8h6m-6 8h6m-6 8h6" />
            <path d="m48 43 8-18 4 2-8 18-5 4 1-6Z" fill="#edf7ff" />
        </g>

        <g v-else-if="name === 'browser'">
            <rect x="8" y="11" width="48" height="39" rx="3" fill="#edf7ff" />
            <path d="M8 19h48M15 15h1m5 0h1m5 0h1" />
            <circle cx="31" cy="34" r="8" fill="#fff" />
            <path d="M27 36c2 2 6 2 8 0m-7-5h.1m5.9 0h.1" />
            <path d="M48 32h10v13H48z" fill="#ffddd7" stroke="#ff806d" />
        </g>

        <g v-else-if="name === 'cup'">
            <path d="M12 19h33v30c-6 6-25 6-33 0V19Z" fill="#fff8dc" />
            <path d="M12 19h33v30c-6 6-25 6-33 0V19Zm33 7h5c9 0 8 14-5 14" />
            <path d="M15 19c4 3 24 3 30 0-4-4-25-4-30 0Z" fill="#536b80" />
            <path d="M52 48c0-12 3-21 7-27m-7 15 7 3m-5-9 6 1" stroke="#45cfa4" />
        </g>

        <g v-else-if="name === 'folder'">
            <path d="M8 18h18l5 6h25v28H8V18Z" fill="#edf7ff" />
            <path d="M8 18h18l5 6h25v28H8V18Z" />
        </g>

        <g v-else-if="name === 'tag'">
            <path d="m10 31 21-21h19l4 4v19L33 54 10 31Z" fill="#fff8dc" />
            <path d="m10 31 21-21h19l4 4v19L33 54 10 31Z" />
            <circle cx="43" cy="21" r="3" />
        </g>

        <g v-else-if="name === 'clock'">
            <circle cx="32" cy="32" r="23" fill="#edf7ff" />
            <path d="M32 19v14l10 6" />
        </g>

        <g v-else-if="name === 'message'">
            <path d="M9 12h46v34H28L16 55v-9H9V12Z" fill="#fff" />
            <path d="M9 12h46v34H28L16 55v-9H9V12Z" />
            <path d="M20 29h3m8 0h3m8 0h3" />
        </g>

        <g v-else-if="name === 'article'">
            <path d="M14 7h28l9 9v41H14V7Z" fill="#e8f8f2" />
            <path d="M42 7v10h9M14 7h28l9 9v41H14V7Zm9 22h19M23 37h19M23 45h13" />
        </g>

        <g v-else-if="name === 'pen'">
            <path d="m12 48 5-14L43 8l13 13-26 26-14 5-4-4Z" fill="#edf7ff" />
            <path d="m12 48 5-14L43 8l13 13-26 26-14 5-4-4Zm5-14 13 13M39 12l13 13" />
        </g>

        <g v-else-if="name === 'user'">
            <circle cx="32" cy="21" r="11" fill="#fff8dc" />
            <path d="M12 56c1-13 8-20 20-20s19 7 20 20M32 32c6 0 11-5 11-11S38 10 32 10s-11 5-11 11 5 11 11 11Z" />
        </g>
    </svg>
</template>

<script setup lang="ts">
defineProps<{
    name:
        | "mascot"
        | "plane"
        | "laptop"
        | "api"
        | "note"
        | "browser"
        | "cup"
        | "folder"
        | "tag"
        | "clock"
        | "message"
        | "article"
        | "pen"
        | "user";
}>();
</script>

<style scoped>
.doodle-icon {
    width: 1em;
    height: 1em;
    overflow: visible;
    color: #16324f;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
}
</style>
