export interface ResearchSource {
    title: string;
    url: string;
    summary: string;
}

export interface Section {
    title: string;
    keyPoints: string[];
    researchQueries?: string[];
    writingGoal?: string;
    content?: string;
    status?: string;
    sources?: ResearchSource[];
    revisionCount?: number;
}

export interface Outline {
    title: string;
    summary: string;
    sections: Section[];
}

export interface AgentState {
    step: "idle" | "analyzing" | "outlining" | "writing" | "reviewing" | "completed" | "failed";
    outline: Outline | null;
    currentSection: number;
    content: string;
    title: string;
    summary: string;
    feedback: string;
    statusMessage?: string;
}

export interface CompleteResult {
    title: string;
    summary: string;
    content: string;
    outline: Outline;
    reviewReport?: {
        summary?: string;
        strengths?: string[];
        risks?: string[];
        score?: number;
    } | null;
}

export interface StartStreamEvent {
    type: "state" | "status" | "outline_delta" | "done" | "error";
    success?: boolean;
    state?: AgentState;
    statusMessage?: string;
    content?: string;
    message?: string;
}

export interface CompleteStreamEvent {
    type: "state" | "status" | "article_delta" | "result" | "done" | "error";
    success?: boolean;
    state?: AgentState;
    statusMessage?: string;
    content?: string;
    result?: CompleteResult;
    message?: string;
}

type StreamResult = {
    success: boolean;
    state?: AgentState;
    result?: CompleteResult;
    error?: string;
};

/**
 * Client wrapper around the backend writing workflow API.
 */
export class AgentClient {
    private sessionId: string;
    private baseUrl: string;

    constructor(sessionId: string, baseUrl: string = "/api/agent") {
        this.sessionId = sessionId;
        this.baseUrl = baseUrl;
    }

    private buildHeaders(isJson = true): HeadersInit {
        const headers: Record<string, string> = {};
        if (isJson) {
            headers["Content-Type"] = "application/json";
        }
        if (typeof document !== "undefined") {
            const token = localStorage.getItem("token");
            if (token) {
                headers["Authorization"] = `Bearer ${token}`;
            }
        }

        return headers;
    }

    async start(prompt: string, fileContent?: string): Promise<{ success: boolean; state?: AgentState; error?: string }> {
        return this.postJson("/start", {
            sessionId: this.sessionId,
            prompt,
            fileContent,
        });
    }

    async startStream(
        prompt: string,
        fileContent: string | undefined,
        onEvent: (event: StartStreamEvent) => void
    ): Promise<{ success: boolean; state?: AgentState; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/stream-start`, {
                method: "POST",
                headers: this.buildHeaders(true),
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    prompt,
                    fileContent,
                }),
            });

            const result = await this.consumeJsonEventStream<StartStreamEvent>(response, onEvent, "Failed to start writing workflow");
            return {
                success: result.success,
                state: result.state,
                error: result.error,
            };
        } catch (error) {
            console.error("Streaming start failed:", error);
            return { success: false, error: this.toErrorMessage(error, "Network error") };
        }
    }

    async getState(): Promise<{ success: boolean; state?: AgentState; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/state/${this.sessionId}`, {
                headers: this.buildHeaders(false),
            });
            const data = await response.json();

            if (!data.success) {
                return { success: false, error: data.message || "Failed to load agent state" };
            }

