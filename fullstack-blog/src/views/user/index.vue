<template>
    <base-layout>
        <template #default>
            <a-skeleton :loading="loadingProfile" active avatar :paragraph="{ rows: 6 }">
                <section v-if="profile" class="user-profile">
                    <!-- 彩绘小图标只负责视觉引导，不参与用户数据逻辑。 -->
                    <DoodleIcon class="profile-doodle" name="user" :size="42" />
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
                            <a-button :loading="friendLoading" :disabled="profile.friendship_status === 'outgoing'" @click="handleFriendAction">
                                {{ friendActionText }}
                            </a-button>
                            <a-button @click="goToPrivateChat">私聊</a-button>
                        </div>
                        <div v-else class="user-actions">
                            <a-button @click="openSocialSettings">好友与隐私</a-button>
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

            <a-modal v-model:open="socialSettingsOpen" title="好友与隐私" :footer="null" width="560px">
                <a-spin :spinning="socialSettingsLoading">
                    <div class="privacy-form">
                        <label>
                            <span>谁可以申请加我为好友</span>
                            <a-select v-model:value="privacyForm.allowFriendRequests">
                                <a-select-option value="everyone">所有人</a-select-option>
                                <a-select-option value="following">仅我关注的人</a-select-option>
                                <a-select-option value="none">任何人都不可以</a-select-option>
                            </a-select>
                        </label>
                        <label>
                            <span>谁可以给我发私信</span>
                            <a-select v-model:value="privacyForm.allowDirectMessages">
                                <a-select-option value="everyone">所有人</a-select-option>
                                <a-select-option value="friends">仅好友</a-select-option>
                                <a-select-option value="none">任何人都不可以</a-select-option>
                            </a-select>
                        </label>
                        <div class="privacy-switch"><span>公开粉丝数</span><a-switch v-model:checked="privacyForm.showFollowers" /></div>
                        <div class="privacy-switch"><span>公开关注数</span><a-switch v-model:checked="privacyForm.showFollowing" /></div>
                        <a-button type="primary" :loading="savingPrivacy" @click="savePrivacy">保存隐私设置</a-button>
                    </div>

                    <div class="friend-requests">
                        <h3>待处理好友申请</h3>
                        <div v-for="request in pendingFriendRequests" :key="request.id" class="friend-request-item">
                            <img :src="resolveAvatar(request.avatar, defaultAvatar)" :alt="request.nick_name || request.username" />
                            <div>
                                <strong>{{ request.nick_name || request.username }}</strong>
                                <small v-if="request.message">{{ request.message }}</small>
                            </div>
                            <a-button size="small" type="primary" @click="resolveIncomingRequest(request.id, true)">接受</a-button>
                            <a-button size="small" danger @click="resolveIncomingRequest(request.id, false)">拒绝</a-button>
                        </div>
                        <a-empty v-if="!pendingFriendRequests.length" :image="false" description="暂无待处理申请" />
                    </div>
                </a-spin>
            </a-modal>
        </template>
    </base-layout>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRoute, useRouter } from "vue-router";

import { ArticleDTO, UserDTO } from "@/bean/dto";
import CardArticle from "@/components/card/card-article.vue";
import DoodleIcon from "@/components/doodle-icon.vue";
import { useAsyncLoading } from "@/hooks/async";
import { articleService } from "@/services/article";
import { FriendRequestDTO, userService } from "@/services/user";
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
const socialSettingsOpen = ref(false);
const socialSettingsLoading = ref(false);
const savingPrivacy = ref(false);
const pendingFriendRequests = ref<FriendRequestDTO[]>([]);
const privacyForm = reactive({
    allowFriendRequests: "everyone" as "everyone" | "following" | "none",
    allowDirectMessages: "friends" as "everyone" | "friends" | "none",
    showFollowers: true,
    showFollowing: true,
});

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
const friendActionText = computed(() => ({
    friends: "解除好友",
    outgoing: "申请已发送",
    incoming: "接受好友",
    none: "加好友",
}[profile.value?.friendship_status || "none"]));

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

const handleFriendActionImpl = async () => {
    if (!store.isAuthed) {
        message.warning("请先登录后再添加好友");
        router.push("/login");
        return;
    }
    if (!profile.value) return;
    if (profile.value.friendship_status === "friends") {
        await userService.removeFriend(profile.value.id);
        profile.value.friendship_status = "none";
        message.success("已解除好友关系");
    } else if (profile.value.friendship_status === "incoming" && profile.value.friend_request_id) {
        await userService.acceptFriendRequest(profile.value.friend_request_id);
        profile.value.friendship_status = "friends";
        message.success("已成为好友");
    } else if (profile.value.friendship_status === "none") {
        await userService.sendFriendRequest(profile.value.id);
        profile.value.friendship_status = "outgoing";
        message.success("好友申请已发送");
    }
};
const { trigger: handleFriendAction, loading: friendLoading } = useAsyncLoading(handleFriendActionImpl);

const openSocialSettings = async () => {
    socialSettingsOpen.value = true;
    socialSettingsLoading.value = true;
    try {
        const [privacyResponse, requestResponse] = await Promise.all([
            userService.getPrivacy(),
            userService.getFriendRequests("incoming"),
        ]);
        const privacy = privacyResponse.data;
        if (privacy) {
            privacyForm.allowFriendRequests = privacy.allow_friend_requests;
            privacyForm.allowDirectMessages = privacy.allow_direct_messages;
            privacyForm.showFollowers = Boolean(privacy.show_followers);
            privacyForm.showFollowing = Boolean(privacy.show_following);
        }
        pendingFriendRequests.value = (requestResponse.data || []).filter((item) => item.status === "pending");
    } finally {
        socialSettingsLoading.value = false;
    }
};

const savePrivacy = async () => {
    savingPrivacy.value = true;
    try {
        await userService.updatePrivacy({ ...privacyForm });
        if (profile.value) {
            profile.value.follower_count_private = !privacyForm.showFollowers;
            profile.value.following_count_private = !privacyForm.showFollowing;
        }
        message.success("隐私设置已保存");
    } finally {
        savingPrivacy.value = false;
    }
};

const resolveIncomingRequest = async (requestId: number, accept: boolean) => {
    if (accept) await userService.acceptFriendRequest(requestId);
    else await userService.rejectFriendRequest(requestId);
    pendingFriendRequests.value = pendingFriendRequests.value.filter((item) => item.id !== requestId);
    message.success(accept ? "已接受好友申请" : "已拒绝好友申请");
};

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

.privacy-form {
    display: grid;
    gap: 16px;

    label {
        display: grid;
        gap: 8px;
    }

    .ant-select {
        width: 100%;
    }
}

.privacy-switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.friend-requests {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #eef2f7;

    h3 {
        margin-bottom: 14px;
    }
}

.friend-request-item {
    display: grid;
    grid-template-columns: 40px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    padding: 10px 0;

    img {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        object-fit: cover;
    }

    strong,
    small {
        display: block;
    }

    small {
        margin-top: 2px;
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

    .friend-request-item {
        grid-template-columns: 40px minmax(0, 1fr);

        .ant-btn {
            grid-column: span 1;
        }
    }
}
</style>
