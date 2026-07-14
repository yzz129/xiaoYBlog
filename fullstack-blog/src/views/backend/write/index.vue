<template>
    <section class="workspace__wrapper">
        <!-- 创作区保留完整发布和 AI 流程，只重构信息层级与视觉节奏。 -->
        <div class="admin-page-heading admin-page-heading--write">
            <div>
                <span class="admin-page-heading__eyebrow">IDEA WORKBENCH</span>
                <h1>{{ isEdit ? "继续打磨这篇文章" : "写下今天的新发现" }}</h1>
                <p>从一个念头开始，在左边落笔，在右边预览它最终的样子。</p>
            </div>
            <DoodleIcon name="pen" :size="58" />
        </div>
        <a-spin :spinning="initLoading">
            <a-form class="form-write" ref="formRef" :model="formModel" :rules="rules" :wrapper-col="{ span: 24 }">
                <a-form-item label="AI 创作">
                    <a-card title="AI 创作智能体">
                        <div v-if="agentState.step === 'idle' || agentState.step === 'analyzing' || agentState.step === 'failed'">
                            <a-form-item label="创作主题">
                                <a-textarea
                                    v-model:value="aiPrompt"
                                    placeholder="请输入创作主题，例如：生成一篇关于 Vue diff 算法的技术博客"
                                    :auto-size="{ minRows: 3, maxRows: 6 }"
                                />
                            </a-form-item>
                            <a-form-item label="参考文件（可选）">
                                <a-upload
                                    :multiple="false"
                                    accept=".txt,.md,.pdf,.docx,.doc"
                                    :before-upload="beforeUpload"
                                    @change="handleFileChange"
                                >
                                    <a-button>
                                        <upload-outlined></upload-outlined>
                                        选择文件
                                    </a-button>
                                </a-upload>
                                <p v-if="fileList.length > 0" class="file-list">
                                    {{ fileList[0].name }}
                                    <a @click="fileList = []" style="margin-left: 10px; color: #ff4d4f;">删除</a>
                                </p>
                            </a-form-item>
                            <a-form-item>
                                <a-button
                                    type="primary"
                                    :loading="agentState.step === 'analyzing'"
                                    @click="startAgent"
                                    :disabled="!aiPrompt.trim()"
                                >
                                    开始创作
                                </a-button>
                            </a-form-item>
                        </div>
                        <div v-if="agentState.step === 'outlining' || agentState.step === 'writing'">
                            <a-divider>文章大纲</a-divider>
                            <div class="outline-section">
                                <h3>{{ agentState.outline?.title }}</h3>
                                <p class="summary">{{ agentState.outline?.summary }}</p>
                                <a-timeline>
                                    <a-timeline-item
                                        v-for="(section, index) in agentState.outline?.sections"
                                        :key="index"
                                        :color="index < agentState.currentSection ? 'green' : index === agentState.currentSection ? 'blue' : 'gray'"
                                    >
                                        <div class="section-item">
                                            <h4>{{ section.title }}</h4>
                                            <ul>
                                                <li v-for="(point, pIndex) in section.keyPoints" :key="pIndex">
                                                    {{ point }}
                                                </li>
                                            </ul>
                                            <div v-if="section.content" class="section-preview">
                                                <a-tag color="green">已完成</a-tag>
                                            </div>
                                        </div>
                                    </a-timeline-item>
                                </a-timeline>
                            </div>
                            <a-form-item v-if="agentState.step === 'outlining'">
                                <a-space>
                                    <a-button type="primary" @click="confirmOutline">
                                        确认大纲，开始写作
                                    </a-button>
                                    <a-button @click="resetAgent">
                                        重新生成
                                    </a-button>
                                </a-space>
                            </a-form-item>
                        </div>
                        <div v-if="agentState.step === 'writing' || agentState.step === 'reviewing'">
                            <a-divider>当前章节</a-divider>
                            <div class="current-section" v-if="currentSection">
                                <h4>{{ currentSection.title }}</h4>
                                <div class="section-content">
                                    <a-textarea
                                        v-model:value="currentSectionContent"
                                        :auto-size="{ minRows: 10, maxRows: 20 }"
                                        class="section-editor"
                                    />
                                </div>
                                <div class="feedback-area" v-if="agentState.step === 'reviewing'">
                                    <a-form-item label="修改意见">
                                        <a-textarea
                                            v-model:value="sectionFeedback"
                                            placeholder="请输入修改意见，例如：请补充更多代码示例"
                                            :auto-size="{ minRows: 2, maxRows: 4 }"
                                        />
                                    </a-form-item>
                                    <a-space>
                                        <a-button type="primary" @click="reviseCurrentSection">
                                            确认修改
                                        </a-button>
                                        <a-button @click="cancelRevision">
                                            取消
                                        </a-button>
                                    </a-space>
                                </div>
                                <a-space v-else>
                                    <a-button
                                        type="primary"
                                        @click="nextSection"
                                        :disabled="agentState.currentSection >= (agentState.outline?.sections?.length || 0) - 1"
                                    >
                                        下一节
                                    </a-button>
                                    <a-button @click="showFeedback">
                                        修改本节
                                    </a-button>
                                    <a-button @click="skipSection">
                                        跳过本节
                                    </a-button>
                                </a-space>
                            </div>
                            <a-form-item v-if="agentState.currentSection >= (agentState.outline?.sections?.length || 0) - 1">
                                <a-button type="primary" @click="completeAgent">
                                    完成创作
                                </a-button>
                            </a-form-item>
                        </div>
                        <div v-if="agentState.step === 'completed'">
                            <a-result
                                status="success"
                                title="创作已完成"
                                sub-title="AI 已经整理好整篇文章，你可以将结果流式应用到正文部分。"
                            >
                                <template #extra>
                                    <a-button type="primary" :loading="isApplyingContent" @click="applyContent">
                                        应用到正文
                                    </a-button>
                                    <a-button @click="resetAgent">
                                        重新开始
                                    </a-button>
                                </template>
                            </a-result>
                            <div v-if="finalArticleStreamingText" class="outline-stream-panel">
                                <div class="outline-stream-title">最终成文流</div>
                                <pre class="outline-stream-content">{{ finalArticleStreamingText }}</pre>
                            </div>
                        </div>
                        <div v-if="agentState.step !== 'idle' && agentState.step !== 'completed'" class="agent-status">
                            <a-spin v-if="agentState.step !== 'failed'" size="small" />
                            <span style="margin-left: 10px;">{{ statusText }}</span>
                        </div>
                        <div v-if="agentState.step === 'analyzing' && outlineStreamingText" class="outline-stream-panel">
                            <div class="outline-stream-title">大纲生成流</div>
                            <pre class="outline-stream-content">{{ outlineStreamingText }}</pre>
                        </div>
                    </a-card>
                </a-form-item>
                <a-form-item>
                    <a-button type="primary" :loading="isPublishLoading" @click.prevent="onClickPublish">{{
                        isEdit ? "保存博客" : "发布博客"
                    }}</a-button>
                </a-form-item>
                <a-form-item name="poster" label="文章封面">
                    <div class="poster-upload">
                        <a-upload :show-upload-list="false" accept="image/*" :before-upload="handleCoverUpload">
                            <a-button :loading="coverUploading">
                                <upload-outlined></upload-outlined>
                                上传本地封面
                            </a-button>
                        </a-upload>
                        <a-input
                            class="input-simple"
                            v-model:value="formModel.poster"
                            placeholder="支持直接输入封面 URL，或上传本地图片后自动填充"
                        >
                        </a-input>
                    </div>
                    <el-image :src="formModel.poster" class="articlePoster" fit="cover" />
                </a-form-item>
                <a-form-item name="articleTitle" label="文章标题">
                    <a-input class="input-simple" v-model:value="formModel.articleTitle" placeholder="请输入标题"> </a-input>
                </a-form-item>
                <a-form-item name="summary" label="文章摘要">
                    <a-textarea
                        class="input-simple"
                        v-model:value="formModel.summary"
                        placeholder="请输入文章摘要"
                        :auto-size="{ minRows: 2, maxRows: 4 }"
                    />
                </a-form-item>
                <a-form-item name="private" label="是否私密">
                    <a-radio-group v-model:value="formModel.private">
                        <a-radio :value="0">否</a-radio>
                        <a-radio :value="1">是</a-radio>
                    </a-radio-group>
                </a-form-item>
                <a-form-item name="articleText" label="正文部分">
                    <a-row :gutter="20">
                        <a-col :span="12">
                            <a-textarea
                                class="md-textarea"
                                v-model:value="formModel.articleText"
                                placeholder="请输入 markdown 格式的正文"
                                @change="onMdContentChange"
                            />
                        </a-col>
                        <a-col :span="12">
                            <section class="md-preview" v-html="purifiedContent"></section>
                        </a-col>
                    </a-row>
                </a-form-item>
            </a-form>
        </a-spin>
        <a-modal title="关联分类/标签" v-model:open="isRelationVisible" :footer="null" width="860px">
            <a-form class="form-releation" ref="relFormRef" :model="relFormModel" :wrapper-col="{ span: 24 }">
                <a-form-item label="文章标签">
                    <a-form-item-rest>
                        <a-row :gutter="16">
                            <a-col v-for="(tag, index) in newTagList" :key="index" :xs="8" :sm="4">
                                <a-input v-model:value="tag.value" />
                                <DeleteOutlined @click="deleteTag(index)" />
                            </a-col>
                            <a-col :span="4"><PlusOutlined @click="addTag" /></a-col>
                        </a-row>
                    </a-form-item-rest>
                </a-form-item>
                <a-form-item label="新增分类">
                    <a-form-item-rest>
                        <a-row :gutter="16">
                            <a-col v-for="(category, index) in newCategoryList" :key="index" :xs="8" :sm="4">
                                <a-input v-model:value="category.value" />
                                <DeleteOutlined @click="deleteCategory(index)" />
                            </a-col>
                            <a-col :span="4"><PlusOutlined @click="addCategory" /></a-col>
                        </a-row>
                    </a-form-item-rest>
                </a-form-item>
                <a-form-item name="categorys" label="已有分类">
                    <a-checkbox-group v-model:value="relFormModel.oldCategoryIds">
                        <a-row :gutter="16">
                            <a-col v-for="category in categorys" :key="category.id" :xs="8" :sm="4">
                                <a-checkbox class="category-checkbox" :value="category.id">{{ category.category_name }}</a-checkbox>
                            </a-col>
                        </a-row>
                    </a-checkbox-group>
                </a-form-item>
                <a-form-item class="align-center">
                    <a-button type="primary" :loading="isConfirmLoading" @click.prevent="onConfirmPublish">{{
                        isEdit ? "确认保存" : "确认发布"
                    }}</a-button>
                </a-form-item>
            </a-form>
        </a-modal>
    </section>
