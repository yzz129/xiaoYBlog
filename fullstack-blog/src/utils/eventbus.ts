import mitt from "mitt";

type Events = {
    sessionInvalid: void;
    dmUnreadRefresh: void;
    dmMessage: {
        id: number;
        sender_id: number;
        receiver_id: number;
        sender_name: string;
        sender_avatar?: string;
        receiver_name: string;
        receiver_avatar?: string;
        content: string;
        create_time: string;
    };
};

export const eventBus = mitt<Events>();
