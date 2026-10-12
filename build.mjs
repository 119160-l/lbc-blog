/* ==========================================================================
   build.mjs —— 把 posts/*.md 编译进 assets/js/posts.js
   用法：node build.mjs
   站点运行时不依赖 Node：内容已内联为 JS，双击 index.html 也能看。
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';

const ROOT  = import.meta.dirname;
const INDEX = path.join(ROOT, 'posts', 'posts.json');
const OUT   = path.join(ROOT, 'assets', 'js', 'posts.js');

if (!fs.existsSync(INDEX)) {
  console.error('找不到 posts/posts.json');
  process.exit(1);
}

/* 统计正文字数（去掉语法符号与代码围栏） */
function plainLen(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*?\$/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s*(?:[#>\-*+]|\d+[.)])\s*/gm, '')
    .replace(/[*_~`|]/g, '')
    .replace(/\s+/g, '')
    .length;
}

const meta = JSON.parse(fs.readFileSync(INDEX, 'utf8'));
const warns = [];

const list = meta.map(item => {
  const file = path.join(ROOT, item.file || '');
  let body = '';
  if (item.file && fs.existsSync(file)) {
    body = fs.readFileSync(file, 'utf8').replace(/^\s*#[ \t]+.*(?:\r?\n|$)/, '').trim();
  } else {
    warns.push(`${item.id}：正文文件不存在（${item.file}）`);
  }
  const chars = plainLen(body);
  return { ...item, chars, minutes: Math.max(1, Math.round(chars / 350)), body };
});

list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

const js =
  '/* 本文件由 build.mjs 自动生成，请勿手改。 */\n' +
  '/* 改内容请编辑 posts/posts.json 与 posts/*.md，然后运行 node build.mjs */\n' +
  'window.BLOG_POSTS = ' + JSON.stringify(list, null, 2) + ';\n';

fs.writeFileSync(OUT, js, 'utf8');

console.log(`编译完成：${list.length} 篇文章 -> assets/js/posts.js`);
const byCat = {};
for (const p of list) byCat[p.category] = (byCat[p.category] || 0) + 1;
for (const [k, v] of Object.entries(byCat)) console.log(`  ${k}：${v} 篇`);
if (warns.length) {
  console.log('\n提醒：');
  warns.forEach(w => console.log('  - ' + w));
}
