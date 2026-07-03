<template>
    <base-layout>
        <template #default>
            <a-skeleton :loading="loadingProfile" active avatar :paragraph="{ rows: 6 }">
                <section v-if="profile" class="user-profile">
                    <img class="user-avatar" :src="userAvatar" :alt="profile.nick_name || profile.user_name" />

                    <div class="user-main">
                        <div class="user-head">
                            <div>
                                <h1>{{ profile.nick_name || profile.user_name }}</h1>
                                <p class="user-account">@{{ profile.user_name }}</p>
                            </div>
                            <span class="user-role">{{ roleText }}</span>
                        </div>

                        <p class="user-intro">{{ profile.intro || "这个用户还没有填写个人简介。" }}</p>

                        <div v-if="!isSelf" class="user-actions">
                            <a-button type="primary" :loading="followLoading" @click="toggleFollow">
                                {{ profile.is_following ? "取消关注" : "关注" }}
                            </a-button>
                            <a-button @click="goToPrivateChat">私聊</a-button>
                        </div>

                        <p class="user-meta">加入时间：{{ joinedTime }}</p>
                    </div>
                </section>

                <a-empty v-else description="用户不存在" />
            </a-skeleton>

            <section v-if="profile" class="user-stats">
                <div class="stat-card">
                    <strong>{{ profile.article_count || 0 }}</strong>
                    <span>公开文章</span>
                </div>
                <div class="stat-card">
                    <strong>{{ profile.follower_count || 0 }}</strong>
                    <span>粉丝</span>
                </div>
                <div class="stat-card">
                    <strong>{{ profile.following_count || 0 }}</strong>
                    <span>关注</span>
                </div>
            </section>

            <section v-if="profile" class="user-categories">
                <header class="section-head">
                    <h2>博客分类</h2>
                    <span>{{ profile.categories?.length || 0 }} 个分类</span>
                </header>

                <div v-if="profile.categories?.length" class="category-grid">
                    <router-link
                        v-for="category in profile.categories"
                        :key="category.id"
                        :to="`/category/${category.category_name}`"
                        class="category-card"
                    >
                        <strong>{{ category.category_name }}</strong>
                        <span>{{ category.article_count }} 篇文章</span>
                    </router-link>
                </div>
                <a-empty v-else description="暂无公开分类" />
            </section>

            <section class="user-articles">
                <header class="section-head">
                    <div>
                        <h2>{{ isSelf ? "我的文章" : "Ta 的公开文章" }}</h2>
                        <span>{{ articles.length }} / {{ total }} 篇</span>
                    </div>

                    <a-input-search
                        v-model:value="articleKeyword"
                        class="article-search"
                        allow-clear
                        placeholder="搜索该用户的博客文章"
                    />
                </header>

                <a-skeleton :loading="loadingArticles" active :paragraph="{ rows: 6 }">
                    <template v-if="articles.length > 0">
                        <CardArticle v-for="item in articles" :key="item.id" :article="item" />
                    </template>
                    <a-empty v-else :description="articleEmptyText" />
                </a-skeleton>
            </section>
        </template>
    </base-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRoute, useRouter } from "vue-router";

import { ArticleDTO, UserDTO } from "@/bean/dto";
import CardArticle from "@/components/card/card-article.vue";
import { useAsyncLoading } from "@/hooks/async";
import { articleService } from "@/services/article";
import { userService } from "@/services/user";
import { useStore } from "@/stores";
import { defaultAvatar, resolveAvatar } from "@/utils/avatar";
import { format } from "@/utils/date-utils";

const ARTICLE_PAGE_SIZE = 100;

const route = useRoute();
const router = useRouter();
const store = useStore();

const userId = computed(() => Number(route.params.id));
const profile = ref<UserDTO | null>(null);
const articles = ref<ArticleDTO[]>([]);
const total = ref(0);
const articleKeyword = ref("");

let articleSearchTimer: number | null = null;

const loadProfile = async () => {
    const res = await userService.publicDetail(userId.value);
    profile.value = res.data || null;
};

const loadArticles = async () => {
    const res = await articleService.pageByAuthor({
        authorId: userId.value,
        pageNo: 1,
        pageSize: ARTICLE_PAGE_SIZE,
        keyword: articleKeyword.value.trim(),
    });
    articles.value = res.data || [];
    total.value = res.total || 0;
};

const { trigger: fetchProfile, loading: loadingProfile } = useAsyncLoading(loadProfile);
const { trigger: fetchArticles, loading: loadingArticles } = useAsyncLoading(loadArticles);

