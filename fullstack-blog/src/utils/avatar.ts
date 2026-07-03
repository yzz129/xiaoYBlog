import defaultAvatar from "@/assets/img/avatar.jpg";

export function resolveAvatar(avatar?: string | null, fallback = defaultAvatar) {
    if (typeof avatar === "string" && avatar.trim()) {
        return avatar.trim();
    }

    return fallback;
}

export { defaultAvatar };