            return { success: true, state: data.state };
        } catch (error) {
            console.error("Failed to load agent state:", error);
            return { success: false, error: "Network error" };
        }
    }

    async confirmOutline(): Promise<{ success: boolean; state?: AgentState; error?: string }> {
        return this.postJson("/confirm-outline", { sessionId: this.sessionId });
    }

    async nextSection(): Promise<{ success: boolean; state?: AgentState; error?: string }> {
        return this.postJson("/next-section", { sessionId: this.sessionId });
    }

    async reviseSection(feedback: string): Promise<{ success: boolean; state?: AgentState; error?: string }> {
        return this.postJson("/revise-section", {
            sessionId: this.sessionId,
            feedback,
        });
    }

    async skipSection(): Promise<{ success: boolean; state?: AgentState; error?: string }> {
        return this.postJson("/skip-section", { sessionId: this.sessionId });
    }

    async complete(): Promise<{ success: boolean; result?: CompleteResult; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/complete`, {
                method: "POST",
                headers: this.buildHeaders(true),
                body: JSON.stringify({
                    sessionId: this.sessionId,
                }),
            });

            const data = await response.json();
            if (!data.success) {
                return { success: false, error: data.message || "Failed to complete writing" };
            }

            return { success: true, result: data.result };
        } catch (error) {
            console.error("Failed to complete writing:", error);
            return { success: false, error: "Network error" };
        }
    }

    async completeStream(
        onEvent: (event: CompleteStreamEvent) => void
    ): Promise<{ success: boolean; result?: CompleteResult; state?: AgentState; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/stream-complete`, {
                method: "POST",
                headers: this.buildHeaders(true),
                body: JSON.stringify({
                    sessionId: this.sessionId,
                }),
            });

            const result = await this.consumeJsonEventStream<CompleteStreamEvent>(response, onEvent, "Failed to complete writing");
            return {
                success: result.success,
                state: result.state,
                result: result.result,
                error: result.error,
            };
        } catch (error) {
            console.error("Streaming complete failed:", error);
            return { success: false, error: this.toErrorMessage(error, "Network error") };
        }
    }

    async reset(): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/reset`, {
                method: "POST",
                headers: this.buildHeaders(true),
                body: JSON.stringify({
                    sessionId: this.sessionId,
                }),
            });

            const data = await response.json();
            if (!data.success) {
                return { success: false, error: data.message || "Failed to reset session" };
            }

            return { success: true };
        } catch (error) {
            console.error("Failed to reset session:", error);
            return { success: false, error: "Network error" };
        }
    }

    async streamSection(sectionIndex: number, onChunk: (chunk: string) => void): Promise<{ success: boolean; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}/stream-section/${this.sessionId}/${sectionIndex}`, {
                headers: this.buildHeaders(false),
            });
            if (!response.ok) {
                throw new Error("Failed to stream section");
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const events = buffer.split("\n\n");
                buffer = events.pop() || "";

                for (const eventBlock of events) {
                    const dataLine = eventBlock
                        .split("\n")
                        .find((line) => line.startsWith("data: "));

                    if (!dataLine) {
                        continue;
                    }

                    const payload = dataLine.slice(6).trim();
                    if (!payload || payload === "[DONE]") {
                        continue;
                    }

                    const data = JSON.parse(payload);
                    const content = data?.choices?.[0]?.delta?.content || "";
                    if (content) {
                        onChunk(content);
                    }
                }
            }

            return { success: true };
        } catch (error) {
            console.error("Failed to stream section:", error);
            return { success: false, error: "Network error" };
        }
    }

    private async postJson(path: string, payload: Record<string, unknown>): Promise<{ success: boolean; state?: AgentState; error?: string }> {
        try {
            const response = await fetch(`${this.baseUrl}${path}`, {
                method: "POST",
                headers: this.buildHeaders(true),
                body: JSON.stringify(payload),
            });

            const data = await response.json();
            if (!data.success) {
                return { success: false, error: data.message || "Request failed" };
            }

            return { success: true, state: data.state };
        } catch (error) {
            console.error(`Agent request failed ${path}:`, error);
            return { success: false, error: "Network error" };
        }
    }

    private async consumeJsonEventStream<TEvent extends { type: string; state?: AgentState; result?: CompleteResult; message?: string }>(
        response: Response,
        onEvent: (event: TEvent) => void,
        defaultError: string
    ): Promise<StreamResult> {
        if (!response.ok) {
            throw new Error(await this.readErrorResponse(response, defaultError));
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let latestState: AgentState | undefined;
        let latestResult: CompleteResult | undefined;

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const eventBlock of events) {
                const lines = eventBlock.split("\n");
                const eventLine = lines.find((line) => line.startsWith("event: "));
                const dataLine = lines.find((line) => line.startsWith("data: "));

                if (!eventLine || !dataLine) {
                    continue;
                }

                const type = eventLine.slice(7).trim() as TEvent["type"];
                const payload = JSON.parse(dataLine.slice(6));
                const event = { type, ...payload } as TEvent;

                if (event.state) {
                    latestState = event.state;
                }

                if (event.result) {
                    latestResult = event.result;
                }

                onEvent(event);

                if (type === "error") {
                    return {
                        success: false,
                        error: event.message || defaultError,
                    };
                }
            }
        }

        const trailingEvent = this.parseStreamEvent<TEvent>(buffer);
        if (trailingEvent) {
            if (trailingEvent.state) {
                latestState = trailingEvent.state;
            }

            if (trailingEvent.result) {
                latestResult = trailingEvent.result;
            }

            onEvent(trailingEvent);

            if (trailingEvent.type === "error") {
                return {
                    success: false,
                    error: trailingEvent.message || defaultError,
                };
            }
        }

        return {
            success: true,
            state: latestState,
            result: latestResult,
        };
    }

    private parseStreamEvent<TEvent extends { type: string; state?: AgentState; result?: CompleteResult; message?: string }>(
        eventBlock: string
    ): TEvent | null {
        const trimmedBlock = eventBlock.trim();
        if (!trimmedBlock) {
            return null;
        }

        const lines = trimmedBlock.split("\n");
        const eventLine = lines.find((line) => line.startsWith("event: "));
        const dataLine = lines.find((line) => line.startsWith("data: "));

        if (!eventLine || !dataLine) {
            return null;
        }

        try {
            const type = eventLine.slice(7).trim() as TEvent["type"];
            const payload = JSON.parse(dataLine.slice(6));
            return { type, ...payload } as TEvent;
        } catch (error) {
            console.error("Failed to parse stream event:", error, eventBlock);
            return null;
        }
    }

    private async readErrorResponse(response: Response, fallbackMessage: string): Promise<string> {
        try {
            const contentType = response.headers.get("content-type") || "";
            const bodyText = await response.text();

            if (!bodyText) {
                return `${fallbackMessage} (${response.status})`;
            }

            if (contentType.includes("application/json")) {
                const payload = JSON.parse(bodyText);
                return payload?.message || payload?.error || `${fallbackMessage} (${response.status})`;
            }

            const streamError = this.extractStreamError(bodyText);
            if (streamError) {
                return streamError;
            }

            return bodyText.trim() || `${fallbackMessage} (${response.status})`;
        } catch (error) {
            console.error("Failed to read error response:", error);
            return `${fallbackMessage} (${response.status})`;
        }
    }

    private extractStreamError(rawBody: string): string | null {
        const eventBlocks = rawBody.split("\n\n");
        for (const eventBlock of eventBlocks) {
            const parsed = this.parseStreamEvent<{ type: string; message?: string }>(eventBlock);
            if (parsed?.type === "error" && parsed.message) {
                return parsed.message;
            }
        }

        return null;
    }

    private toErrorMessage(error: unknown, fallbackMessage: string): string {
        if (error instanceof Error && error.message) {
            return error.message;
        }

        return fallbackMessage;
    }
}

export function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
