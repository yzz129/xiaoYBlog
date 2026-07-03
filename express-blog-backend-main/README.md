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