</template>

<script setup lang="ts">
import DoodleIcon from "@/components/doodle-icon.vue";
































import { computed, reactive, ref } from "vue";

import { throttle } from "lodash-es";

import { PlusOutlined, DeleteOutlined, UploadOutlined } from "@ant-design/icons-vue";

import { Form, Input, message, Modal, Radio, Spin, Upload, Button, Card, Timeline, Tag, Result, Divider, Space } from "ant-design-vue";

import { useStore } from "@/stores";

import { useRoute, useRouter } from "vue-router";

import { REQUIRED_VALIDATOR_BLUR } from "@/utils/validator";

import { useAsyncLoading } from "@/hooks/async";

import { ArticleDTO, CategoryDTO, UserDTO } from "@/bean/dto";

import { categoryService } from "@/services/category";

import { articleService } from "@/services/article";

import { uploadService } from "@/services/upload";

import { AgentClient, AgentState, CompleteResult, Section, generateSessionId } from "./agent-client";

interface MarkdownDeps {
    marked: typeof import("marked").marked;
    DOMPurify: typeof import("dompurify").default;
}

let markdownDepsPromise: Promise<MarkdownDeps> | null = null;

const ensureMarkdownDeps = async (): Promise<MarkdownDeps> => {
    if (!markdownDepsPromise) {
        markdownDepsPromise = (async () => {
            const [markedModule, domPurifyModule, hljsModule, javascriptModule, htmlModule, cssModule, shellModule, jsonModule, plaintextModule] = await Promise.all([
                import("marked"),
                import("dompurify"),
                import("highlight.js/lib/core"),
                import("highlight.js/lib/languages/javascript"),
                import("highlight.js/lib/languages/xml"),
                import("highlight.js/lib/languages/css"),
                import("highlight.js/lib/languages/shell"),
                import("highlight.js/lib/languages/json"),
                import("highlight.js/lib/languages/plaintext"),
                import("highlight.js/styles/atom-one-dark.css"),
            ]);

            const hljs = hljsModule.default;
            hljs.registerLanguage("javascript", javascriptModule.default);
            hljs.registerLanguage("html", htmlModule.default);
            hljs.registerLanguage("css", cssModule.default);
            hljs.registerLanguage("shell", shellModule.default);
            hljs.registerLanguage("json", jsonModule.default);
            hljs.registerLanguage("plaintext", plaintextModule.default);

            markedModule.marked.setOptions({
                gfm: true,
                breaks: true,
            });

            return {
                marked: markedModule.marked,
                DOMPurify: domPurifyModule.default,
            };
        })();
    }

    return markdownDepsPromise;
};

