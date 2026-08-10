# 小Y博客后端

后端项目基于 `Express + MySQL + Redis + Socket.IO + MinIO`，为博客前台、后台管理、实时聊天和 AI 写作提供接口能力。

## 技术栈

- Express
- MySQL / mysql2
- Redis
- Socket.IO
- MinIO
- JWT
- LangChain / DeepSeek / Tavily

## 启动

先准备环境变量：

- 复制 `.env.example` 为 `.env`
- 按本地环境填写 MySQL、Redis、MinIO、JWT、AI 配置

然后启动：

```bash
npm install
npm start
```

默认服务地址：

```text
http://127.0.0.1:8002
```

## 演示数据

一键生成演示账号、关注关系和私聊数据：

```bash
npm run seed:demo
```

默认测试账号：

- `test_user_01 / 123456`
- `test_user_02 / 123456`
- `test_user_03 / 123456`

## 测试脚本

当前已提供最小回归脚本：

```bash
npm run test:comment-reply
```

覆盖范围：

- 评论分页接口可返回新增评论
- 已审核回复会出现在评论回复列表中
- 未审核回复不会混入公开评论回复列表
- 未审核回复会出现在审核分页接口中

## 可演示验收流程

建议按下面顺序验收：

1. 启动后端服务：`npm start`
2. 生成演示数据：`npm run seed:demo`
3. 运行最小回归：`npm run test:comment-reply`
4. 启动前端后联调以下链路：
   - 登录与当前用户资料
   - 用户主页、关注、粉丝
   - 私聊与聊天室实时消息
   - 发布文章、上传头像/封面
   - AI 写作与参考文件解析

## 主要能力

- 登录 / 注册 / 当前用户信息
- 用户公开主页
- 关注 / 粉丝 / 私聊
- 聊天室在线状态与实时消息
- 文章发布、更新、搜索、作者文章查询
- MinIO 图片上传
- AI 多步写作工作流

## 面试可讲点

- 环境配置统一走 `process.env`
- 实时聊天从 socket 级在线状态改造成 user 级在线状态
- 私聊未读提醒从轮询升级为实时推送
- AI 写作支持流式大纲、流式章节、Redis 会话恢复
- MinIO 用于头像和封面存储
## 小Y Agent 宠物助手

登录后，所有页面右下角都会出现小Y宠物。点击后可以用自然语言创建长任务，也可以指定执行时间。任务由后端持续执行，关闭抽屉或刷新页面不会丢失进度。

当前内置工具包括：

- 搜索、读取站内博客，识别文章作者
- 搜索和关注站内用户
- 通过 Tavily 搜索公开网页
- 根据收集资料撰写原创 Markdown 草稿
- 发布草稿或覆盖更新已有文章

Agent 不是固定工作流。运行时会反复读取任务目标和真实工具结果，由模型选择下一步工具；没有模型密钥时会启用一个只覆盖常见站内搜索、关注、写作和发布任务的有限本地降级策略。

### 配置

在后端环境文件中至少配置一个模型提供方：

```env
# 推荐：OpenAI Responses API
OPENAI_API_KEY=
OPENAI_AGENT_MODEL=gpt-5-mini

# 或使用现有的 DeepSeek OpenAI-compatible 接口
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
DEEPSEEK_MODEL=deepseek-chat

# 只有公开网页搜索需要
TAVILY_API_KEY=
```

MySQL 启动后，服务会自动创建 `agent_task` 与 `agent_task_event` 两张表。生产数据库账号需要拥有首次建表权限；也可以先启动一次服务完成建表，再收紧权限。

### 状态与安全边界

任务状态包含 `scheduled`、`queued`、`running`、`waiting_input`、`waiting_approval`、`paused`、`completed`、`failed` 和 `cancelled`。调度器每 5 秒领取到期任务；运行中任务的计划、观察结果、草稿和事件时间线都会持久化。

搜索、读取和关注会直接执行并写入审计事件。发布文章和覆盖更新属于高影响动作，运行时会强制停在 `waiting_approval`，只有当前任务所有者批准后才会执行。审批动作会先被原子认领，避免重复点击导致重复发布。

主要接口位于 `/pet-agent`：

- `POST /tasks`：创建立即或定时任务
- `GET /tasks`、`GET /tasks/:id`：任务列表与事件详情
- `POST /tasks/:id/messages`：补充要求并继续规划
- `POST /tasks/:id/approval`：批准或拒绝待确认动作
- `POST /tasks/:id/pause|resume|cancel`：控制长任务

前端开发环境可使用 `/login?agentPreview=1` 查看隔离的 UI 预览状态。该入口只在 Vite 开发模式生效，不会绕过生产鉴权，也不会调用真实 Agent API。
