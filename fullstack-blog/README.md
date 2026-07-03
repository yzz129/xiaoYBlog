# 小Y博客前端

前端项目基于 `Vue 3 + TypeScript + Vite`，面向博客站点与后台管理场景，包含：

- 首页文章流
- 站内搜索
- 用户主页 / 我的主页
- 关注与粉丝列表
- 在线聊天室与私聊
- 后台文章管理
- AI 写作工作流

## 技术栈

- Vue 3
- TypeScript
- Vite
- Pinia
- Vue Router
- Ant Design Vue
- Element Plus
- Socket.IO Client

## 启动

```bash
npm install
npm run dev
```

## 打包

```bash
npm run build
```

## 主要页面

- `/` 首页
- `/search` 搜索结果页
- `/article/:id` 文章详情页
- `/user/:id` 用户详情页
- `/me` 我的主页
- `/chat` 聊天室 / 私聊
- `/backend` 后台

## 工程亮点

- 全站 Vue 文件统一迁移到 `<script setup lang="ts">`
- 请求层统一鉴权与错误处理
- 搜索结果页支持切换与无限加载
- 聊天相关支持实时推送与未读提醒
- AI 写作重依赖按需加载，降低常规路由首包

## 已知说明

- AI 写作页仍依赖较大的 `pdfjs` / `mammoth` 相关包，但已做按需加载
- 后台仍存在部分历史控制器与接口层编码遗留，前端主要链路可正常演示
