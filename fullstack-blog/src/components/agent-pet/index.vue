<template>
    <teleport to="body">
        <div
            v-if="visible && !petHidden"
            ref="launcherRef"
            class="pet-launcher"
            :class="{
                'pet-launcher--busy': hasRunningTask,
                'pet-launcher--dragging': isDragging,
                'pet-launcher--bubble-right': bubbleOpensRight,
                [`pet-launcher--state-${petVisualState}`]: true,
                [`pet-launcher--motion-${petMotion}`]: true,
            }"
            :style="launcherStyle"
        >
            <transition name="pet-bubble">
                <aside v-if="bubbleVisible && !isOpen" class="pet-launcher__bubble" aria-live="polite" @pointerdown.stop>
                    <div class="pet-bubble__topline">
                        <span :class="['status-dot', `status-dot--${launcherTone}`]"></span>
                        <span>{{ launcherStatus }}</span>
                        <button type="button" aria-label="收起提示气泡" title="收起气泡" @click.stop="hideBubble">×</button>
                    </div>
                    <strong>{{ proactiveInteraction ? "小Y 来找你啦" : launcherTitle }}</strong>
                    <p>{{ proactiveInteraction?.content || launcherHint }}</p>
                    <div v-if="launcherProgress.total" class="pet-bubble__progress">
                        <div><span>任务进度</span><b>{{ launcherProgress.completed }}/{{ launcherProgress.total }}</b></div>
                        <i><span :style="{ width: `${launcherProgress.percent}%` }"></span></i>
                    </div>
                    <div class="pet-bubble__footer">
                        <span>按住小Y可拖动</span>
                        <button type="button" @click.stop="hidePet">隐藏小Y</button>
                    </div>
                </aside>
            </transition>

            <button
                ref="launcherButtonRef"
                class="pet-launcher__orb"
                type="button"
                aria-label="打开小Y Agent；按住可以拖动"
                title="点击打开，按住拖动"
                @click="handleLauncherClick"
                @pointerdown="startDrag"
                @pointermove="moveDrag"
                @pointerup="endDrag"
                @pointercancel="endDrag"
                @mouseenter="startHoverMotion"
                @mouseleave="endHoverMotion"
            >
                <span class="pet-launcher__aura" aria-hidden="true"></span>
                <span class="pet-launcher__shadow" aria-hidden="true"></span>
                <span class="pet-launcher__spark pet-launcher__spark--one" aria-hidden="true"></span>
                <span class="pet-launcher__spark pet-launcher__spark--two" aria-hidden="true"></span>
                <span class="pet-launcher__spark pet-launcher__spark--three" aria-hidden="true"></span>
                <span v-if="hasRunningTask" class="pet-launcher__status" aria-hidden="true"></span>
                <img :src="petImage" alt="" draggable="false" />
            </button>
            <button
                v-if="!bubbleVisible && !isOpen"
                class="pet-launcher__bubble-toggle"
                type="button"
                aria-label="显示小Y的任务提示"
                title="显示任务提示"
                @click.stop="showBubble"
            >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5.5h14v10H9l-4 3v-13Z" /></svg>
            </button>
        </div>

        <transition name="pet-recall">
            <button v-if="visible && petHidden" class="pet-recall" type="button" aria-label="召回小Y Agent" @click="showPet">
                <img :src="mascotIdle" alt="" />
                <span>召回小Y</span>
            </button>
        </transition>

        <transition name="agent-bubble">
            <aside
                v-if="isOpen"
                ref="drawerRef"
                class="agent-bubble"
                :class="{ 'agent-bubble--below': chatBubbleBelow, 'agent-bubble--ready': chatBubbleReady }"
                :style="chatBubbleStyle"
                role="dialog"
                aria-label="小Y Agent 任务助手"
                tabindex="-1"
            >
                <header class="agent-header">
                    <div class="agent-header__identity">
                        <div class="agent-header__avatar"><img :src="petImage" alt="小Y" /></div>
                        <div>
                            <h2>小Y Agent</h2>
                            <p><span :class="['status-dot', `status-dot--${currentTone}`]"></span>{{ currentStatusText }}</p>
                        </div>
                    </div>
                    <div class="agent-header__actions">
                        <button
                            v-if="authenticated || preview"
                            type="button"
                            title="主动陪伴设置"
                            aria-label="主动陪伴设置"
                            :class="{ active: settingsOpen }"
                            @click="settingsOpen = !settingsOpen"
                        >
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></svg>
                        </button>
                        <button v-if="authenticated || preview" type="button" title="新任务" aria-label="新任务" @click="startNewTask">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                        </button>
                        <button type="button" title="关闭" aria-label="关闭" @click="closeDrawer">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                        </button>
                    </div>
                </header>

                <section v-if="settingsOpen && (authenticated || preview)" class="agent-settings" aria-label="主动陪伴设置">
                    <div class="agent-settings__head">
                        <div><strong>Agent Loop</strong><span>只在你在线且活跃时陪伴</span></div>
                        <label class="agent-switch">
                            <input v-model="agentSettings.proactiveEnabled" type="checkbox" />
                            <span></span>
                        </label>
                    </div>
                    <div class="agent-settings__grid">
                        <label>互动风格
                            <select v-model.number="agentSettings.humorLevel">
                                <option :value="0">安静务实</option>
                                <option :value="1">温和陪伴</option>
                                <option :value="2">偶尔玩梗</option>
                                <option :value="3">活泼有梗</option>
                            </select>
                        </label>
                        <label>最短间隔
                            <select v-model.number="agentSettings.intervalMinutes">
                                <option :value="30">30 分钟</option>
                                <option :value="60">1 小时</option>
                                <option :value="120">2 小时</option>
                                <option :value="240">4 小时</option>
                            </select>
                        </label>
                        <label>每天最多
                            <select v-model.number="agentSettings.dailyLimit">
                                <option :value="1">1 次</option>
                                <option :value="2">2 次</option>
                                <option :value="4">4 次</option>
                                <option :value="6">6 次</option>
                                <option :value="8">8 次</option>
                            </select>
                        </label>
                        <label>安静开始<input v-model="agentSettings.quietStart" type="time" /></label>
                        <label>安静结束<input v-model="agentSettings.quietEnd" type="time" /></label>
                    </div>
                    <div class="agent-settings__foot">
                        <span>每天最多 {{ agentSettings.dailyLimit }} 次；不会记忆密码、密钥和联系方式。</span>
                        <button type="button" :disabled="settingsSaving" @click="saveAgentSettings">{{ settingsSaving ? "保存中…" : "保存" }}</button>
                    </div>
                </section>

                <template v-if="authenticated || preview">
                <div v-if="tasks.length" class="task-rail" aria-label="最近任务">
                    <button
                        v-for="task in tasks.slice(0, 6)"
                        :key="task.id"
                        type="button"
                        :class="{ active: task.id === activeTask?.id }"
                        @click="selectTask(task.id)"
                    >
                        <span :class="['task-rail__dot', `task-rail__dot--${statusTone(task.status)}`]"></span>
                        <span>{{ task.title }}</span>
                    </button>
                </div>

                <main ref="scrollArea" class="agent-content">
                    <section v-if="proactiveInteraction" class="proactive-card">
                        <div class="proactive-card__mascot"><img :src="petThinking" alt="" /></div>
                        <div class="proactive-card__body">
                            <div><strong>小Y 主动来找你</strong><small>已结合你的任务与偏好</small></div>
                            <p>{{ proactiveInteraction.content }}</p>
                            <button v-if="proactiveInteraction.suggestion" type="button" @click="useProactiveSuggestion">
                                {{ proactiveInteraction.suggestion }}
                            </button>
                        </div>
                        <div class="proactive-card__feedback" aria-label="评价这次互动">
                            <button type="button" title="喜欢，今后多来一点" :class="{ active: proactiveInteraction.feedback === 'liked' }" @click="feedbackProactive('liked')">👍</button>
                            <button type="button" title="不喜欢，减少类似内容" :class="{ active: proactiveInteraction.feedback === 'disliked' }" @click="feedbackProactive('disliked')">👎</button>
                            <button type="button" title="收起" @click="dismissProactive">×</button>
                        </div>
                    </section>
                    <div v-if="!activeTask" class="agent-welcome">
                        <div class="agent-welcome__art"><img :src="petWork" alt="" /></div>
                        <h3>把事情交给我吧</h3>
                        <p>我可以搜索站内博客、找到作者、关注或添加好友、发送私信、整理资料、撰写或编辑文章，也能按你指定的时间开始。</p>
                        <button type="button" @click="useExample">试试：查资料并写一篇博客</button>
                        <div v-if="agentMetrics" class="agent-health" aria-label="Agent 运行概况">
                            <span><b>{{ metricsSuccessRate }}</b><small>完成成功率</small></span>
                            <span><b>{{ agentMetrics.tasks.total }}</b><small>累计任务</small></span>
                            <span><b>{{ agentMetrics.alerts.length }}</b><small>待关注</small></span>
                        </div>
                        <small v-if="agentMetrics?.orchestration" class="agent-health__mode">执行引擎：{{ agentMetrics.orchestration.driver === 'redis' ? 'Redis 持久队列' : '数据库安全轮询' }} · {{ agentMetrics.orchestration.state }}</small>
                    </div>

                    <template v-else>
                        <section class="conversation-block">
                            <div class="user-message">
                                <span>你</span>
                                <div>
                                    <p>{{ activeTask.goal }}</p>
                                    <div v-if="activeTask.context?.attachments?.length" class="message-images">
                                        <img v-for="image in activeTask.context.attachments" :key="image.url" :src="image.url" :alt="image.name || '任务图片'" />
                                    </div>
                                </div>
                            </div>
                            <div v-if="activeTask.scheduledAt" class="schedule-note">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>
                                {{ formatSchedule(activeTask.scheduledAt) }} 执行
                            </div>
                        </section>

                        <section v-if="activeTask.context?.plan?.length" class="plan-block">
                            <div class="section-title">
                                <h3>执行计划</h3>
                                <span>{{ completedStepCount }}/{{ normalizedPlan.length }}</span>
                            </div>
                            <ol class="plan-list">
                                <li v-for="step in normalizedPlan" :key="step.id" :class="`plan-list__item--${step.status}`">
                                    <span class="plan-list__marker">
                                        <svg v-if="step.status === 'completed'" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 12 3 3 7-7" /></svg>
                                        <span v-else-if="step.status === 'running'" class="working-dots"><i></i><i></i><i></i></span>
                                        <span v-else-if="step.status === 'failed'">!</span>
                                        <span v-else-if="step.status === 'skipped'">–</span>
                                        <span v-else></span>
                                    </span>
                                    <div>
                                        <strong>{{ step.title }}</strong>
                                        <p v-if="step.status === 'waiting'">等待你的确认或补充信息</p>
                                        <p v-else-if="step.retryAt">将在 {{ formatSchedule(step.retryAt) }} 自动重试</p>
                                        <p v-else-if="step.error">{{ step.error }}</p>
                                        <p v-else-if="step.summary && step.status !== 'running'">{{ step.summary }}</p>
                                    </div>
                                </li>
                            </ol>
                        </section>

                        <section v-else-if="activeTask.status === 'scheduled'" class="scheduled-block">
                            <div class="scheduled-block__clock">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l4 2" /></svg>
                            </div>
                            <div><strong>已经记下来了</strong><p>到时间后我会自己开始，并持续保存进度。</p></div>
                        </section>

                        <section v-else class="activity-block">
                            <div v-for="event in visibleEvents" :key="event.id" :class="['activity-row', `activity-row--${event.status}`]">
                                <span></span><div><strong>{{ event.title }}</strong><p v-if="event.content">{{ event.content }}</p></div>
                            </div>
                        </section>

                        <section v-if="draft" class="artifact-card">
                            <div class="artifact-card__head"><span>博客草稿</span><button type="button" @click="draftVisible = true">查看全文</button></div>
                            <img v-if="draft.poster" class="artifact-card__poster" :src="draft.poster" :alt="draft.title" />
                            <h3>{{ draft.title }}</h3>
                            <p>{{ draft.summary || draft.content.slice(0, 100) }}</p>
                            <small v-if="draft.images?.length">已包含 {{ draft.images.length }} 张图片</small>
                        </section>

                        <section v-if="activeTask.status === 'waiting_approval' && activeTask.pendingAction" class="approval-card">
                            <div class="approval-card__icon">
                                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7v5c0 4.8 3.4 7.9 8 9 4.6-1.1 8-4.2 8-9V7l-8-4Z" /><path d="m9 12 2 2 4-4" /></svg>
                            </div>
                            <div>
                                <h3>这一步需要你的确认</h3>
                                <p>{{ activeTask.pendingAction.label }}</p>
                                <blockquote v-if="approvalPayloadPreview">{{ approvalPayloadPreview }}</blockquote>
                                <small>{{ approvalHint }}</small>
                            </div>
                            <div class="approval-card__actions">
                                <button class="secondary" type="button" @click="handleApproval(false)">先不执行</button>
                                <button class="primary" type="button" @click="handleApproval(true)">批准执行</button>
                            </div>
                        </section>

                        <section v-if="activeTask.result?.summary" class="result-card">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>
                            <div><strong>任务完成</strong><p>{{ activeTask.result.summary }}</p></div>
                        </section>

                        <section v-if="activeTask.lastError" class="error-card">
                            <strong>任务遇到问题</strong><p>{{ activeTask.lastError }}</p>
                        </section>

                        <section class="diagnostic-card">
                            <button class="diagnostic-card__toggle" type="button" :aria-expanded="diagnosticsOpen" @click="toggleDiagnostics">
                                <span><strong>运行报告</strong><small>{{ diagnosticStatusLabel }}</small></span>
                                <span aria-hidden="true">{{ diagnosticsOpen ? '收起' : '查看' }}</span>
                            </button>
                            <div v-if="diagnosticsOpen" class="diagnostic-card__body">
                                <p v-if="diagnosticsLoading" class="diagnostic-card__loading">正在汇总模型、工具与预算数据…</p>
                                <template v-else-if="taskDiagnostics">
                                    <div class="diagnostic-grid">
                                        <span><small>决策</small><b>{{ taskDiagnostics.decisions.total }}</b></span>
                                        <span><small>模型调用</small><b>{{ taskDiagnostics.models.calls }}</b></span>
                                        <span><small>工具成功</small><b>{{ taskDiagnostics.tools.completed }}</b></span>
                                        <span><small>Token</small><b>{{ formatCompactNumber(taskDiagnostics.models.totalTokens) }}</b></span>
                                    </div>
                                    <p v-if="taskDiagnostics.observability.traceIds.length" class="diagnostic-trace">Trace {{ taskDiagnostics.observability.traceIds[taskDiagnostics.observability.traceIds.length - 1].slice(0, 12) }}…</p>
                                    <div class="budget-row"><span>步骤</span><b>{{ taskDiagnostics.budget.usedSteps }} / {{ taskDiagnostics.budget.maxSteps }}</b></div>
                                    <div class="budget-track"><i :style="{ width: budgetPercent(taskDiagnostics.budget.usedSteps, taskDiagnostics.budget.maxSteps) }"></i></div>
                                    <div class="budget-row"><span>工具调用</span><b>{{ taskDiagnostics.budget.usedToolCalls }} / {{ taskDiagnostics.budget.maxToolCalls }}</b></div>
                                    <div class="budget-track"><i :style="{ width: budgetPercent(taskDiagnostics.budget.usedToolCalls, taskDiagnostics.budget.maxToolCalls) }"></i></div>
                                    <div v-if="taskDiagnostics.warnings.length" class="diagnostic-warnings">
                                        <p v-for="warning in taskDiagnostics.warnings" :key="warning">{{ warning }}</p>
                                    </div>
                                    <p v-else class="diagnostic-ok">运行健康，未发现异常。</p>
                                </template>
                                <p v-else class="diagnostic-card__loading">暂时没有可用的运行数据。</p>
                            </div>
                        </section>
                    </template>
                </main>

                <footer class="agent-composer">
                    <div v-if="!activeTask" class="schedule-control">
                        <button type="button" :class="{ active: scheduleEnabled }" @click="scheduleEnabled = !scheduleEnabled">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 8v5l3 2" /></svg>
                            {{ scheduleEnabled ? "定时执行" : "立即执行" }}
                        </button>
                        <input v-if="scheduleEnabled" v-model="scheduledAt" type="datetime-local" aria-label="任务执行时间" :min="minimumSchedule" />
                    </div>
                    <div class="attachment-control">
                        <input
                            ref="attachmentInput"
                            class="attachment-input"
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            multiple
                            aria-label="选择任务图片"
                            @change="handleAttachmentSelection"
                        />
                        <button type="button" :class="{ active: pendingAttachments.length }" :disabled="attachmentUploading || pendingAttachments.length >= 6" @click="openAttachmentPicker">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12.5 14.2 6.3a3 3 0 1 1 4.2 4.2l-8.5 8.5a5 5 0 0 1-7.1-7.1l8-8" /></svg>
                            {{ attachmentUploading ? "正在上传…" : pendingAttachments.length ? `图片 ${pendingAttachments.length}/6` : "添加图片" }}
                        </button>
                        <span>支持 JPG、PNG、WEBP、GIF，单张不超过 5MB</span>
                    </div>
                    <div v-if="pendingAttachments.length" class="attachment-previews" aria-label="待发送图片">
                        <figure v-for="image in pendingAttachments" :key="image.id">
                            <img :src="image.previewUrl" :alt="image.name" />
                            <button type="button" :aria-label="`移除 ${image.name}`" @click="removeAttachment(image.id)">×</button>
                        </figure>
                    </div>
                    <div class="composer-box">
                        <textarea
                            v-model="messageText"
                            :placeholder="graphMessageBlocked ? graphMessageHint : activeTask ? '继续补充要求…' : '告诉小Y要完成什么任务…'"
                            :disabled="graphMessageBlocked"
                            rows="2"
                            @keydown.enter.exact.prevent="submitMessage"
                        ></textarea>
                        <button class="send-button" type="button" :disabled="graphMessageBlocked || !messageText.trim() || submitting || attachmentUploading" aria-label="发送任务" @click="submitMessage">
                            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 5 16 7-16 7 3-7-3-7Z" /><path d="M7 12h13" /></svg>
                        </button>
                    </div>
                    <div v-if="activeTask && !terminalStatus" class="task-controls">
                        <button v-if="activeTask.status === 'paused'" type="button" @click="resumeTask">继续任务</button>
                        <button v-else-if="activeTask.status !== 'waiting_approval'" type="button" @click="pauseTask">暂停</button>
                        <span>执行记录会自动保存</span>
                        <button class="danger" type="button" @click="cancelTask">取消任务</button>
                    </div>
                    <p v-else class="composer-hint">Enter 发送 · 发布、关注、好友与私信等对外操作会先征求你的确认</p>
                </footer>
                </template>

                <main v-else class="agent-content agent-content--guest">
                    <div class="guest-gate">
                        <div class="guest-gate__art"><img :src="petWork" alt="小Y" /></div>
                        <span>AI 任务助手</span>
                        <h3>登录后，把任务交给我</h3>
                        <p>我可以搜索博客、查找作者、关注或添加好友、发送私信、整理资料、撰写和编辑文章，也可以按指定时间自动执行。</p>
                        <button type="button" @click="goToLogin">登录并开始使用</button>
                        <small>涉及发布、关注、好友和私信等对外操作时，我会先征求你的确认。</small>
                    </div>
                </main>
            </aside>
        </transition>

        <a-modal v-model:open="draftVisible" :footer="null" width="760px" title="小Y 撰写的博客草稿" class="agent-draft-modal">
            <article v-if="draft" class="draft-preview">
                <h1>{{ draft.title }}</h1>
                <p class="draft-preview__summary">{{ draft.summary }}</p>
                <img v-if="draft.poster" class="draft-preview__poster" :src="draft.poster" :alt="draft.title" />
                <pre>{{ draft.content }}</pre>
            </article>
        </a-modal>
    </teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { message } from "ant-design-vue";
