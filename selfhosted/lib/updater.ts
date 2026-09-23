import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { APP_VERSION } from "./version";

/**
 * 在线更新核心库（仅在自托管版生效）。
 * - 通过 GitHub Releases 检测最新版本
 * - 维护 data/version.json（已部署版本记录）与 data/update-job.json（更新进度）
 * - 更新前的「数据与源码双备份」由调用方（API 路由）在应用存活时完成，
 *   因为 detached 更新脚本会重启进程，无法再回头操作数据库。
 */

const GITHUB_API = "https://api.github.com";
const REPO = "yangxivi/XiviBlog";

function dataDir(): string {
  const d = join(process.cwd(), "data");
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
  return d;
}

/** 已部署版本：优先读 data/version.json，否则退回代码内置版本 */
export function readDeployedVersion(): string {
  try {
    const p = join(dataDir(), "version.json");
    if (existsSync(p)) {
      const j = JSON.parse(readFileSync(p, "utf8")) as { version?: string };
      if (j.version) return j.version;
    }
  } catch {
    /* ignore */
  }
  return APP_VERSION;
}

export function writeDeployedVersion(v: string): void {
  const p = join(dataDir(), "version.json");
  writeFileSync(p, JSON.stringify({ version: v, deployedAt: new Date().toISOString() }), "utf8");
}

export type ReleaseInfo = {
  tag: string;
  name: string;
  notes: string;
  /** 仓库源码 tarball（universality：tar -xzf 即可解，无需 unzip） */
  tarballUrl: string;
  /** Release asset zip（含完整 selfhosted 代码，供在线更新使用） */
  zipUrl: string | null;
  htmlUrl: string;
  publishedAt: string;
};

/** 拉取 GitHub 最新 Release；无 Release 或网络失败返回 null（不影响主流程） */
export async function fetchLatestRelease(token?: string): Promise<ReleaseInfo | null> {
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": "XiviBlog-SelfHosted",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${GITHUB_API}/repos/${REPO}/releases/latest`, { headers });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      tag_name?: string;
      name?: string;
      body?: string;
      html_url?: string;
      published_at?: string;
      tarball_url?: string;
      assets?: Array<{ name?: string; browser_download_url?: string }>;
    };
    if (!j.tag_name || !j.tarball_url) return null;
    // 优先找 xiviblog-selfhosted-*.zip 格式的 asset
    const zipAsset = j.assets?.find((a) =>
      a.name?.toLowerCase().includes("selfhosted") && a.name?.endsWith(".zip")
    );
    return {
      tag: j.tag_name,
      name: j.name || j.tag_name,
      notes: j.body || "",
      tarballUrl: j.tarball_url,
      zipUrl: zipAsset?.browser_download_url ?? null,
      htmlUrl: j.html_url || `https://github.com/${REPO}/releases/tag/${j.tag_name}`,
      publishedAt: j.published_at || "",
    };
  } catch {
    return null;
  }
}

/** 把 "v1.2.3" / "1.2.3" 转成 [1,2,3]，非数字段记 0 */
export function parseVersion(v: string): number[] {
  return v
    .replace(/^v/i, "")
    .split(".")
    .map((x) => parseInt(x, 10) || 0);
}

/** a > b 返回 1，a < b 返回 -1，相等返回 0 */
export function compareVersion(a: string, b: string): number {
  const A = parseVersion(a);
  const B = parseVersion(b);
  const n = Math.max(A.length, B.length);
  for (let i = 0; i < n; i++) {
    const x = A[i] || 0;
    const y = B[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

export type UpdateCheck = {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  release: ReleaseInfo | null;
  checkedAt: string;
};

/** 对比当前版本与 GitHub 最新版，返回是否有可用更新 */
export async function checkUpdate(
  token?: string,
  force = false
): Promise<UpdateCheck> {
  const current = APP_VERSION;
  const release = await fetchLatestRelease(token);
  const hasUpdate = release ? compareVersion(release.tag, current) > 0 : false;
  const result: UpdateCheck = {
    current,
    latest: release?.tag ?? null,
    hasUpdate,
    release: hasUpdate ? release : null,
    checkedAt: new Date().toLocaleString("sv-SE", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).replace(" ", "T"),
  };
  // 缓存到 data/update-check.json，供自动检测节流
  if (force || true) {
    try {
      writeFileSync(join(dataDir(), "update-check.json"), JSON.stringify(result), "utf8");
    } catch {
      /* ignore */
    }
  }
  return result;
}

/* ============================ 更新进度（job） ============================ */

export type UpdateJobStatus =
  | "idle"
  | "queued"
  | "backing_up"
  | "downloading"
  | "extracting"
  | "installing"
  | "building"
  | "restarting"
  | "done"
  | "failed"
  | "rolled_back";

export type UpdateJob = {
  status: UpdateJobStatus;
  current: string;
  target: string;
  tarballUrl: string;
  snapshotId: number | null;
  rollbackFile: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  /** 进程外（detached 脚本）写入的实时进度行 */
  log: string[];
  error?: string;
};

const JOB_FILE = () => join(dataDir(), "update-job.json");

export function getUpdateJob(): UpdateJob {
  try {
    const p = JOB_FILE();
    if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8")) as UpdateJob;
  } catch {
    /* ignore */
  }
  return {
    status: "idle",
    current: APP_VERSION,
    target: "",
    tarballUrl: "",
    snapshotId: null,
    rollbackFile: null,
    startedAt: null,
    finishedAt: null,
    log: [],
  };
}

export function writeUpdateJob(job: UpdateJob): void {
  try {
    writeFileSync(JOB_FILE(), JSON.stringify(job, null, 2), "utf8");
  } catch {
    /* ignore */
  }
}

export function appendJobLog(job: UpdateJob, line: string): UpdateJob {
  const next = { ...job, log: [...job.log, `[${new Date().toISOString().slice(11, 19)}] ${line}`].slice(-200) };
  writeUpdateJob(next);
  return next;
}

/** 列出 data/.rollback 下可回滚的源码备份 */
export function listRollbackBundles(): { file: string; version: string; at: string }[] {
  try {
    const d = dataDir();
    const dir = join(d, ".rollback");
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir)
      .filter((f: string) => f.endsWith(".tar.gz"))
      .map((f: string) => {
        const m = /^app-(.+)-(\d+)\.tar\.gz$/.exec(f);
        return { file: join(dir, f), version: m?.[1] || "未知", at: m?.[2] || "" };
      })
      .sort((a: { file: string }, b: { file: string }) => b.file.localeCompare(a.file));
    return files;
  } catch {
    return [];
  }
}
