/* ==========================================================================
   import.mjs —— 把本地学习资料（Markdown）按文件夹结构导入站点
   用法：node import.mjs

   设计要点
   1. 分类 = 源文件夹结构，不做内容判断：
        课程(course) → 阶段分组(stage) → 章(chapter) → 篇(item)
      章的判定：md 文件所在的那个目录。如果某目录里 ≥6 个 md 且文件名都是
      `NN-` 数字前缀（如 运筹学/知识库/01-绪论.md），则把每个文件提升为一章。
   2. id 由「源文件相对路径」的 sha1 前 6 位决定 → 确定性、可重跑、
      以后新增文件不会让已有链接失效。
   3. 正文单独复制到 posts/<课程>/... 保持原结构（图片相对路径才不会错），
      元数据只写 assets/js/catalog.js，正文由浏览器按需 fetch ——
      两百多篇正文合起来好几 MB，全内联会把首页拖死。
   4. 排除缓存/重复目录（.venv、.obsidian、ima上传包、未命名 等），
      Ogata 教材（47MB 图 + 774 张）刻意不在扫描范围内，另行决定。
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SITE      = import.meta.dirname;
const SRC_ROOT  = '/Users/lbc/Downloads';
const POSTS_DIR = path.join(SITE, 'posts');
const OUT_JS    = path.join(SITE, 'assets', 'js', 'catalog.js');

/* 配图压缩：默认只「缩边到 1400px」，不改格式、不改文件名 ——
   这样 Markdown 里的引用一个字都不用动，零风险。
   加 --jpg 会转成 JPEG q85（体积能再降 3 倍，但需要改写引用、画质有损）。 */
const ARGS     = process.argv.slice(2);
const TO_JPG   = ARGS.includes('--jpg');
const NO_MIN   = ARGS.includes('--no-minify');
const MAX_W    = 1600;

/* ---------------- 课程定义 = 顶层分类 ---------------- */
const COURSES = [
  { key: 'complex', name: '复变函数与积分变换', short: '复变函数', src: '202679/2026720复变函数',
    desc: '三阶段：复变函数基础 → 复变积分理论 → 积分变换（傅里叶 / 拉普拉斯）' },
  { key: 'prob',    name: '概率论与数理统计', short: '概率论', src: '202679/2026727概率论与数理统计',
    desc: '三阶段：概率论基础 → 多维随机变量与极限理论 → 数理统计基础' },
  { key: 'control', name: '自动控制原理', short: '自控', src: '202679/2026808自动控制原理',
    desc: '第 1～17 章：数学模型、时域/根轨迹/频域三大方法、校正设计，延伸到状态空间与机器人' },
  { key: 'matrix',  name: '矩阵论', short: '矩阵论', src: '基础课程/矩阵论',
    desc: '线性空间、范数、矩阵分析、矩阵分解、特征值估计、广义逆、特殊矩阵类' },
  { key: 'or',      name: '运筹学', short: '运筹学', src: '运筹学',
    desc: '14 章知识库：线性规划、对偶与敏感性、运输问题、整数/非线性/动态规划、图与网络、排队论、对策论' }
];

/* ---------------- 排除规则 ---------------- */
const SKIP_DIR = /(^|\/)(\.workbuddy|\.obsidian|\.vscode|\.idea|\.venv|\.tmp-npm-cache|__pycache__|node_modules|\.git|\.trae-html-share-packages|矩阵论_ima上传包|未命名|ipad-macbook-price-guide)(\/|$)/;
const SKIP_FILE = /^(\.DS_Store|LICENSE.*|.*\.(zip|pdf|exe|dmg|app|woff2?|ttf)$)/i;
const IMG_EXT = /\.(png|jpe?g|svg|gif|webp|bmp|avif)$/i;
const MAX_ASSET = 3 * 1024 * 1024;          /* 单张图 >3MB 不搬，避免仓库爆炸 */

/* ---------------- 小工具 ---------------- */
const sha6 = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 6);

