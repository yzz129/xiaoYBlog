# 小Y博客面试项目
<img width="2547" height="1915" alt="image" src="https://github.com/user-attachments/assets/bcb5f3c0-be90-4670-a36d-20d09a5a0dd7" />
<img width="2733" height="1911" alt="image" src="https://github.com/user-attachments/assets/a3ee99c5-5cd3-4082-bcdd-31b2e2f5b1f8" />
<img width="2735" height="1911" alt="image" src="https://github.com/user-attachments/assets/087a1813-1f1c-4ba8-ac44-79b138627d09" />
<img width="2724" height="1920" alt="image" src="https://github.com/user-attachments/assets/59609ed1-90c4-4c41-ac35-f39cccdd414a" />

这是一个可直接用于前端面试展示的全栈博客项目，包含：

- 前台博客：文章、搜索、用户主页、关注、粉丝、私聊、聊天室
- 后台管理：文章管理、个人资料、封面/头像上传、AI 辅助写作
- 后端服务：Express + MySQL + Redis + Socket.IO + MinIO

## 仓库结构

- [fullstack-blog]
  前端项目，基于 `Vue 3 + TypeScript + Vite + Pinia + Vue Router`
- [express-blog-backend-main]
  后端项目，基于 `Express + MySQL + Redis + Socket.IO + MinIO`

## 当前亮点

- 用户体系完整：注册、登录、资料编辑、头像上传、公开主页
- 社交功能完整：关注/取关、粉丝与关注列表、用户详情页、私聊、聊天室
- AI 写作链路完整：异步启动、流式大纲、流式章节、参考文件解析、Redis 会话持久化
- 文件存储完整：头像和文章封面接入 MinIO
- 工程能力可讲：`<script setup lang="ts">` 迁移、按需拆包、依赖分包、环境变量统一

## 本地启动

1. 启动后端

```bash
cd express-blog-backend-main
npm install
npm start
```

2. 启动前端

```bash
cd fullstack-blog
npm install
npm run dev
```

默认地址：

- 前端：`http://127.0.0.1:8080`
- 后端：`http://127.0.0.1:8002`

## 环境依赖

- Node.js `>= 20`
- MySQL `8.x`
- Redis `6.x / 7.x`
- MinIO

后端使用 [express-blog-backend-main/.env]加载环境变量。

## 演示账号与数据

后端已提供一键演示数据脚本：

```bash
cd express-blog-backend-main
npm run seed:demo
```

会自动创建 10 个演示账号，密码统一为：

```text
123456
```

账号示例：

- `test_user_01`
- `test_user_02`
- `test_user_03`

脚本会同时补充：

- 用户资料
- 关注关系
- 私聊演示数据

## 验收流程

建议按这个顺序演示：

1. 前台首页与搜索
2. 用户主页、关注与粉丝列表
3. 聊天室与私聊实时通知
4. 后台发文、封面上传、个人资料编辑
5. AI 写作工作流与参考文件解析
6. 后端最小回归脚本：
   - `npm run test:comment-reply`
   - `npm run test:user`

## 文档

- 前端说明：[fullstack-blog/README.md]
- 后端说明：[express-blog-backend-main/README.md]
