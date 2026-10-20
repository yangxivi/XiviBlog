// 构建后兜底：把 .next/static、public 与 migrations 同步进 .next/standalone
// 防止走 standalone/server.js 部署时静态资源（含 CSS）404。
// 若不使用 standalone（如 npm start 直接读根 .next），则自动跳过，无副作用。
//
// migrations/ 必须一起同步：安装向导（app/api/install）要读 migrations/*.sql 执行建表，
// 并读 migrations/_seed_full.json 写入演示内容；standalone 默认不含该目录，漏同步会导致
// 「安装向导装完但没有演示数据」。
import { cp, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const standaloneDir = join(root, '.next', 'standalone');

async function exists(p) {
  try { await access(p, constants.F_OK); return true; } catch { return false; }
}

if (!(await exists(standaloneDir))) {
  console.log('[copy-static] 未使用 standalone，跳过（npm start 直接读根 .next，CSS 不丢）');
  process.exit(0);
}

for (const [from, to] of [
  [join(root, '.next', 'static'), join(standaloneDir, '.next', 'static')],
  [join(root, 'public'), join(standaloneDir, 'public')],
  [join(root, 'migrations'), join(standaloneDir, 'migrations')],
]) {
  if (await exists(from)) {
    await cp(from, to, { recursive: true });
    console.log(`[copy-static] 已同步 ${from} → ${to}`);
  }
}
console.log('[copy-static] 完成');
