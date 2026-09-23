# XiviBlog 自托管安装版

对标 WordPress 的「上传 → 解压 → 安装」体验：把本目录上传到你的云服务器，跑一条脚本初始化数据库，再打开浏览器完成安装向导，即可拥有自己的博客。

> 本版本与 Cloudflare 版**代码同源、数据层不同**：Cloudflare 版用 D1（边缘 SQLite），本版本用本地 **SQLite 文件**（`better-sqlite3`），其余业务逻辑、后台、主题、Markdown 编辑器完全一致。

---

## 一、服务器要求

| 项目 | 要求 |
| --- | --- |
| 系统 | 任意 Linux（Ubuntu / Debian / CentOS 等） |
| Node.js | ≥ 18（推荐 20+） |
| 数据库 | 自带 SQLite，**无需** 额外安装 MySQL/PostgreSQL |
| 内存 | ≥ 512MB 即可 |
| 其他 | （可选）Nginx + Certbot 用于域名与 HTTPS |

---

## 二、上传与解压

```bash
# 把压缩包上传后解压到网站目录
unzip xiviblog-install.zip -d /var/www/xiviblog
cd /var/www/xiviblog
```

---

## 三、一键安装

```bash
bash install.sh
```

脚本会自动：
1. 检查 Node.js 版本；
2. `npm install` 安装依赖（含原生模块 better-sqlite3）；
3. 复制 `.env.example` 为 `.env`（首次需你补充密钥）；
4. 执行 `migrations/` 下所有 SQL 建表（含 3 篇示例文章）。

> 安装脚本**不会**写入任何管理员账号——管理员由下面的网页向导创建。

### 配置 `.env`（重要）

编辑 `.env`，至少修改这两项：

```ini
SESSION_SECRET=请用 openssl rand -hex 32 生成的随机串
ADMIN_PASSWORD=你自己的后台邀请码（也是主密钥）
```

其余可保持默认：

```ini
DATABASE_PATH=./data/xiviblog.db     # SQLite 文件路径，目录会自动创建
SITE_URL=http://localhost:3000       # 对外访问地址
PORT=3000                           # Node 监听端口
```

---

## 四、启动 & 安装向导（关键一步）

```bash
npm run build      # 首次需要构建（之后可只 npm start）
npm start          # 启动，默认监听 3000
```

打开浏览器访问 **`http://你的服务器IP:3000/install`**（若已配域名则用域名），填写：

- 站点名称（可选）
- **管理员邮箱**
- **管理员密码**（≥6 位）

点击「完成安装」后，向导会：
1. 再次确保数据库表结构就绪；
2. 创建你的管理员账号；
3. 写入站点名称。

随后即可前往 **`/admin`** 登录后台写文章。

> 与 WordPress 的 `wp-admin/install.php` 体验一致：数据库 + 账号一步到位。

---

## 五、绑定域名 + HTTPS（可选但推荐）

```bash
bash setup-nginx.sh blog.yourdomain.com
```

脚本会：写入 Nginx 反向代理 → 重载 Nginx → 用 Certbot 自动签发免费 HTTPS 证书。
完成后用 `https://blog.yourdomain.com` 访问，并在 `.env` 把 `SITE_URL` 改成该地址。

### 用进程守护（让服务常驻）

推荐用 `pm2` 或 systemd 保活。例如 pm2：

```bash
npm i -g pm2
pm2 start "npm start" --name xiviblog
pm2 save
```

---

## 六、目录结构（自托管版）

```
xiviblog/
├─ app/                 # 页面 + /api 路由 + /admin 后台 + /install 安装向导
├─ components/          # UI 组件
├─ lib/                 # 业务逻辑（db 适配层 / auth / settings / markdown …）
│   └─ db.ts            # SQLite 适配器（D1 兼容接口）
├─ migrations/          # 数据库结构迁移（0001 ~ 0016）
├─ public/              # 静态资源
├─ scripts/
│   └─ install-db.mjs   # 独立迁移脚本
├─ install.sh           # 一键安装
├─ setup-nginx.sh       # Nginx + HTTPS
├─ next.config.mjs
├─ package.json
└─ .env.example
```

---

## 七、与 Cloudflare 版的区别

| 维度 | Cloudflare 版 | 自托管版 |
| --- | --- | --- |
| 运行环境 | Cloudflare Workers | 任意 Linux + Node |
| 数据库 | D1（托管 SQLite） | 本地 SQLite 文件 |
| 缓存 | 边缘 Cache API | 反向代理 / CDN 缓存 |
| 部署 | `wrangler deploy` | `npm start` + Nginx |
| 安装 | 无需（无界面） | 网页安装向导 `/install` |
| 成本 | Cloudflare 免费额度 | 一台 VPS（几十元/月） |

两者共享同一套业务代码，功能、主题、编辑器完全一致。

---

## 八、常见问题

- **端口被占用 / 想换端口**：改 `.env` 的 `PORT`，并同步 `setup-nginx.sh` 的代理端口。
- **忘记管理员密码**：删除 `data/xiviblog.db` 中 `users` 表对应行，或重新执行 `install.sh` 后访问 `/install`（会提示已安装，需先清空数据库文件再重装）。
- **better-sqlite3 编译失败**：确保服务器有 build-essential / python3（预编译包通常无需编译；若缺失请安装 `apt install build-essential python3`）。
- **想用 PostgreSQL**：当前自托管版锁定 SQLite；更换数据库需替换 `lib/db.ts` 适配层。