interface NewTagDTO {
    value: string;
}

interface NewCategoryDTO {
    value: string;
}

interface RelFormModel {
    oldCategoryIds: number[];
}

const store = useStore();

const userInfo = computed<UserDTO | null>(() => store.userInfo);

const route = useRoute();

const router = useRouter();

const formRef = ref();

const formModel = reactive({
            articleText: "",
            private: 0,
            articleTitle: "",
            summary: "",
            poster: "",
        });

const coverUploading = ref(false);

const aiPrompt = ref("");

const fileList = ref<any[]>([]);

const agent = ref<AgentClient | null>(null);

const sessionId = ref("");

const agentState = ref<AgentState>({
            step: 'idle',
            outline: null,
            currentSection: 0,
            content: '',
            title: '',
            summary: '',
            feedback: '',
            statusMessage: '',
        });

const agentResult = ref<CompleteResult | null>(null);

const sectionFeedback = ref("");

const currentSectionContent = ref("");

const finalArticleStreamingText = ref("");

const isApplyingContent = ref(false);

const outlineStreamingText = ref("");

const statusText = computed(() => {
            const statusMap: Record<string, string> = {
                analyzing: "正在分析主题并生成大纲...",
                outlining: "大纲已生成，等待确认。",
                writing: `正在撰写第 ${agentState.value.currentSection + 1} 节...`,
                reviewing: "等待补充修改意见...",
                completed: "创作已完成。",
                failed: "创作失败。",
            };
            return agentState.value.statusMessage || statusMap[agentState.value.step] || "";
        });

