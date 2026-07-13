<template>
    <base-layout>
        <template #default>
            <a-skeleton :loading="loadingPage" active avatar :paragraph="{ rows: 8 }">
                <section v-if="currentUser && profile" class="me-profile">
                    <!-- 将个人空间做成轻量手账封面，所有内容仍来自当前账号。 -->
                    <DoodleIcon class="profile-doodle" name="mascot" :size="42" />
                    <img class="me-avatar" :src="userAvatar" :alt="displayName" />

                    <div class="me-main">
                        <div class="me-head">
                            <div>
                                <h1>{{ displayName }}</h1>
                                <p class="me-account">@{{ currentUser.user_name || currentUser.username }}</p>
                            </div>

                            <div class="me-actions">
                                <a-button @click="goToProfileEdit">编辑资料</a-button>
                                <a-button type="primary" @click="goToWrite">开始创作</a-button>
                            </div>
                        </div>

                        <p class="me-intro">{{ currentUser.intro || "这个账号还没有填写个人简介。" }}</p>

                        <div class="me-basic">
                            <span>邮箱：{{ currentUser.email || "未填写" }}</span>
                            <span>加入时间：{{ joinedTime }}</span>
                        </div>
                    </div>
                </section>

                <section v-if="profile" class="me-stats">
                    <div class="stat-card">
                        <strong>{{ ownArticleTotal }}</strong>
                        <span>我的作品</span>
                    </div>
                    <button type="button" class="stat-card stat-card--button" @click="openSocialDrawer('followers')">
                        <strong>{{ profile.follower_count || 0 }}</strong>
                        <span>粉丝</span>
                    </button>
                    <button type="button" class="stat-card stat-card--button" @click="openSocialDrawer('following')">
                        <strong>{{ profile.following_count || 0 }}</strong>
                        <span>关注</span>
                    </button>
                </section>

                <section v-if="profile" class="me-categories">
                    <header class="section-head">
                        <h2>我的博客分类</h2>
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

                <section class="me-articles">
                    <header class="section-head">
                        <div>
                            <h2>我的作品</h2>
                            <span>{{ articles.length }} / {{ ownArticleTotal }} 篇</span>
                        </div>

                        <a-input-search
                            v-model:value="articleKeyword"
                            class="article-search"
                            allow-clear
                            placeholder="搜索我的博客文章"
                        />
                    </header>

                    <template v-if="articles.length > 0">
                        <CardArticle v-for="item in articles" :key="item.id" :article="item" />
                    </template>
                    <a-empty v-else :description="articleEmptyText" />
                </section>
            </a-skeleton>

            <a-drawer
                :open="socialDrawerVisible"
                :title="socialDrawerTitle"
                width="520"
                placement="right"
                @close="closeSocialDrawer"
            >
                <template #extra>
                    <a-segmented v-model:value="socialMode" :options="socialOptions" @change="onSocialModeChange" />
                </template>

                <a-spin :spinning="socialLoading && socialUsers.length === 0">
                    <div v-if="socialUsers.length > 0" class="social-list">
                        <article v-for="user in socialUsers" :key="user.id" class="social-card">
                            <button type="button" class="social-user" @click="goToUserDetail(user.id)">
                                <img
                                    class="social-avatar"
                                    :src="resolveAvatar(user.avatar, defaultAvatar)"
                                    :alt="user.nick_name || user.user_name"
                                />

                                <div class="social-main">
                                    <div class="social-head">
                                        <strong>{{ user.nick_name || user.user_name }}</strong>
                                        <span>@{{ user.user_name }}</span>
                                    </div>
                                    <p>{{ user.intro || "这个用户还没有填写个人简介。" }}</p>
                                    <div class="social-meta">
                                        <span>{{ user.article_count || 0 }} 作品</span>
                                        <span>{{ user.follower_count || 0 }} 粉丝</span>
                                        <span>{{ user.following_count || 0 }} 关注</span>
                                    </div>
                                </div>
                            </button>

                            <div class="social-actions">
                                <a-button size="small" @click="goToPrivateChat(user.id)">私聊</a-button>
                                <a-button
                                    size="small"
                                    :type="user.is_following ? 'default' : 'primary'"
                                    :loading="actionLoadingUserId === user.id"
                                    @click="toggleUserFollow(user)"
                                >
                                    {{ user.is_following ? "取关" : "关注" }}
                                </a-button>
                                <a-button size="small" @click="goToUserDetail(user.id)">主页</a-button>
                            </div>
                        </article>

                        <div class="social-loadmore">
                            <a-button v-if="socialHasMore" :loading="socialLoading" @click="loadMoreSocialUsers">加载更多</a-button>
                            <span v-else>没有更多了</span>
                        </div>
                    </div>

                    <a-empty v-else :description="socialEmptyText" />
                </a-spin>
            </a-drawer>
        </template>
    </base-layout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";

