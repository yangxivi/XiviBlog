# 曦微博客 - 微信云托管部署镜像
# 基于 Next.js standalone 输出构建最小运行时

FROM node:22-alpine AS builder

WORKDIR /app

# 复制包管理文件并安装依赖
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts 2>/dev/null || npm install --ignore-scripts

# 复制源码
COPY . .

# 构建应用（standalone 输出）
RUN npm run build

# 安装生产依赖（更好的 sqlite 原生模块需要重新编译）
RUN npm ci --only=production && npm install better-sqlite3 --build-from-source

# 运行阶段
FROM node:22-alpine AS runner

WORKDIR /app

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 从构建阶段复制 standalone 输出
COPY --from=builder /app/.next/standalone/. .
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# 创建数据目录
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "server.js"]
