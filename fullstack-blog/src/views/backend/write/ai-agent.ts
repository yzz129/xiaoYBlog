import { message } from "ant-design-vue";

export interface AgentState {
    step: 'idle' | 'analyzing' | 'outlining' | 'writing' | 'reviewing' | 'completed';
    outline: Outline | null;
    currentSection: number;
    content: string;
    title: string;
    summary: string;
    feedback: string;
}

export interface Outline {
    title: string;
    summary: string;
    sections: Section[];
}

export interface Section {
    title: string;
    keyPoints: string[];
    content?: string;
}

export class WritingAgent {
    private state: AgentState;
    private apiKey: string;
    private onStateChange: (state: AgentState) => void;
    private onStreamContent: (content: string, type: 'title' | 'summary' | 'section') => void;

    constructor(
        apiKey: string,
        onStateChange: (state: AgentState) => void,
        onStreamContent: (content: string, type: 'title' | 'summary' | 'section') => void
    ) {
        this.apiKey = apiKey;
        this.onStateChange = onStateChange;
        this.onStreamContent = onStreamContent;
        this.state = {
            step: 'idle',
            outline: null,
            currentSection: 0,
            content: '',
            title: '',
            summary: '',
            feedback: ''
        };
    }

    getState(): AgentState {
        return { ...this.state };
    }

    private updateState(updates: Partial<AgentState>) {
        this.state = { ...this.state, ...updates };
        this.onStateChange(this.state);
    }

    // 步骤1: 分析需求并生成大纲
    async generateOutline(prompt: string, fileContent?: string): Promise<void> {
        this.updateState({ step: 'analyzing' });

        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: `你是一个专业的技术博客写作助手。请根据用户的需求生成文章大纲。
                            
请按照以下JSON格式输出大纲：
{
    "title": "文章标题",
    "summary": "文章摘要（100字左右）",
    "sections": [
        {
            "title": "章节标题",
            "keyPoints": ["要点1", "要点2", "要点3"]
        }
    ]
}

要求：
1. 标题要吸引人且准确反映内容
2. 摘要要概括文章核心内容
3. 章节划分要合理，逻辑清晰
4. 每个章节列出3-5个关键要点
5. 只输出JSON格式，不要其他说明文字`
                        },
                        {
                            role: 'user',
                            content: `${prompt}\n\n${fileContent ? '参考文件内容：' + fileContent : ''}`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error('API 调用失败');
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        if (dataStr === '[DONE]') break;

                        try {
                            const data = JSON.parse(dataStr);
                            const delta = data.choices[0].delta;

                            if (delta.content) {
                                fullContent += delta.content;
                            }
                        } catch (error) {
                            console.error('解析流式数据失败:', error);
                        }
                    }
                }
            }

            // 解析大纲
            const outline: Outline = JSON.parse(fullContent);
            this.updateState({
                step: 'outlining',
                outline,
                title: outline.title,
                summary: outline.summary
            });

            this.onStreamContent(outline.title, 'title');
            this.onStreamContent(outline.summary, 'summary');

            message.success('大纲生成完成，请确认后开始写作');
        } catch (error) {
            console.error('生成大纲失败:', error);
            message.error('生成大纲失败，请重试');
            this.updateState({ step: 'idle' });
        }
    }

    // 步骤2: 根据大纲逐段写作
    async writeSection(sectionIndex: number): Promise<void> {
        if (!this.state.outline) return;

        this.updateState({ step: 'writing', currentSection: sectionIndex });

        const section = this.state.outline.sections[sectionIndex];

        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: `你是一个专业的技术博客作者。请根据提供的大纲信息，撰写高质量的Markdown格式内容。

写作要求：
1. 使用Markdown格式，包括标题、列表、代码块等
2. 内容要详细、专业、易懂
3. 代码示例要完整且有注释
4. 适当使用图表或表格说明
5. 保持与前文的连贯性`
                        },
                        {
                            role: 'user',
                            content: `文章标题：${this.state.title}
文章摘要：${this.state.summary}

当前章节：${section.title}
关键要点：${section.keyPoints.join('、')}

${sectionIndex > 0 ? '前文内容：' + this.state.content.substring(Math.max(0, this.state.content.length - 500)) : ''}

请撰写这一章节的内容。`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error('API 调用失败');
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let sectionContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        if (dataStr === '[DONE]') break;

                        try {
                            const data = JSON.parse(dataStr);
                            const delta = data.choices[0].delta;

                            if (delta.content) {
                                sectionContent += delta.content;
                                this.onStreamContent(sectionContent, 'section');
                            }
                        } catch (error) {
                            console.error('解析流式数据失败:', error);
                        }
                    }
                }
            }

            // 更新章节内容
            const updatedOutline = { ...this.state.outline };
            updatedOutline.sections[sectionIndex].content = sectionContent;

            // 更新完整内容
            const newContent = this.state.content + '\n\n' + sectionContent;
            this.updateState({
                outline: updatedOutline,
                content: newContent
            });

            message.success(`第 ${sectionIndex + 1} 节写作完成`);
        } catch (error) {
            console.error('写作失败:', error);
            message.error('写作失败，请重试');
        }
    }

    // 步骤3: 根据用户反馈修改内容
    async reviseSection(sectionIndex: number, feedback: string): Promise<void> {
        if (!this.state.outline) return;

        this.updateState({ step: 'reviewing', feedback });

        const section = this.state.outline.sections[sectionIndex];

        try {
            const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'system',
                            content: `你是一个专业的技术博客编辑。请根据用户的反馈修改内容。`
                        },
                        {
                            role: 'user',
                            content: `原始内容：
${section.content}

用户反馈：
${feedback}

请根据反馈修改内容，保持Markdown格式。`
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 2048,
                    stream: true
                })
            });

            if (!response.ok) {
                throw new Error('API 调用失败');
            }

            const reader = response.body!.getReader();
            const decoder = new TextDecoder();
            let revisedContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        if (dataStr === '[DONE]') break;

                        try {
                            const data = JSON.parse(dataStr);
                            const delta = data.choices[0].delta;

                            if (delta.content) {
                                revisedContent += delta.content;
                                this.onStreamContent(revisedContent, 'section');
                            }
                        } catch (error) {
                            console.error('解析流式数据失败:', error);
                        }
                    }
                }
            }

            // 更新章节内容
            const updatedOutline = { ...this.state.outline };
            updatedOutline.sections[sectionIndex].content = revisedContent;

            // 更新完整内容
            const sections = updatedOutline.sections;
            const newContent = sections.map(s => s.content).join('\n\n');
            
            this.updateState({
                outline: updatedOutline,
                content: newContent
            });

            message.success('修改完成');
        } catch (error) {
            console.error('修改失败:', error);
            message.error('修改失败，请重试');
        }
    }

    // 步骤4: 完成写作
    complete(): { title: string; summary: string; content: string } {
        this.updateState({ step: 'completed' });
        return {
            title: this.state.title,
            summary: this.state.summary,
            content: this.state.content
        };
    }

    // 重置Agent
    reset() {
        this.state = {
            step: 'idle',
            outline: null,
            currentSection: 0,
            content: '',
            title: '',
            summary: '',
            feedback: ''
        };
        this.onStateChange(this.state);
    }
}
