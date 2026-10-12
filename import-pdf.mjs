/* ==========================================================================
   import-pdf.mjs —— 把本地 PDF 教材/资料复制进站点并生成 assets/js/files.js

   用法：node import-pdf.mjs [--no-copy]
     --no-copy   只重新生成 files.js，不复制 PDF（改元数据时用）

   和 import.mjs 是两件事：那一个管 Markdown 正文，这一个管 PDF 附件。
   PDF 统一放进 files/，并且**不提交 git**（见 .gitignore），
   免得仓库被几百 MB 的扫描件撑爆；发布时整目录上传，线上照样能下。

   带 pre 标记的条目（两本大部头扫描件）不由这里复制 ——
   它们要先用 pdf-shrink.py 压到 files/ 里，这里只负责登记。
   缺少压缩版时会提示怎么生成，不会拿 129 MB 的原件顶上去。
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const SRC = '/Users/lbc/Downloads';
/* 站点根目录写成绝对路径，**不要**用相对路径或 process.cwd()：
   WorkBuddy 的沙盒会把工作目录报成 /Users/lbc/Workbuddy/…（b 小写），
   而真实目录是 WorkBuddy，按字面比对会直接 EACCES 拒绝拷贝。 */
const ROOT = '/Users/lbc/WorkBuddy/Claw/lbc-blog';
const OUT = path.join(ROOT, 'assets/js/files.js');
const FILE_DIR = path.join(ROOT, 'files');
/* 写进 files.js 的必须是**相对**路径，网页上的 href 直接用 */
const REL_DIR = 'files';
const NO_COPY = process.argv.includes('--no-copy');

/* course 对应 catalog 里的课程 key；空串表示「基础/跨课程」 */
const PDFS = [
  {
    slug: 'husongsong-autocontrol-7ed',
    title: '自动控制原理（第七版）',
    sub: '胡寿松',
    course: 'control',
    tag: '教材',
    src: '基础课程/自动控制原理/自动控制原理（第七版） (胡寿松) (z-library.sk, 1lib.sk, z-lib.sk).pdf',
    pre: true,
    note: '扫描版 680 页，已压至 120 DPI 灰度便于在网页上读'
  },
  {
    slug: 'ogata-modern-control-2010',
    title: 'Modern Control Engineering',
    sub: 'Katsuhiko Ogata, 2010',
    course: 'control',
    tag: '教材',
    src: '202679/自控圣经/Ogata2010.pdf'
  },
  {
    slug: 'chengyunpeng-matrix-theory-3ed',
    title: '矩阵论（第 3 版）',
    sub: '程云鹏 · 张凯院 · 徐仲',
    course: 'matrix',
    tag: '教材',
    src: '基础课程/矩阵论/矩阵论（第3版） (程云鹏,张凯院,徐仲) (z-library.sk, 1lib.sk, z-lib.sk).pdf'
  },
  {
    slug: 'or-textbook-5ed',
    title: '运筹学（本科版 · 第 5 版）',
    sub: '《运筹学》教材编写组',
    course: 'or',
    tag: '教材',
    src: '基础课程/运筹学/运筹学本科版(第5版) (《运筹学》教材编写组) (z-library.sk, 1lib.sk, z-lib.sk).pdf',
    pre: true,
    note: '扫描版 394 页，已压至 120 DPI 灰度便于在网页上读'
  },
  {
    slug: 'or-chapter1-sample',
    title: '运筹学 · 第 1 章 绪论',
    sub: '清华社官方免费样章',
    course: 'or',
    tag: '样章',
    src: '运筹学/第1章 绪论（清华社官方免费样章）.pdf'
  },
  {
    slug: 'ode-dynamical-systems-zh',
    title: '常微分方程与动力系统（中文版）',
    sub: '金成桴 译 · 机械工业出版社 2011',
    course: '',
    tag: '参考书',
    src: '基础课程/常微分方程与动力系统_中文版_金成桴译_机械工业出版社2011.pdf'
  },
  {
    slug: 'ode-dynamical-systems-teschl',
    title: 'Ordinary Differential Equations and Dynamical Systems',
    sub: 'Gerald Teschl',
    course: '',
    tag: '参考书',
    src: '基础课程/Ordinary Differential Equations and Dynamical Systems.pdf'
  },
  {
    slug: 'linear-systems-primer',
    title: 'A Linear Systems Primer',
    sub: 'Antsaklis & Michel',
    course: '',
    tag: '参考书',
    src: '基础课程/[Panos_J_Antsaklis,_Anthony_N._Michel]_Linear Systems Primer.pdf'
  },
  {
    slug: 'linear-systems-primer-ch1-bilingual',
    title: 'A Linear Systems Primer · 第 1 章 中英对照',
    sub: '自制对照版',
    course: '',
    tag: '中英对照',
    src: '基础课程/Linear Systems Primer 第1章 中文版/A Linear Systems Primer 第1章 中英对照.pdf'
  }
];

