/**
 * 友链地址的纯函数工具（服务端与后台客户端共用，不能引任何云端绑定）。
 */

/** 补全协议、去掉首尾空白；只接受 http/https，别的（javascript:、mailto:…）一律返回空串 */
export function normalizeFriendUrl(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return "";
  const withProto = /^[a-z][a-z0-9+.\-]*:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

/** 显示用的短地址：去掉协议与末尾斜杠，太长就截断 */
export function prettyHost(url: string): string {
  const n = normalizeFriendUrl(url);
  if (!n) return url.trim() || "（地址为空）";
  try {
    const u = new URL(n);
    const p = u.pathname === "/" ? "" : u.pathname.replace(/\/$/, "");
    const s = `${u.host}${p}`;
    return s.length > 46 ? `${s.slice(0, 44)}…` : s;
  } catch {
    return url;
  }
}

/**
 * 明显不该由服务端去请求的地址（本机 / 内网 / 元数据服务）。
 * 这只是友好提示层，真正的兜底是 workers 的 global_fetch_strictly_public。
 */
export function isPrivateHost(url: string): boolean {
  try {
    const h = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      h === "localhost" ||
      h.endsWith(".localhost") ||
      h === "::1" ||
      h === "0.0.0.0"
    ) {
      return true;
    }
    if (/^127\./.test(h) || /^10\./.test(h) || /^192\.168\./.test(h)) return true;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
    if (/^169\.254\./.test(h)) return true;
    if (/^(fc|fd|fe80)/i.test(h)) return true;
    return false;
  } catch {
    return false;
  }
}