import { useRouter } from "vue-router";
import { io, type Socket } from "socket.io-client";

import mascotIdle from "@/assets/illustrations/empty-mascot.webp";
import petCelebrate from "@/assets/illustrations/pet-celebrate.png";
import petSleep from "@/assets/illustrations/pet-sleep.png";
import petThinking from "@/assets/illustrations/pet-thinking.png";
import petWork from "@/assets/illustrations/pet-work.png";
import {
    PetAgentInteraction,
    PetAgentMetrics,
    PetAgentProfile,
    PetAgentSettings,
    PetTask,
    PetTaskDiagnostics,
    PetTaskStatus,
    petAgentService,
} from "@/services/pet-agent";
import { uploadService } from "@/services/upload";

const props = withDefaults(defineProps<{ visible: boolean; preview?: boolean; authenticated?: boolean }>(), { preview: false, authenticated: true });
const router = useRouter();

const isOpen = ref(false);
const tasks = ref<PetTask[]>([]);
const activeTask = ref<PetTask | null>(null);
const taskDiagnostics = ref<PetTaskDiagnostics | null>(null);
const agentMetrics = ref<PetAgentMetrics | null>(null);
const diagnosticsOpen = ref(false);
const diagnosticsLoading = ref(false);
const messageText = ref("");
const scheduleEnabled = ref(false);
const scheduledAt = ref("");
const submitting = ref(false);
const draftVisible = ref(false);
interface PendingAttachment {
    id: string;
    name: string;
    url: string;
    previewUrl: string;
}
const attachmentInput = ref<HTMLInputElement | null>(null);
const pendingAttachments = ref<PendingAttachment[]>([]);
const attachmentUploading = ref(false);
const agentProfile = ref<PetAgentProfile | null>(null);
const proactiveInteraction = ref<PetAgentInteraction | null>(null);
const settingsOpen = ref(false);
const settingsSaving = ref(false);
const agentSettings = ref<PetAgentSettings>({
    proactiveEnabled: true,
    humorLevel: 2,
    intervalMinutes: 60,
    quietStart: "23:00",
    quietEnd: "07:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai",
    dailyLimit: 4,
});
const scrollArea = ref<HTMLElement | null>(null);
const launcherRef = ref<HTMLElement | null>(null);
const launcherButtonRef = ref<HTMLButtonElement | null>(null);
const drawerRef = ref<HTMLElement | null>(null);
const launcherPosition = ref<{ x: number; y: number } | null>(null);
const viewportWidth = ref(0);
const bubbleVisible = ref(true);
const petHidden = ref(false);
const isDragging = ref(false);
type PetMotion = "idle" | "focus" | "happy" | "celebrate" | "wave";
type PetVisualState = "idle" | "thinking" | "work" | "celebrate" | "sleep";
const petMotion = ref<PetMotion>("idle");
const currentHour = ref(new Date().getHours());
const chatBubblePosition = ref({ left: 12, top: 12, arrowX: 220, below: false });
const chatBubbleReady = ref(false);
let realtimeSocket: Socket | null = null;
let realtimeRefreshTimer: number | null = null;
let motionTimer: number | null = null;
let motionResetTimer: number | null = null;
let bubbleTimer: number | null = null;
let clockTimer: number | null = null;
let chatResizeObserver: ResizeObserver | null = null;
let chatPositionFrame: number | null = null;
let dragState: { pointerId: number; startX: number; startY: number; originX: number; originY: number } | null = null;
let suppressLauncherClick = false;
let isHoveringPet = false;
let lastActivitySignalAt = 0;

