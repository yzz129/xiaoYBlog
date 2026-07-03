const { getAiWriterConfig } = require("./config");
const sessionStore = require("./session-store");
const DeepSeekChatClient = require("./llm-client");
const ResearchService = require("./research-service");
const Planner = require("./planner");
const Writer = require("./writer");
const Reviewer = require("./reviewer");
const { chunkText, getCurrentDateLabel, rebuildArticleContent } = require("./helpers");

/**
 * Multi-step blog writing workflow:
 * 1. submit start request
 * 2. run planning/research in background
 * 3. confirm outline
 * 4. write section by section
 * 5. revise
 * 6. complete
 */
class BlogWritingWorkflow {
    constructor(snapshot = null) {
        const options = getAiWriterConfig();

        if (!options.deepseekApiKey) {
            throw new Error("Missing DeepSeek API key configuration");
        }
        if (!options.tavilyApiKey) {
            throw new Error("Missing Tavily API key configuration");
        }

        this.options = options;
        this.llm = new DeepSeekChatClient(options);
        this.researchService = new ResearchService(options);
        this.planner = new Planner({
            llm: this.llm,
            researchService: this.researchService,
            knowledgeCutoff: options.knowledgeCutoff,
        });
        this.writer = new Writer({
            llm: this.llm,
            researchService: this.researchService,
            knowledgeCutoff: options.knowledgeCutoff,
        });
        this.reviewer = new Reviewer({
            llm: this.llm,
            knowledgeCutoff: options.knowledgeCutoff,
        });
        this.state = snapshot?.state || null;
        this.cachedReplay = snapshot?.cachedReplay || null;
    }

    _createInitialState(sessionId, prompt, fileContent) {
        const currentDate = getCurrentDateLabel();

        return {
            sessionId,
            prompt,
            fileContent: fileContent || "",
            step: "idle",
            currentSection: 0,
            content: "",
            title: "",
            summary: "",
            feedback: "",
            outline: null,
            analysis: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            statusMessage: "",
            metadata: {
                currentDate,
                knowledgeCutoff: this.options.knowledgeCutoff,
                latestInfoPolicy:
                    "Research externally for current facts and treat post-cutoff facts as untrusted unless grounded by search results.",
            },
            research: {
                globalPackets: [],
                sectionPackets: {},
            },
            reviewReport: null,
        };
    }

    _ensureState() {
        if (!this.state) {
            throw new Error("Session has not been initialized");
        }
    }

    _cloneState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    initializeStart(sessionId, prompt, fileContent = "") {
        this.state = this._createInitialState(sessionId, prompt, fileContent);
        this.state.step = "analyzing";
        this.state.statusMessage = "Analyzing topic and building outline...";
        this.state.updatedAt = new Date().toISOString();

        return { success: true, state: this._cloneState() };
    }

    async runStartPipeline(streamHooks = {}) {
        this._ensureState();

        const { prompt, fileContent } = this.state;
        const planResult = await this.planner.createPlan({ prompt, fileContent }, streamHooks);

        this.state.analysis = planResult.analysis;
        this.state.research.globalPackets = planResult.globalResearch;
        this.state.outline = planResult.outline;
        this.state.title = planResult.outline.title;
        this.state.summary = planResult.outline.summary;
        this.state.step = "outlining";
        this.state.statusMessage = "Outline is ready. Confirm it to start writing.";
        this.state.updatedAt = new Date().toISOString();

        return { success: true, state: this._cloneState() };
    }

    async start(sessionId, prompt, fileContent = "") {
        this.initializeStart(sessionId, prompt, fileContent);
        return this.runStartPipeline();
    }

    failStart(error) {
        this._ensureState();
        this.state.step = "failed";
        this.state.statusMessage = error?.message || "Failed to build outline";
        this.state.updatedAt = new Date().toISOString();
        return { success: false, state: this._cloneState() };
    }

    async confirmOutline() {
        this._ensureState();
        this.state.step = "writing";
        this.state.statusMessage = "Outline confirmed. Preparing current section...";
        this.state.updatedAt = new Date().toISOString();
        return { success: true, state: this._cloneState() };
    }

