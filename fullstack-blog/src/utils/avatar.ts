import defaultAvatar from "@/assets/img/default-avatar.png";

export function resolveAvatar(avatar?: string | null, fallback = defaultAvatar) {
    if (typeof avatar === "string" && avatar.trim()) {
        return avatar.trim();
    }

    return fallback;
}

export { defaultAvatar };
