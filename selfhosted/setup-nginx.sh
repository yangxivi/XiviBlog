#!/usr/bin/env bash
# XiviBlog 自托管版 · Nginx 反向代理 + HTTPS 配置
# 用法： bash setup-nginx.sh 你的域名 [端口]
set -euo pipefail

DOMAIN="${1:-}"
PORT="${2:-3000}"

if [ -z "$DOMAIN" ]; then
  read -p "请输入你的域名（如 blog.example.com）: " DOMAIN
fi
if [ -z "$DOMAIN" ]; then
  echo "✗ 未提供域名"
  exit 1
fi

NGINX_CONF="/etc/nginx/sites-available/xiviblog"
echo "→ 写入 Nginx 配置：$NGINX_CONF"
cat > "$NGINX_CONF" <<EOF
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

echo "→ 启用站点…"
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/xiviblog

echo "→ 校验并重载 Nginx…"
nginx -t
systemctl reload nginx

echo "→ 申请 HTTPS 证书（certbot）…"
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --redirect \
  -m "admin@${DOMAIN}" || echo "⚠ certbot 自动申请失败，请手动运行：certbot --nginx -d $DOMAIN"

echo ""
echo "============================================"
echo "✓ 完成！访问地址： https://${DOMAIN}"
echo "  后台： https://${DOMAIN}/admin"
echo "  安装向导： https://${DOMAIN}/install"
echo "============================================"
