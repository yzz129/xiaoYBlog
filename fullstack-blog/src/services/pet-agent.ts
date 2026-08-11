import { ApiService } from "@/services/index";
import { CommonResponse } from "@/bean/xhr";

export type PetTaskStatus =
    | "scheduled"
    | "queued"
    | "running"
    | "waiting_approval"
    | "waiting_input"
    | "paused"
    | "completed"
    | "failed"
    | "cancelled";

export interface PetTaskEvent {
    id: number;
    taskId: string;
    type: string;
    title: string;
    content: string;
    status: "info" | "running" | "completed" | "waiting" | "scheduled" | "failed";
    data?: Record<string, any> | null;
    createdAt: string;
}

export interface PetTask {
    id: string;
    userId: number;
    title: string;
    goal: string;
    status: PetTaskStatus;
    scheduledAt?: string | null;
    timezone: string;
    context: {
        iteration?: number;
        plan?: string[];
        attachments?: Array<{ type: "image"; url: string; name?: string }>;
        artifacts?: {
            draft?: {
                title: string;
                summary: string;
                content: string;
                tags?: string[];
                poster?: string;
                images?: Array<{ url: string; alt?: string; provider?: string; model?: string }>;
                imagePlan?: Array<{ prompt: string; alt: string; placement: "cover" | "inline"; sectionTitle?: string }>;
            };
        };
    };
    pendingAction?: { type: string; label: string; payload?: Record<string, any> } | null;
    result?: { summary?: string; artifacts?: Record<string, any> } | null;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    events?: PetTaskEvent[];
}

class PetAgentService extends ApiService {
    constructor() {
        super("pet-agent");
    }

    createTask(params: { message: string; scheduledAt?: string; timezone?: string; attachments?: Array<{ type: "image"; url: string; name?: string }> }) {
        return this.$postJson<CommonResponse<PetTask>>("tasks", params);
    }

    listTasks(limit = 20) {
        return this.$get<CommonResponse<PetTask[]>>("tasks", { limit });
    }

    getTask(id: string) {
        return this.$get<CommonResponse<PetTask>>(`tasks/${id}`);
    }

    addMessage(id: string, content: string, attachments?: Array<{ type: "image"; url: string; name?: string }>) {
        return this.$postJson<CommonResponse<PetTask>>(`tasks/${id}/messages`, { content, attachments });
    }

    approve(id: string, approved: boolean) {
        return this.$postJson<CommonResponse<PetTask>>(`tasks/${id}/approval`, { approved });
    }

    pause(id: string) {
        return this.$postJson<CommonResponse<PetTask>>(`tasks/${id}/pause`);
    }

    resume(id: string) {
        return this.$postJson<CommonResponse<PetTask>>(`tasks/${id}/resume`);
    }

    cancel(id: string) {
        return this.$postJson<CommonResponse<PetTask>>(`tasks/${id}/cancel`);
    }
}

export const petAgentService = new PetAgentService();
