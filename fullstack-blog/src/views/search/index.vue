<template>
    <base-layout>
        <section class="search-page">
            <PageHeading
                title="搜索结果"
                :description="keyword ? `正在查找：${keyword}` : '输入关键词，寻找文章或创作者。'"
                icon="plane"
            />

            <div class="search-switch">
                <button
                    type="button"
                    class="search-switch__btn"
                    :class="{ 'search-switch__btn--active': activeTab === 'users' }"
                    @click="switchTab('users')"
                >
                    用户
                    <span>{{ userState.total }}</span>
                </button>
                <button
                    type="button"
                    class="search-switch__btn"
                    :class="{ 'search-switch__btn--active': activeTab === 'articles' }"
                    @click="switchTab('articles')"
                >
                    文章
                    <span>{{ articleState.total }}</span>
                </button>
            </div>

            <section v-if="activeTab === 'users'" class="search-panel">
                <a-skeleton :loading="userState.loading && !userState.list.length" active :paragraph="{ rows: 8 }">
                    <template v-if="userState.list.length">
                        <div class="user-list">
                            <router-link
                                v-for="user in userState.list"
                                :key="user.id"
                                :to="`/user/${user.id}`"
                                class="user-card"
                            >
                                <img class="user-card__avatar" :src="resolveAvatar(user.avatar)" :alt="user.nick_name || user.user_name" />
                                <div class="user-card__content">
                                    <div class="user-card__head">
                                        <strong>{{ user.nick_name || user.user_name }}</strong>
                                        <span>@{{ user.user_name }}</span>
                                    </div>
                                    <p class="user-card__intro">{{ user.intro || "这个用户还没有填写个人简介。" }}</p>
                                    <div class="user-card__stats">
                                        <span>{{ user.article_count || 0 }} 篇文章</span>
                                        <span>{{ user.follower_count || 0 }} 粉丝</span>
                                        <span>{{ user.following_count || 0 }} 关注</span>
                                    </div>
                                </div>
                            </router-link>
                        </div>

                        <div v-if="userState.loading" class="loading-more">加载中...</div>
                        <div v-else-if="!userState.hasMore" class="loading-more loading-more--end">没有更多用户了</div>
                        <div ref="userSentinel" class="scroll-sentinel" />
                    </template>
                    <IllustratedEmpty v-else title="没有找到相关用户" description="换一个关键词再试试吧。" />
                </a-skeleton>
            </section>

            <section v-else class="search-panel">
                <a-skeleton :loading="articleState.loading && !articleState.list.length" active :paragraph="{ rows: 8 }">
                    <template v-if="articleState.list.length">
                        <div class="article-list">
                            <CardArticle v-for="article in articleState.list" :key="article.id" :article="article" />
                        </div>

                        <div v-if="articleState.loading" class="loading-more">加载中...</div>
                        <div v-else-if="!articleState.hasMore" class="loading-more loading-more--end">没有更多文章了</div>
                        <div ref="articleSentinel" class="scroll-sentinel" />
                    </template>
                    <IllustratedEmpty v-else title="没有找到相关文章" description="换一个关键词再试试吧。" />
                </a-skeleton>
            </section>
        </section>
    </base-layout>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

import type { ArticleDTO, UserDTO } from "@/bean/dto";
import CardArticle from "@/components/card/card-article.vue";
import IllustratedEmpty from "@/components/illustrated-empty.vue";
import PageHeading from "@/components/page-heading.vue";
import { articleService } from "@/services/article";
import { userService } from "@/services/user";
import { resolveAvatar } from "@/utils/avatar";

type SearchTab = "users" | "articles";

interface SearchState<T> {
    list: T[];
    pageNo: number;
    total: number;
    loading: boolean;
    hasMore: boolean;
}

const createSearchState = <T>(): SearchState<T> => ({
    list: [],
    pageNo: 1,
    total: 0,
    loading: false,
    hasMore: true,
});

const route = useRoute();
const router = useRouter();
const pageSize = 10;

const userSentinel = ref<HTMLElement | null>(null);
const articleSentinel = ref<HTMLElement | null>(null);
const observer = ref<IntersectionObserver | null>(null);

const userState = reactive<SearchState<UserDTO>>(createSearchState<UserDTO>());
const articleState = reactive<SearchState<ArticleDTO>>(createSearchState<ArticleDTO>());

const keyword = computed(() => String(route.query.q || "").trim());
const activeTab = computed<SearchTab>(() => (route.query.tab === "articles" ? "articles" : "users"));

const resetState = <T>(state: SearchState<T>) => {
    state.list = [];
    state.pageNo = 1;
    state.total = 0;
    state.loading = false;
    state.hasMore = true;
};

const loadUsers = async (reset = false) => {
    if (!keyword.value || userState.loading || (!userState.hasMore && !reset)) {
        return;
    }

    if (reset) {
        resetState(userState);
    }

    userState.loading = true;
    try {
        const res = await userService.search({
            keyword: keyword.value,
            pageNo: userState.pageNo,
            pageSize,
        });
        const data = res.data || [];
        userState.total = res.total || 0;
        userState.list = reset ? data : [...userState.list, ...data];
        userState.hasMore = userState.list.length < userState.total;
        if (data.length > 0) {
            userState.pageNo += 1;
        } else {
            userState.hasMore = false;
        }
    } finally {
        userState.loading = false;
    }
};

