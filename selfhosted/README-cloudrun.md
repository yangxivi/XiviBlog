# 曦微博客 — 微信云托管部署指南

本指南说明如何将自托管版曦微博客部署到**微信云托管**（腾讯云 Cloud Run 风格）。

## 架构概述

| 组件 | 说明 |
|------|------|
| 运行时 | Node.js 22 + Next.js 16 standalone 输出 |
| 数据库 | 本地 SQLite（默认）或 Turso 远程（可选） |
| 镜像 | 多阶段 Docker 构建，最终镜像 ~350MB |
| 入口 | `node server.js`（监听 3000 端口） |

## 前置要求

- [ ] 已创建微信云托管环境
- [ ] 有 Docker 或本地构建能力（可选，平台支持直接构建）
- [ ] 可选：注册 [Turso](https://turso.io) 免费账号（远程数据库）

## 方式一：本地 SQLite（推荐入门）

### 1. 准备 `.env` 文件

```bash
# 复制 .env.example 为 .env
cp .env.example .env

# 编辑 .env
SESSION_SECRET=your-random-secret-here
ADMIN_PASSWORD=your-master-key
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/xiviblog.db
```

### 2. 构建 Docker 镜像

```bash
# 在 selfhosted/ 目录下
docker build -t xiviblog-selfhosted .
```

### 3. 推送到镜像仓库

微信云托管支持从**腾讯云镜像仓库（TCR）**或**GitHub** 拉取镜像：

```bash
# 方式 A：推送到 TCR
docker tag xiviblog-selfhosted ccr.ccs.qq.com/<your-namespace>/xiviblog-selfhosted
docker push ccr.ccs.qq.com/<your-namespace>/xiviblog-selfhosted

# 方式 B：推送到 GitHub Container Registry
docker tag xiviblog-selfhosted ghcr.io/yangxivi/xiviblog-selfhosted
docker push ghcr.io/yangxivi/xiviblog-selfhosted
```

### 4. 在微信云托管控制台创建服务

1. 登录 [微信云托管](https://console.cloud.tencent.com/tcb)
2. 选择「应用」→「创建应用」
3. 模板选 **Express.js**（或 **Node.js**）
4. 填写镜像地址和访问端口（**3000**）
5. 环境变量：
   ```
   SESSION_SECRET=your-random-secret-here
   ADMIN_PASSWORD=your-master-key
   DATABASE_TYPE=sqlite
   ```
6. 持久化存储：挂载 `/app/data` 到云盘（SQLite 文件必须持久化）
7. 创建并部署

### 5. 首次访问

- 访问 `https://<your-app>.tcloudbaseapp.com/install`
- 按向导完成安装（创建管理员、种子数据）

## 方式二：Turso 远程数据库（无状态部署）

适合需要**多实例自动扩缩容**或**备份无忧**的场景。

### 1. 创建 Turso 数据库

```bash
# 安装 Turso CLI（可选，也可用 Web 控制台）
npm install -g @turso/cli

# 登录
turso auth login

# 创建数据库
turso db create xiviblog

# 创建 Token（长期有效，用于 .env）
turso db token create xiviblog
```

记录：
- `TURSO_DATABASE_URL`：`https://xiviblog.<region>.turso.io`
- `TURSO_AUTH_TOKEN`：`<your-token>`

### 2. 建表（一次性）

```bash
# 创建 Turso 数据库后，需手动执行建表语句
# 或者：先用本地 SQLite 跑完安装向导，导出 schema.sql，在 Turso 中执行
turso db shell xiviblog
sqlite> -- 粘贴 0001_init.sql ~ 0016_comments.sql 的内容
```

### 3. 准备 `.env`

```bash
DATABASE_TYPE=turso
TURSO_DATABASE_URL=https://xiviblog.<region>.turso.io
TURSO_AUTH_TOKEN=<your-token>
```

### 4. 部署（同方式一的步骤 3~5）

与方式一的区别：
- 无需持久化存储（数据库在云端）
- 可启用**多实例**（水平扩缩容）
- 启动时自动迁移表（如果 schema 不完整）

## 环境变量说明

| 变量 | 必填 | 说明 |
|------|------|------|
| `SESSION_SECRET` | 是 | 会话签名密钥，建议 `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | 是 | 后台注册邀请码 / 主密钥 |
| `DATABASE_TYPE` | 否 | `sqlite`（默认）或 `turso` |
| `DATABASE_PATH` | sqlite | SQLite 文件路径（相对容器工作目录） |
| `TURSO_DATABASE_URL` | turso | Turso 数据库 URL |
| `TURSO_AUTH_TOKEN` | turso | Turso 认证 Token |
| `SITE_URL` | 否 | 站点对外地址（用于 sitemap/RSS） |
| `PORT` | 否 | 监听端口，默认 3000 |

## 持久化存储（SQLite 模式必须）

微信云托管容器重启后数据会丢失，**必须**挂载云盘到 `/app/data`：

1. 控制台 → 应用 → 存储 → 创建云盘（≥5GB）
2. 创建服务时 → 存储 → 挂载云盘
   - 容器路径：`/app/data`
   - 云盘名：`xivi-blog-data`

## 健康检查

```yaml
healthCheck:
  httpGet:
    path: /
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30
```

## 常见问题

### Q: 启动报错 `Cannot find package "better-sqlite3"`
A: 确认 `next.config.ts` 中 `serverExternalPackages` 包含 `"better-sqlite3"`（已有），且 Dockerfile 中 `npm install better-sqlite3 --build-from-source` 执行成功。

### Q: 安装向导打不开 / 跳转异常
A: 检查 `middleware.ts` 是否正常工作，以及 `SESSION_SECRET` 是否设置。

### Q: Turso 模式下 `getRawDb()` 返回 `null`
A: 预期行为。Turso 适配器不提供 raw 实例，迁移脚本需通过 HTTP API 单独执行建表语句。

### Q: 如何查看日志？
A: 微信云托管控制台 → 应用 → 日志，实时查看 stdout/stderr。

## 回滚策略

- **版本标签**：每次发布打 git tag（如 `v1.3.20`），镜像 tag 同版本号
- **回滚**：控制台 → 应用 → 版本 → 选择旧版本 → 回滚