const POSITION_KEY = "xiaoy-agent-position-v1";
const BUBBLE_KEY = "xiaoy-agent-bubble-visible-v1";
const HIDDEN_KEY = "xiaoy-agent-hidden-v1";
const LAUNCHER_SIZE = 86;
const VIEWPORT_PADDING = 12;

function resolveSocketEndpoint() {
    if (import.meta.env.VITE_SOCKET_SERVER) return import.meta.env.VITE_SOCKET_SERVER;
    return import.meta.env.DEV ? "http://127.0.0.1:8002" : window.location.origin;
}

function signalAgentActivity() {
    if (!realtimeSocket?.connected || document.visibilityState !== "visible") return;
    const now = Date.now();
    if (now - lastActivitySignalAt < 12_000) return;
    lastActivitySignalAt = now;
    realtimeSocket.emit("presence:activity");
}

function connectTaskUpdates() {
    if (!props.authenticated || props.preview) return;
    realtimeSocket?.close();
    realtimeSocket = io(`${resolveSocketEndpoint()}/notify`, {
        path: "/socket.io",
        transports: ["websocket", "polling"],
        withCredentials: true,
    });
    realtimeSocket.on("connect", signalAgentActivity);
    realtimeSocket.on("agent:task", (payload: { taskId?: string }) => {
        if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
        realtimeRefreshTimer = window.setTimeout(async () => {
            await loadTasks().catch(() => undefined);
            if (activeTask.value?.id && (!payload?.taskId || payload.taskId === activeTask.value.id)) {
                await loadActiveTask().catch(() => undefined);
            }
        }, 120);
    });
    realtimeSocket.on("agent:proactive", (interaction: PetAgentInteraction) => {
        proactiveInteraction.value = interaction;
        bubbleVisible.value = true;
        petHidden.value = false;
        clearBubbleTimer();
        playPetMotion("happy", 1700);
        if (isOpen.value) markProactiveSeen();
    });
}

async function loadAgentProfile() {
    if (!props.authenticated || props.preview) return;
    const response = await petAgentService.getProfile(10);
    agentProfile.value = response.data.profile;
    agentSettings.value = { ...response.data.profile.settings };
    proactiveInteraction.value = response.data.interactions.find((item) => item.status === "unseen") || null;
    if (proactiveInteraction.value) {
        bubbleVisible.value = true;
        clearBubbleTimer();
    }
}

async function saveAgentSettings() {
    if (settingsSaving.value) return;
    if (props.preview) {
        settingsOpen.value = false;
        message.success("主动陪伴设置已保存（开发预览）");
        return;
    }
    settingsSaving.value = true;
    try {
        agentProfile.value = (await petAgentService.updateSettings(agentSettings.value)).data;
        agentSettings.value = { ...agentProfile.value.settings };
        settingsOpen.value = false;
        message.success(agentSettings.value.proactiveEnabled ? "小Y 会按新节奏陪伴你" : "已关闭主动陪伴");
    } finally {
        settingsSaving.value = false;
    }
}

async function markProactiveSeen() {
    const interaction = proactiveInteraction.value;
    if (!interaction || interaction.status !== "unseen" || props.preview) return;
    try {
        proactiveInteraction.value = (await petAgentService.setInteractionState(interaction.id, "seen")).data;
    } catch (_error) {
        return;
    }
}

async function feedbackProactive(feedback: "liked" | "disliked") {
    const interaction = proactiveInteraction.value;
    if (!interaction) return;
    if (props.preview) {
        proactiveInteraction.value = { ...interaction, feedback, status: "seen" };
        return;
    }
    proactiveInteraction.value = (await petAgentService.sendInteractionFeedback(interaction.id, feedback)).data;
    message.success(feedback === "liked" ? "收到，今后会多一点这种风格" : "收到，今后会减少类似内容");
}

async function dismissProactive() {
    const interaction = proactiveInteraction.value;
    proactiveInteraction.value = null;
    if (!interaction || props.preview) return;
    await petAgentService.sendInteractionFeedback(interaction.id, "dismissed").catch(() => undefined);
}

function useProactiveSuggestion() {
    const taskId = proactiveInteraction.value?.metadata?.taskId;
    if (typeof taskId === "string" && taskId) {
        selectTask(taskId);
        markProactiveSeen();
        return;
    }
    const suggestion = proactiveInteraction.value?.suggestion;
    if (!suggestion) return;
    startNewTask();
    messageText.value = suggestion;
    markProactiveSeen();
}

function handleUserActivity() {
    signalAgentActivity();
}

function handleVisibilityActivity() {
    if (document.visibilityState === "visible") signalAgentActivity();
}

const terminalStatuses: PetTaskStatus[] = ["completed", "failed", "cancelled"];
const terminalStatus = computed(() => Boolean(activeTask.value && terminalStatuses.includes(activeTask.value.status)));
const graphMessageBlocked = computed(() => activeTask.value?.context.execution?.engine === "langgraph" && activeTask.value.status !== "waiting_input");
const graphMessageHint = computed(() => terminalStatus.value ? "任务已结束，可新建任务继续" : activeTask.value?.status === "waiting_approval" ? "请先确认或拒绝当前操作" : activeTask.value?.status === "paused" ? "请先继续任务，等待需要补充信息时再发送" : "任务正在处理，需要补充信息时可继续输入");
const hasRunningTask = computed(() => tasks.value.some((task) => ["running", "queued", "waiting_approval"].includes(task.status)));
const currentTone = computed(() => statusTone(activeTask.value?.status || (hasRunningTask.value ? "running" : "completed")));
const currentStatusText = computed(() => statusLabel(activeTask.value?.status || (hasRunningTask.value ? "running" : "completed")));
const draft = computed(() => activeTask.value?.context?.artifacts?.draft || activeTask.value?.result?.artifacts?.draft || null);
const minimumSchedule = computed(() => {
    const date = new Date(Date.now() + 5 * 60 * 1000);
    const offset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - offset).toISOString().slice(0, 16);
});
const visibleEvents = computed(() => (activeTask.value?.events || []).filter((event) => !["message", "plan", "artifact"].includes(event.type)).slice(-8));
const normalizedPlan = computed(() => (activeTask.value?.context?.plan || []).map((step, index) => {
    if (typeof step === "string") return { id: `legacy_${index}`, title: step, status: "pending" as const, summary: "", error: "", retryAt: null };
    return step;
}));
const completedStepCount = computed(() => normalizedPlan.value.filter((step) => ["completed", "skipped"].includes(step.status)).length);
const launcherTask = computed(() => activeTask.value || tasks.value.find((task) => !terminalStatuses.includes(task.status)) || tasks.value[0] || null);
const isProcessing = computed(() => ["running", "queued"].includes(launcherTask.value?.status || ""));
const launcherPlan = computed(() => (launcherTask.value?.context?.plan || []).map((step, index) => {
    if (typeof step === "string") return { id: `legacy_${index}`, title: step, status: "pending" as const };
    return step;
}));
const launcherProgress = computed(() => {
    const total = launcherPlan.value.length;
    const completed = launcherPlan.value.filter((step) => ["completed", "skipped"].includes(step.status)).length;
    return { total, completed, percent: total ? Math.round((completed / total) * 100) : 0 };
});
const launcherTone = computed(() => statusTone(launcherTask.value?.status || "completed"));
const launcherStatus = computed(() => props.authenticated || props.preview ? statusLabel(launcherTask.value?.status || "completed") : "登录后开始工作");
const launcherTitle = computed(() => props.authenticated || props.preview ? (launcherTask.value?.title || "你好，我是小Y") : "你好，我是小Y");
const launcherHint = computed(() => {
    if (!props.authenticated && !props.preview) return "点我看看能为你完成哪些任务。";
    if (!launcherTask.value) return "点我打开聊天框，交给我一个任务吧。";
    if (launcherTask.value.status === "waiting_approval") return "任务需要你的确认，点我继续。";
    if (launcherTask.value.status === "waiting_input") return "我还需要一点信息，点我补充。";
    if (launcherTask.value.status === "failed") return launcherTask.value.lastError || "任务遇到问题，点我查看详情。";
    if (launcherTask.value.status === "completed") return launcherTask.value.result?.summary || "任务已完成，点我查看结果。";
    if (launcherTask.value.status === "scheduled" && launcherTask.value.scheduledAt) return `将在 ${formatSchedule(launcherTask.value.scheduledAt)} 自动开始。`;
    const runningStep = launcherPlan.value.find((step) => step.status === "running" || step.status === "waiting");
    return runningStep ? `正在处理：${runningStep.title}` : "我正在自主执行，完成后会告诉你。";
});
const isLateNight = computed(() => currentHour.value >= 23 || currentHour.value < 6);
const petVisualState = computed<PetVisualState>(() => {
    if (isDragging.value || ["happy", "celebrate"].includes(petMotion.value)) return "celebrate";
    if (petMotion.value === "focus" || isProcessing.value) return "thinking";
    if (isOpen.value) return "work";
    if (isLateNight.value && !hasRunningTask.value) return "sleep";
    return "idle";
});
const petImage = computed(() => ({
    idle: mascotIdle,
    thinking: petThinking,
    work: petWork,
    celebrate: petCelebrate,
    sleep: petSleep,
})[petVisualState.value]);
const launcherStyle = computed(() => launcherPosition.value
    ? { left: `${launcherPosition.value.x}px`, top: `${launcherPosition.value.y}px`, right: "auto", bottom: "auto" }
    : undefined);
const bubbleOpensRight = computed(() => Boolean(launcherPosition.value && launcherPosition.value.x < viewportWidth.value / 2));
const chatBubbleBelow = computed(() => chatBubblePosition.value.below);
const chatBubbleStyle = computed(() => ({
    left: `${chatBubblePosition.value.left}px`,
    top: `${chatBubblePosition.value.top}px`,
    "--pet-anchor-x": `${chatBubblePosition.value.arrowX}px`,
}));

function statusTone(status: PetTaskStatus | string) {
    if (["running", "queued"].includes(status)) return "running";
    if (["waiting_approval", "waiting_input", "paused", "scheduled"].includes(status)) return "waiting";
    if (["failed", "cancelled"].includes(status)) return "failed";
    return "completed";
}

function statusLabel(status: PetTaskStatus | string) {
    return ({ scheduled: "等待指定时间", queued: "准备开始", running: "正在执行", waiting_approval: "等待你的确认", waiting_input: "等待补充信息", paused: "任务已暂停", completed: "随时待命", failed: "任务遇到问题", cancelled: "任务已取消" } as Record<string, string>)[status] || "随时待命";
}

const metricsSuccessRate = computed(() => agentMetrics.value?.tasks.successRate == null ? "—" : `${Math.round(agentMetrics.value.tasks.successRate * 100)}%`);
const diagnosticStatusLabel = computed(() => {
    if (diagnosticsLoading.value) return "正在分析";
    if (!taskDiagnostics.value) return "模型、工具与预算";
    return taskDiagnostics.value.warnings.length ? `${taskDiagnostics.value.warnings.length} 项需关注` : "运行健康";
});