/* 用 PyMuPDF 读页数；读不到就留空，不影响下载 */
function pageCount(p) {
  try {
    const out = execFileSync(process.env.HOME + '/.workbuddy/binaries/python/envs/default/bin/python',
      ['-c', 'import pymupdf,sys;print(len(pymupdf.open(sys.argv[1])))', p],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    return Number(out) || 0;
  } catch { return 0; }
}

const list = [];
let copied = 0, bytes = 0;
if (!fs.existsSync(FILE_DIR)) fs.mkdirSync(FILE_DIR, { recursive: true });

for (const it of PDFS) {
  const name = it.slug + '.pdf';
  const to = path.join(FILE_DIR, name);
  let size;

  if (it.pre) {
    /* 大部头扫描件：pdf-shrink.py 已经直接产到 files/ 了，这里不覆盖它 */
    if (!fs.existsSync(to)) {
      console.warn(`  ⚠ 缺少压缩版 ${name}，先生成：\n` +
        `     python3 pdf-shrink.py "${path.join(SRC, it.src)}" ${to}`);
      continue;
    }
    size = fs.statSync(to).size;
  } else {
    const from = path.join(SRC, it.src);
    if (!fs.existsSync(from)) { console.warn('  跳过（源文件不存在）：' + it.src); continue; }
    if (!NO_COPY) {
      /* 有些源 PDF 本身是只读的，copyFileSync 会把 444 一起带过来，
         下次想覆盖就 EACCES（沙盒里报成笼统的 permission denied）。
         先放开权限，复制完再统一设成 644。 */
      if (fs.existsSync(to)) { try { fs.chmodSync(to, 0o644); } catch { /* 无视 */ } }
      const before = fs.existsSync(to) ? fs.statSync(to).size : -1;
      fs.copyFileSync(from, to);
      try { fs.chmodSync(to, 0o644); } catch { /* 无视 */ }
      if (before !== fs.statSync(to).size) copied++;
    }
    size = fs.statSync(to).size;
  }

  const pages = pageCount(to);
  bytes += size;

  list.push({
    id: 'f-' + it.slug,
    title: it.title,
    sub: it.sub,
    course: it.course,
    tag: it.tag,
    file: REL_DIR + '/' + name,
    size,
    pages,
    note: it.note || ''
  });
  console.log(`  ${(size / 1048576).toFixed(1).padStart(7)} MB  ${String(pages).padStart(4)} 页  ${it.title}`);
}

list.sort((a, b) => (a.course ? 0 : 1) - (b.course ? 0 : 1) || b.size - a.size);

const js =
  '/* 本文件由 import-pdf.mjs 自动生成，请勿手改。 */\n' +
  '/* 改 PDF 清单请编辑 import-pdf.mjs，然后运行 node import-pdf.mjs */\n' +
  'window.BLOG_FILES = ' + JSON.stringify(list) + ';\n';
fs.writeFileSync(OUT, js);

console.log(`\n共 ${list.length} 个 PDF，合计 ${(bytes / 1048576).toFixed(1)} MB` +
  (NO_COPY ? '（未复制文件）' : `，新复制 ${copied} 个`));
console.log('已写入 ' + OUT + `（${(js.length / 1024).toFixed(1)} KB）`);
