import { ApiService } from "@/services/index";
import { CommonResponse, LoginModel, PageResponse, QuerySearchModel, RecordResponse } from "@/bean/xhr";
import { DirectMessageDTO, DirectMessageUnreadConversationDTO, UserDTO } from "@/bean/dto";

class UserService extends ApiService {
    public login(params: LoginModel) {
        return this.$putJson<RecordResponse<UserDTO>>("login", params);
    }

    public register(params: { userName: string; password: string; nickName: string }) {
        return this.$postJson<RecordResponse<null>>("register", params);
    }

    public current() {
        return this.$get<RecordResponse<UserDTO>>("current");
    }

    public publicDetail(id: number) {
        return this.$get<RecordResponse<UserDTO>>(`public/${id}`);
    }

    public search(params: QuerySearchModel) {
        return this.$get<PageResponse<UserDTO>>("search", params);
    }

    public followStatus(id: number) {
        return this.$get<CommonResponse<{ is_following: boolean }>>(`follow/status/${id}`);
    }

    public follow(id: number) {
        return this.$postJson<CommonResponse<null>>(`follow/${id}`);
    }

    public unfollow(id: number) {
        return this.$del<CommonResponse<null>>(`follow/${id}`);
    }

    public getFollowers(params: QuerySearchModel) {
        return this.$get<PageResponse<UserDTO>>("followers", params);
    }

    public getFollowing(params: QuerySearchModel) {
        return this.$get<PageResponse<UserDTO>>("following", params);
    }

    public getDirectMessages(targetUserId: number) {
        return this.$get<CommonResponse<{ target_user: UserDTO; messages: DirectMessageDTO[] }>>(`dm/${targetUserId}`);
    }

    public getUnreadDirectMessageSummary() {
        return this.$get<CommonResponse<{ total_unread: number; conversations: DirectMessageUnreadConversationDTO[] }>>(
            "dm/unread/summary"
        );
    }

    public sendDirectMessage(targetUserId: number, content: string) {
        return this.$postJson<CommonResponse<{ id: number }>>(`dm/${targetUserId}`, { content });
    }

    public updateProfile(params: { nickName: string; email?: string; intro?: string; avatar?: string }) {
        return this.$putJson<RecordResponse<UserDTO>>("profile", params);
    }

    public updatePassword(params: { currentPassword: string; newPassword: string }) {
        return this.$putJson<RecordResponse<null>>("password", params);
    }

    public logout() {
        return this.$put("logout");
    }
}

export const userService = new UserService("user");
