"use client";

import { useEffect, useRef } from "react";

/**
 * 站内搜索埋点：进到 /search?q=xxx 就上报一次关键词（含命中数）。
 * 只在真的带了关键词时上报；重复渲染靠 ref 去重，同一次搜索只发一条。
 */
export default function SearchLogger({
  q,
  results,
}: {
  q: string;
  results: number;
}) {
  const sent = useRef("");

  useEffect(() => {
    const kw = q.trim();
    if (!kw) return;
    const key = `${kw}|${results}`;
    if (sent.current === key) return;
    sent.current = key;

    void fetch("/api/track/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: kw, results }),
      keepalive: true,
    }).catch(() => {});
  }, [q, results]);

  return null;
}