const loadPage = async () => {
    articleKeyword.value = "";
    await Promise.all([fetchProfile(), fetchArticles()]);
};

watch(
    () => route.params.id,
    () => {
        void loadPage();
    },
    { immediate: true }
);

watch(articleKeyword, () => {
    if (articleSearchTimer) {
        window.clearTimeout(articleSearchTimer);
    }

    articleSearchTimer = window.setTimeout(() => {
        void loadArticles();
    }, 300);
});

const isSelf = computed(() => Number(store.userInfo?.id || 0) === Number(profile.value?.id || 0));
const roleText = computed(() => (profile.value?.role_name === "admin" ? "管理员" : "普通用户"));
const joinedTime = computed(() =>
    profile.value?.create_time ? format(profile.value.create_time, "YYYY年MM月DD日") : "未知"
);
const userAvatar = computed(() => resolveAvatar(profile.value?.avatar, defaultAvatar));
const articleEmptyText = computed(() =>
    articleKeyword.value.trim() ? "没有找到匹配的文章" : isSelf.value ? "你还没有公开文章" : "暂无公开文章"
);

const handleToggleFollow = async () => {
    if (!store.isAuthed) {
        message.warning("请先登录后再关注用户");
        router.push("/login");
        return;
    }

    if (!profile.value) {
        return;
    }

    if (profile.value.is_following) {
        await userService.unfollow(profile.value.id);
        profile.value.is_following = false;
        profile.value.follower_count = Math.max((profile.value.follower_count || 1) - 1, 0);
        message.success("已取消关注");
        return;
    }

    await userService.follow(profile.value.id);
    profile.value.is_following = true;
    profile.value.follower_count = (profile.value.follower_count || 0) + 1;
    message.success("关注成功");
};

const { trigger: toggleFollow, loading: followLoading } = useAsyncLoading(handleToggleFollow);

const goToPrivateChat = () => {
    if (!profile.value) {
        return;
    }

    if (!store.isAuthed) {
        message.warning("请先登录后再私聊");
        router.push("/login");
        return;
    }

    router.push(`/chat?mode=direct&userId=${profile.value.id}`);
};
</script>

<style lang="scss" scoped>
.user-profile,
.user-categories,
.user-articles {
    background: #fff;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.user-profile {
    display: flex;
    align-items: flex-start;
    gap: 20px;
}

.user-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 16px;
    margin-top: 24px;
}

.stat-card {
    background: #fff;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
    text-align: center;

    strong {
        display: block;
        font-size: 30px;
        color: #111827;
    }

    span {
        margin-top: 6px;
        display: block;
        color: #6b7280;
    }
}

.user-categories,
.user-articles {
    margin-top: 24px;
}

.user-avatar {
    width: 108px;
    height: 108px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(15, 23, 42, 0.08);
}

.user-main {
    flex: 1;
}

.user-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;

    h1 {
        margin: 0;
        font-size: 30px;
        color: #111827;
    }
}

.user-account {
    margin: 6px 0 0;
    color: #6b7280;
}

.user-role {
    padding: 4px 10px;
    border-radius: 999px;
    background: #eff6ff;
    color: #2563eb;
    font-size: 13px;
}

.user-intro {
    margin: 14px 0 10px;
    line-height: 1.8;
    color: #4b5563;
}

.user-actions {
    display: flex;
    gap: 12px;
    margin: 18px 0 10px;
}

.user-meta {
    margin: 0;
    color: #6b7280;
    font-size: 14px;
}

.section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;

    h2 {
        margin: 0;
        font-size: 24px;
        color: #111827;
    }

    span {
        color: #6b7280;
    }
}

.article-search {
    width: 320px;
    max-width: 100%;
}

.category-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 16px;
}

.category-card {
    padding: 16px;
    border-radius: 12px;
    background: #f8fafc;

    strong {
        display: block;
        color: #111827;
    }

    span {
        margin-top: 8px;
        display: block;
        color: #6b7280;
    }
}

@media screen and (max-width: 767px) {
    .user-profile {
        flex-direction: column;
        align-items: center;
        text-align: center;
    }

    .user-head {
        flex-direction: column;
        align-items: center;
    }

    .user-actions {
        justify-content: center;
    }

    .user-stats {
        grid-template-columns: 1fr;
    }

    .section-head {
        flex-direction: column;
        align-items: stretch;
    }

    .article-search {
        width: 100%;
    }
}
</style>
