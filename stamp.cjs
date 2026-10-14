/* ==========================================================================
   stamp.cjs —— 给资源 URL 打「版本戳」，解决发布后手机/浏览器仍用旧 JS 的问题

   为什么要它：平台的静态服务没给 Cache-Control/ETag，浏览器会按 Last-Modified
   启发式缓存 assets/js/*.css；资源 URL 又不带版本参数。结果就是：发布成功了，
   手机打开却还是老代码（老阅读层 → 表现为"点教材就下载"这类已修问题复发）。

   做法：拿 assets/ 下所有文件的最新 mtime + 文件数算一个 8 位 hash，
        写进所有 HTML 里 assets/ 开头的 src/href（形如 ?v=6ff321d6）。
        资源没动 → 戳不变（不会白白让所有人重下）；资源一动 → 戳变，全站强制刷新。

   用法：
     node stamp.cjs            # 重新盖章
     node stamp.cjs --check    # 只检查（发布前校验用，戳过期就 exit 1）

   check-site.cjs 直接 require 本文件复算同一个戳，所以算法只能写这一份 ——
   两处各写一遍迟早会分叉，届时校验会一直报"过期"或一直报"通过"，都是假信号。
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const HTMLS = ['index.html', 'library.html', 'course.html', 'archive.html', 'about.html', 'article.html'];

/* 遍历 assets/ 下所有文件，取最新 mtime 与文件数 —— 内容变了戳就变 */
function walk(dir, acc) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else {
      acc.n += 1;
      if (st.mtimeMs > acc.newest) acc.newest = st.mtimeMs;
    }
  }
  return acc;
}

function computeStamp(root) {
  const acc = walk(path.join(root || ROOT, 'assets'), { newest: 0, n: 0 });
  const s = Math.floor(acc.newest / 1000) + ':' + acc.n;
  let h = 5381, h2 = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  for (let i = 0; i < s.length; i++) h2 = ((h2 * 33) ^ s.charCodeAt(s.length - 1 - i)) >>> 0;
  return (h.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).slice(0, 8);
}

function stampHtml(html, stamp) {
  let touched = 0;
  const out = html.replace(
    /((?:src|href)="assets\/[^"?#]+)(\?v=[0-9a-f]+)?(")/g,
    (m, head, old, tail) => {
      if (old === `?v=${stamp}`) return m;
      touched += 1;
      return `${head}?v=${stamp}${tail}`;
    }
  );
  return { out, touched };
}

module.exports = { ROOT, HTMLS, computeStamp, stampHtml };

if (require.main === module) {
  const stamp = computeStamp(ROOT);
  const check = process.argv.includes('--check');
  const problems = [];
  let touched = 0;

  for (const f of HTMLS) {
    const file = path.join(ROOT, f);
    if (!fs.existsSync(file)) { problems.push(`${f} 不存在`); continue; }
    const before = fs.readFileSync(file, 'utf8');
    const r = stampHtml(before, stamp);
    touched += r.touched;
    if (r.out === before) continue;
    if (check) problems.push(`${f} 的资源 URL 版本戳不是 ${stamp}`);
    else fs.writeFileSync(file, r.out, 'utf8');
  }

  if (check) {
    if (problems.length) {
      console.error('❌ 资源戳过期，请先运行 node stamp.cjs：\n - ' + problems.join('\n - '));
      process.exit(1);
    }
    console.log(`✅ 资源版本戳一致：v=${stamp}`);
  } else {
    console.log(`已盖章 v=${stamp}，更新 ${touched} 处资源引用`);
  }
}