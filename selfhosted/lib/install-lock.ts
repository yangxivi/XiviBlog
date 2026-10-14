import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { countUsers } from "./users";
import { resolveDbPath } from "./db";

/* ==========================================================================
 * 安装状态与「安装锁」——安装状态的唯一权威判定（Node 运行时，直连数据库）
 *
 * 为什么要有这个文件：
 * 早期版本把「是否已安装」交给 middleware 里的 HTTP 自探（middleware 去请求
 * 自己的 /api/install）。middleware 跑在 edge 沙箱里，在「Nginx 反代 + 隧道」
 * 这类部署下这个自探会失败；失败被当成「未安装」，于是出现两个后果：
 *   1. 装好的站点被整站 307 到 /install，首页打不开（整站砖掉）；
 *   2. 安装向导长期对外暴露，任何人打开 /install 都能看到重装表单。
 *
 * 现在改成三层判定，全部在 Node 运行时完成，不依赖任何网络调用：
 *   1. 环境变量硬锁 XIVIBLOG_INSTALL_LOCK=1（装完可置 1，永久关闭向导）
 *   2. 安装标记文件 <数据库目录>/.installed（首次安装成功后写入）
 *   3. users 表是否已有账号
 * 任意一条命中即视为「已安装」→ 安装页面 404、安装接口拒绝。
 * ========================================================================== */

/** 数据库文件路径（复用 lib/db.ts 的 resolveDbPath，保证与业务查询同一库） */
function dbPath(): string {
  return resolveDbPath();
}

/** 安装标记文件：放在数据库同目录，随数据一起迁移/备份 */
function markerPath(): string {
  return join(dirname(dbPath()), ".installed");
}

/** 环境变量硬锁：XIVIBLOG_INSTALL_LOCK=1 / true / yes / on */
export function isInstallLockedByEnv(): boolean {
  const v = String(process.env.XIVIBLOG_INSTALL_LOCK || "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

// 标记文件一旦出现就不会再消失，命中后常驻内存，省掉每请求一次 stat
let markerCache = false;

/** 是否存在安装标记文件 */
export function hasInstallMarker(): boolean {
  if (markerCache) return true;
  try {
    if (existsSync(markerPath())) {
      markerCache = true;
      return true;
    }
  } catch {
    /* 文件系统异常时按「无标记」处理，还有 users 表兜底 */
  }
  return false;
}

/**
 * 安装成功时落盘标记。写失败不抛错（users 表仍然兜底），
 * 但如果标记写不进去，重复安装的风险就回退到「users 表非空」这一层。
 */
export function writeInstallMarker(): boolean {
  try {
    mkdirSync(dirname(markerPath()), { recursive: true });
    writeFileSync(
      markerPath(),
      `installed_at=${new Date().toISOString()}\n`,
      "utf8"
    );
    markerCache = true;
    return true;
  } catch {
    return false;
  }
}

export type InstallState = {
  /** 是否已安装（向导与安装接口应该关闭） */
  installed: boolean;
  /** 判定依据，便于排查：env-lock / marker / users / fresh */
  reason: "env-lock" | "marker" | "users" | "fresh";
};

/**
 * 唯一权威判定。查询异常（表未建立、库损坏）一律按「未安装」处理，
 * 让首次安装流程能继续跑；此时 env-lock 与标记文件仍然可以兜住重复安装。
 */
export async function installState(): Promise<InstallState> {
  if (isInstallLockedByEnv()) return { installed: true, reason: "env-lock" };
  if (hasInstallMarker()) return { installed: true, reason: "marker" };
  try {
    const n = await countUsers();
    if (n > 0) return { installed: true, reason: "users" };
  } catch {
    /* 表还没建 → 未安装 */
  }
  return { installed: false, reason: "fresh" };
}

/** 便捷包装：只看是否已安装 */
export async function isInstalled(): Promise<boolean> {
  return (await installState()).installed;
}
