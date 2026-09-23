/** @type {import('next').NextConfig} */
const nextConfig = {
  // 自托管版：标准 Next.js 构建，不依赖 OpenNext / Cloudflare Workers。
  // 静态资源由 Next 自带服务（public/ 目录），无需 Workers Assets。
  // better-sqlite3 是原生模块，必须作为外部依赖在运行时 require，不能被打包。
  serverExternalPackages: ["better-sqlite3"],
  // 自托管分发：产出 .next/standalone（最小运行时），上传服务器后 `node server.js` 即可跑，
  // 无需在服务器上 npm install / npm run build。
  output: "standalone",
};

export default nextConfig;
