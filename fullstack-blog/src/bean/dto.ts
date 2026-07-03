import { PlainObject } from "./base";

export interface RecordDTO extends PlainObject {
    id: number;
}

export interface ArticleDTO extends RecordDTO {
    article_name: string;
    article_text: string;
    author: string;
    author_user_id?: number;
    author_avatar?: string;
    author_intro?: string;
    poster: string;
    summary: string;
    read_num: number;
    create_time: string;
    private: 0 | 1;
    tags: TagCamelCaseDTO[];
    categories: CategoryCamelCaseDTO[];
}

export interface CategoryCamelCaseDTO extends RecordDTO {
    categoryName: string;
}

export interface TagCamelCaseDTO extends RecordDTO {
    tagName: string;
}

export interface CategoryDTO extends RecordDTO {
    category_name: string;
    poster: string;
    article_count?: number;
    category_count?: number;
}

export interface UserCategoryDTO extends RecordDTO {
    category_name: string;
    article_count: number;
}

export interface TagDTO extends RecordDTO {
    tag_name: string;
}

export interface CommentDTO extends RecordDTO {
    site_url: string;
    nick_name: string;
    avatar: string;
    create_time: string;
    content: string;
    article_id: number;
    article_name: string;
    email: string;
    jump_url: string;
    replies: ReplyDTO[];
}

export interface ReplyDTO extends RecordDTO {
    reply_name: string;
    nick_name: string;
    avatar: string;
    create_time: string;
    content: string;
    email: string;
    jump_url: string;
    site_url: string;
    article_id: number;
    article_name: string;
}

export interface CommentUserInfo extends PlainObject {
    email: string;
    nick_name: string;
    site_url: string;
}

export interface UserDTO extends RecordDTO {
    role_id: number;
    role_name: string;
    user_name: string;
    username?: string;
    nick_name?: string;
    avatar?: string;
    email?: string;
    intro?: string;
    last_login_time?: string;
    create_time?: string;
    article_count?: number;
    follower_count?: number;
    following_count?: number;
    is_following?: boolean;
    categories?: UserCategoryDTO[];
    token?: string;
}

export interface DirectMessageDTO extends RecordDTO {
    sender_id: number;
    receiver_id: number;
    sender_name: string;
    sender_avatar?: string;
    receiver_name: string;
    receiver_avatar?: string;
    content: string;
    create_time: string;
}

export interface DirectMessageUnreadConversationDTO {
    user_id: number;
    nick_name: string;
    avatar?: string;
    unread_count: number;
    latest_time: string;
}
