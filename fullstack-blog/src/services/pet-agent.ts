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
        execution?: { engine: "legacy" | "langgraph"; version: number };
        iteration?: number;
        plan?: Array<string | PetTaskPlanStep>;
        budget?: {
            maxSteps: number;
            usedSteps: number;
            maxToolCalls: number;
            usedToolCalls: number;
            maxTokens: number;
            usedTokens: number;
            maxRuntimeMs: number;
            runtimeStartedAt: string | null;
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

export interface PetTaskDiagnostics {
    taskId: string;
    status: PetTaskStatus | "unknown";
    generatedAt: string;
    lifecycle: { firstEventAt: string | null; lastEventAt: string | null; durationMs: number; totalEvents: number };
    decisions: { total: number; model: number; localFallback: number; averageLatencyMs: number; p95LatencyMs: number; contractViolations: number };
    models: {
        calls: number;
        totalTokens: number;
        providers: Record<string, { attempts: number; completed: number; failed: number; durationMs: number }>;
        circuitHealth: Record<string, { status: "closed" | "recovering" | "open"; consecutiveFailures: number; retryAfterMs: number; lastErrorCode: string }>;
    };
    observability: { tracedEvents: number; traceIds: string[] };
    tools: { started: number; completed: number; failed: number; averageLatencyMs: number; p95LatencyMs: number };
    approvals: { requested: number; completed: number; rejectedOrFailed: number };
    budget: {
        maxSteps: number;
        usedSteps: number;
        maxToolCalls: number;
        usedToolCalls: number;
        maxTokens: number;
        usedTokens: number;
        maxRuntimeMs: number;
        runtimeStartedAt: string | null;
    };
    warnings: string[];
}

export interface PetAgentMetrics {
    generatedAt: string;
    tasks: { total: number; statuses: Record<string, number>; successRate: number | null };
    models: {
        calls: number;
        totalTokens: number;
        providers: Record<string, { attempts: number; completed: number; failed: number; durationMs: number }>;
        circuitHealth: Record<string, { status: "closed" | "recovering" | "open"; consecutiveFailures: number; retryAfterMs: number; lastErrorCode: string }>;
    };
    tools: { started: number; completed: number; failed: number };
    approvals: { requested: number; completed: number; rejectedOrFailed: number };
    observability: { tracedTasks: number; traceIds: string[] };
    alerts: Array<{ taskId: string; status: string; warnings: string[] }>;
    orchestration?: { driver: "poll" | "redis"; state: string; queue: string; lastError: string };
}

export interface PetAgentSettings {
    proactiveEnabled: boolean;
    humorLevel: number;
    intervalMinutes: number;
    quietStart: string;
    quietEnd: string;
    timezone: string;
    dailyLimit: number;
}

export interface PetAgentProfile {
    userId: number;
    settings: PetAgentSettings;
    memory: {
        topics?: Record<string, number>;
        preferences?: string[];
        dislikes?: string[];
        lastLearnedAt?: string;
    };
    evolution: {
        variants?: Record<string, { shown?: number; score?: number }>;
        feedback?: Record<string, number>;
    };
    lastInteractionAt?: string | null;
    dailyInteractionCount: number;
    totalFeedback: number;
    feedbackScore: number;
}

export interface PetAgentInteraction {
    id: string;
    userId: number;
    kind: string;
    variantKey: string;
    content: string;
    suggestion?: string;
    status: "unseen" | "seen" | "dismissed";
    feedback?: "liked" | "disliked" | "dismissed" | "";
    metadata?: Record<string, unknown>;
    createdAt: string;
    seenAt?: string | null;
    feedbackAt?: string | null;
}

class PetAgentService extends ApiService {
    constructor() {
        super("pet-agent");
    }

    getProfile(limit = 10) {
        return this.$get<RecordResponse<{ profile: PetAgentProfile; interactions: PetAgentInteraction[] }>>("profile", { limit });
    }

    updateSettings(settings: Partial<PetAgentSettings>) {
        return this.$patchJson<RecordResponse<PetAgentProfile>>("profile", { settings });
    }

    listInteractions(limit = 20) {
        return this.$get<RecordResponse<PetAgentInteraction[]>>("interactions", { limit });
    }

    setInteractionState(id: string, state: "seen" | "dismissed") {
        return this.$postJson<RecordResponse<PetAgentInteraction>>(`interactions/${id}/state`, { state });
    }

    sendInteractionFeedback(id: string, feedback: "liked" | "disliked" | "dismissed") {
        return this.$postJson<RecordResponse<PetAgentInteraction>>(`interactions/${id}/feedback`, { feedback });
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

    getTaskDiagnostics(id: string) {
        return this.$get<RecordResponse<PetTaskDiagnostics>>(`tasks/${id}/diagnostics`);
    }

    getMetrics(limit = 20) {
        return this.$get<RecordResponse<PetAgentMetrics>>("metrics", { limit });
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