function formatCompactNumber(value: number) {
    return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 1 }).format(value || 0);
}

function budgetPercent(used: number, maximum: number) {
    if (!maximum) return "0%";
    return `${Math.min(100, Math.max(0, Math.round((used / maximum) * 100)))}%`;
}

function formatSchedule(value: string) {
    return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

async function loadAgentMetrics() {
    if (props.preview || !props.authenticated) return;
    agentMetrics.value = (await petAgentService.getMetrics()).data;
}

async function loadTaskDiagnostics(taskId = activeTask.value?.id) {
    if (!taskId || props.preview || !props.authenticated) return;
    diagnosticsLoading.value = true;
    try {
        taskDiagnostics.value = (await petAgentService.getTaskDiagnostics(taskId)).data;
    } finally {
        diagnosticsLoading.value = false;
    }
}

async function toggleDiagnostics() {
    diagnosticsOpen.value = !diagnosticsOpen.value;
    if (diagnosticsOpen.value && activeTask.value) {
        await loadTaskDiagnostics(activeTask.value.id).catch(() => {
            taskDiagnostics.value = null;
        });
    }
}

async function loadTasks(selectActive = false) {
    const response = await petAgentService.listTasks();
    tasks.value = response.data || [];
    if (selectActive && !activeTask.value && tasks.value.length) await selectTask(tasks.value[0].id);
}

async function loadActiveTask() {
    if (!activeTask.value) return;
    const response = await petAgentService.getTask(activeTask.value.id);
    activeTask.value = response.data;
    const index = tasks.value.findIndex((task) => task.id === response.data.id);
    if (index >= 0) tasks.value[index] = response.data;
    await nextTick();
    if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
    if (diagnosticsOpen.value) await loadTaskDiagnostics(response.data.id).catch(() => undefined);
}

async function selectTask(id: string) {
    const response = await petAgentService.getTask(id);
    activeTask.value = response.data;
    messageText.value = "";
    await nextTick();
    if (scrollArea.value) scrollArea.value.scrollTop = scrollArea.value.scrollHeight;
}

function openAttachmentPicker() {
    attachmentInput.value?.click();
}

function revokeAttachmentPreview(image: PendingAttachment) {
    if (image.previewUrl.startsWith("blob:")) URL.revokeObjectURL(image.previewUrl);
}

function clearAttachments() {
    pendingAttachments.value.forEach(revokeAttachmentPreview);
    pendingAttachments.value = [];
    if (attachmentInput.value) attachmentInput.value.value = "";
}

function removeAttachment(id: string) {
    const image = pendingAttachments.value.find((item) => item.id === id);
    if (image) revokeAttachmentPreview(image);
    pendingAttachments.value = pendingAttachments.value.filter((item) => item.id !== id);
}

function readFileAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
        reader.readAsDataURL(file);
    });
}

async function handleAttachmentSelection(event: Event) {
    const input = event.target as HTMLInputElement;
    const selected = Array.from(input.files || []);
    input.value = "";
    if (!selected.length) return;

    const availableSlots = 6 - pendingAttachments.value.length;
    if (availableSlots <= 0) {
        message.warning("一次任务最多添加 6 张图片");
        return;
    }
    if (selected.length > availableSlots) message.warning(`最多还能添加 ${availableSlots} 张图片`);

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    const files = selected.slice(0, availableSlots).filter((file) => {
        if (!allowedTypes.has(file.type)) {
            message.error(`${file.name} 不是支持的图片格式`);
            return false;
        }
        if (file.size > 5 * 1024 * 1024) {
            message.error(`${file.name} 超过 5MB`);
            return false;
        }
        return true;
    });
    if (!files.length) return;

    attachmentUploading.value = true;
    try {
        for (const file of files) {
            const previewUrl = props.preview ? await readFileAsDataUrl(file) : URL.createObjectURL(file);
            try {
                const url = props.preview ? previewUrl : (await uploadService.uploadImage(file, "common")).data?.url;
                if (!url) throw new Error("上传接口没有返回图片地址");
                pendingAttachments.value.push({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    name: file.name,
                    url,
                    previewUrl,
                });
            } catch (error) {
                if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
                message.error(`${file.name} 上传失败：${error instanceof Error ? error.message : "请稍后重试"}`);
            }
        }
    } finally {
        attachmentUploading.value = false;
    }
}

function startNewTask() {
    activeTask.value = null;
    messageText.value = "";
    scheduleEnabled.value = false;
    scheduledAt.value = "";
    clearAttachments();
}

function useExample() {
    messageText.value = "找到最近写 Vue 3 的作者，关注他，并参考他的文章写一篇博客，发布前让我确认。";
}

async function submitMessage() {
    const content = messageText.value.trim();
    if (!content || graphMessageBlocked.value || submitting.value || attachmentUploading.value) return;
    if (scheduleEnabled.value) {
        const scheduleTime = new Date(scheduledAt.value).getTime();
        if (!scheduledAt.value || !Number.isFinite(scheduleTime)) {
            message.warning("请先选择任务执行时间");
            return;
        }
        if (scheduleTime < Date.now() + 4 * 60 * 1000) {
            message.warning("执行时间至少需要晚于现在 5 分钟");
            return;
        }
    }
    submitting.value = true;
    try {
        const attachments = pendingAttachments.value.map((image) => ({ type: "image" as const, url: image.url, name: image.name }));
        if (props.preview) {
            const now = new Date().toISOString();
            const previewTask: PetTask = {
                id: "preview-task",
                userId: 1,
                title: content.slice(0, 34),
                goal: content,
                status: content.includes("发布") ? "waiting_approval" : "running",
                scheduledAt: scheduleEnabled.value && scheduledAt.value ? new Date(scheduledAt.value).toISOString() : null,
                timezone: "Asia/Shanghai",
                context: {
                    plan: ["搜索站内博客", "识别作者与资料", "关注作者", "撰写博客草稿", "确认后发布"],
                    attachments,
                    artifacts: { draft: { title: "Vue 3 实战：把复杂交互拆成可靠的响应式流程", summary: "从真实博客案例出发，整理 Vue 3 响应式设计与工程实践。", content: "# Vue 3 实战\n\n这是一份由小Y整理的开发预览草稿。\n\n## 从问题开始\n\n先明确状态边界，再拆分交互步骤。\n\n## 实践建议\n\n让每一步都可观察、可恢复，并为高影响操作保留人工确认。", poster: attachments[0]?.url || "", images: attachments } },
                },
                pendingAction: content.includes("发布") ? { type: "publish_blog", label: "发布文章《Vue 3 实战：把复杂交互拆成可靠的响应式流程》" } : null,
                result: null,
                createdAt: now,
                updatedAt: now,
                events: [
                    { id: 1, taskId: "preview-task", type: "message", title: "你交代了一个任务", content, status: "completed", createdAt: now },
                    { id: 2, taskId: "preview-task", type: "plan", title: "已制定执行计划", content: "搜索 → 识别作者 → 关注 → 撰写 → 确认发布", status: "completed", createdAt: now },
                    { id: 3, taskId: "preview-task", type: "tool", title: "搜索站内博客", content: "正在调用 search_blog", status: "running", createdAt: now },
                    { id: 4, taskId: "preview-task", type: "tool_result", title: "找到 6 篇与 Vue 3 相关的站内博客", content: "", status: "completed", createdAt: now },
                    { id: 5, taskId: "preview-task", type: "tool", title: "识别作者：林墨", content: "正在读取作者信息", status: "running", createdAt: now },
                    { id: 6, taskId: "preview-task", type: "tool_result", title: "已识别作者：林墨", content: "", status: "completed", createdAt: now },
                    { id: 7, taskId: "preview-task", type: "tool", title: "关注作者", content: "正在关注", status: "running", createdAt: now },
                    { id: 8, taskId: "preview-task", type: "tool_result", title: "已关注 林墨", content: "", status: "completed", createdAt: now },
                    { id: 9, taskId: "preview-task", type: "tool", title: "撰写博客草稿", content: "正在整理资料", status: "running", createdAt: now },
                    { id: 10, taskId: "preview-task", type: "tool_result", title: "博客草稿已完成", content: "", status: "completed", createdAt: now },
                    ...(content.includes("发布") ? [{ id: 11, taskId: "preview-task", type: "approval_required", title: "需要你的确认", content: "发布文章前需要你的确认", status: "waiting" as const, createdAt: now }] : []),
                ],
            };
            activeTask.value = previewTask;
            tasks.value = [previewTask];
            messageText.value = "";
            scheduleEnabled.value = false;
            scheduledAt.value = "";
            clearAttachments();
            playPetMotion("celebrate", 1500);
            message.success("开发预览任务已生成");
            return;
        }
        const response = activeTask.value
            ? await petAgentService.addMessage(activeTask.value.id, content, attachments)
            : await petAgentService.createTask({ message: content, attachments, scheduledAt: scheduleEnabled.value && scheduledAt.value ? new Date(scheduledAt.value).toISOString() : undefined, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Shanghai" });
        activeTask.value = response.data;
        messageText.value = "";
        scheduleEnabled.value = false;
        scheduledAt.value = "";
        clearAttachments();
        await loadTasks();
        playPetMotion("celebrate", 1500);
        message.success(response.data.status === "scheduled" ? "任务已安排，到时间后小Y会自动执行" : "任务已交给小Y");
    } finally {
        submitting.value = false;
    }
}

async function handleApproval(approved: boolean) {
    if (!activeTask.value) return;
    if (props.preview) {
        activeTask.value = {
            ...activeTask.value,
            status: approved ? "completed" : "cancelled",
            pendingAction: null,
            result: approved ? { summary: "文章已发布（开发预览）", artifacts: activeTask.value.context.artifacts } : { summary: "你拒绝了发布操作" },
        };
        tasks.value = [activeTask.value];
        message.success(approved ? "已批准并完成（开发预览）" : "已拒绝该操作");
        return;
    }
    activeTask.value = (await petAgentService.approve(activeTask.value.id, approved)).data;
    message.success(approved ? "已批准，小Y会继续执行" : "已拒绝该操作");
}

async function pauseTask() { if (activeTask.value) activeTask.value = props.preview ? { ...activeTask.value, status: "paused" } : (await petAgentService.pause(activeTask.value.id)).data; }
async function resumeTask() { if (activeTask.value) activeTask.value = props.preview ? { ...activeTask.value, status: "running" } : (await petAgentService.resume(activeTask.value.id)).data; }
async function cancelTask() { if (activeTask.value) activeTask.value = props.preview ? { ...activeTask.value, status: "cancelled", pendingAction: null } : (await petAgentService.cancel(activeTask.value.id)).data; }

function queueChatBubblePosition() {
    if (!isOpen.value) return;
    if (chatPositionFrame) window.cancelAnimationFrame(chatPositionFrame);
    chatPositionFrame = window.requestAnimationFrame(() => {
        chatPositionFrame = null;
        updateChatBubblePosition();
    });
}

function updateChatBubblePosition() {
    if (!isOpen.value || !launcherRef.value || !drawerRef.value) return;
    const petRect = launcherRef.value.getBoundingClientRect();
    const bubbleRect = drawerRef.value.getBoundingClientRect();
    const margin = window.innerWidth <= 620 ? 10 : 14;
    const gap = window.innerWidth <= 620 ? 10 : 14;
    const centerX = petRect.left + petRect.width / 2;
    const maxLeft = Math.max(margin, window.innerWidth - bubbleRect.width - margin);
    const left = Math.min(Math.max(centerX - bubbleRect.width / 2, margin), maxLeft);
    let top = petRect.top - bubbleRect.height - gap;
    let below = false;

    if (top < margin) {
        below = true;
        top = petRect.bottom + gap;
    }
    const maxTop = Math.max(margin, window.innerHeight - bubbleRect.height - margin);
    top = Math.min(Math.max(top, margin), maxTop);
    const arrowX = Math.min(Math.max(centerX - left, 30), Math.max(30, bubbleRect.width - 30));
    chatBubblePosition.value = { left, top, arrowX, below };
}

function observeChatBubble() {
    chatResizeObserver?.disconnect();
    if (!drawerRef.value || typeof ResizeObserver === "undefined") return;
    chatResizeObserver = new ResizeObserver(queueChatBubblePosition);
    chatResizeObserver.observe(drawerRef.value);
}

async function toggleDrawer() {
    if (isOpen.value) {
        await closeDrawer();
        return;
    }
    if (props.authenticated && !props.preview) {
        await loadTasks(true);
        loadAgentMetrics().catch(() => undefined);
    }
    chatBubbleReady.value = false;
    isOpen.value = true;
    await nextTick();
    updateChatBubblePosition();
    chatBubbleReady.value = true;
    observeChatBubble();
    drawerRef.value?.focus();
    markProactiveSeen();
}
async function closeDrawer() {
    isOpen.value = false;
    chatBubbleReady.value = false;
    chatResizeObserver?.disconnect();
    await nextTick();
    launcherButtonRef.value?.focus();
}
function goToLogin() { closeDrawer(); router.push({ name: "Login" }); }

function handleDrawerKeydown(event: KeyboardEvent) {
    if (!isOpen.value) return;
    if (event.key === "Escape") {
        event.preventDefault();
        closeDrawer();
    }
}

function clampPosition(x: number, y: number) {
    const width = launcherRef.value?.offsetWidth || LAUNCHER_SIZE;
    const height = launcherRef.value?.offsetHeight || LAUNCHER_SIZE;
    return {
        x: Math.min(Math.max(x, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, window.innerWidth - width - VIEWPORT_PADDING)),
        y: Math.min(Math.max(y, VIEWPORT_PADDING), Math.max(VIEWPORT_PADDING, window.innerHeight - height - VIEWPORT_PADDING)),
    };
}

function persistPosition() {
    if (launcherPosition.value) localStorage.setItem(POSITION_KEY, JSON.stringify(launcherPosition.value));
}

function startDrag(event: PointerEvent) {
    if (event.button !== 0 || !launcherRef.value) return;
    const rect = launcherRef.value.getBoundingClientRect();
    clearMotionTimers();
    petMotion.value = "happy";
    dragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top };
    if (event.currentTarget instanceof HTMLElement) event.currentTarget.setPointerCapture(event.pointerId);
}

function moveDrag(event: PointerEvent) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (!isDragging.value && Math.hypot(deltaX, deltaY) < 5) return;
    isDragging.value = true;
    suppressLauncherClick = true;
    launcherPosition.value = clampPosition(dragState.originX + deltaX, dragState.originY + deltaY);
    queueChatBubblePosition();
}

