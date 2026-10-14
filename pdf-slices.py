#!/usr/bin/env python3
"""
pdf-slices.py —— 把大部头扫描教材切成「按页小图」，给网页做一个自己翻页的阅读器

为什么需要它（2026-10-13 实测）：
  手机端反馈「点教材打不开、还是变成下载」。查下来不是站点的问题，是浏览器的问题 ——
  国产浏览器 / 微信内置浏览器经常不给 iframe 里的 PDF 渲染，有的干脆把 PDF 拦截成下载；
  就算能渲染，63 MB 的扫描件在移动网络上也要先啃完整个文件才有第一页。
  预切成按页 WebP 之后：
    · 每翻一页只传几十 KB，秒开，且手机上不费流量；
    · 不依赖浏览器任何 PDF 能力 —— 图片谁都会显示；
    · 关掉就释放，不会占住几十 MB 内存。

只切「大部头」：体积 ≥ MIN_MB 的才切（矢量小 PDF 用 iframe 直接读，秒开，不必切）。
小文件切了纯亏：既占空间，又丢了「可选中搜索、能复制公式」的好处。

用法（依赖：pymupdf + pillow）：
  python3 pdf-slices.py sample          # 抽样测量各参数的体积，不落盘到站点
  python3 pdf-slices.py all             # 全量生成，并写 assets/js/slices.js
  python3 pdf-slices.py all 900 55      # 指定页宽(px)与 WebP 质量
  python3 pdf-slices.py list            # 看看哪些文件会被切、切多少页

产物：
  files/slices/<教材id>/p0001.webp ...
  assets/js/slices.js                  # window.BLOG_SLICES = { id: {dir, ext, pages, w, h} }

可重复执行：已存在的页会跳过（断点续跑友好）。参数变了想重来，加 --force。
"""
import json
import os
import re
import sys
import time

ROOT = '/Users/lbc/Workbuddy/Claw/lbc-blog'
FILES_JS = os.path.join(ROOT, 'assets/js/files.js')
SLICES_JS = os.path.join(ROOT, 'assets/js/slices.js')

MIN_MB = 15.0        # 只切这个体积以上的
TARGET_W = 1000      # 渲染页宽（px）。手机竖屏约 393 CSS px，1000px 兼顾清晰与体积
WEBP_Q = 58
WEBP_METHOD = 4


def load_books():
    """从 files.js 里读出教材清单（别手抄一份，源头只能是它）"""
    src = open(FILES_JS, encoding='utf-8').read()
    m = re.search(r'window\.BLOG_FILES\s*=\s*(\[[\s\S]*?\]);', src)
    if not m:
        raise SystemExit('files.js 里没解析出 BLOG_FILES，脚本需要更新')
    return json.loads(m.group(1))


def targets(books, min_mb=None):
    """min_mb 不给默认参数、调用时再读全局，--min-mb 开关才生效"""
    if min_mb is None:
        min_mb = MIN_MB
    out = []
    for b in books:
        size_mb = (b.get('size') or 0) / 1048576
        if size_mb >= min_mb:
            out.append((b, size_mb))
    return out

def page_pix(pymupdf, page, target_w):
    """按目标页宽渲染灰度图（扫描件本来就是黑白，灰度不丢信息、体积减半）"""
    rect = page.rect
    zoom = target_w / max(rect.width, 1)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom),
                          colorspace=pymupdf.csGRAY, alpha=False)
    return pix


def to_webp(pix, PILImage, path, q, method):
    img = PILImage.frombytes('L', (pix.width, pix.height), pix.samples)
    img.save(path, 'WEBP', quality=q, method=method)
    return img.width, img.height