    async streamSection(sectionIndex, onChunk) {
        this._ensureState();
        const section = this.state.outline?.sections?.[sectionIndex];

        if (!section) {
            throw new Error("Invalid section index");
        }

        if (this.cachedReplay && this.cachedReplay.sectionIndex === sectionIndex) {
            for (const chunk of chunkText(this.cachedReplay.content)) {
                await onChunk(chunk);
            }
            this.cachedReplay = null;
            return section.content || "";
        }

        if (section.content) {
            for (const chunk of chunkText(section.content)) {
                await onChunk(chunk);
            }
            return section.content;
        }

        this.state.step = "writing";
        this.state.statusMessage = `Writing section ${sectionIndex + 1}: ${section.title}`;
        this.state.updatedAt = new Date().toISOString();

        return this.writer.draftSection(this.state, sectionIndex, onChunk);
    }

    async nextSection() {
        this._ensureState();

        const nextIndex = this.state.currentSection + 1;
        const sectionCount = this.state.outline.sections.length;

        if (nextIndex >= sectionCount) {
            this.state.step = "completed";
            this.state.statusMessage = "All sections are complete. You can now apply the final article.";
            this.state.updatedAt = new Date().toISOString();
            return { success: true, state: this._cloneState() };
        }

        this.state.currentSection = nextIndex;
        this.state.step = "writing";
        this.state.statusMessage = `Switched to section ${nextIndex + 1}.`;
        this.state.updatedAt = new Date().toISOString();

        return { success: true, state: this._cloneState() };
    }

    async reviseSection(feedback) {
        this._ensureState();

        const sectionIndex = this.state.currentSection;
        const revisedContent = await this.reviewer.reviseSection(this.state, sectionIndex, feedback);
        this.cachedReplay = {
            sectionIndex,
            content: revisedContent,
        };
        this.state.step = "writing";
        this.state.statusMessage = "Current section was rewritten from your feedback.";
        this.state.updatedAt = new Date().toISOString();

        return { success: true, state: this._cloneState() };
    }

    async handleFeedback(feedback) {
        if (!feedback || !feedback.comment) {
            return { success: false, error: "Missing feedback content" };
        }

        return this.reviseSection(feedback.comment);
    }

    async complete() {
        this._ensureState();

        this.state.content = rebuildArticleContent(this.state.outline);
        this.state.reviewReport = await this.reviewer.evaluateArticle(this.state);
        this.state.step = "completed";
        this.state.statusMessage = "Writing workflow completed.";
        this.state.updatedAt = new Date().toISOString();

        return {
            success: true,
            result: {
                title: this.state.outline.title,
                summary: this.state.outline.summary,
                content: this.state.content,
                outline: this._cloneState().outline,
                reviewReport: this.state.reviewReport,
            },
        };
    }

    async completeStream(streamHooks = {}) {
        this._ensureState();

        const { onStatus = null, onArticleChunk = null } = streamHooks;

        this.state.content = rebuildArticleContent(this.state.outline);
        this.state.statusMessage = "Assembling final article...";
        this.state.updatedAt = new Date().toISOString();

        if (onStatus) {
            await onStatus(this.state.statusMessage);
        }

        if (onArticleChunk) {
            for (const chunk of chunkText(this.state.content)) {
                await onArticleChunk(chunk);
            }
        }

        this.state.statusMessage = "Reviewing final article quality...";
        this.state.updatedAt = new Date().toISOString();
        if (onStatus) {
            await onStatus(this.state.statusMessage);
        }

        this.state.reviewReport = await this.reviewer.evaluateArticle(this.state);
        this.state.step = "completed";
        this.state.statusMessage = "Writing workflow completed.";
        this.state.updatedAt = new Date().toISOString();

        return {
            success: true,
            state: this._cloneState(),
            result: {
                title: this.state.outline.title,
                summary: this.state.outline.summary,
                content: this.state.content,
                outline: this._cloneState().outline,
                reviewReport: this.state.reviewReport,
            },
        };
    }

    async reset() {
        this.state = null;
        this.cachedReplay = null;
    }

    getState() {
        return this._cloneState();
    }

    exportSession() {
        return {
            state: this._cloneState(),
            cachedReplay: this.cachedReplay ? { ...this.cachedReplay } : null,
        };
    }
}

BlogWritingWorkflow.sessionStore = sessionStore;

module.exports = BlogWritingWorkflow;