function endDrag(event: PointerEvent) {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    if (isDragging.value) persistPosition();
    if (event.currentTarget instanceof HTMLElement && event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragState = null;
    isDragging.value = false;
    playPetMotion("happy", 900);
    queueChatBubblePosition();
    schedulePetMotion();
}

async function handleLauncherClick() {
    if (suppressLauncherClick) {
        suppressLauncherClick = false;
        return;
    }
    await toggleDrawer();
    playPetMotion(isOpen.value ? "happy" : "wave", 760);
}

function clearMotionTimers() {
    if (motionTimer) window.clearTimeout(motionTimer);
    if (motionResetTimer) window.clearTimeout(motionResetTimer);
    motionTimer = null;
    motionResetTimer = null;
}

function playPetMotion(motion: PetMotion, duration = 1100) {
    if (isDragging.value && motion !== "happy") return;
    if (motionResetTimer) window.clearTimeout(motionResetTimer);
    petMotion.value = motion;
    motionResetTimer = window.setTimeout(() => {
        petMotion.value = isHoveringPet ? "wave" : "idle";
        motionResetTimer = null;
    }, duration);
}

function schedulePetMotion() {
    if (motionTimer) window.clearTimeout(motionTimer);
    const delay = 3200 + Math.round(Math.random() * 4200);
    motionTimer = window.setTimeout(() => {
        if (!isOpen.value && !petHidden.value && !isDragging.value && !isHoveringPet && !isProcessing.value && !isLateNight.value) {
            playPetMotion(Math.random() > .42 ? "focus" : "happy", 1500);
        }
        schedulePetMotion();
    }, delay);
}

function startHoverMotion() {
    isHoveringPet = true;
    playPetMotion("wave", 1600);
}

function endHoverMotion() {
    isHoveringPet = false;
    petMotion.value = "idle";
}

function hideBubble() {
    clearBubbleTimer();
    bubbleVisible.value = false;
    localStorage.setItem(BUBBLE_KEY, "false");
}

function showBubble() {
    bubbleVisible.value = true;
    localStorage.setItem(BUBBLE_KEY, "true");
    scheduleBubbleAutoHide();
}

function hidePet() {
    clearBubbleTimer();
    petHidden.value = true;
    isOpen.value = false;
    chatBubbleReady.value = false;
    chatResizeObserver?.disconnect();
    localStorage.setItem(HIDDEN_KEY, "true");
}

function showPet() {
    petHidden.value = false;
    bubbleVisible.value = true;
    localStorage.setItem(HIDDEN_KEY, "false");
    localStorage.setItem(BUBBLE_KEY, "true");
    scheduleBubbleAutoHide();
}

function clearBubbleTimer() {
    if (bubbleTimer) window.clearTimeout(bubbleTimer);
    bubbleTimer = null;
}

function scheduleBubbleAutoHide() {
    clearBubbleTimer();
    if (window.innerWidth > 620 || hasRunningTask.value || launcherTask.value) return;
    bubbleTimer = window.setTimeout(() => {
        if (!isOpen.value && !hasRunningTask.value) bubbleVisible.value = false;
        bubbleTimer = null;
    }, 6000);
}

function handleViewportResize() {
    viewportWidth.value = window.innerWidth;
    if (launcherPosition.value) {
        launcherPosition.value = clampPosition(launcherPosition.value.x, launcherPosition.value.y);
        persistPosition();
    }
    queueChatBubblePosition();
}

onMounted(() => {
    viewportWidth.value = window.innerWidth;
    currentHour.value = new Date().getHours();
    bubbleVisible.value = localStorage.getItem(BUBBLE_KEY) !== "false";
    petHidden.value = localStorage.getItem(HIDDEN_KEY) === "true";
    try {
        const storedPosition = localStorage.getItem(POSITION_KEY);
        if (storedPosition) {
            const parsed = JSON.parse(storedPosition);
            if (Number.isFinite(parsed?.x) && Number.isFinite(parsed?.y)) launcherPosition.value = clampPosition(parsed.x, parsed.y);
        }
    } catch {
        localStorage.removeItem(POSITION_KEY);
    }
    window.addEventListener("resize", handleViewportResize);
    window.addEventListener("keydown", handleDrawerKeydown);
    window.addEventListener("pointerdown", handleUserActivity, { passive: true });
    window.addEventListener("keydown", handleUserActivity, { passive: true });
    document.addEventListener("visibilitychange", handleVisibilityActivity);
    clockTimer = window.setInterval(() => { currentHour.value = new Date().getHours(); }, 60_000);
    schedulePetMotion();
    scheduleBubbleAutoHide();
    if (props.authenticated && !props.preview) {
        loadTasks().catch(() => undefined);
        loadAgentProfile().catch(() => undefined);
        connectTaskUpdates();
    }
});
const approvalHint = computed(() => {
    const type = activeTask.value?.pendingAction?.type;
    if (type === "send_direct_message") return "批准后会立即把这段内容发送给对方。";
    if (type === "send_friend_request") return "批准后对方会收到一条好友申请。";
    if (type === "accept_friend_request" || type === "reject_friend_request") return "批准后会更新这条好友申请的状态。";
    if (type === "follow_user") return "批准后会立即关注该用户。";
    return "批准后会立即执行，操作结果会记录在任务中。";
});
const approvalPayloadPreview = computed(() => {
    const action = activeTask.value?.pendingAction;
    if (action?.type === "send_direct_message") return String(action.payload?.content || "");
    if (action?.type === "send_friend_request") return String(action.payload?.message || "");
    return "";
});
onBeforeUnmount(() => {
    realtimeSocket?.close();
    if (realtimeRefreshTimer) window.clearTimeout(realtimeRefreshTimer);
    if (clockTimer) window.clearInterval(clockTimer);
    if (chatPositionFrame) window.cancelAnimationFrame(chatPositionFrame);
    chatResizeObserver?.disconnect();
    clearMotionTimers();
    clearBubbleTimer();
    clearAttachments();
    window.removeEventListener("resize", handleViewportResize);
    window.removeEventListener("keydown", handleDrawerKeydown);
    window.removeEventListener("pointerdown", handleUserActivity);
    window.removeEventListener("keydown", handleUserActivity);
    document.removeEventListener("visibilitychange", handleVisibilityActivity);
});

watch(
    () => launcherTask.value?.status,
    (status, previousStatus) => {
        if (!status || !previousStatus || status === previousStatus) return;
        if (["waiting_approval", "waiting_input", "completed", "failed"].includes(status)) {
            bubbleVisible.value = true;
            clearBubbleTimer();
        }
        if (status === "completed") playPetMotion("celebrate", 1900);
    }
);

watch(
    () => [launcherTask.value?.id || "", launcherTask.value?.context?.plan?.length || 0] as const,
    ([taskId, length], [previousTaskId, previousLength]) => {
        if (taskId && taskId === previousTaskId && length > previousLength) playPetMotion("celebrate", 1500);
        queueChatBubblePosition();
    }
);

watch(
    () => [launcherTask.value?.id || "", draft.value?.title || ""] as const,
    ([taskId, title], [previousTaskId, previousTitle]) => {
        if (taskId && taskId === previousTaskId && title && title !== previousTitle) playPetMotion("celebrate", 1900);
        queueChatBubblePosition();
    }
);

watch(
    () => activeTask.value?.id || "",
    (taskId, previousTaskId) => {
        if (taskId === previousTaskId) return;
        diagnosticsOpen.value = false;
        taskDiagnostics.value = null;
    }
);
</script>

<style lang="scss" scoped>
$navy: #0c294f;
$mint: #55ddb5;
$mint-dark: #159d7b;
$line: #dce4ed;
$muted: #728097;
$paper: #ffffff;
$coral: #ff766f;
$yellow: #ffbf2f;

button, textarea, input { font-family: var(--xy-font-body, "Microsoft YaHei", sans-serif); }
.pet-launcher, .pet-recall, .agent-bubble { font-family: var(--xy-font-body, "Microsoft YaHei", sans-serif); }
.pet-launcher { position: fixed; right: 26px; bottom: 24px; z-index: 1100; width: 96px; height: 96px; transition: opacity .2s ease; }
.pet-launcher__orb { position: relative; width: 100%; height: 100%; overflow: visible; border: 0; background: transparent; cursor: grab; padding: 0; filter: drop-shadow(0 10px 16px rgba(12, 41, 79, .16)); touch-action: none; user-select: none; transition: transform .22s ease, filter .22s ease; }
.pet-launcher__orb:hover { transform: translateY(-5px) rotate(-2deg); filter: drop-shadow(0 14px 20px rgba(12, 41, 79, .2)); }
.pet-launcher--dragging { transition: none; }
.pet-launcher--dragging .pet-launcher__orb { cursor: grabbing; transform: scale(1.06) rotate(2deg); filter: drop-shadow(0 18px 24px rgba(12, 41, 79, .24)); }
.pet-launcher__orb img { position: relative; z-index: 2; width: 100%; height: 100%; object-fit: contain; pointer-events: none; transform-origin: 50% 82%; will-change: transform; }
.pet-launcher__aura { position: absolute; z-index: 0; inset: 12px; border-radius: 50%; background: radial-gradient(circle, rgba(85,221,181,.2), rgba(81,185,223,.07) 48%, transparent 70%); opacity: .65; animation: pet-aura-breathe 3.8s ease-in-out infinite; }
.pet-launcher__shadow { position: absolute; z-index: 1; left: 22%; right: 22%; bottom: 6px; height: 10px; border-radius: 50%; background: rgba(12,41,79,.16); filter: blur(5px); animation: pet-shadow-breathe 3.8s ease-in-out infinite; }
.pet-launcher__spark { position: absolute; z-index: 4; width: 8px; height: 8px; opacity: 0; pointer-events: none; }
.pet-launcher__spark::before { content: "✦"; position: absolute; color: $mint; font-size: 12px; line-height: 1; text-shadow: 0 2px 8px rgba(85,221,181,.35); }
.pet-launcher__spark--one { left: 0; top: 18px; }
.pet-launcher__spark--two { right: 1px; top: 4px; transform: scale(.75); }
.pet-launcher__spark--three { right: -2px; bottom: 14px; transform: scale(.55); }
.pet-launcher--state-idle .pet-launcher__orb img { animation: pet-breathe 3.8s ease-in-out infinite; }
.pet-launcher--state-thinking .pet-launcher__orb img { animation: pet-think 1.8s ease-in-out infinite; }
.pet-launcher--state-work .pet-launcher__orb img { animation: pet-work 1.45s ease-in-out infinite; }
.pet-launcher--state-sleep .pet-launcher__orb img { animation: pet-sleep 4.8s ease-in-out infinite; }
.pet-launcher--state-celebrate .pet-launcher__orb img { animation: pet-happy .78s ease-in-out infinite; }
.pet-launcher--motion-focus .pet-launcher__orb img { animation: pet-focus 1.5s ease-in-out; }
.pet-launcher--motion-happy .pet-launcher__orb img { animation: pet-happy .78s ease-in-out 2; }
.pet-launcher--motion-celebrate .pet-launcher__orb img { animation: pet-celebrate 1.05s cubic-bezier(.2,.8,.2,1) 2; }
.pet-launcher--motion-wave .pet-launcher__orb img { animation: pet-wave .8s ease-in-out 2; }
.pet-launcher--motion-happy .pet-launcher__spark, .pet-launcher--motion-celebrate .pet-launcher__spark, .pet-launcher--motion-wave .pet-launcher__spark, .pet-launcher--busy .pet-launcher__spark { animation: pet-sparkle 1.05s ease-out; }
.pet-launcher--motion-happy .pet-launcher__spark--two, .pet-launcher--motion-celebrate .pet-launcher__spark--two, .pet-launcher--motion-wave .pet-launcher__spark--two, .pet-launcher--busy .pet-launcher__spark--two { animation-delay: .13s; }
.pet-launcher--motion-happy .pet-launcher__spark--three, .pet-launcher--motion-celebrate .pet-launcher__spark--three, .pet-launcher--motion-wave .pet-launcher__spark--three, .pet-launcher--busy .pet-launcher__spark--three { animation-delay: .28s; }
.pet-launcher--busy .pet-launcher__aura { animation: pet-work-aura 1.25s ease-in-out infinite; }
.pet-launcher--busy .pet-launcher__spark { animation-iteration-count: infinite; animation-duration: 1.8s; }
.pet-launcher--dragging .pet-launcher__orb img { animation: pet-drag-happy .48s ease-in-out infinite alternate; }
.pet-launcher--dragging .pet-launcher__shadow { transform: scaleX(.72); opacity: .5; }
.pet-launcher__status { position: absolute; top: 8px; right: 5px; width: 13px; height: 13px; border-radius: 50%; background: $mint; border: 3px solid white; box-shadow: 0 0 0 1px rgba(12,41,79,.08); animation: pet-pulse 1.6s infinite; }
.pet-launcher__bubble { position: absolute; right: 76px; top: -24px; width: 238px; color: $navy; background: rgba(255,255,255,.97); border: 1px solid rgba(12,41,79,.1); border-radius: 18px 18px 5px 18px; padding: 12px 13px 10px; box-shadow: 0 16px 40px rgba(12,41,79,.15); backdrop-filter: blur(12px); cursor: default; }
.pet-launcher--bubble-right .pet-launcher__bubble { right: auto; left: 76px; border-radius: 18px 18px 18px 5px; }
.pet-bubble__topline { display: flex; align-items: center; gap: 6px; color: $muted; font-size: 11px; line-height: 1; }
.pet-bubble__topline button { margin-left: auto; width: 22px; height: 22px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: #8995a7; font-size: 18px; line-height: 1; cursor: pointer; }
.pet-bubble__topline button:hover { color: $navy; background: #edf5f3; }
.pet-launcher__bubble > strong { display: block; margin-top: 7px; overflow: hidden; color: $navy; font-size: 13px; line-height: 1.45; text-overflow: ellipsis; white-space: nowrap; }
.pet-launcher__bubble > p { margin: 3px 0 0; color: $muted; font-size: 11px; line-height: 1.5; }
.pet-bubble__progress { margin-top: 9px; }
.pet-bubble__progress > div { display: flex; justify-content: space-between; color: #76859a; font-size: 10px; }
.pet-bubble__progress b { color: $mint-dark; font-size: 10px; }
.pet-bubble__progress > i { display: block; height: 5px; margin-top: 5px; overflow: hidden; border-radius: 99px; background: #e9f0f3; }
.pet-bubble__progress > i span { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, $mint, #51b9df); transition: width .35s ease; }
.pet-bubble__footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 9px; padding-top: 8px; border-top: 1px solid #edf1f5; color: #98a4b4; font-size: 9px; }
.pet-bubble__footer button { padding: 0; border: 0; background: transparent; color: $muted; font-size: 10px; cursor: pointer; }
.pet-bubble__footer button:hover { color: $coral; }
.pet-launcher__bubble-toggle { position: absolute; right: 0; top: 2px; width: 27px; height: 27px; display: grid; place-items: center; padding: 0; border: 2px solid white; border-radius: 50%; background: $navy; color: white; box-shadow: 0 5px 12px rgba(12,41,79,.2); cursor: pointer; }
.pet-launcher__bubble-toggle svg { width: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linejoin: round; }
.pet-recall { position: fixed; z-index: 1100; right: 0; bottom: 34px; height: 42px; display: flex; align-items: center; gap: 4px; padding: 3px 10px 3px 3px; border: 1px solid rgba(12,41,79,.1); border-right: 0; border-radius: 22px 0 0 22px; background: rgba(255,255,255,.95); color: $navy; box-shadow: 0 10px 30px rgba(12,41,79,.13); cursor: pointer; backdrop-filter: blur(10px); }
.pet-recall img { width: 34px; height: 34px; object-fit: contain; }
.pet-recall span { font-size: 11px; font-weight: 600; }
.pet-bubble-enter-active, .pet-bubble-leave-active, .pet-recall-enter-active, .pet-recall-leave-active { transition: opacity .2s ease, transform .2s ease; }
.pet-bubble-enter-from, .pet-bubble-leave-to { opacity: 0; transform: translateX(8px) scale(.96); }
.pet-launcher--bubble-right .pet-bubble-enter-from, .pet-launcher--bubble-right .pet-bubble-leave-to { transform: translateX(-8px) scale(.96); }
.pet-recall-enter-from, .pet-recall-leave-to { opacity: 0; transform: translateX(100%); }
.agent-bubble { position: fixed; z-index: 1090; width: min(430px, calc(100vw - 28px)); height: min(680px, calc(100dvh - 28px), 74dvh); display: flex; flex-direction: column; overflow: visible; visibility: hidden; background: $paper; color: $navy; border: 1.5px solid rgba(12,41,79,.82); border-radius: 24px 24px 22px 22px; box-shadow: 0 22px 58px rgba(12,41,79,.19), 0 3px 10px rgba(12,41,79,.08); transform-origin: var(--pet-anchor-x) calc(100% + 13px); }
.agent-bubble--ready { visibility: visible; }
.agent-bubble::after { content: ""; position: absolute; left: var(--pet-anchor-x); bottom: -10px; width: 18px; height: 18px; background: $paper; border-right: 1.5px solid rgba(12,41,79,.82); border-bottom: 1.5px solid rgba(12,41,79,.82); transform: translateX(-50%) rotate(45deg); }
.agent-bubble--below { transform-origin: var(--pet-anchor-x) -13px; }
.agent-bubble--below::after { top: -10px; bottom: auto; border: 0; border-top: 1.5px solid rgba(12,41,79,.82); border-left: 1.5px solid rgba(12,41,79,.82); }
.agent-header { position: relative; z-index: 1; min-height: 68px; padding: 11px 14px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid $line; border-radius: 23px 23px 0 0; background: $paper; }
.agent-header__identity { display: flex; align-items: center; gap: 11px; }
.agent-header__avatar { width: 46px; height: 46px; border-radius: 50%; background: #e8faf5; overflow: hidden; border: 1px solid #c5eee2; }
.agent-header__avatar img { width: 100%; height: 100%; object-fit: cover; transform: scale(1.35) translateY(3px); }
.agent-header h2 { margin: 0; font-family: var(--xy-font-display, "Microsoft YaHei", sans-serif); font-size: 20px; line-height: 1.25; letter-spacing: .02em; }
.agent-header p { margin: 4px 0 0; font-size: 12px; color: $muted; display: flex; align-items: center; gap: 6px; }
.status-dot, .task-rail__dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; }
.status-dot--running, .task-rail__dot--running { background: $mint; box-shadow: 0 0 0 3px rgba(85,221,181,.17); }
.status-dot--waiting, .task-rail__dot--waiting { background: $yellow; }
.status-dot--failed, .task-rail__dot--failed { background: $coral; }
.status-dot--completed, .task-rail__dot--completed { background: #9faabc; }
.agent-header__actions { display: flex; gap: 4px; }
.agent-header__actions button { width: 34px; height: 34px; display: grid; place-items: center; border: 0; border-radius: 9px; background: transparent; color: $navy; cursor: pointer; }
.agent-header__actions button:hover { background: #f0f8f6; }
.agent-header__actions button.active { color: $mint-dark; background: #e8faf5; }
.agent-header__actions svg { width: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; }
.agent-settings { position: relative; z-index: 1; flex: 0 0 auto; padding: 13px 16px 14px; border-bottom: 1px solid $line; background: linear-gradient(180deg, #f7fffc, #fff); box-shadow: 0 8px 18px rgba(12,41,79,.05); }
.agent-settings__head { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.agent-settings__head > div { display: flex; flex-direction: column; gap: 2px; }
.agent-settings__head strong { font-size: 13px; }
.agent-settings__head span { color: $muted; font-size: 10px; }
.agent-switch { position: relative; flex: 0 0 auto; width: 38px; height: 22px; cursor: pointer; }
.agent-switch input { position: absolute; opacity: 0; pointer-events: none; }
.agent-switch span { position: absolute; inset: 0; border-radius: 99px; background: #cfd8e3; transition: background .2s ease; }
.agent-switch span::after { content: ""; position: absolute; left: 3px; top: 3px; width: 16px; height: 16px; border-radius: 50%; background: white; box-shadow: 0 2px 5px rgba(12,41,79,.18); transition: transform .2s ease; }
.agent-switch input:checked + span { background: $mint; }
.agent-switch input:checked + span::after { transform: translateX(16px); }
.agent-settings__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 9px; margin-top: 12px; }
.agent-settings__grid label { display: flex; flex-direction: column; gap: 4px; color: $muted; font-size: 10px; }
.agent-settings__grid select, .agent-settings__grid input { width: 100%; height: 32px; padding: 0 8px; border: 1px solid $line; border-radius: 8px; background: white; color: $navy; font-size: 11px; outline: none; }
.agent-settings__grid select:focus, .agent-settings__grid input:focus { border-color: $mint; box-shadow: 0 0 0 3px rgba(85,221,181,.12); }
.agent-settings__foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 11px; }
.agent-settings__foot span { max-width: 275px; color: #8b98aa; font-size: 9px; line-height: 1.45; }
.agent-settings__foot button { flex: 0 0 auto; padding: 6px 12px; border: 0; border-radius: 8px; background: $navy; color: white; font-size: 11px; cursor: pointer; }
.agent-content--guest { display: grid; place-items: center; padding: 28px; }
.guest-gate { width: 100%; max-width: 330px; text-align: center; }
.guest-gate__art { width: 118px; height: 118px; margin: 0 auto 4px; }
.guest-gate__art img { width: 100%; height: 100%; object-fit: contain; }
.guest-gate > span { display: inline-flex; padding: 4px 9px; border-radius: 99px; background: #e8faf5; color: $mint-dark; font-size: 10px; font-weight: 700; letter-spacing: .08em; }
.guest-gate h3 { margin: 14px 0 8px; color: $navy; font-family: var(--xy-font-display, "Microsoft YaHei", sans-serif); font-size: 22px; }
.guest-gate p { margin: 0; color: $muted; font-size: 13px; line-height: 1.8; }
.guest-gate > button { width: 100%; margin-top: 22px; padding: 12px 16px; border: 0; border-radius: 12px; background: $navy; color: white; font-size: 13px; font-weight: 600; cursor: pointer; box-shadow: 0 10px 24px rgba(12,41,79,.16); }
.guest-gate > button:hover { background: #153b68; transform: translateY(-1px); }
.guest-gate small { display: block; margin-top: 11px; color: #98a4b4; font-size: 10px; line-height: 1.6; }
.task-rail { flex: 0 0 auto; display: flex; gap: 7px; overflow-x: auto; padding: 10px 16px; border-bottom: 1px solid #edf1f5; scrollbar-width: none; }
.task-rail::-webkit-scrollbar { display: none; }
.task-rail button { flex: 0 0 auto; max-width: 168px; display: flex; align-items: center; gap: 7px; padding: 7px 10px; color: $muted; background: white; border: 1px solid $line; border-radius: 8px; font-size: 12px; cursor: pointer; }
.task-rail button span:last-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-rail button.active { color: $navy; border-color: $mint; background: #f0fcf8; }
.agent-content { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 18px 30px; scroll-behavior: smooth; scrollbar-width: none; }
.agent-content::-webkit-scrollbar { display: none; width: 0; height: 0; }
.proactive-card { position: relative; display: grid; grid-template-columns: 52px 1fr; gap: 10px; margin-bottom: 16px; padding: 12px 36px 12px 10px; border: 1px solid #bfeee1; border-radius: 16px 16px 16px 5px; background: linear-gradient(135deg, #ecfcf7, #fffdf6); box-shadow: 0 8px 20px rgba(21,157,123,.08); animation: proactive-arrive .38s cubic-bezier(.2,.82,.22,1); }
.proactive-card__mascot { width: 52px; height: 58px; align-self: end; }
.proactive-card__mascot img { width: 100%; height: 100%; object-fit: contain; }
.proactive-card__body > div { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 3px 8px; }
.proactive-card__body strong { font-size: 12px; }
.proactive-card__body small { color: #91a0b2; font-size: 9px; }
.proactive-card__body p { margin: 7px 0 8px; color: $navy; font-size: 13px; line-height: 1.65; }
.proactive-card__body > button { max-width: 100%; padding: 6px 9px; overflow: hidden; border: 1px solid rgba(21,157,123,.25); border-radius: 8px; background: white; color: $mint-dark; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.proactive-card__feedback { position: absolute; right: 7px; top: 8px; display: flex; flex-direction: column; gap: 3px; }
.proactive-card__feedback button { width: 24px; height: 24px; padding: 0; border: 0; border-radius: 7px; background: transparent; color: $muted; font-size: 11px; cursor: pointer; filter: grayscale(1); opacity: .66; }
.proactive-card__feedback button:hover, .proactive-card__feedback button.active { background: rgba(85,221,181,.16); filter: none; opacity: 1; }
.agent-welcome { min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 26px; }
.agent-welcome__art { width: 142px; height: 122px; overflow: hidden; }
.agent-welcome__art img { width: 100%; height: 100%; object-fit: contain; }
.agent-welcome h3 { margin: 8px 0; font-family: var(--xy-font-display, inherit); font-size: 23px; }
.agent-welcome p { max-width: 320px; margin: 0; color: $muted; font-size: 14px; line-height: 1.8; }
.agent-welcome button { margin-top: 20px; padding: 9px 15px; color: $mint-dark; background: white; border: 1px dashed $mint; border-radius: 9px; cursor: pointer; font-size: 13px; }
.user-message { display: flex; justify-content: flex-end; align-items: flex-start; gap: 8px; }
.user-message > span { order: 2; flex: 0 0 auto; width: 28px; height: 28px; display: grid; place-items: center; border-radius: 50%; background: $navy; color: white; font-size: 11px; }
.user-message p { max-width: 330px; margin: 0; padding: 11px 13px; border-radius: 14px 4px 14px 14px; background: #eafaf6; color: $navy; font-size: 14px; line-height: 1.65; }
.message-images { display: flex; justify-content: flex-end; gap: 6px; margin-top: 7px; }
.message-images img { width: 74px; height: 58px; object-fit: cover; border: 1px solid $line; border-radius: 8px; }
.schedule-note { width: fit-content; margin: 9px 36px 0 auto; display: flex; align-items: center; gap: 6px; color: $muted; font-size: 12px; }
.schedule-note svg, .schedule-control svg { width: 15px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
.plan-block, .activity-block { margin-top: 24px; }
.section-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 13px; }
.section-title h3 { position: relative; margin: 0; font-size: 15px; }
.section-title h3::after { content: ""; position: absolute; left: 0; bottom: -5px; width: 52px; height: 3px; border-radius: 50%; background: $yellow; transform: rotate(-2deg); }
.section-title span { color: $muted; font-size: 12px; }
.plan-list { list-style: none; margin: 0; padding: 0; }
.plan-list li { position: relative; display: grid; grid-template-columns: 26px 1fr; gap: 9px; padding-bottom: 18px; }
.plan-list li:not(:last-child)::before { content: ""; position: absolute; left: 12px; top: 24px; bottom: 0; width: 1px; background: $line; }
.plan-list__marker { position: relative; z-index: 1; width: 25px; height: 25px; display: grid; place-items: center; border-radius: 50%; border: 1px solid $line; background: white; }
.plan-list__item--completed .plan-list__marker { background: $mint; border-color: $mint; color: $navy; }
.plan-list__item--running .plan-list__marker { border-color: $mint; background: #effcf8; }
.plan-list__item--waiting .plan-list__marker { border-color: $yellow; }
.plan-list__item--failed .plan-list__marker { border-color: $coral; background: #fff3f2; color: $coral; font-weight: 700; }
.plan-list__item--skipped { opacity: .56; }
.plan-list__marker svg { width: 15px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.plan-list strong, .activity-row strong { font-size: 13px; font-weight: 600; line-height: 1.5; }
.plan-list p, .activity-row p { margin: 3px 0 0; color: $muted; font-size: 12px; line-height: 1.55; }
.working-dots { display: flex; gap: 2px; }
.working-dots i { width: 3px; height: 3px; border-radius: 50%; background: $mint-dark; animation: dot-wave 1s infinite; }
.working-dots i:nth-child(2) { animation-delay: .14s; }.working-dots i:nth-child(3) { animation-delay: .28s; }
.scheduled-block { margin-top: 24px; display: flex; gap: 12px; padding: 15px; border: 1px dashed #a9dfd1; border-radius: 10px; background: #f7fdfa; }
.scheduled-block__clock { width: 37px; height: 37px; display: grid; place-items: center; border-radius: 50%; background: #dcf8ef; color: $mint-dark; }
.scheduled-block svg { width: 21px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; }
.scheduled-block strong { font-size: 14px; }.scheduled-block p { margin: 4px 0 0; color: $muted; font-size: 12px; }
.activity-row { display: grid; grid-template-columns: 13px 1fr; gap: 8px; margin-bottom: 13px; }
.activity-row > span { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: #aab5c5; }.activity-row--running > span { background: $mint; }.activity-row--failed > span { background: $coral; }.activity-row--waiting > span { background: $yellow; }
.artifact-card, .approval-card, .result-card, .error-card { margin-top: 18px; border-radius: 11px; }
.artifact-card { padding: 14px; border: 1px solid #cfe8e1; background: #fbfefd; }
.artifact-card__head { display: flex; justify-content: space-between; color: $mint-dark; font-size: 12px; }.artifact-card__head button { border: 0; background: transparent; color: $mint-dark; cursor: pointer; text-decoration: underline; }
.artifact-card h3 { margin: 9px 0 5px; font-size: 15px; }.artifact-card p { margin: 0; color: $muted; font-size: 12px; line-height: 1.6; }
.artifact-card small { display: block; margin-top: 7px; color: $mint-dark; font-size: 11px; }
.artifact-card__poster { width: 100%; max-height: 160px; margin-top: 10px; object-fit: cover; border-radius: 8px; }
.approval-card { display: grid; grid-template-columns: 38px 1fr; gap: 11px; padding: 14px; border: 1px solid #f1d987; background: #fffdf5; }
.approval-card__icon { width: 36px; height: 36px; display: grid; place-items: center; border-radius: 50%; color: #bd8200; background: #fff4c9; }.approval-card__icon svg { width: 21px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; }
.approval-card h3 { margin: 1px 0 4px; font-size: 14px; }.approval-card p { margin: 0; color: $muted; font-size: 12px; }.approval-card blockquote { max-height: 86px; margin: 8px 0 0; padding: 7px 9px; overflow: auto; border-left: 3px solid #e1bc52; border-radius: 4px; background: rgba(255, 255, 255, .72); color: $navy; font-size: 11px; line-height: 1.55; white-space: pre-wrap; word-break: break-word; }.approval-card small { display: block; margin-top: 5px; color: #9a7a26; font-size: 10px; line-height: 1.45; }
.approval-card__actions { grid-column: 1 / -1; display: grid; grid-template-columns: 1fr 1.25fr; gap: 8px; margin-top: 4px; }.approval-card__actions button { height: 36px; border-radius: 8px; font-size: 13px; cursor: pointer; }.approval-card__actions .secondary { border: 1px solid $line; background: white; color: $navy; }.approval-card__actions .primary { border: 1px solid $mint-dark; background: $mint; color: $navy; font-weight: 600; }
.result-card { display: flex; gap: 10px; padding: 14px; background: #edf9f5; }.result-card svg { flex: 0 0 auto; width: 24px; height: 24px; padding: 4px; border-radius: 50%; background: $mint; fill: none; stroke: $navy; stroke-width: 2; }.result-card strong, .error-card strong { font-size: 14px; }.result-card p, .error-card p { margin: 4px 0 0; color: $muted; font-size: 12px; line-height: 1.6; }
.error-card { padding: 13px; border: 1px solid #ffc5c1; background: #fff7f6; }
.agent-health { width: 100%; display: grid; grid-template-columns: repeat(3, 1fr); gap: 7px; margin-top: 13px; }.agent-health span { display: grid; gap: 2px; padding: 9px 6px; border: 1px solid $line; border-radius: 9px; background: rgba(255,255,255,.78); }.agent-health b { color: $navy; font-size: 15px; }.agent-health small { color: $muted; font-size: 9px; }
.agent-health__mode { display: block; margin-top: 7px; color: $muted; font-size: 9px; }
.diagnostic-card { padding: 0; border: 1px solid $line; background: #fbfdff; overflow: hidden; }.diagnostic-card__toggle { width: 100%; display: flex; align-items: center; justify-content: space-between; padding: 11px 12px; border: 0; background: transparent; color: $navy; cursor: pointer; text-align: left; }.diagnostic-card__toggle > span:first-child { display: grid; gap: 2px; }.diagnostic-card__toggle strong { font-size: 13px; }.diagnostic-card__toggle small { color: $muted; font-size: 10px; }.diagnostic-card__toggle > span:last-child { color: $mint-dark; font-size: 11px; }
.diagnostic-card__body { padding: 0 12px 12px; border-top: 1px solid #edf1f5; }.diagnostic-card__loading { margin: 11px 0 0; color: $muted; font-size: 11px; }.diagnostic-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 11px 0; }.diagnostic-grid span { display: grid; gap: 3px; padding: 7px 4px; border-radius: 7px; background: white; text-align: center; }.diagnostic-grid small { color: $muted; font-size: 9px; }.diagnostic-grid b { color: $navy; font-size: 13px; }
.budget-row { display: flex; justify-content: space-between; margin-top: 8px; color: $muted; font-size: 10px; }.budget-row b { color: $navy; font-weight: 500; }.budget-track { height: 4px; margin-top: 4px; border-radius: 999px; background: #e9eef3; overflow: hidden; }.budget-track i { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, $mint, $mint-dark); }.diagnostic-warnings { display: grid; gap: 5px; margin-top: 10px; }.diagnostic-warnings p { margin: 0; padding: 6px 8px; border-radius: 6px; color: #9a6218; background: #fff8e8; font-size: 10px; line-height: 1.45; }.diagnostic-ok { margin: 10px 0 0; color: $mint-dark; font-size: 10px; }
.diagnostic-trace { margin: -3px 0 9px; color: #8a98aa; font: 9px/1.4 ui-monospace, SFMono-Regular, Consolas, monospace; }
.agent-composer { position: relative; z-index: 1; flex: 0 0 auto; padding: 11px 15px 14px; border-top: 1px solid $line; border-radius: 0 0 21px 21px; background: white; }
.schedule-control { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }.schedule-control button { display: flex; align-items: center; gap: 5px; height: 30px; padding: 0 9px; border: 1px solid $line; border-radius: 7px; background: white; color: $muted; font-size: 12px; cursor: pointer; }.schedule-control button.active { color: $mint-dark; border-color: $mint; background: #f0fcf8; }.schedule-control input { min-width: 0; flex: 1; height: 30px; padding: 0 8px; color: $navy; border: 1px solid $line; border-radius: 7px; font-size: 12px; }
.attachment-control { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.attachment-control button { flex: 0 0 auto; display: flex; align-items: center; gap: 5px; height: 30px; padding: 0 9px; border: 1px solid $line; border-radius: 7px; background: white; color: $muted; font-size: 12px; cursor: pointer; }
.attachment-control button.active { color: $mint-dark; border-color: $mint; background: #f0fcf8; }
.attachment-control button:disabled { opacity: .55; cursor: wait; }
.attachment-control svg { width: 15px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.attachment-control .attachment-input { display: none; }
.attachment-control > span { min-width: 0; overflow: hidden; color: #98a4b4; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.attachment-previews { display: flex; gap: 7px; padding: 0 0 8px; overflow-x: auto; scrollbar-width: none; }
.attachment-previews::-webkit-scrollbar { display: none; }
.attachment-previews figure { position: relative; flex: 0 0 48px; width: 48px; height: 48px; margin: 0; border: 1px solid $line; border-radius: 9px; background: #f7fafc; overflow: hidden; }
.attachment-previews img { width: 100%; height: 100%; object-fit: cover; }
.attachment-previews button { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 50%; color: white; background: rgba(10, 39, 72, .78); font: 14px/18px sans-serif; cursor: pointer; }
.composer-box { display: flex; align-items: flex-end; gap: 8px; padding: 9px 9px 9px 12px; border: 1px solid #cbd7e2; border-radius: 11px; background: white; transition: border-color .2s, box-shadow .2s; }.composer-box:focus-within { border-color: $mint; box-shadow: 0 0 0 3px rgba(85,221,181,.13); }
.composer-box textarea { flex: 1; min-height: 42px; max-height: 110px; resize: none; border: 0; outline: none; color: $navy; font-size: 13px; line-height: 1.55; }.composer-box textarea::placeholder { color: #9aa6b8; }
.send-button { flex: 0 0 auto; width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid $mint-dark; border-radius: 9px; background: $mint; color: $navy; cursor: pointer; }.send-button:disabled { opacity: .45; cursor: default; }.send-button svg { width: 20px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linejoin: round; }
.composer-hint { margin: 7px 0 0; text-align: center; color: #98a4b4; font-size: 10px; }
.task-controls { display: flex; align-items: center; gap: 9px; margin-top: 7px; font-size: 10px; color: #98a4b4; }.task-controls span { flex: 1; text-align: center; }.task-controls button { border: 0; background: transparent; color: $muted; cursor: pointer; font-size: 11px; }.task-controls .danger { color: $coral; }
.draft-preview h1 { color: $navy; font-size: 25px; }.draft-preview__summary { color: $muted; line-height: 1.7; }.draft-preview pre { white-space: pre-wrap; word-break: break-word; color: #233c5e; font-family: var(--xy-font-body, sans-serif); font-size: 14px; line-height: 1.8; }
.draft-preview__poster { width: 100%; max-height: 340px; margin: 12px 0; object-fit: cover; border-radius: 10px; }
.agent-bubble-enter-active, .agent-bubble-leave-active { transition: transform .24s cubic-bezier(.2,.82,.22,1), opacity .18s ease; }
.agent-bubble-enter-from, .agent-bubble-leave-to { opacity: 0; transform: translateY(12px) scale(.9); }
.agent-bubble--below.agent-bubble-enter-from, .agent-bubble--below.agent-bubble-leave-to { transform: translateY(-12px) scale(.9); }
@keyframes pet-pulse { 50% { box-shadow: 0 0 0 7px rgba(85,221,181,0); } }
@keyframes pet-breathe { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-4px) scale(1.018); } }
@keyframes pet-aura-breathe { 0%, 100% { opacity: .36; transform: scale(.88); } 50% { opacity: .78; transform: scale(1.08); } }
@keyframes pet-shadow-breathe { 0%, 100% { opacity: .65; transform: scaleX(1); } 50% { opacity: .38; transform: scaleX(.82); } }
@keyframes pet-wave { 0%, 100% { transform: rotate(0) translateY(0); } 25% { transform: rotate(-8deg) translateY(-5px); } 50% { transform: rotate(6deg) translateY(-7px) scale(1.025); } 75% { transform: rotate(-4deg) translateY(-3px); } }
@keyframes pet-focus { 0%, 100% { transform: rotate(0) translateY(0); } 30%, 72% { transform: rotate(7deg) translateY(-4px) scale(1.025); } 52% { transform: rotate(10deg) translateY(-7px) scale(1.035); } }
@keyframes pet-think { 0%, 100% { transform: rotate(-3deg) translateY(0); } 50% { transform: rotate(6deg) translateY(-5px) scale(1.02); } }
@keyframes pet-work { 0%, 100% { transform: translate(0,0) rotate(-2deg); } 35% { transform: translate(3px,-7px) rotate(4deg); } 70% { transform: translate(-2px,-4px) rotate(-4deg); } }
@keyframes pet-happy { 0%, 100% { transform: rotate(-5deg) translateY(0) scale(1); } 50% { transform: rotate(6deg) translateY(-7px) scale(1.045); } }
@keyframes pet-celebrate { 0%, 100% { transform: translateY(0) scale(1); } 16% { transform: translateY(3px) scale(1.08,.92); } 48% { transform: translateY(-22px) rotate(-5deg) scale(.96,1.07); } 72% { transform: translateY(-7px) rotate(4deg); } 88% { transform: translateY(1px) scale(1.06,.94); } }
@keyframes pet-sleep { 0%, 100% { transform: translateY(1px) rotate(-1deg) scale(1); } 50% { transform: translateY(-2px) rotate(1deg) scale(1.012); } }
@keyframes pet-work-aura { 0%, 100% { opacity: .42; transform: scale(.88); } 50% { opacity: .9; transform: scale(1.14); } }
@keyframes pet-drag-happy { from { transform: translateY(0) rotate(-7deg) scale(1.03); } to { transform: translateY(-5px) rotate(7deg) scale(1.08); } }
@keyframes pet-sparkle { 0% { opacity: 0; transform: translateY(5px) scale(.3) rotate(0); } 35% { opacity: 1; } 100% { opacity: 0; transform: translateY(-15px) scale(1.25) rotate(55deg); } }
@keyframes dot-wave { 0%, 60%, 100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-3px); opacity: 1; } }
@keyframes proactive-arrive { from { opacity: 0; transform: translateY(9px) scale(.97); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; } }
@media (max-width: 620px) {
    .agent-bubble { width: calc(100vw - 20px); height: min(620px, calc(100dvh - 20px), 68dvh); border-radius: 21px; }
    .agent-bubble::after { width: 16px; height: 16px; bottom: -9px; }
    .agent-bubble--below::after { top: -9px; bottom: auto; }
    .pet-launcher { right: 12px; bottom: 14px; width: 78px; height: 78px; }
    .agent-header { min-height: 62px; padding: 9px 12px; border-radius: 20px 20px 0 0; }
    .agent-header__avatar { width: 40px; height: 40px; }
    .agent-header h2 { font-size: 18px; }
    .agent-settings { padding: 11px 12px 12px; }
    .agent-settings__grid { gap: 7px; }
    .agent-settings__foot span { max-width: 220px; }
    .agent-content { padding: 13px 13px 20px; }
    .proactive-card { grid-template-columns: 43px 1fr; padding-left: 8px; }
    .proactive-card__mascot { width: 43px; height: 50px; }
    .agent-composer { padding: 9px 11px max(10px, env(safe-area-inset-bottom)); border-radius: 0 0 19px 19px; }
    .attachment-control > span, .composer-hint { display: none; }
    .task-rail { padding: 8px 11px; }
    .task-rail button { max-width: 145px; padding: 6px 9px; }
    .pet-launcher__bubble { top: -76px; right: 2px; width: min(238px, calc(100vw - 28px)); border-radius: 18px 18px 5px 18px; }
    .pet-launcher--bubble-right .pet-launcher__bubble { right: auto; left: 2px; border-radius: 18px 18px 18px 5px; }
    .pet-bubble__footer > span { display: none; }
}
</style>