const currentSection = computed<Section | null>(() => {
            if (!agentState.value.outline) return null;
            return agentState.value.outline.sections[agentState.value.currentSection] || null;
        });

const purifiedContent = ref("");

const updateArticlePreview = async (content: string) => {
            const { marked, DOMPurify } = await ensureMarkdownDeps();
            const markedContent = marked(content || "");
            purifiedContent.value = DOMPurify.sanitize(markedContent);
        };

const streamTextToArticle = async (content: string, chunkSize = 120) => {
            isApplyingContent.value = true;
            formModel.articleText = "";
            await updateArticlePreview("");

            for (let index = 0; index < content.length; index += chunkSize) {
                formModel.articleText += content.slice(index, index + chunkSize);
                await updateArticlePreview(formModel.articleText);
                await new Promise((resolve) => window.setTimeout(resolve, 16));
            }

            isApplyingContent.value = false;
        };

const isEdit = ref(false);

const rules = reactive({
            poster: [REQUIRED_VALIDATOR_BLUR],
            articleTitle: [REQUIRED_VALIDATOR_BLUR],
            summary: [REQUIRED_VALIDATOR_BLUR],
            articleText: [REQUIRED_VALIDATOR_BLUR],
        });

const articleDetail = ref<ArticleDTO | null>(null);

const originalTagNames = computed(() => articleDetail.value?.tags.map((item) => item.tagName) || []);

const originalCategoryIds = computed(() => articleDetail.value?.categories.map((item) => item.id) || []);

const init = async () => {
            if (!route.params.id) {
                return;
            }

            isEdit.value = true;
            const id = Number(route.params.id);
            const { data } = await articleService.detail(id);
            articleDetail.value = data;
            Object.assign(formModel, {
                articleText: data.content || data.article_text || "",
                articleTitle: data.article_name || "",
                poster: data.poster || "",
                summary: data.summary || "",
                private: data.private ?? 0,
            });
            await updateArticlePreview(formModel.articleText);
        };

const { trigger: triggerInit, loading: initLoading } = useAsyncLoading(init);

void triggerInit();

const handleRender = ({ target }: { target: HTMLTextAreaElement }) => {
            void updateArticlePreview(target.value);
        };

const onMdContentChange = throttle(handleRender, 300);

const isRelationVisible = ref(false);

const relFormModel = reactive<RelFormModel>({
            oldCategoryIds: [],
        });

