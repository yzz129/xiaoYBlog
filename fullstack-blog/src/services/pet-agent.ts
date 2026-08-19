import { ApiService } from "@/services/index";
import { RecordResponse } from "@/bean/xhr";

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
    data?: Record<string, unknown> | null;
    createdAt: string;
}

export interface PetTaskPlanStep {
    id: string;
    title: string;
    status: "pending" | "running" | "waiting" | "completed" | "failed" | "skipped";
    tool?: string;
    summary?: string;
    error?: string;
    retryAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
}

export interface PetTaskArtifacts {
    draft?: {
        title: string;
        summary: string;
        content: string;
        tags?: string[];
        poster?: string;
        images?: Array<{ url: string; alt?: string; provider?: string; model?: string }>;
        imagePlan?: Array<{ prompt: string; alt: string; placement: "cover" | "inline"; sectionTitle?: string }>;
    };
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
        plan?: Array<string | PetTaskPlanStep>;
        budget?: {
            maxSteps: number;
            usedSteps: number;
            maxToolCalls: number;
            usedToolCalls: number;
        };
        attachments?: Array<{ type: "image"; url: string; name?: string }>;
        artifacts?: PetTaskArtifacts;
    };
    pendingAction?: { type: string; label: string; payload?: Record<string, unknown> } | null;
    result?: { summary?: string; artifacts?: PetTaskArtifacts } | null;
    lastError?: string;
    createdAt: string;
    updatedAt: string;
    startedAt?: string | null;
    completedAt?: string | null;
    nextRetryAt?: string | null;
    lockExpiresAt?: string | null;
    heartbeatAt?: string | null;
    attemptCount?: number;
    events?: PetTaskEvent[];
}

class PetAgentService extends ApiService {
    constructor() {
        super("pet-agent");
    }

    createTask(params: { message: string; scheduledAt?: string; timezone?: string; attachments?: Array<{ type: "image"; url: string; name?: string }> }) {
        return this.$postJson<RecordResponse<PetTask>>("tasks", params);
    }

    listTasks(limit = 20) {
        return this.$get<RecordResponse<PetTask[]>>("tasks", { limit });
    }

    getTask(id: string) {
        return this.$get<RecordResponse<PetTask>>(`tasks/${id}`);
    }

    addMessage(id: string, content: string, attachments?: Array<{ type: "image"; url: string; name?: string }>) {
        return this.$postJson<RecordResponse<PetTask>>(`tasks/${id}/messages`, { content, attachments });
    }

    approve(id: string, approved: boolean) {
        return this.$postJson<RecordResponse<PetTask>>(`tasks/${id}/approval`, { approved });
    }

    pause(id: string) {
        return this.$postJson<RecordResponse<PetTask>>(`tasks/${id}/pause`);
    }

    resume(id: string) {
        return this.$postJson<RecordResponse<PetTask>>(`tasks/${id}/resume`);
    }

    cancel(id: string) {
        return this.$postJson<RecordResponse<PetTask>>(`tasks/${id}/cancel`);
    }
}

export const petAgentService = new PetAgentService();
