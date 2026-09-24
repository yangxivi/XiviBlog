"""把 posts.cover_thumb 全量重建为 WebP 缩略图。

策略：不再从已有的小缩略图二次压缩，而是从原图 cover_image 重新
中心裁切 16:9 → 缩放到 240×135 → WebP q60。
这样画质更好（少一次有损压缩），体积约为原 JPEG 缩略图的 60%。

用法：
  python rebuild-thumbs-webp.py --dry-run     # 只统计不写库
  python rebuild-thumbs-webp.py               # 实际写入
"""
import argparse
import base64
import io
import json
import os
import sys
import time
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor

from PIL import Image

# 资源标识符（非机密，可改为你自己的）；令牌务必从环境变量读取，切勿硬编码
ACC = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "b433825d809e0bb7e7ba0bb3946ced9f")
DB = os.environ.get("CLOUDFLARE_DATABASE_ID", "0a6dacad-4281-4016-aa90-ce912fe9fa6a")
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN")
if not TOKEN:
    sys.exit("ERROR: 请先设置环境变量 CLOUDFLARE_API_TOKEN（具备 D1 编辑权限的 Cloudflare API Token）")
QUERY_URL = f"https://api.cloudflare.com/client/v4/accounts/{ACC}/d1/database/{DB}/query"

TARGET = (240, 135)
WEBP_QUALITY = 60
BATCH = 20


def d1(sql, params=None):
    payload = {"sql": sql}
    if params:
        payload["params"] = params
    req = urllib.request.Request(
        QUERY_URL,
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                j = json.loads(r.read())
            if not j.get("success"):
                raise RuntimeError(j.get("errors"))
            return j["result"][0]["results"]
        except Exception:  # noqa: BLE001
            if attempt == 2:
                raise
            time.sleep(2)
    return []


def raw_b64(data_uri: str) -> str:
    return data_uri.split(",", 1)[1] if "," in data_uri else data_uri


def to_webp_thumb(cover_image: str) -> str:
    img = Image.open(io.BytesIO(base64.b64decode(raw_b64(cover_image)))).convert("RGB")
    w, h = img.size
    target_ratio = TARGET[0] / TARGET[1]
    if w / h > target_ratio:
        new_w = int(round(h * target_ratio))
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    else:
        new_h = int(round(w / target_ratio))
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))
    img = img.resize(TARGET, Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=WEBP_QUALITY, method=6)
    return "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    if not TOKEN:
        sys.stderr.write("错误：未设置环境变量 CLOUDFLARE_API_TOKEN\n")
        sys.exit(1)

    total = d1("SELECT COUNT(*) AS n FROM posts WHERE cover_thumb <> ''")[0]["n"]
    if args.limit:
        total = min(total, args.limit)
    print(f"待处理 {total} 篇" + ("（dry-run，不写库）" if args.dry_run else ""))

    before = 0
    after = 0
    done = 0
    failed = []
    offset = 0
    writes = []

    while done < total:
        want = min(BATCH, total - done)
        rows = d1(
            "SELECT id, cover_image, cover_thumb FROM posts "
            "WHERE cover_thumb <> '' ORDER BY id LIMIT ?1 OFFSET ?2",
            [want, offset],
        )
        if not rows:
            break
        offset += len(rows)

        for row in rows:
            before += len(row["cover_thumb"])
            try:
                new_thumb = to_webp_thumb(row["cover_image"])
            except Exception as e:  # noqa: BLE001
                failed.append((row["id"], repr(e)[:120]))
                after += len(row["cover_thumb"])
                done += 1
                continue
            after += len(new_thumb)
            done += 1
            if not args.dry_run:
                writes.append((new_thumb, row["id"]))

        if writes:
            with ThreadPoolExecutor(max_workers=5) as pool:
                list(
                    pool.map(
                        lambda p: d1(
                            "UPDATE posts SET cover_thumb=?1 WHERE id=?2", [p[0], p[1]]
                        ),
                        writes,
                    )
                )
            writes.clear()

        pct = done / total * 100
        print(
            f"  {done}/{total} ({pct:.0f}%)  累计 {before / 1024:.0f}KB → {after / 1024:.0f}KB",
            flush=True,
        )

    print(f"\n完成 {done} 篇，失败 {len(failed)} 篇")
    if before:
        print(f"缩略图总量 {before / 1024:.0f}KB → {after / 1024:.0f}KB（{after / before * 100:.1f}%）")
    for pid, err in failed[:15]:
        print(f"  失败 id={pid}: {err}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
