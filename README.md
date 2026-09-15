# XiviBlog · 曦微博客

一个跑在 **Cloudflare Workers** 上的轻量级博客系统——可以理解为「手搓版 WordPress」：完整的后台管理、Markdown 写作、主题切换、评论、访问统计，全部零服务器成本，部署即用。

> 技术栈：Next.js 16（App Router）+ React 19 + Tailwind v4 → [OpenNext](https://opennext.js.org/cloudflare) → Cloudflare Workers + D1（SQLite）+ Workers Assets（静态资源）+ Cache API 边缘缓存。

---

## ✨ 功能特性

- **完整后台**：文章（增删改、置顶、定时发布、版本历史）、标签、媒体库、访问统计（含搜索词看板）、站点设置、数据备份。
- **Markdown 编辑器**：16 个工具栏动作、实时预览、粘贴/拖拽传图、分屏滚动同步。
- **多主题**：`--brand` CSS 变量驱动，内置多套配色 × 明暗模式一键切换。
- **三端自适应**：桌面 / 平板 / 手机，侧边栏可左右互换。
- **边缘缓存**：`custom-worker.ts` 用 Cloudflare Cache API 缓存整页 HTML / RSC / 分页 JSON，重复访问 TTFB 从 1~2.6s 降到 0.25~0.5s。
- **AI 封面**：后台可调用 agnes 等图像模型生成文章封面（密钥存 D1 设置，前端直连生图避免 Workers 出口 IP 限流）。
- **零成本**：Cloudflare 免费额度即可支撑个人博客（Workers 请求、D1 行数、Assets 流量均在免费档内）。

---

## 🧰 环境要求

- Node.js ≥ 20（推荐 22）
- 一个 Cloudflare 账号（免费版即可）
- `wrangler`（`npm i -g wrangler` 或随项目 `npx wrangler`）
- 一个已在 Cloudflare 接入并开启代理（orange-cloud）的域名（可选，也可用 `*.workers.dev` 默认子域）

---

## 🚀 部署到 Cloudflare Workers

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库

```bash
npx wrangler d1 create xivi-blog-db
```

命令会返回一个 `database_id`，把它填进 `wrangler.jsonc` 的 `d1_databases[].database_id`（以及 `migrations/_seed_*.sql` 里若需直连则看第 4 步）。

> ⚠️ 部署前请确认 `wrangler.jsonc` 里的以下字段已改为你自己的：
> - `account_id`
> - `name`（Worker 名称，默认 `xivi-blog`）
> - `d1_databases[].database_id` / `database_name`
> - `routes[].pattern`（你的自定义域名，如 `blog.your.com`）

### 3. 应用数据库结构迁移

仓库 `migrations/` 下是编号的 SQL（`0001_init.sql` … `0015_cover_thumb.sql`）。逐个执行：

```bash
# 跳过下划线开头的种子文件（见第 4 步单独处理）
for f in migrations/0*.sql; do
  case "$(basename "$f")" in _*) continue;; esac
  echo "==> $f"
  npx wrangler d1 execute xivi-blog-db --remote --file="$f"
done
```

> 若你的环境 `--file` 通道异常，可改用 Cloudflare 控制台 D1 的 Query 面板逐文件粘贴执行，或用 `npx wrangler d1 execute xivi-blog-db --remote --command "$(cat 文件路径)"`。

### 4.（可选）初始化管理员与示例文章

```bash
npx wrangler d1 execute xivi-blog-db --remote --file=migrations/_seed_default_user.sql
npx wrangler d1 execute xivi-blog-db --remote --file=migrations/_seed_posts.sql
```

`_seed_default_user.sql` 写入的是一个**占位管理员**（`admin@example.com`，密码不可用）。部署完成后请通过前台 **`/admin/register`** 用「邀请码 = `ADMIN_PASSWORD`」创建你自己的管理员账号，再删除占位账号。

### 5. 设置运行所需 Secret

应用通过 Cloudflare 环境变量读取以下机密（**务必用 secret，不要写进代码或 wrangler.jsonc**）：

```bash
# 会话 HMAC 签名密钥，建议： openssl rand -hex 32
npx wrangler secret put SESSION_SECRET

# 管理员主密钥：作为 /admin/register 邀请码，也用于 /admin/forgot 找回验证
npx wrangler secret put ADMIN_PASSWORD
```

### 6. 构建并部署

```bash
npm run cf:deploy
# 等价于： opennextjs-cloudflare build && wrangler deploy
```

部署成功后 Worker 即可访问；若已配置自定义域名，稍候 DNS 生效即可。

### 7. 创建你的管理员账号

打开 `https://<你的域名>/admin/register`，填写邮箱 / 密码，邀请码填第 5 步设置的 `ADMIN_PASSWORD`，即可登录后台 `/admin`。

---

## 💻 本地开发

```bash
# 纯前端预览（不连 Cloudflare）
npm run dev

# 连 Cloudflare（D1 / 缓存）本地预览，需要先有 wrangler 配置
npm run cf:preview
```

本地连 D1 时，机密可放在 `.dev.vars`（已被 .gitignore 忽略，**切勿提交**）：

```ini
SESSION_SECRET=dev-only-secret
ADMIN_PASSWORD=dev-only-master
```

---

## 🗂 项目结构

```
blog/
├─ app/                  # Next.js App Router：页面 + /api 路由 + /admin 后台
│  ├─ api/               # auth / posts / pages / media / cover / stats ...
│  └─ admin/             # 登录、注册、编辑器、设置、统计等后台界面
├─ lib/                  # 核心逻辑：db（D1 封装）、auth、markdown、settings、revisions
├─ components/           # UI 组件
├─ custom-worker.ts      # Cloudflare 边缘缓存层（Cache API）
├─ open-next.config.ts   # OpenNext 构建配置
├─ wrangler.jsonc        # Cloudflare Workers / D1 / Assets / 路由 配置
├─ migrations/           # D1 结构迁移（0001-0016）+ 两个 _seed_*.sql 种子
├─ public/               # 静态资源（covers / svg；文章配图 shots/ 不入库）
├─ scripts/              # 运维脚本（见下）
└─ .env.example          # 本地环境变量模板
```

---

## ⚙️ 配置说明

### 环境变量 / Secret

| 名称 | 类型 | 说明 |
| --- | --- | --- |
| `SESSION_SECRET` | Secret | 会话签名密钥，`openssl rand -hex 32` 生成 |
| `ADMIN_PASSWORD` | Secret | 管理员主密钥；`/admin/register` 邀请码、`/admin/forgot` 找回验证 |
| `CLOUDFLARE_API_TOKEN` | 本地 | 运维脚本（如 `scripts/`）直连 D1 HTTP API 用，从环境变量读取，**不写入仓库** |
| `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_DATABASE_ID` | 本地 | 同上，运维脚本可覆盖的默认值 |

### AI 封面（可选）

后台「AI 生成封面」依赖一个图像生成 API（默认 agnes）。相关配置（Base URL / 模型 / Key）保存在 D1 的站点设置里（后台「站点设置 → AI 封面」），**不在代码或环境变量中**。前端拿到提示词后直连图像服务生图，避免 Workers 共享出口 IP 被限流。

---

## 🛠 运维脚本（`scripts/`）

| 脚本 | 作用 |
| --- | --- |
| `migrate-about-to-pages.mjs` | 把「关于本站」从 settings 迁移到 pages 表 |
| `rebuild-thumbs-webp.py` | 把全部封面缩略图用 WebP 重新生成（需 `Pillow` + 环境变量 `CLOUDFLARE_API_TOKEN`） |
| `update-timeline.mjs` | 把迭代记录追加到「关于本站」时间轴 |

> 其余 `verify-*` / `probe-*` / `*-check` 等内部 QA 脚本含真实后台凭据，已被 `.gitignore` 排除，不会进入仓库。

---

## 🔒 安全约定

- **任何机密（API Token、管理员密码）都不入库**：Token 仅从环境变量读取；管理员密码通过 `ADMIN_PASSWORD` Secret 与注册/找回流程管理。
- `.env`、`.dev.vars`、本地日志均已被 `.gitignore` 忽略。
- 文章插图走 `public/shots/` 静态外链，不内嵌 base64，避免撑大 D1、拖慢边缘缓存。

---

## 📄 License

仅供个人学习与使用。如需商用或二次分发，请自行评估合规要求。