function walk(dir, out = []) {
  let ents = [];
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    const rel = path.relative(dir, full);
    if (e.isDirectory()) {
      if (SKIP_DIR.test('/' + rel + '/')) continue;
      walk(full, out);
    } else {
      if (SKIP_FILE.test(e.name)) continue;
      out.push(full);
    }
  }
  return out;
}

function plainLen(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*?\$/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[#>\-*+]|\d+[.)])\s*/gm, '')
    .replace(/[*_~`|]/g, '')
    .replace(/\s+/g, '').length;
}

/* 从正文里取标题与摘要 */
function dig(md) {
  const body = md.replace(/^\uFEFF/, '');
  const lines = body.split('\n');
  let title = '';
  let ti = -1;
  for (let i = 0; i < lines.length && i < 40; i++) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/);
    if (m) { title = m[1].trim(); ti = i; break; }
  }
  let excerpt = '';
  for (let i = ti + 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l || l.startsWith('#') || l.startsWith('>') || l.startsWith('```') ||
        l.startsWith('![') || l.startsWith('|') || l.startsWith('---')) continue;
    excerpt = l
      .replace(/\$\$[\s\S]*?\$\$/g, ' ')
      .replace(/\$[^$]*?\$/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_~`]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (excerpt) break;
  }
  if (excerpt.length > 62) excerpt = excerpt.slice(0, 62) + '…';
  return { title, excerpt };
}

/* 自然排序：第2章 要排在 第10章 前面。
   ⚠️ 坑：直接用 localeCompare(…, 'zh') 会按拼音排，于是
   「第二阶段」排在「第一阶段」前面（er < san < yi），
   所以必须先把中文数字换成阿拉伯数字再比较。 */
const CN = { '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
function cn2num(s) {
  return s.replace(/[一二三四五六七八九十]+/g, (m) => {
    if (m === '十') return '10';
    if (m.includes('十')) {
      const [a, b] = m.split('十');
      return String((a ? (CN[a] || 0) : 1) * 10 + (b ? (CN[b] || 0) : 0));
    }
    return String(CN[m] || m);
  });
}
function natKey(s) {
  return cn2num(String(s)).replace(/\d+/g, (n) => n.padStart(6, '0'));
}
/* 阶段显示优先级：总览 → 第N阶段 → 复习类 → 其他 → 无阶段（汇总/练习题册） */
function stageRank(s) {
  if (s === '总览') return 0;
  if (/^第[一二三四五六七八九十\d]+阶段/.test(s)) return 1;
  if (/复习|冲刺/.test(s)) return 2;
  if (s === '') return 4;
  return 3;
}
function prettyDir(name) {
  return name
    .replace(/^第([一二三四五六七八九十百]+)阶段[-—]?/, '第$1阶段 · ')
    .replace(/^第(\d+)章[-—]?\s*/, '第 $1 章　')
    .replace(/^(\d+)[-\s]+/, '');
}
/* 篇的类别：从文件名推 */
const KIND_WORDS = ['公式推导', '知识讲解', '练习题', '仿真与绘图', '项目实战', '实践项目', '讲解副本', '通俗讲解'];
function kindOf(fileBase, dirBase) {
  let b = fileBase.replace(/\.md$/i, '');
  if (b.toUpperCase() === 'README') {
    return dirBase.replace(/^\d+[-–—]\s*/, '').replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  b = b
    .replace(/^第\d+章[-—]?\s*/, '')
    .replace(/^\d+[-–—]\s*/, '')
    .replace(/^\d+[\s　]+/, '');
  /* 「第N章-xxx-练习题」这类要把尾巴上的类别词认出来，别把章名当类别 */
  for (const w of KIND_WORDS) {
    if (b.endsWith(w)) return w;
  }
  if (!b) b = fileBase.replace(/\.md$/i, '');
  return b;
}

/* 配图压缩：只动「大图」，而且只在结果确实更小的时候才替换。
   实测教训：sips 把 PNG 重新编码成 32 位，1787×659 的 matplotlib 平涂图
   从 40KB 涨到 55KB；批量缩边反而让图片总量从 34.7MB 涨到 38.8MB。
   所以规则收紧为：>300KB 的大图才缩，缩完不更小就还原原图。 */
const MIN_BIG = 300 * 1024;
function shrink(dest, src, size) {
  if (NO_MIN || size < MIN_BIG) return 0;
  try {
    execFileSync('sips', ['-Z', String(MAX_W), dest], { stdio: 'ignore' });
    const after = fs.statSync(dest).size;
    if (after >= size) { fs.copyFileSync(src, dest); return 0; }   /* 没变小 → 还原 */
    return size - after;
  } catch {
    try { fs.copyFileSync(src, dest); } catch {}
    return 0;
  }
}

/* ---------------- 主流程 ---------------- */
fs.mkdirSync(POSTS_DIR, { recursive: true });

const catalog = [];
const summary = [];
let totalBytes = 0, totalAssets = 0, assetBytes = 0, assetSaved = 0;

for (const c of COURSES) {
  const root = path.join(SRC_ROOT, c.src);
  if (!fs.existsSync(root)) { summary.push(`⚠️  跳过 ${c.name}：源目录不存在 ${root}`); continue; }

  const dest = path.join(POSTS_DIR, c.key);
  fs.mkdirSync(dest, { recursive: true });   /* 只建不删：同名文件原地覆盖，重跑安全 */

  const files = walk(root).sort((a, b) => natKey(a).localeCompare(natKey(b), 'zh'));
  const mds = files.filter((f) => /\.md$/i.test(f));

  /* ---------------- 分类推导 ----------------
     源目录的三种常见形态（都要正确落到「阶段 / 章 / 篇」上）：
       A) 阶段/第N章/1-公式推导.md              课程 → 阶段 → 第N章 → 篇
       A2) 阶段/第N章/4-Python可视化/README.md 子目录也是「篇」，名字就叫 Python可视化
       B) 第N章/1-公式推导.md                  没有阶段层，第N章 直接当章（自控 17 章）
       C) 知识库/01-绪论.md                    NN- 数字前缀 ≥6 个 → 每个文件自己成一章
     早先的版本只取目录最后一段当章名，会把三章的「Python可视化」并成同一个组，
     所以这里改成：章 = 阶段下的那一层目录，子目录归到「篇」的命名里。 */
  const CHAPTER_DIR = /^第\s*\d+\s*章/;
  const byDir = new Map();
  for (const f of mds) {
    const d = path.dirname(path.relative(root, f));
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(f);
  }
  const promote = new Map();
  for (const [d, list] of byDir) {
    const bases = list.map((f) => path.basename(f));
    const numbered = bases.filter((b) => /^\d\d[-–—]/.test(b)).length;
    if (list.length >= 6 && numbered >= list.length / 2) promote.set(d, true);
  }

  /* 子目录当「篇名」用；同名子目录里有多个文件时再带上文件名 */
  const subCount = new Map();
  for (const f of mds) {
    const dirRel = path.dirname(path.relative(root, f));
    if (dirRel === '.') continue;
    const segs = dirRel.split('/');
    const sub = segs.length > 2 ? segs[2] : (segs.length > 1 && !CHAPTER_DIR.test(segs[0]) ? segs[1] : '');
    if (!sub) continue;
    const k = dirRel;
    if (!subCount.has(k)) subCount.set(k, {});
    const o = subCount.get(k);
    o[sub] = (o[sub] || 0) + 1;
  }

  const items = [];
  for (const f of mds) {
    const rel = path.relative(root, f);
    const relDir = path.dirname(rel);
    const fileBase = path.basename(f);
    const fileStem = fileBase.replace(/\.md$/i, '');
    const segs = relDir === '.' ? [] : relDir.split('/');

    let stage, chapter, kindRaw;
    const isPromoted = promote.has(relDir);

    if (isPromoted) {
      /* C) 每个文件自己成章 */
      stage = segs.length ? prettyDir(segs[0]) : '总览';
      chapter = prettyDir(fileStem);
      kindRaw = '正文';
    } else if (!segs.length) {
      /* 课程根目录上的文件（学习路线 / 总目录 …） */
      stage = '总览';
      chapter = '总览';
      kindRaw = fileStem;
    } else if (CHAPTER_DIR.test(segs[0])) {
      /* B) 第N章 直接在最外层 */
      stage = '';
      chapter = prettyDir(segs[0]);
      kindRaw = segs.length > 1 ? prettyDir(segs[1]) : kindOf(fileBase, segs[0]);
    } else if (segs.length === 1) {
      /* 单层目录：练习题汇总 / 知识库 / 实践项目 … */
      stage = '';
      chapter = prettyDir(segs[0]);
      kindRaw = kindOf(fileBase, segs[0]);
    } else {
      /* A) 阶段 / 第N章 / [子目录] */
      stage = prettyDir(segs[0]);
      chapter = prettyDir(segs[1]);
      if (segs.length > 2) {
        const sub = prettyDir(segs[2]);
        kindRaw = (subCount.get(relDir) || {})[sub] > 1 ? sub + ' · ' + fileStem : sub;
      } else {
        kindRaw = kindOf(fileBase, segs[1]);
      }
    }

    const md = fs.readFileSync(f, 'utf8');
    const { title, excerpt } = dig(md);

    const st = fs.statSync(f);
    const id = c.key + '-' + sha6(c.key + '/' + rel);
    const relOut = 'posts/' + c.key + '/' + rel.split(path.sep).join('/');

    const outPath = path.join(SITE, relOut);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.copyFileSync(f, outPath);
    totalBytes += Buffer.byteLength(md, 'utf8');

    const chars = plainLen(md);
    items.push({
      id,
      n: 0,
      title: title || (chapter + ' · ' + kindRaw),
      course: c.key,
      stage,
      chapter,
      kind: kindRaw,
      kindFull: kindRaw,
      date: st.mtime.toISOString().slice(0, 10),
      chars,
      minutes: Math.max(1, Math.round(chars / 350)),
      excerpt: excerpt || '',
      file: relOut,
      co: COURSES.indexOf(c)                  /* 课程顺序 */
    });
  }

  /* 同一章里出现重名「篇」（比如 练习题汇总 下 12 个都叫「练习题」）时，
     改用更具体的名字，否则一排按钮长得一模一样没法点 */
  const seen = new Map();
  for (const it of items) {
    const k = it.stage + '||' + it.chapter + '||' + it.kind;
    seen.set(k, (seen.get(k) || 0) + 1);
  }
  for (const it of items) {
    const k = it.stage + '||' + it.chapter + '||' + it.kind;
    if (seen.get(k) > 1 && it.kindFull === it.kind) {
      const stem = it.file.split('/').pop().replace(/\.md$/i, '');
      let specific = stem
        .replace(/^第\d+章[-—]?\s*/, '')
        .replace(/[-–—](练习题|知识讲解|公式推导|仿真与绘图)$/, '')
        .replace(/^\d+[-–—]\s*/, '');
      if (/^第\d+章/.test(stem)) specific = stem.replace(/^(第\d+章)[-—]?\s*/, '$1 ')
        .replace(/[-–—](练习题|知识讲解|公式推导|仿真与绘图)$/, '');
      it.kind = prettyDir(specific) || it.kind;
      if (it.kind === it.kindFull) it.kind = it.kindFull + ' ' + (items.indexOf(it) + 1);
    }
  }

  /* 配图等静态资源：按原相对路径搬过去（默认只缩边） */
  for (const f of files) {
    if (/\.md$/i.test(f)) continue;
    const rel = path.relative(root, f);
    if (!IMG_EXT.test(rel)) continue;
    const size = fs.statSync(f).size;
    if (size > MAX_ASSET) continue;
    const out = path.join(POSTS_DIR, c.key, rel);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.copyFileSync(f, out);
    const before = fs.statSync(out).size;
    const saved = shrink(out, f, before);
    totalAssets++; assetBytes += (before - saved); assetSaved += saved;
  }

  const chapters = new Set(items.map((i) => i.stage + '||' + i.chapter));
  catalog.push(...items);
  summary.push(`${c.name}：${items.length} 篇 / ${chapters.size} 章 / ${items.filter(i => i.stage === '总览').length} 篇总览`);
}

/* 课程汇总信息已移到排序之后生成 */

/* 顺序：课程 → 阶段优先级 → 文件原始路径的自然序。
   用「原始路径」当章/篇的排序键，是因为 prettyDir 已经把 `01-` `第1章-` 这类
   前缀洗干净了，拿洗过的名字排序会丢掉文件夹里的编号顺序
   （运筹学 知识库 就会排出 决策分析 / 动态规划 / 图与网络分析 这种乱序）。 */
catalog.sort((a, b) =>
  a.co - b.co ||
  stageRank(a.stage) - stageRank(b.stage) ||
  natKey(a.file).localeCompare(natKey(b.file)));

const seq = {};
for (const it of catalog) { delete it.kindFull; delete it.co; seq[it.course] = (seq[it.course] || 0) + 1; it.n = seq[it.course]; }

/* 课程汇总信息（首页直接用，免得前端再算一遍）—— 必须在排序之后算 */
const courses = COURSES.map((c) => {
  const mine = catalog.filter((i) => i.course === c.key);
  if (!mine.length) return null;
  const chapters = new Set(mine.map((i) => i.stage + '||' + i.chapter));
  const stages = [];
  for (const i of mine) if (!stages.includes(i.stage)) stages.push(i.stage);
  const dates = mine.map((i) => i.date).sort();
  return {
    key: c.key, name: c.name, short: c.short, desc: c.desc,
    items: mine.length,
    chapters: chapters.size,
    stages,
    updated: dates[dates.length - 1] || '',
    chars: mine.reduce((a, b) => a + b.chars, 0)
  };
}).filter(Boolean);

const js =
  '/* 本文件由 import.mjs 自动生成，请勿手改。 */\n' +
  '/* 改内容请编辑源目录里的 Markdown，然后运行 node import.mjs */\n' +
  'window.BLOG_SECTIONS = ' + JSON.stringify([
    /* 首页只渲染这一层。以后要加板块，在这里加一条就行：
       href 给「点进去之后」的页面地址；open:false 表示还没内容，卡片显示「敬请期待」不可点 */
    { key: 'study', name: '学习资料', desc: '课程笔记、公式推导、练习题与仿真代码，按「课程 → 阶段 → 章 → 篇」归档',
      href: 'library.html', open: true,  icon: 'book', tone: 'blue' },
    { key: 'essay', name: '生活随笔', desc: '随手记录，想到什么写什么',
      href: 'essay.html',  open: false, icon: 'pen',  tone: 'warm' }
  ]) + ';\n' +
  'window.BLOG_COURSES = ' + JSON.stringify(courses) + ';\n' +
  'window.BLOG_POSTS = ' + JSON.stringify(catalog) + ';\n';

fs.writeFileSync(OUT_JS, js, 'utf8');

/* ---------------- 汇报 ---------------- */
console.log('导入完成');
console.log('─'.repeat(60));
summary.forEach((s) => console.log('  ' + s));
console.log('─'.repeat(60));
console.log(`合计：${catalog.length} 篇 / ${courses.length} 门课 / 正文 ${(totalBytes / 1024 / 1024).toFixed(1)} MB / 配图 ${totalAssets} 张 ${(assetBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`元数据：assets/js/catalog.js ${(fs.statSync(OUT_JS).size / 1024).toFixed(0)} KB`);
const kinds = {};
for (const i of catalog) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
const top = Object.entries(kinds).sort((a, b) => b[1] - a[1]).slice(0, 10);
console.log('篇目类型：' + top.map(([k, v]) => `${k} ${v}`).join('｜') + (Object.keys(kinds).length > 10 ? `｜…共 ${Object.keys(kinds).length} 种` : ''));
if (assetSaved) console.log(`配图缩边省下：${(assetSaved / 1024 / 1024).toFixed(1)} MB`);