const newTagList = ref<NewTagDTO[]>([]);

const addTag = () => {
            if (newTagList.value.length >= 4) {
                message.warning("最多添加 4 个标签");
                return;
            }
            newTagList.value.push({ value: "" });
        };

const deleteTag = (index: number) => {
            newTagList.value.splice(index, 1);
        };

const newCategoryList = ref<NewCategoryDTO[]>([]);

const addCategory = () => {
            if (newCategoryList.value.length >= 4) {
                message.warning("最多添加 4 个分类");
                return;
            }
            newCategoryList.value.push({ value: "" });
        };

const deleteCategory = (index: number) => {
            newCategoryList.value.splice(index, 1);
        };

const categorys = ref<CategoryDTO[]>([]);

const categoryNames = computed(() => categorys.value.map((item) => item.category_name));

const loadCategories = async () => {
            const res = await categoryService.all();
            categorys.value = res.data || [];
        };

void loadCategories();

const handlePublish = async () => {
            await formRef.value?.validate();
            isRelationVisible.value = true;
        };

const { trigger: onClickPublish, loading: isPublishLoading } = useAsyncLoading(handlePublish);

const handleCoverUpload = async (file: File) => {
            if (!file.type.startsWith("image/")) {
                message.error("封面仅支持图片文件");
                return false;
            }

            if (file.size / 1024 / 1024 > 5) {
                message.error("封面大小不能超过 5MB");
                return false;
            }

            coverUploading.value = true;
            try {
                const response = await uploadService.uploadImage(file, "article-cover");
                formModel.poster = response.data?.url || "";
                message.success("封面上传成功");
            } finally {
                coverUploading.value = false;
            }

            return false;
        };

const handleConfirmPublish = async () => {
            const tagNames = newTagList.value.map((item) => item.value.trim()).filter(Boolean);
            const newCategoryNames = newCategoryList.value.map((item) => item.value.trim()).filter(Boolean);

            if (!tagNames.length) {
                message.warning("至少输入一个标签");
                return Promise.reject(false);
            }

            const duplicateCategory = newCategoryNames.find((item) => categoryNames.value.includes(item));
            if (duplicateCategory) {
                message.warning(`分类 [${duplicateCategory}] 已存在，请直接选择已有分类`);
                return Promise.reject(false);
            }

            if (!newCategoryNames.length && !relFormModel.oldCategoryIds.length) {
                message.warning("至少选择一个分类");
                return Promise.reject(false);
            }

            if (isEdit.value) {
                const deleteTagIDs = (articleDetail.value?.tags || [])
                    .filter((tag) => !tagNames.includes(tag.tagName))
                    .map((tag) => tag.id);
                const newTags = tagNames.filter((tagName) => !originalTagNames.value.includes(tagName));
                const deleteCategoryIDs = (articleDetail.value?.categories || [])
                    .filter((category) => !relFormModel.oldCategoryIds.includes(category.id))
                    .map((category) => category.id);
                const relatedCategoryIDs = relFormModel.oldCategoryIds.filter((id) => !originalCategoryIds.value.includes(id));

                await articleService.update({
                    id: Number(route.params.id),
                    ...formModel,
                    deleteTagIDs: deleteTagIDs.length ? deleteTagIDs : null,
                    newTags: newTags.length ? newTags : null,
                    deleteCategoryIDs: deleteCategoryIDs.length ? deleteCategoryIDs : null,
                    newCategories: newCategoryNames.length ? newCategoryNames : null,
                    relatedCategoryIDs: relatedCategoryIDs.length ? relatedCategoryIDs : null,
                });
                message.success("保存成功");
            } else {
                await articleService.add({
                    authorId: userInfo.value?.id,
                    ...formModel,
                    oldCategoryIds: relFormModel.oldCategoryIds.length ? relFormModel.oldCategoryIds : null,
                    tags: tagNames,
                    newCategories: newCategoryNames.length ? newCategoryNames : null,
                });
                message.success("发布成功");
            }

            isRelationVisible.value = false;
            router.push("/backend");
        };

const { trigger: onConfirmPublish, loading: isConfirmLoading } = useAsyncLoading(handleConfirmPublish);