import { ArticleDTO, UserDTO } from "@/bean/dto";
import CardArticle from "@/components/card/card-article.vue";
import DoodleIcon from "@/components/doodle-icon.vue";
import { useAsyncLoading } from "@/hooks/async";
import { articleService } from "@/services/article";
import { userService } from "@/services/user";
import { useStore } from "@/stores";
import { defaultAvatar, resolveAvatar } from "@/utils/avatar";
import { format } from "@/utils/date-utils";

type SocialMode = "followers" | "following";

const ARTICLE_PAGE_SIZE = 100;

const router = useRouter();
const store = useStore();

const currentUser = ref<UserDTO | null>(null);
const profile = ref<UserDTO | null>(null);
const articles = ref<ArticleDTO[]>([]);
const ownArticleTotal = ref(0);
const articleKeyword = ref("");

const socialDrawerVisible = ref(false);
const socialMode = ref<SocialMode>("followers");
const socialUsers = ref<UserDTO[]>([]);
const socialPageNo = ref(1);
const socialTotal = ref(0);
const socialLoading = ref(false);
const actionLoadingUserId = ref<number | null>(null);

let articleSearchTimer: number | null = null;

const socialOptions = [
    { label: "粉丝", value: "followers" },
    { label: "关注", value: "following" },
];

const displayName = computed(
    () => currentUser.value?.nick_name || currentUser.value?.user_name || currentUser.value?.username || "我"
);
const userAvatar = computed(() => resolveAvatar(currentUser.value?.avatar, defaultAvatar));
const joinedTime = computed(() =>
    currentUser.value?.create_time ? format(currentUser.value.create_time, "YYYY年MM月DD日") : "未知"
);
const socialDrawerTitle = computed(() => (socialMode.value === "followers" ? "我的粉丝" : "我的关注"));
const socialHasMore = computed(() => socialUsers.value.length < socialTotal.value);
const socialEmptyText = computed(() => (socialMode.value === "followers" ? "你还没有粉丝" : "你还没有关注任何用户"));
const articleEmptyText = computed(() =>
    articleKeyword.value.trim() ? "没有找到匹配的文章" : "你还没有发布任何作品"
);

const loadArticles = async () => {
    const keyword = articleKeyword.value.trim();
    const res = await articleService.pageUser({
        pageNo: 1,
        pageSize: ARTICLE_PAGE_SIZE,
        keyword,
    });

    articles.value = res.data || [];
    ownArticleTotal.value = res.total || 0;
};

const loadMePage = async () => {
    const me = await store.refreshCurrentUser();
    if (!me?.id) {
        message.warning("请先登录后查看我的主页");
        router.push("/login");
        return;
    }

    currentUser.value = me;
    const profileRes = await userService.publicDetail(me.id);
    profile.value = profileRes.data || null;
    await loadArticles();
};

const { trigger: fetchPage, loading: loadingPage } = useAsyncLoading(loadMePage);
void fetchPage();

watch(articleKeyword, () => {
    if (articleSearchTimer) {
        window.clearTimeout(articleSearchTimer);
    }

    articleSearchTimer = window.setTimeout(() => {
        void loadArticles();
    }, 300);
});

const fetchSocialUsers = async (append = false) => {
    socialLoading.value = true;

    try {
        const pageNo = append ? socialPageNo.value + 1 : 1;
        const request = socialMode.value === "followers" ? userService.getFollowers : userService.getFollowing;
        const res = await request.call(userService, {
            keyword: "",
            pageNo,
            pageSize: 20,
        });

        socialUsers.value = append ? socialUsers.value.concat(res.data || []) : res.data || [];
        socialPageNo.value = pageNo;
        socialTotal.value = res.total || 0;
    } finally {
        socialLoading.value = false;
    }
};

const openSocialDrawer = (mode: SocialMode) => {
    socialMode.value = mode;
    socialDrawerVisible.value = true;
    void fetchSocialUsers(false);
};

const closeSocialDrawer = () => {
    socialDrawerVisible.value = false;
};

const onSocialModeChange = () => {
    void fetchSocialUsers(false);
};

