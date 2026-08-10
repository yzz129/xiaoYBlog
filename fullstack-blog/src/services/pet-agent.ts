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
        artifacts?: {
            draft?: { title: string; summary: string; content: string; tags?: string[] };
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

    createTask(params: { message: string; scheduledAt?: string; timezone?: string }) {
        return this.$postJson<CommonResponse<PetTask>>("tasks", params);
    }

    listTasks(limit = 20) {
        return this.$get<CommonResponse<PetTask[]>>("tasks", { limit });
    }

    getTask(id: string) {
        return this.$get<CommonResponse<PetTask>>(`tasks/${id}`);
    }

    addMessage(id: string, content: string) {
        return this.$postJson<CommonResponse<PetTask>>(`tasks/${id}/messages`, { content });
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