const beforeUpload = (file) => {
            // 限制文件大小不超过 10MB
            const isLt10M = file.size / 1024 / 1024 < 10;
            if (!isLt10M) {
                message.error("文件大小不能超过 10MB");
                return false;
            }

            const fileName = String(file.name || "").toLowerCase();
            const supportedExtensions = [".txt", ".md", ".pdf", ".docx", ".doc"];
            const isSupported = supportedExtensions.some((extension) => fileName.endsWith(extension));

            if (!isSupported) {
                message.error("只支持 .txt、.md、.pdf、.docx 或 .doc 文件");
                return false;
            }

            fileList.value = [file];
            return false;
        };

const readReferenceFile = async () => {
            const selectedFile = fileList.value[0];
            if (!selectedFile) {
                return "";
            }

            const rawFile = selectedFile.originFileObj || selectedFile;
            const fileName = String(rawFile.name || "").toLowerCase();

            if (fileName.endsWith(".doc")) {
                throw new Error("暂不支持解析旧版 .doc 文件，请先转换为 .docx 或 PDF。");
            }

            if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
                if (typeof rawFile.text === "function") {
                    return await rawFile.text();
                }

                return await readFileAsText(rawFile);
            }

            if (fileName.endsWith(".docx")) {
                return await extractDocxText(rawFile);
            }

            if (fileName.endsWith(".pdf")) {
                return await extractPdfText(rawFile);
            }

            if (typeof rawFile.text === "function") {
                return await rawFile.text();
            }

            return await readFileAsText(rawFile);
        };

const readFileAsText = async (rawFile: File): Promise<string> => {
            return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result || ""));
                reader.onerror = () => reject(new Error("参考文件读取失败"));
                reader.readAsText(rawFile);
            });
        };

const extractDocxText = async (rawFile: File): Promise<string> => {
            const mammoth = await import("mammoth/mammoth.browser");
            const arrayBuffer = await rawFile.arrayBuffer();
            const result = await mammoth.extractRawText({ arrayBuffer });

            if (result.messages?.length) {
                console.warn("DOCX parse messages:", result.messages);
            }

            return result.value?.trim() || "";
        };

const extractPdfText = async (rawFile: File): Promise<string> => {
            const pdfjsLib = await import("pdfjs-dist");
            pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
                "pdfjs-dist/build/pdf.worker.min.mjs",
                import.meta.url
            ).toString();

            const arrayBuffer = await rawFile.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const pageTexts: string[] = [];

            for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
                const page = await pdf.getPage(pageNumber);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map((item) => ("str" in item ? item.str : ""))
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim();

                if (pageText) {
                    pageTexts.push(pageText);
                }
            }

            return pageTexts.join("\n\n");
        };

const handleFileChange = (info) => {
            if (info.fileList && info.fileList.length > 0) {
                fileList.value = [info.fileList[info.fileList.length - 1]];
            }
        };

const generateContent = async () => {
            if (!aiPrompt.value.trim()) {
                message.warning("请输入创作主题");
                return;
            }

            let fileContent = "";
            try {
                fileContent = await readReferenceFile();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "参考文件读取失败";
                message.error(errorMessage);
                return;
            }
            formModel.articleTitle = aiPrompt.value.trim();
            formModel.summary = fileContent ? fileContent.slice(0, 120) : "";
            await streamTextToArticle(fileContent || "");
            message.success("参考内容已应用到正文");
        };

const startAgent = async () => {
            if (!aiPrompt.value.trim()) {
                message.warning("请输入创作主题");
                return;
            }

            sessionId.value = generateSessionId();
            agent.value = new AgentClient(sessionId.value);
            agentResult.value = null;
            currentSectionContent.value = "";
            sectionFeedback.value = "";
            outlineStreamingText.value = "";
            finalArticleStreamingText.value = "";
            agentState.value = {
                ...agentState.value,
                step: "analyzing",
                outline: null,
                currentSection: 0,
                content: "",
                title: "",
                summary: "",
                feedback: "",
                statusMessage: "正在分析主题并生成大纲...",
            };

            let fileContent = "";
            try {
                fileContent = await readReferenceFile();
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : "参考文件读取失败";
                agentState.value = {
                    ...agentState.value,
                    step: "failed",
                    statusMessage: errorMessage,
                };
                message.error(errorMessage);
                return;
            }
            const result = await agent.value.startStream(aiPrompt.value, fileContent, (event) => {
                if (event.type === "status" && event.statusMessage) {
                    agentState.value = {
                        ...agentState.value,
                        statusMessage: event.statusMessage,
                    };
                }

                if (event.type === "outline_delta" && event.content) {
                    outlineStreamingText.value += event.content;
                }

                if (event.type === "state" && event.state) {
                    agentState.value = event.state;
                }
            });

            if (result.success && result.state) {
                agentState.value = result.state;
                if (result.state.step === "outlining") {
                    message.success("大纲生成完成，请确认后开始写作");
                }
                return;
            }

            if (result.success && agent.value) {
                const latestState = await agent.value.getState();
                if (latestState.success && latestState.state) {
                    agentState.value = latestState.state;
                    if (latestState.state.step === "outlining") {
                        message.success("大纲生成完成，请确认后开始写作");
                        return;
                    }
                }
            }

            agentState.value = {
                ...agentState.value,
                step: "failed",
                statusMessage: result.error || "启动写作流程失败",
            };
            message.error(result.error || "启动写作流程失败");
        };

