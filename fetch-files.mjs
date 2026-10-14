/* ==========================================================================
   fetch-files.mjs —— 从线上站点把 files/ 里的 PDF 拉回本地

   为什么存在：
     files/（9 份 PDF，约 360 MB）被 .gitignore 排除，GitHub 上没有；
     本地为了省空间可以删掉它（`rm -rf files`），线上站点是权威副本。
     但**发布是把整个本地目录打包上传的**，files/ 空着发布会让线上那 9 个
     PDF 链接全部 404 —— 所以发布前先跑一次本脚本把 PDF 取回来。

   用法：
     node fetch-files.mjs                 # 只补缺失的文件
     node fetch-files.mjs --force         # 全部重新下载
     node fetch-files.mjs --only=matrix   # 只下文件名含 matrix 的

   清单来自 assets/js/files.js（由 import-pdf.mjs 生成），不手写列表。
   ========================================================================== */

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ORIGIN = 'https://zhixing-notes-28282.app.workbuddy.host';

const force = process.argv.includes('--force');
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const only = onlyArg ? onlyArg.slice('--only='.length) : '';

/* files.js 是浏览器脚本，用一个假的 window 跑一遍取出清单 */
const box = { window: {} };
vm.createContext(box);
vm.runInContext(readFileSync(join(ROOT, 'assets', 'js', 'files.js'), 'utf8'), box, {
  filename: 'assets/js/files.js',
});
const list = box.window.BLOG_FILES || [];
if (!list.length) {
  console.error('assets/js/files.js 里没有 BLOG_FILES，先跑 node import-pdf.mjs');
  process.exit(1);
}

const human = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB');

let got = 0;
let skipped = 0;
let failed = 0;

for (const f of list) {
  if (only && !f.file.includes(only)) continue;

  const dest = join(ROOT, f.file);
  if (!force && existsSync(dest) && statSync(dest).size === f.size) {
    skipped++;
    console.log(`跳过  ${f.file}  （已存在且大小一致）`);
    continue;
  }

  mkdirSync(dirname(dest), { recursive: true });
  const url = ORIGIN + '/' + f.file.split('/').map(encodeURIComponent).join('/');
  process.stdout.write(`下载  ${f.file}  (${human(f.size)}) … `);

  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const buf = Buffer.from(await res.arrayBuffer());

    /* 大小对不上就说明拿到的是错误页 / 半截文件，别写盘 */
    if (buf.length !== f.size) {
      throw new Error(`大小不符，期望 ${f.size}，实得 ${buf.length}`);
    }
    writeFileSync(dest, buf);
    const md5 = createHash('md5').update(buf).digest('hex');
    got++;
    console.log(`完成  md5=${md5.slice(0, 8)}`);
  } catch (e) {
    failed++;
    console.log('失败  ' + e.message);
  }
}

console.log(`\n新下载 ${got} 份，跳过 ${skipped} 份，失败 ${failed} 份`);
if (failed) {
  console.error('有文件没取回来，**先别发布**（线上现有的 PDF 会被空目录覆盖掉）。');
  process.exit(1);
}