const loadMoreSocialUsers = () => {
    if (!socialHasMore.value || socialLoading.value) {
        return;
    }

    void fetchSocialUsers(true);
};

const updateProfileCounts = () => {
    if (!profile.value) {
        return;
    }

    if (socialMode.value === "followers") {
        profile.value.follower_count = socialTotal.value;
        return;
    }

    profile.value.following_count = socialTotal.value;
};

const toggleUserFollow = async (user: UserDTO) => {
    if (!user?.id) {
        return;
    }

    actionLoadingUserId.value = user.id;

    try {
        if (user.is_following) {
            await userService.unfollow(user.id);
            user.is_following = false;
            user.follower_count = Math.max((user.follower_count || 1) - 1, 0);

            if (socialMode.value === "following") {
                socialUsers.value = socialUsers.value.filter((item) => item.id !== user.id);
                socialTotal.value = Math.max(socialTotal.value - 1, 0);
                updateProfileCounts();
            }

            message.success("已取消关注");
            return;
        }

        await userService.follow(user.id);
        user.is_following = true;
        user.follower_count = (user.follower_count || 0) + 1;
        message.success("关注成功");
    } finally {
        actionLoadingUserId.value = null;
    }
};

const goToProfileEdit = () => {
    router.push("/backend/profile");
};

const goToWrite = () => {
    router.push("/backend/write");
};

const goToUserDetail = (userId: number) => {
    router.push(`/user/${userId}`);
    closeSocialDrawer();
};

const goToPrivateChat = (userId: number) => {
    router.push(`/chat?mode=direct&userId=${userId}`);
    closeSocialDrawer();
};
</script>

<style lang="scss" scoped>
.me-profile,
.me-categories,
.me-articles {
    background: #fff;
    border-radius: 16px;
    padding: 24px;
    box-shadow: 0 16px 40px rgba(15, 23, 42, 0.08);
}

.me-profile {
    display: flex;
    align-items: flex-start;
    gap: 20px;
}

.me-avatar {
    width: 108px;
    height: 108px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(15, 23, 42, 0.08);
}

.me-main {
    flex: 1;
}

.me-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;

    h1 {
        margin: 0;
        color: #111827;
        font-size: 30px;
    }
}

.me-account,
.me-intro,
.me-basic {
    color: #6b7280;
}

.me-account {
    margin: 6px 0 0;
}

.me-intro {
    margin: 20px 0 0;
    line-height: 1.8;
}

.me-basic {
    margin-top: 14px;
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
}

.me-actions {
    display: flex;
    gap: 12px;
}

.me-stats {
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
    border: 0;

    strong {
        display: block;
        font-size: 30px;
        color: #111827;
    }

    span {
        display: block;
        margin-top: 6px;
        color: #6b7280;
    }
}

.stat-card--button {
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 20px 40px rgba(15, 23, 42, 0.12);
    }
}

.me-categories,
.me-articles {
    margin-top: 24px;
}

.section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;

    h2 {
        margin: 0;
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
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 16px;
}

.category-card {
    display: block;
    padding: 16px;
    border-radius: 14px;
    background: linear-gradient(135deg, #eff6ff, #f8fafc);
    transition: transform 0.2s ease, box-shadow 0.2s ease;

    strong {
        display: block;
        color: #111827;
    }

    span {
        display: block;
        margin-top: 8px;
        color: #6b7280;
    }

    &:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    }
}

.social-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.social-card {
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 16px;
    padding: 16px;
    background: #fff;
}

.social-user {
    width: 100%;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    text-align: left;
    background: transparent;
    border: 0;
    padding: 0;
    cursor: pointer;
}

.social-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.social-main {
    min-width: 0;
    flex: 1;

    p {
        margin: 8px 0 0;
        color: #6b7280;
        line-height: 1.6;
    }
}

.social-head {
    display: flex;
    align-items: center;
    gap: 10px;

    strong {
        color: #111827;
        font-size: 16px;
    }

    span {
        color: #6b7280;
    }
}

.social-meta {
    margin-top: 10px;
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
    color: #6b7280;
    font-size: 13px;
}

.social-actions {
    margin-top: 14px;
    display: flex;
    gap: 8px;
}

.social-loadmore {
    display: flex;
    justify-content: center;
    padding: 8px 0 4px;
    color: #6b7280;
}

@media screen and (max-width: 900px) {
    .me-profile {
        flex-direction: column;
    }

    .me-head {
        flex-direction: column;
    }

    .me-stats {
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