const confirmOutline = async () => {
            if (!agent.value) return;

            const result = await agent.value.confirmOutline();
            if (result.success && result.state) {
                agentState.value = result.state;
                currentSectionContent.value = "";

                const sectionIndex = 0;
                const streamResult = await agent.value.streamSection(sectionIndex, (chunk) => {
                    currentSectionContent.value += chunk;
                });

                if (!streamResult.success) {
                    message.error(streamResult.error || "章节内容流式输出失败");
                }
                return;
            }

            message.error(result.error || "确认大纲失败");
        };

const nextSection = async () => {
            if (!agent.value) return;

            const result = await agent.value.nextSection();
            if (result.success && result.state) {
                agentState.value = result.state;
                currentSectionContent.value = "";

                const sectionIndex = agentState.value.currentSection;
                const streamResult = await agent.value.streamSection(sectionIndex, (chunk) => {
                    currentSectionContent.value += chunk;
                });

                if (!streamResult.success) {
                    message.error(streamResult.error || "章节内容流式输出失败");
                }
                return;
            }

            message.error(result.error || "切换到下一节失败");
        };

const showFeedback = () => {
            if (!agent.value) return;
            agentState.value.step = 'reviewing';
        };

const cancelRevision = () => {
            if (!agent.value) return;
            agentState.value.step = 'writing';
            sectionFeedback.value = '';
        };

const reviseCurrentSection = async () => {
            if (!agent.value || !sectionFeedback.value.trim()) {
                message.warning("请输入修改意见");
                return;
            }

            const result = await agent.value.reviseSection(sectionFeedback.value);
            if (result.success && result.state) {
                agentState.value = result.state;
                currentSectionContent.value = "";
                sectionFeedback.value = "";

                const sectionIndex = agentState.value.currentSection;
                const streamResult = await agent.value.streamSection(sectionIndex, (chunk) => {
                    currentSectionContent.value += chunk;
                });

                if (!streamResult.success) {
                    message.error(streamResult.error || "修订内容流式输出失败");
                }
                return;
            }

            message.error(result.error || "修订当前章节失败");
        };

const skipSection = async () => {
            await nextSection();
        };

const completeAgent = async () => {
            if (!agent.value) return;

            finalArticleStreamingText.value = "";
            agentState.value = {
                ...agentState.value,
                step: "completed",
                statusMessage: "正在整理最终文章...",
            };

            const result = await agent.value.completeStream((event) => {
                if (event.type === "status" && event.statusMessage) {
                    agentState.value = {
                        ...agentState.value,
                        statusMessage: event.statusMessage,
                    };
                }

                if (event.type === "article_delta" && event.content) {
                    finalArticleStreamingText.value += event.content;
                    agentState.value = {
                        ...agentState.value,
                        content: finalArticleStreamingText.value,
                    };
                }

                if (event.type === "state" && event.state) {
                    agentState.value = event.state;
                }

                if (event.type === "result" && event.result) {
                    agentResult.value = event.result;
                }
            });

            if (result.success && result.result) {
                agentResult.value = result.result;
                finalArticleStreamingText.value = result.result.content || finalArticleStreamingText.value;
                agentState.value = {
                    ...agentState.value,
                    ...(result.state || {}),
                    step: "completed",
                    outline: result.result.outline,
                    title: result.result.title,
                    summary: result.result.summary,
                    content: result.result.content,
                    statusMessage: "写作流程已完成",
                };
                return;
            }

            agentState.value = {
                ...agentState.value,
                step: "failed",
                statusMessage: result.error || "完成创作失败",
            };
            message.error(result.error || "完成创作失败");
        };