def do_sample(books):
    """抽样测量：几个参数组合各取几页，报平均体积，并把样本页写到 /tmp 供肉眼核对"""
    from PIL import Image
    import pymupdf
    combos = [(900, 55), (1000, 58), (1100, 62)]
    sel = targets(books)
    if not sel:
        print('没有超过阈值的文件，无需处理')
        return
    for b, size_mb in sel:
        src = os.path.join(ROOT, b['file'])
        doc = pymupdf.open(src)
        n = len(doc)
        probes = sorted({1, max(2, n // 3), max(3, 2 * n // 3), n})
        print(f"\n{b['title']}（{b['file']} {size_mb:.1f}MB / {n} 页）")
        for w, q in combos:
            tot = 0
            cnt = 0
            dims = None
            for pno in probes:
                pix = page_pix(pymupdf, doc[pno - 1], w)
                img = Image.frombytes('L', (pix.width, pix.height), pix.samples)
                tmp = f'/tmp/slice-probe-{b["id"]}-{w}-{q}-{pno}.webp'
                img.save(tmp, 'WEBP', quality=q, method=WEBP_METHOD)
                tot += os.path.getsize(tmp)
                cnt += 1
                dims = img.size
            avg = tot / cnt / 1024
            print(f"  {w}px q{q}: 平均 {avg:6.1f} KB/页  → 全书约 {avg * n / 1024:5.1f} MB"
                  f"（{dims[0]}×{dims[1]}）")
            # 留一张 1000px 的 PNG 样本给自己肉眼核对清晰度
            if w == 1000:
                keep = f'/tmp/slice-sample-{b["id"]}.png'
                pix = page_pix(pymupdf, doc[probes[1] - 1], 1000)
                img = Image.frombytes('L', (pix.width, pix.height), pix.samples)
                img.save(keep, 'PNG')
                print(f'  样本页（自己看一眼清晰度）：{keep}')
        doc.close()


def do_all(books, target_w, q, force=False):
    from PIL import Image
    import pymupdf
    sel = targets(books)
    manifest = {}
    if os.path.exists(SLICES_JS):
        old = open(SLICES_JS, encoding='utf-8').read()
        m = re.search(r'window\.BLOG_SLICES\s*=\s*(\{[\s\S]*?\});', old)
        if m:
            manifest = json.loads(m.group(1))
    t0 = time.time()
    for b, size_mb in sel:
        src = os.path.join(ROOT, b['file'])
        out_dir = os.path.join(ROOT, 'files/slices', b['id'])
        os.makedirs(out_dir, exist_ok=True)
        doc = pymupdf.open(src)
        n = len(doc)
        made = 0
        for i in range(n):
            path = os.path.join(out_dir, 'p%04d.webp' % (i + 1))
            if not force and os.path.exists(path) and os.path.getsize(path) > 0:
                made += 1
                continue
            pix = page_pix(pymupdf, doc[i], target_w)
            img = Image.frombytes('L', (pix.width, pix.height), pix.samples)
            img.save(path, 'WEBP', quality=q, method=WEBP_METHOD)
            made += 1
            if made % 50 == 0 or made == n:
                print(f'\r  {b["title"][:16]:18s} {made}/{n} 页  {time.time() - t0:5.0f}s',
                      end='', flush=True)
        print()
        # 量一下实际体积 + 尺寸
        total = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir))
        last = Image.open(os.path.join(out_dir, 'p%04d.webp' % n))
        manifest[b['id']] = {
            'dir': 'files/slices/%s' % b['id'],
            'ext': 'webp',
            'pages': n,
            'w': last.size[0],
            'h': last.size[1],
        }
        print(f'  → {made} 页，{total / 1048576:.1f} MB，{last.size[0]}×{last.size[1]}')
        doc.close()
    with open(SLICES_JS, 'w', encoding='utf-8') as fh:
        fh.write('/* 由 pdf-slices.py 生成，请勿手改：改参数后重跑脚本 */\n')
        fh.write('window.BLOG_SLICES = ' + json.dumps(manifest, ensure_ascii=False, indent=2) + ';\n')
    print(f'\n清单已写：{SLICES_JS}')
    print(f'切完总耗时 {time.time() - t0:.0f}s')


if __name__ == '__main__':
    args = sys.argv[1:]
    cmd = args[0] if args else 'sample'
    # 全局开关：--min-mb=0 表示「全部都切」（矢量小 PDF 也切）
    for a in list(args):
        if a.startswith('--min-mb='):
            MIN_MB = float(a.split('=', 1)[1])
            args.remove(a)
    books = load_books()
    if cmd == 'list':
        print('会被切的文件（≥ %.0f MB）：' % MIN_MB)
        for b, s in targets(books):
            print(f'  {s:6.1f} MB  {b["pages"]:>4} 页  {b["title"]}')
        print('不会切的：')
        for b in books:
            if (b.get('size') or 0) / 1048576 < MIN_MB:
                print(f'  {(b.get("size") or 0) / 1048576:6.1f} MB  {b.get("pages"):>4} 页  {b["title"]}')
    elif cmd == 'sample':
        do_sample(books)
    elif cmd == 'all':
        w = int(args[1]) if len(args) > 1 else TARGET_W
        q = int(args[2]) if len(args) > 2 else WEBP_Q
        force = '--force' in args
        TARGET_W = w
        do_all(books, w, q, force)
    else:
        print(__doc__)
        sys.exit(1)
