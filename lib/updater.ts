import { APP_VERSION } from "./version";

const GITHUB_API = "https://api.github.com";
const REPO = "yangxivi/XiviBlog";

export type UpdateCheck = {
  current: string;
  latest: string | null;
  hasUpdate: boolean;
  checkedAt: string;
};

/** 拉取 GitHub 最新 Release */
export async function fetchLatestRelease(): Promise<{ tag: string; url: string } | null> {
  try {
    const res = await fetch(`${GITHUB_API}/repos/${REPO}/releases/latest`);
    if (!res.ok) return null;
    const j = await res.json() as { tag_name?: string; html_url?: string };
    if (!j.tag_name) return null;
    return { tag: j.tag_name, url: j.html_url || `https://github.com/${REPO}/releases/tag/${j.tag_name}` };
  } catch {
    return null;
  }
}

/** 把 "v1.2.3" / "1.2.3" 转成 [1,2,3] */
export function parseVersion(v: string): number[] {
  return v.replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0);
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

/** 对比当前版本与 GitHub 最新版 */
export async function checkUpdate(): Promise<UpdateCheck> {
  const current = APP_VERSION;
  const release = await fetchLatestRelease();
  const hasUpdate = release ? compareVersion(release.tag, current) > 0 : false;
  return {
    current,
    latest: release?.tag ?? null,
    hasUpdate,
    checkedAt: new Date().toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" })
      .replace(" ", "T")
      .slice(0, 19),
  };
}