const applyContent = async () => {
            const state = agentState.value;
            const finalResult = agentResult.value;
            const articleTitle = finalResult?.title || state.outline?.title || "";
            const articleSummary = finalResult?.summary || state.outline?.summary || "";
            const articleContent = finalResult?.content || state.content || "";

            if (!articleTitle && !articleSummary && !articleContent) {
                message.error("当前没有可应用的生成内容");
                return;
            }

            formModel.articleTitle = articleTitle;
            formModel.summary = articleSummary;
            await streamTextToArticle(articleContent);
            message.success("生成内容已应用到正文");
        };

const resetAgent = async () => {
            if (agent.value) {
                await agent.value.reset();
            }
            agent.value = null;
            sessionId.value = "";
            agentState.value = {
                step: 'idle',
                outline: null,
                currentSection: 0,
                content: '',
                title: '',
                summary: '',
                feedback: '',
                statusMessage: ''
            };
            agentResult.value = null;
            sectionFeedback.value = '';
            currentSectionContent.value = '';
            outlineStreamingText.value = '';
            finalArticleStreamingText.value = '';
            isApplyingContent.value = false;
            aiPrompt.value = '';
            fileList.value = [];
        };
</script>

<style lang="scss" scoped>
.workspace__wrapper {
    background-color: #fff;
    padding: 20px;
    min-height: 100vh;
}

.poster-upload {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 12px;
}

:deep(.md-textarea),
.md-preview {
    min-height: 450px;
    max-height: 70vh;
    padding: 16px 20px;
}

:deep(.md-textarea) {
    resize: vertical;
}

.md-preview {
    border: 1px solid #d9d9d9;
    overflow: auto;
}

:deep(.input-simple) {
    max-width: 100%;
    width: 100%;
}

:deep(.category-checkbox) {
    display: flex;
    align-items: center;
    .ant-checkbox + span {
        flex: 1;
        @include one-line-ellipsis;
    }
}

:deep(.articlePoster) {
    display: block;
    margin-top: 10px;
    max-width: 100%;
    height: auto;
    max-height: 360px;
}

/* Agent 相关样式 */
.outline-section {
    background-color: #f5f5f5;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    
    h3 {
        margin-top: 0;
        color: #1890ff;
    }
    
    .summary {
        color: #666;
        margin-bottom: 16px;
        font-style: italic;
    }
}

.section-item {
    h4 {
        margin: 8px 0;
        color: #333;
    }
    
    ul {
        margin: 8px 0;
        padding-left: 20px;
        
        li {
            color: #666;
            margin: 4px 0;
        }
    }
    
    .section-preview {
        margin-top: 8px;
    }
}

.current-section {
    background-color: #f0f8ff;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 16px;
    
    h4 {
        margin-top: 0;
        color: #1890ff;
    }
}

.section-editor {
    font-family: var(--xy-font-code);
    font-size: 14px;
}

.feedback-area {
    background-color: #fff7e6;
    padding: 16px;
    border-radius: 8px;
    margin-top: 16px;
}

.agent-status {
    display: flex;
    align-items: center;
    margin-top: 16px;
    padding: 12px;
    background-color: #e6f7ff;
    border-radius: 4px;
}

.outline-stream-panel {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid #d6e4ff;
    border-radius: 8px;
    background-color: #f7fbff;
}

.outline-stream-title {
    margin-bottom: 8px;
    color: #1677ff;
    font-weight: 600;
}

.outline-stream-content {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 260px;
    overflow: auto;
    font-family: var(--xy-font-code);
    font-size: 13px;
    line-height: 1.6;
}

.file-list {
    margin-top: 8px;
    color: #666;
}

/* 响应式设计 */
@media screen and (max-width: 768px) {
    .workspace__wrapper {
        padding: 10px;
    }
    
    :deep(.md-textarea),
    .md-preview {
        min-height: 400px;
        max-height: 60vh;
    }
    
    /* 小屏幕改为单栏布局 */
    :deep(.ant-row > .ant-col) {
        flex: 1 0 100%;
        max-width: 100%;
    }
    
    :deep(.ant-row) {
        flex-direction: column;
    }
    
    .md-preview {
        margin-top: 16px;
    }
}
</style>

<style lang="scss" scoped src="@/views/article/md-render.scss"></style>






