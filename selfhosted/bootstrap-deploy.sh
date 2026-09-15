#!/usr/bin/env bash
# 曦微博客 自托管版 · 一键部署脚本（腾讯轻量云 / 通用 Linux）
# 用法（root 或带 sudo 执行）：
#   curl -fsSL https://raw.githubusercontent.com/yangxivi/XiviBlog/main/selfhosted/bootstrap-deploy.sh | bash
# 或下载后： bash bootstrap-deploy.sh
# 完成后访问 http://<服务器IP>:3000/install 完成初始化。

set -euo pipefail

APP_DIR="/opt/xiviblog"
REPO="https://github.com/yangxivi/XiviBlog.git"
PORT="${PORT:-3000}"

# 是否 root
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else SUDO="sudo"; fi

echo "==> [1/6] 安装运行环境（Node.js 20 / git / 构建工具）"
NODE_VER="$(node -v 2>/dev/null | tr -d 'v' | cut -d. -f1 || true)"
if [ -z "$NODE_VER" ] || [ "$NODE_VER" -lt 18 ]; then
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -y -q
    $SUDO apt-get install -y -q curl git build-essential python3
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO apt-get install -y -q nodejs
  elif command -v dnf >/dev/null 2>&1; then
    $SUDO dnf install -y -q curl git gcc-c++ make python3
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO dnf install -y -q nodejs
  elif command -v yum >/dev/null 2>&1; then
    $SUDO yum install -y -q curl git gcc-c++ make python3
    curl -fsSL https://rpm.nodesource.com/setup_20.x | $SUDO bash -
    $SUDO yum install -y -q nodejs
  else
    echo "不支持的包管理器，请手动安装 Node.js 20 后重试"; exit 1
  fi
fi
echo "    node $(node -v 2>/dev/null) | npm $(npm -v 2>/dev/null)"

command -v git >/dev/null 2>&1 || { echo "git 未安装，无法继续"; exit 1; }

echo "==> [2/6] 拉取源码"
$SUDO mkdir -p "$APP_DIR"
if [ ! -f "$APP_DIR/selfhosted/package.json" ]; then
  $SUDO rm -rf "$APP_DIR"
  if ! $SUDO git clone --depth 1 "$REPO" "$APP_DIR" 2>/dev/null; then
    echo "    直连 GitHub 失败，改用 ghproxy 镜像..."
    $SUDO git clone --depth 1 "https://ghproxy.com/https://github.com/yangxivi/XiviBlog.git" "$APP_DIR"
  fi
fi
cd "$APP_DIR/selfhosted"

echo "==> [3/6] 安装依赖（含 Linux 版 better-sqlite3）"
$SUDO npm install --no-audit --no-fund

echo "==> [4/6] 构建 Next.js"
NODE_OPTIONS="--max-old-space-size=1536" $SUDO npm run build

echo "==> [5/6] 写入 .env"
if [ ! -f .env ]; then
  PUB_IP="$(curl -s --max-time 8 ifconfig.me 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
  SITE_URL="http://${PUB_IP:-127.0.0.1}:${PORT}"
  $SUDO bash -c "cat > .env <<EOF
DATABASE_PATH=$APP_DIR/selfhosted/data/xiviblog.db
PORT=$PORT
SITE_URL=$SITE_URL
SESSION_SECRET=$(head -c 32 /dev/urandom | base64 | tr -d '=/+')
ADMIN_PASSWORD=$(head -c 12 /dev/urandom | base64 | tr -d '=/+' | cut -c1-12)
NODE_ENV=production
EOF"
  echo "    已生成 .env（SESSION_SECRET 随机；ADMIN_PASSWORD 为初始值，可在安装向导里改）"
fi

echo "==> [6/6] 用 pm2 托管启动"
if ! command -v pm2 >/dev/null 2>&1; then $SUDO npm install -g pm2; fi
$SUDO pm2 delete xiviblog 2>/dev/null || true
$SUDO pm2 start npm --name xiviblog -- start
$SUDO pm2 save
$SUDO pm2 startup 2>/dev/null || true

echo ""
echo "============================================================"
echo " 部署完成！请打开浏览器访问安装向导完成初始化："
echo "   $SITE_URL/install"
echo " 前台首页： $SITE_URL/"
echo " 后台管理： $SITE_URL/admin"
echo "============================================================"
