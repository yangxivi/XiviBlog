// 独立迁移脚本：在 Node 环境直接执行 migrations/ 下的编号 SQL。
// 用法：node scripts/install-db.mjs   （可先设置 DATABASE_PATH 环境变量）
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { readdirSync, readFileSync } from "node:fs";

const path = process.env.DATABASE_PATH || "./data/xiviblog.db";
mkdirSync(dirname(path), { recursive: true });

const db = new Database(path);
db.pragma("journal_mode = WAL");
db.pragma("busy_timeout = 5000");
db.pragma("foreign_keys = OFF");

const dir = join(process.cwd(), "migrations");
const files = readdirSync(dir)
  // 与 lib/migrate.ts 保持一致：0001_init.sql … 0017_pages.sql（数字编号开头即可）
  .filter((f) => /^\d+.*\.sql$/.test(f))
  // 跳过种子文件（_seed_*.sql 与 0002_seed.sql 由安装流程另行处理）
  .filter((f) => !/seed/i.test(f))
  .sort();

let count = 0;
for (const f of files) {
  db.exec(readFileSync(join(dir, f), "utf8"));
  count++;
}

db.close();
console.log(`✓ 已执行 ${count} 个迁移文件，数据库就绪：${path}`);
