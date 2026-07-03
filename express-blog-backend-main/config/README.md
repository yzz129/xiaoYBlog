# 配置说明

后端配置已经统一改为环境变量方案。

- Node 代码只从 `process.env` 读取配置
- 本地开发通过项目根目录下的 `.env` / `.env.local` / `.env.development` 注入
- Docker 运行通过 `compose.yaml` 注入

加载顺序如下，后面的会覆盖前面的同名变量：

1. `.env`
2. `.env.{NODE_ENV}`
3. `.env.local`
4. `.env.{NODE_ENV}.local`

建议做法：

- 本地开发：复制 `.env.example` 为 `.env`
- 生产部署：通过容器、PM2 或系统环境变量注入
