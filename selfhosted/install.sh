#!/usr/bin/env bash
# XiviBlog 自托管版 · 一键安装脚本
# 用法： bash install.sh
set -euo pipefail

echo "============================================"
echo "   XiviBlog 自托管版安装"
echo "============================================"

# 1) 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "✗ 未检测到 Node.js，请先安装 Node.js >= 18（推荐 20+）"
  exit 1
fi
NODE_MAJOR=$(node -v | sed -E 's/v([0-9]+)\..*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "✗ Node.js 版本过低（当前 v$(node -v)），需要 >= 18"
  exit 1
fi
echo "✓ Node.js $(node -v)"

# 2) 安装依赖
if [ ! -d node_modules ]; then
  echo "→ 安装依赖（npm install）…"
  npm install
else
  echo "✓ 依赖已存在，跳过安装"
fi

# 3) 生成 .env
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "⚠ 已复制 .env.example → .env，请务必编辑以下两项（可用 openssl rand -hex 32 生成）："
  echo "    SESSION_SECRET=你的随机串"
  echo "    ADMIN_PASSWORD=你的后台邀请码/主密钥"
  echo ""
fi

# 4) 初始化数据库（建表）
echo "→ 初始化数据库（执行 migrations）…"
node scripts/install-db.mjs

# 5) 完成提示
echo ""
echo "============================================"
echo "✓ 数据库已就绪"
echo ""
echo "接下来："
echo "  1) 构建：        npm run build"
echo "  2) 启动：        npm start"
echo "  3) 浏览器打开：  http://localhost:3000/install"
echo "     按提示填写管理员邮箱与密码，即可完成安装。"
echo "  4) 如需域名 + HTTPS，运行： bash setup-nginx.sh 你的域名"
echo "============================================"
