#!/usr/bin/env bash
# XiviBlog 自托管版 · 一键部署脚本（Linux / 腾讯轻量云 Lighthouse 等）
# 在服务器上执行： bash deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "============================================"
echo "   XiviBlog 自托管版部署"
echo "============================================"

# 1) Node.js 版本检查
if ! command -v node >/dev/null 2>&1; then
  echo "✗ 未检测到 Node.js。请先安装 Node.js >= 18（推荐 20）："
  echo "    Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
  echo "    或直接在 1Panel 应用商店安装 Node.js 20。"
  exit 1
fi
NODE_MAJOR=$(node -v | sed -E 's/v([0-9]+)\..*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "✗ Node.js 版本过低（当前 v$(node -v)），需要 >= 18"
  exit 1
fi
echo "✓ Node.js $(node -v)"

# 2) 安装依赖（含构建所需 devDependencies）
echo "→ 安装依赖（npm install）…"
npm install

# 3) 构建
echo "→ 构建（npm run build）…"
npm run build

# 4) 初始化数据库（建表，better-sqlite3 原生模块依赖本机编译/预编译）
echo "→ 初始化数据库…"
node scripts/install-db.mjs

# 5) 生成 .env（首次运行自动生成随机密钥）
if [ ! -f .env ]; then
  if command -v openssl >/dev/null 2>&1; then
    SECRET=$(openssl rand -hex 32)
    ADMIN_KEY=$(openssl rand -hex 16)
  else
    SECRET=$(head -c 32 /dev/urandom | xxd -p | tr -d '\n')
    ADMIN_KEY=$(head -c 16 /dev/urandom | xxd -p | tr -d '\n')
  fi
  cat > .env <<EOF
# ===== XiviBlog 自托管版配置（自动生成）=====
SESSION_SECRET=$SECRET
ADMIN_PASSWORD=$ADMIN_KEY
DATABASE_PATH=./data/xiviblog.db
SITE_URL=http://localhost:3000
PORT=3000
EOF
  echo "✓ 已生成 .env"
  echo "  后台注册邀请码 ADMIN_PASSWORD = $ADMIN_KEY   （请妥善保存，/admin/register 需要）"
fi

# 6) 用 PM2 托管为常驻后台进程（支持开机自启）
if ! command -v pm2 >/dev/null 2>&1; then
  echo "→ 安装 PM2 进程管理器…"
  sudo npm install -g pm2 2>/dev/null || npm install -g pm2
fi
PORT_VAL=$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2 | tr -d '[:space:]' || true)
PORT_VAL=${PORT_VAL:-3000}
pm2 delete xiviblog 2>/dev/null || true
pm2 start npm --name xiviblog -- start
pm2 save
echo "→ 注册 PM2 开机自启（如失败请手动执行 pm2 startup）…"
pm2 startup >/dev/null 2>&1 || true

echo ""
echo "============================================"
echo "✓ 部署完成！"
echo ""
echo "请通过浏览器访问安装向导："
echo "  http://<你的服务器IP>:${PORT_VAL}/install"
echo "填写管理员邮箱与密码，即可完成安装。"
echo ""
echo "安装完成后："
echo "  前台： http://<你的服务器IP>:${PORT_VAL}/"
echo "  后台： http://<你的服务器IP>:${PORT_VAL}/admin"
echo ""
echo "绑定域名 + HTTPS： bash setup-nginx.sh 你的域名"
echo "查看运行日志：     pm2 logs xiviblog"
echo "重启 / 停止：      pm2 restart xiviblog / pm2 stop xiviblog"
echo "============================================"