const loadArticles = async (reset = false) => {
    if (!keyword.value || articleState.loading || (!articleState.hasMore && !reset)) {
        return;
    }

    if (reset) {
        resetState(articleState);
    }

    articleState.loading = true;
    try {
        const res = await articleService.search({
            keyword: keyword.value,
            pageNo: articleState.pageNo,
            pageSize,
        });
        const data = res.data || [];
        articleState.total = res.total || 0;
        articleState.list = reset ? data : [...articleState.list, ...data];
        articleState.hasMore = articleState.list.length < articleState.total;
        if (data.length > 0) {
            articleState.pageNo += 1;
        } else {
            articleState.hasMore = false;
        }
    } finally {
        articleState.loading = false;
    }
};

const bindObserver = async () => {
    await nextTick();
    observer.value?.disconnect();

    const target = activeTab.value === "users" ? userSentinel.value : articleSentinel.value;
    if (!target) {
        return;
    }

    observer.value = new IntersectionObserver(
        (entries) => {
            if (!entries[0]?.isIntersecting) {
                return;
            }

            if (activeTab.value === "users") {
                void loadUsers();
                return;
            }

            void loadArticles();
        },
        {
            root: null,
            rootMargin: "0px 0px 240px 0px",
            threshold: 0,
        }
    );

    observer.value.observe(target);
};

const loadPage = async () => {
    resetState(userState);
    resetState(articleState);

    if (!keyword.value) {
        await bindObserver();
        return;
    }

    await Promise.all([loadUsers(true), loadArticles(true)]);
    await bindObserver();
};

const switchTab = (tab: SearchTab) => {
    router.push({
        path: "/search",
        query: {
            ...route.query,
            q: keyword.value,
            tab,
        },
    });
};

watch(
    () => route.query.q,
    () => {
        void loadPage();
    },
    { immediate: true }
);

watch(
    () => route.query.tab,
    async () => {
        await bindObserver();
    }
);

onMounted(() => {
    void bindObserver();
});

onBeforeUnmount(() => {
    observer.value?.disconnect();
});
</script>

<style lang="scss" scoped>
.search-page {
    width: min(1120px, 100%);
    margin: 0 auto;
    padding: 8px 0 40px;
}

.search-switch {
    display: flex;
    gap: 0;
    margin-bottom: 20px;
    border-bottom: 1px solid var(--xy-line);
}

.search-switch__btn {
    min-width: 150px;
    height: 50px;
    border: none;
    border-radius: 0;
    background: transparent;
    color: var(--xy-text);
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    box-shadow: none;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;

    span {
        min-width: 28px;
        padding: 4px 8px;
        border-radius: 5px;
        background: var(--xy-blue-soft);
        color: var(--xy-muted);
        font-size: 14px;
    }
}

.search-switch__btn:hover {
    color: var(--xy-ink);
    transform: none;
}

.search-switch__btn--active {
    color: var(--xy-ink);
    background: var(--xy-mint-soft);
    box-shadow: inset 0 -3px 0 var(--xy-mint);

    span {
        background: #fff;
        color: var(--xy-text);
    }
}

.search-panel {
    min-height: 180px;
}

.article-list,
.user-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.user-card {
    display: flex;
    gap: 18px;
    padding: 20px 4px;
    background: #fff;
    border: 0;
    border-bottom: 1px solid var(--xy-line);
    border-radius: 0;
    box-shadow: none;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.user-card:hover {
    padding-inline: 12px;
    background: var(--xy-yellow-soft);
    transform: none;
    box-shadow: none;
}

.user-card__avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    border: 2px solid rgb(15 95 168 / 8%);
}

.user-card__content {
    min-width: 0;
    flex: 1;
}

.user-card__head {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;

    strong {
        font-size: 20px;
        color: #0f172a;
    }

    span {
        color: #64748b;
    }
}

.user-card__intro {
    margin: 10px 0 14px;
    color: #334155;
    line-height: 1.7;
}

.user-card__stats {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    color: #64748b;
    font-size: 14px;
}

.loading-more {
    margin-top: 18px;
    text-align: center;
    color: #64748b;
}

.loading-more--end {
    color: #94a3b8;
}

.scroll-sentinel {
    width: 100%;
    height: 1px;
}

@media screen and (max-width: 768px) {
    .search-head {
        padding: 22px 18px;
        border-radius: 18px;
    }

    .search-switch {
        gap: 10px;
    }

    .search-switch__btn {
        height: 50px;
        font-size: 16px;
    }

    .article-list,
    .user-list {
        gap: 14px;
    }

    .user-card {
        padding: 18px;
        gap: 14px;
        border-radius: 18px;
    }

    .user-card__avatar {
        width: 60px;
        height: 60px;
    }

    .user-card__head strong {
        font-size: 18px;
    }
}

@media screen and (max-width: 576px) {
    .search-page {
        padding-bottom: 24px;
    }

    .search-switch {
        grid-template-columns: 1fr;
    }

    .user-card {
        flex-direction: column;
        align-items: flex-start;
    }

    .user-card__stats {
        gap: 10px 14px;
    }
}
</style>
