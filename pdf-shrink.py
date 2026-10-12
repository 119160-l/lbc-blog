#!/usr/bin/env python3
"""
pdf-shrink.py —— 把扫描版 PDF 压到适合网页阅读的体积

为什么需要它：手头两本教材是纯扫描件（无文本层），
  胡寿松《自动控制原理》680 页 / 129 MB，运筹学 394 页 / 127 MB。
  原样放上站，发布时要传 300 MB，以后每次改点内容都得重传一遍，不划算。

做法：逐页渲染成灰度 JPEG 重新组装。
  这两本本来就是黑白扫描，灰度不损失信息；120 DPI 在手机/电脑上放大看公式够用。

用法：
  python3 pdf-shrink.py <输入.pdf> files/<输出>.pdf [dpi] [质量]
默认 dpi=120、质量=68。**输出直接写进站点的 files/ 目录**，
之后跑 node import-pdf.mjs 会把它登记进清单（带 pre 标记的条目）。

注意：对**文字版 PDF 不要用**（会把可选中的文字变成图）。
矩阵论那本虽然是扫描件，但原件是 PNG 无损、压成 JPEG 反而更大，也不要用。
"""
import os
import sys
import time

import pymupdf

def shrink(src: str, dst: str, dpi: int = 120, quality: int = 68) -> None:
    doc = pymupdf.open(src)
    out = pymupdf.open()
    n = len(doc)
    t0 = time.time()
    for i, page in enumerate(doc):
        pix = page.get_pixmap(dpi=dpi, colorspace=pymupdf.csGRAY)
        img = pix.tobytes("jpeg", jpg_quality=quality)
        # 页面尺寸沿用原页（pt），内容用 JPEG 铺满
        newpage = out.new_page(width=page.rect.width, height=page.rect.height)
        newpage.insert_image(newpage.rect, stream=img)
        if (i + 1) % 50 == 0 or i + 1 == n:
            done = (i + 1) / n
            print(f"\r  {i + 1}/{n} 页  {done * 100:5.1f}%  已用 {time.time() - t0:.0f}s", end="", flush=True)
    print()
    out.save(dst, garbage=4, deflate=True)
    out.close()
    doc.close()


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    a, b = sys.argv[1], sys.argv[2]
    d = int(sys.argv[3]) if len(sys.argv) > 3 else 120
    q = int(sys.argv[4]) if len(sys.argv) > 4 else 68
    before = os.path.getsize(a) / 1048576
    shrink(a, b, d, q)
    after = os.path.getsize(b) / 1048576
    print(f"  {os.path.basename(a)}: {before:.1f} MB → {after:.1f} MB"
          f"（省 {(1 - after / before) * 100:.0f}%，{d} DPI 灰度）")
