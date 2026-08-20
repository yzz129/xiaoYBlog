import { defineStore } from "pinia";
import { CommentUserInfo, UserDTO } from "@/bean/dto";
import { userService } from "@/services/user";
import { LoginModel } from "@/bean/xhr";

export const useStore = defineStore("main", {
    state: () => ({
        isMenuVisible: false,
        commentUserInfo: JSON.parse(localStorage.getItem("commentUserInfo") || "null"),
        userInfo: JSON.parse(localStorage.getItem("userInfo") || "null") as UserDTO | null,
        csrfToken: localStorage.getItem("csrfToken") || "",
    }),

    getters: {
        isAuthed: (state) => Boolean(state.userInfo),
    },

    actions: {
        setIsMenuVisible(visible: boolean) {
            this.isMenuVisible = visible;
        },

        setCommentUserInfo(info: CommentUserInfo | null) {
            this.commentUserInfo = info;
            if (info) {
                localStorage.setItem("commentUserInfo", JSON.stringify(info));
            } else {
                localStorage.removeItem("commentUserInfo");
            }
        },

        setUserInfo(info: UserDTO | null) {
            this.userInfo = info;
            if (info) {
                localStorage.setItem("userInfo", JSON.stringify(info));
            } else {
                localStorage.removeItem("userInfo");
            }
        },

        setCsrfToken(token: string) {
            this.csrfToken = token;
            if (token) {
                localStorage.setItem("csrfToken", token);
            } else {
                localStorage.removeItem("csrfToken");
            }
            localStorage.removeItem("token");
        },

        async login(payload: LoginModel): Promise<UserDTO> {
            const response = await userService.login(payload);
            const userInfo = response.data as UserDTO;
            this.setUserInfo(userInfo);
            this.setCsrfToken(userInfo?.csrfToken || "");
            return userInfo;
        },

        async register(payload: { userName: string; password: string; nickName: string }): Promise<void> {
            await userService.register(payload);
        },

        async fetchCurrent(force = false): Promise<UserDTO | null> {
            if (!force && this.userInfo) {
                return this.userInfo;
            }

            const response = await userService.current();
            const currentUser = (response.data as UserDTO | null) || null;
            this.setUserInfo(currentUser);
            this.setCsrfToken(currentUser?.csrfToken || "");
            return currentUser;
        },

        async refreshCurrentUser(): Promise<UserDTO | null> {
            return this.fetchCurrent(true);
        },

        async logout(): Promise<void> {
            await userService.logout();
            this.clearUserSession();
        },

        clearUserSession() {
            this.setUserInfo(null);
            this.setCsrfToken("");
        },
    },
});
