/* ==========================================================================
   check-site.cjs —— 发布前的整页回归校验（70 项断言）

   用法：
     /Users/lbc/.workbuddy/binaries/node/versions/22.22.2-6/bin/node check-site.cjs
     通过时输出「✅ 全部通过（N 项）」，失败时逐条列出并 exit 1。

   覆盖：
     1. 首页只放两个板块入口（学习资料可点 / 生活随笔锁定 + 敬请期待、无科目卡片、无搜索框）
     2. 学习资料页 5 个科目卡 + 搜索框 + 9 条教材
     3. 课文区：整行可点 → 阅读层（iframe src、标题、页数、锁滚动、地址栏 #read=）
     4. 阅读层三种关闭方式 + 点「下载」不误开层 + Enter 可开
     5. #read=<id> 直链自动进阅读层
     6. 课程页只列本课 PDF，且不预加载 iframe
     7. 9 秒未加载出来的兜底按钮
     8. 预检只认铁证：4xx/返回网页才降级；fetch 直接失败不误杀（保留 iframe 等超时兜底）
     9. 矩阵论两篇知识讲解的 7 张配图全部落地（src 存在 / loading=lazy / alt 未被污染）
    10. 小屏与触屏适配：safe-area、降级面板操作行、pointer:coarse、触屏超时更短
    11. 触屏可读性：默认 #zoom=140 可读字号（不用 FitH）、横屏全屏按钮、提示语、桌面不变

   关键实现说明（别改成别的写法，会静默失效）：
     - jsdom 30 不再执行外链 <script src>，所以这里把脚本正文**内联**进 HTML 再交给 jsdom；
       文件缺失会插一条注释并记成失败，避免「页面没渲染」被误读成断言写错。
     - 站点取正文用的是相对地址 fetch('posts/x.md')，打桩时必须先 `new w.URL(u, 'https://site.local/')`，
       否则会漏掉并退到 Node 原生 fetch → 一律 404。
     - loadPage 第三参 fetchMode 模拟阅读层预检的三种判死（reject / 404 / html），
       只在 library.html 上生效（该页启动零 fetch，唯一 fetch 就是预检）。
   ========================================================================== */
/* 发布前整页校验：把 <script src> 内联进 HTML 再交给 jsdom（jsdom 30 不再执行外链脚本） */
const fs = require('fs');
const path = require('path');
const ROOT = '/Users/lbc/Workbuddy/Claw/lbc-blog';
const { JSDOM, VirtualConsole } = require('/Users/lbc/.workbuddy/binaries/node/workspace/node_modules/jsdom');

const problems = [];
let checks = 0;
function ok() { checks++; }
function bad(name, detail) { checks++; problems.push(name + (detail ? ' —— ' + detail : '')); }
function assert(cond, name, detail) { cond ? ok() : bad(name, detail); }

function inlineScripts(html, noSlices) {
  const missing = [];
  const out = html.replace(/<script\s+src="([^"]+)"([^>]*)><\/script>/g, (m, src, rest) => {
    if (/^https?:/.test(src)) return m;
    const clean = src.split('?')[0];           /* 资源 URL 现在带 ?v= 版本戳 */
    const p = path.join(ROOT, clean);
    if (!fs.existsSync(p)) { missing.push(src); return `<!-- 缺文件：${src} -->`; }
    /* noSlices：把切片清单换成空的，用来测「没有切片时走 iframe」那条分支 */
    const body = (noSlices && /slices\.js$/.test(clean))
      ? 'window.BLOG_SLICES = {};'
      : fs.readFileSync(p, 'utf8').replace(/<\/script/gi, '<\\/script');
    return `<script${rest}>${body}</script>`;
  });
  return { html: out, missing };
}

async function loadPage(rel, urlOverride, opts) {
  const o = (typeof opts === 'string') ? { fetchMode: opts } : (opts || {});
  const fetchMode = o.fetchMode;
  const touch = !!o.touch;
  const html = fs.readFileSync(path.join(ROOT, rel.split('?')[0]), 'utf8');
  const { html: inlined, missing } = inlineScripts(html, !!o.noSlices);
  const url = 'https://site.local/' + (urlOverride || rel);
  const vc = new VirtualConsole();
  vc.on('jsdomError', () => { });   /* 点 <a download> 会报「not implemented: navigation」，忽略 */
  const dom = new JSDOM(inlined, {
    url, runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) {
      /* opts.touch：模拟手机（pointer:coarse + maxTouchPoints） */
      w.matchMedia = (q) => ({
        matches: touch && /coarse/.test(String(q)),
        addListener() { }, removeListener() { }, addEventListener() { }, removeEventListener() { },
      });
      try {
        Object.defineProperty(w.navigator, 'maxTouchPoints', { get: () => (touch ? 5 : 0), configurable: true });
      } catch (e) { }
      const of = w.fetch;
      w.fetch = function (u) {
        /* fetchMode：模拟阅读层预检判死的三种输入 */
        if (fetchMode === 'reject') return Promise.reject(new w.TypeError('Failed to fetch'));
        if (fetchMode === '404') return Promise.resolve({ ok: false, status: 404, headers: { get: () => 'text/html' }, text: () => Promise.resolve('') });
        if (fetchMode === 'html') return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'text/html' }, text: () => Promise.resolve('<html></html>') });
        let s = null;
        try { s = new w.URL(String(u), 'https://site.local/'); } catch (e) { }
        if (s && s.host === 'site.local') {
          const p = path.join(ROOT, decodeURIComponent(s.pathname.replace(/^\//, '')));
          return fs.existsSync(p)
            ? Promise.resolve({
              ok: true, status: 200,
              headers: { get: (h) => String(h).toLowerCase() === 'content-type' ? 'application/pdf' : null },
              text: () => Promise.resolve(fs.readFileSync(p, 'utf8')),
            })
            : Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
        }
        if (of) return of.apply(this, arguments);
        return Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') });
      };
      if (w.HTMLCanvasElement) w.HTMLCanvasElement.prototype.getContext = () => null;
    }
  });
  await new Promise((res) => {
    if (dom.window.document.readyState === 'complete') return res();
    dom.window.addEventListener('load', res);
    setTimeout(res, 2500);
  });
  await new Promise((r) => setTimeout(r, 500));
  if (missing.length) bad(`${rel} 脚本缺失`, missing.join(', '));
  return { w: dom.window, d: dom.window.document };
}

const fire = (w, el, type, init) => el.dispatchEvent(new w.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true }, init)));

/* 大教材走「按页图」阅读器（不碰 iframe）。现在 9 本全有切片，所以测 iframe 分支时
   要用 { noSlices: true } 加载（把切片清单换成空的），并按**页面运行时的**清单挑书。 */
function iframeRow(d) {
  const map = (d.defaultView && d.defaultView.BLOG_SLICES) || {};
  const r = [...d.querySelectorAll('#main .dl-row')].find((x) => !map[x.getAttribute('data-fid')]);
  if (!r) throw new Error('页面上找不到没切片的教材，iframe 分支没法测');
  return r;
}

(async () => {
  /* ---------- 1. 首页 ---------- */
  {
    const { d } = await loadPage('index.html');
    const brand = (d.querySelector('.logo-text') || {}).textContent || '';
    assert(brand.trim() === '半亩方塘', '首页站名', JSON.stringify(brand));
    const entries = d.querySelectorAll('#main .sec-entry');
    assert(entries.length === 2, '首页板块数', entries.length + ' 个');
    const links = d.querySelectorAll('#main a.sec-entry');
    assert(links.length === 1 && /library\.html$/.test(links[0].getAttribute('href')), '首页可点板块', links.length + ' 个');
    const locked = d.querySelectorAll('#main .sec-entry.is-locked');
    assert(locked.length === 1 && /敬请期待/.test(locked[0].textContent), '生活随笔锁定态');
    assert(d.querySelectorAll('#main .course-card').length === 0, '首页不该出现科目卡片');
    assert(d.querySelectorAll('#main input[type="search"], #main .search-input').length === 0, '首页不该有搜索框');
    const css = fs.readFileSync(path.join(ROOT, 'assets/css/style.css'), 'utf8');
    assert(/\[hidden\][^{]*\{[^}]*display:\s*none\s*!important/.test(css), '[hidden] 保护规则丢了');
  }

  /* ---------- 2. 学习资料页：科目层 + 搜索 + 在线阅读区 ---------- */
  let html = null, win = null, rows = null;
  {
    /* noSlices：这一节给第 3 节的 iframe 分支当底稿（现在 9 本都有切片了） */
    const { w, d } = await loadPage('library.html', null, { noSlices: true });
    html = d; win = w;
    const cards = d.querySelectorAll('#main .course-card');
    assert(cards.length === 5, '科目卡片数', cards.length + ' 个');
    assert(d.querySelector('#main input[type="search"], #main .search-input'), '资料页缺搜索框');
    rows = [...d.querySelectorAll('#main .dl-row')];
    assert(rows.length === 9, '教材条目数', rows.length + ' 条');
    assert(rows.every((r) => r.tagName === 'DIV' && r.getAttribute('data-fid')), '每行都是可点的 div + data-fid');
    assert(rows.every((r) => r.querySelector('.dl-ico svg')), '每行都有图标');
    assert(rows.every((r) => r.querySelector('.dl-go') && /在线阅读/.test(r.querySelector('.dl-go').textContent)), '每行都有「在线阅读」提示');
    const dls = rows.map((r) => r.querySelector('[data-dl]'));
    assert(dls.every((a) => a && /^files\/.+\.pdf$/.test(a.getAttribute('href')) && a.hasAttribute('download')), '每行都保留下载小按钮');
    assert(rows.every((r) => !/href="files/.test(r.outerHTML.replace(/<a class="dl-mini"[\s\S]*?<\/a>/g, ''))), '整行不再是下载链接');
  }

  /* ---------- 3. 点一行 → 就地打开阅读层 ---------- */
  {
    const d = html, w = win;
    const row = iframeRow(d);   /* 这一节测 iframe 阅读层，必须挑没切片的教材 */
    const fid = row.getAttribute('data-fid');
    const pdf = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/js/files.js'), 'utf8')
      .match(/window\.BLOG_FILES = (\[[\s\S]*\]);/)[1]).find((f) => f.id === fid);

    fire(w, row, 'click');
    const mask = d.getElementById('pdfMask');
    assert(mask, '阅读层已创建');
    assert(mask && !mask.hidden, '点一下就该打开阅读层');
    const fr = d.getElementById('pdfFrame');
    assert(fr.getAttribute('src') === pdf.file + '#view=FitH', 'iframe 指向 PDF', fr.getAttribute('src'));
    assert(d.getElementById('pdfTitle').textContent === pdf.title, '标题填对了');
    assert(/页/.test(d.getElementById('pdfSub').textContent), '副标题带页数', d.getElementById('pdfSub').textContent);
    assert(d.getElementById('pdfNew').getAttribute('href') === pdf.file, '「新窗口」链接正确');
    assert(d.getElementById('pdfDl').getAttribute('href') === pdf.file, '「下载」链接正确');
    assert(d.documentElement.classList.contains('pdf-lock'), '打开时锁住页面滚动');
    assert(d.location.hash === '#read=' + encodeURIComponent(fid), '地址栏带上 #read=', d.location.hash);

    /* 关闭按钮 */
    fire(w, d.getElementById('pdfClose'), 'click');
    assert(mask.hidden, '点「关闭」能收起');
    assert(fr.getAttribute('src') === 'about:blank', '关闭时清空 iframe 释放内存', fr.getAttribute('src'));
    assert(!d.documentElement.classList.contains('pdf-lock'), '关闭后恢复滚动');

    /* 再开一次，点遮罩关闭 */
    fire(w, row, 'click');
    assert(!mask.hidden, '能再次打开');
    fire(w, mask, 'click');
    assert(mask.hidden, '点遮罩能关闭');

    /* Esc 关闭 */
    fire(w, row, 'click');
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(mask.hidden, 'Esc 能关闭');

    /* 点下载小按钮不该打开阅读层 */
    fire(w, row, 'click');
    fire(w, d.getElementById('pdfClose'), 'click');
    fire(w, row.querySelector('[data-dl]'), 'click');
    assert(mask.hidden, '点「下载」不会误开阅读层');

    /* 键盘 Enter 也能打开 */
    row.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    assert(!mask.hidden, '行上按 Enter 能打开');
    fire(w, d.getElementById('pdfClose'), 'click');
  }

  /* ---------- 4. 直链 #read=<id> 打开就是那一本 ---------- */
  {
    const { d } = await loadPage('library.html', 'library.html#read=f-ogata-modern-control-2010', { noSlices: true });
    const fr = d.getElementById('pdfFrame');
    const mask = d.getElementById('pdfMask');
    assert(mask && !mask.hidden, '带 #read= 打开时自动进入阅读层');
    assert(fr && /ogata-modern-control-2010\.pdf/.test(fr.getAttribute('src') || ''),
      '直链指向对的那本（未切片 → iframe）', fr && fr.getAttribute('src'));
  }
  {
    /* 切片教材的直链：应该直接进按页图阅读器，而不是去啃整本 PDF */
    const { d } = await loadPage('library.html', 'library.html#read=f-or-textbook-5ed');
    const sl = d.getElementById('pdfSlice');
    const fr = d.getElementById('pdfFrame');
    assert(sl && !sl.hidden, '切片教材的直链进按页图阅读层');
    assert(fr && fr.hidden, '切片教材直链不挂 iframe');
    assert(/\/p0001\.webp$/.test((d.getElementById('slImg').getAttribute('src') || '')),
      '切片直链定位到第 1 页', d.getElementById('slImg').getAttribute('src'));
  }

  /* ---------- 5. 课程页同样能读，且只列本课的 ---------- */
  {
    const { d } = await loadPage('course.html?c=control');
    const list = [...d.querySelectorAll('#main .dl-row')];
    assert(list.length >= 1 && list.length < 9, '课程页只列本课 PDF', list.length + ' 条');
    const fr = d.getElementById('pdfFrame');
    assert(!fr, '未点之前不预加载 iframe（避免白拖几十 MB）');
  }

  /* ---------- 6. 矩阵论知识讲解：7 张新配图 ---------- */
  for (const [id, want] of [['matrix-5adf47', 3], ['matrix-019195', 4]]) {
    const { d } = await loadPage('article.html?id=' + id, 'article.html?id=' + id);
    const body = d.getElementById('postBody') || d.querySelector('#main');
    const imgs = [...body.querySelectorAll('img')];
    assert(imgs.length === want, id + ' 图片数', imgs.length + ' 张，期望 ' + want);
    const bads = [];
    for (const im of imgs) {
      const src = im.getAttribute('src') || '';
      if (!/^\/posts\//.test(src)) { bads.push('src 异常 ' + src); continue; }
      if (!fs.existsSync(path.join(ROOT, src))) bads.push('文件不存在 ' + src);
      if (im.getAttribute('loading') !== 'lazy') bads.push('丢 loading=lazy ' + src);
      const alt = im.getAttribute('alt') || '';
      if (alt.includes('<') || alt.includes('"')) bads.push('alt 被污染 ' + src);
    }
    assert(!bads.length, id + ' 配图', bads.join(' | '));
    assert(d.querySelectorAll('#postBody .img-missing, #main .img-missing').length === 0, id + ' 仍有「配图缺失」占位');
  }

  /* ---------- 7. 加载超时的兜底：9 秒后给出「重试 + 系统阅读器」 ---------- */
  {
    const { w, d } = await loadPage('library.html', null, { noSlices: true });
    const row = iframeRow(d);
    const fid = row.getAttribute('data-fid');
    fire(w, row, 'click');
    await new Promise((r) => setTimeout(r, 9600));
    const st = d.getElementById('pdfStatus');
    assert(!st.hidden, '超时提示仍然可见');
    assert(/pdf-slow/.test(st.innerHTML), '超时后切换到兜底版式');
    assert(!!st.querySelector('[data-rd-retry]'), '超时面板也带重试按钮（不只一个出口）');
    const alt = st.querySelector('a.pdf-btn');
    assert(alt && /^files\/.+\.pdf$/.test(alt.getAttribute('href')) && alt.getAttribute('target') === '_blank',
      '兜底按钮指向 PDF 且新窗口打开', alt && alt.getAttribute('href'));
    assert(d.getElementById('pdfFrame').getAttribute('src') ===
      JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/js/files.js'), 'utf8')
        .match(/window\.BLOG_FILES = (\[[\s\S]*\]);/)[1]).find((f) => f.id === fid).file + '#view=FitH',
      '兜底出现时 iframe 仍在等同一个文件');
  }

  /* ---------- 8. 预检只认铁证：文件真的没了才降级；fetch 失败不误杀 ---------- */
  /* fetch 直接 reject（浏览器限制 / 断网）时，iframe 可能照样能加载 ——
     不能因此撤掉它，更不能断言「网络没连通」，只能交给超时兜底。 */
  {
    const { w, d } = await loadPage('library.html', null, { fetchMode: 'reject', noSlices: true });
    const row = iframeRow(d);
    fire(w, row, 'click');
    await new Promise((r) => setTimeout(r, 300));
    const fr = d.getElementById('pdfFrame');
    assert(/files\/.+\.pdf/.test(fr.getAttribute('src') || ''), 'fetch 失败不撤 iframe（可能照样能读）', fr.getAttribute('src'));
    const st = d.getElementById('pdfStatus');
    assert(st && !st.hidden && /正在打开/.test(st.textContent), 'fetch 失败不立刻弹「网络没连通」', st && st.textContent);
  }
  /* HTTP 4xx / 返回网页才是铁证：立刻降级 */
  for (const [mode, kw, label] of [
    ['404', '404', 'HTTP 404'],
    ['html', '不是 PDF', '返回网页'],
  ]) {
    const { w, d } = await loadPage('library.html', null, { fetchMode: mode, noSlices: true });
    const row = iframeRow(d);
    fire(w, row, 'click');
    await new Promise((r) => setTimeout(r, 300));
    const mask = d.getElementById('pdfMask');
    assert(mask && !mask.hidden, label + '：阅读层仍然打开');
    const st = d.getElementById('pdfStatus');
    assert(st && !st.hidden && st.textContent.includes(kw),
      label + '：状态层给出对应降级提示', st && st.textContent);
    assert(st && !!st.querySelector('[data-rd-retry]'), label + '：降级面板带重试按钮');
    const fr2 = d.getElementById('pdfFrame');
    assert(fr2 && (fr2.getAttribute('src') === 'about:blank' || !fr2.getAttribute('src')),
      label + '：iframe 已撤下', fr2 && fr2.getAttribute('src'));
    /* 点重试会重走流程（此模式下必然再失败一次，提示依旧在） */
    fire(w, st.querySelector('[data-rd-retry]'), 'click');
    await new Promise((r) => setTimeout(r, 300));
    const st2 = d.getElementById('pdfStatus');
    assert(st2 && !st2.hidden && st2.textContent.includes(kw), label + '：重试后仍是降级提示');
  }

  /* ---------- 9. 小屏与触屏适配 ---------- */
  {
    const css2 = fs.readFileSync(path.join(ROOT, 'assets/css/study.css'), 'utf8');
    assert(/safe-area-inset/.test(css2), '阅读层小屏缺少 safe-area 适配');
    assert(/pdf-slow-acts/.test(css2), '降级面板操作行缺少样式');
    const js2 = fs.readFileSync(path.join(ROOT, 'assets/js/study.js'), 'utf8');
    assert(/pointer:\s*coarse/.test(js2), 'study.js 缺少触屏检测');
    assert(/6000\s*:\s*9000/.test(js2), '触屏超时未比桌面短');
  }

  /* ---------- 10. 触屏可读性：默认放大字号 + 横屏全屏 ---------- */
  {
    const { w, d } = await loadPage('library.html', null, { touch: true, noSlices: true });
    const row = iframeRow(d);
    fire(w, row, 'click');
    const fr = d.getElementById('pdfFrame');
    assert(fr.getAttribute('src').indexOf('#zoom=') > 0, '触屏不再用 FitH（小字根源），改按可读字号', fr.getAttribute('src'));
    const fsb = d.getElementById('pdfFs');
    assert(fsb && !fsb.hidden, '触屏显示「横屏全屏」按钮');
    const tip = d.getElementById('pdfTip');
    assert(tip && /横屏/.test(tip.textContent), '触屏提示语提到横屏', tip && tip.textContent);
    fire(w, fsb, 'click');
    await new Promise((r) => setTimeout(r, 100));
    assert(!d.getElementById('pdfMask').hidden, '点横屏全屏不影响阅读层');
    assert(fr.getAttribute('src').indexOf('#zoom=') > 0, '横屏全屏不重设 iframe.src（避免重载几十 MB、页码归零）');
  }
  {
    const { w, d } = await loadPage('library.html', null, { noSlices: true });
    const row = iframeRow(d);
    fire(w, row, 'click');
    assert(/#view=FitH$/.test(d.getElementById('pdfFrame').getAttribute('src')), '桌面仍按页宽适配');
    assert(d.getElementById('pdfFs').hidden, '桌面隐藏横屏全屏按钮');
  }

  /* ---------- 11. 切片阅读器：大部头扫描教材按页图读 ---------- */
  {
    const { w, d } = await loadPage('library.html');
    w.localStorage.clear();   /* 别让上一轮记住的页码影响断言 */
    const SL = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/js/slices.js'), 'utf8')
      .match(/window\.BLOG_SLICES = (\{[\s\S]*?\});/)[1]);
    const books = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/js/files.js'), 'utf8')
      .match(/window\.BLOG_FILES = (\[[\s\S]*\]);/)[1]);
    const sliced = books.filter((f) => SL[f.id]);
    /* 全部教材都切了片：点开任何一本都不会再把 PDF 丢给浏览器（手机上那等于触发下载） */
    assert(sliced.length === books.length,
      '9 本教材全部有切片（点开永远不会触发下载）', sliced.length + '/' + books.length + ' 本');
    const bad = [];
    for (const f of sliced) {
      const m = SL[f.id];
      if (m.pages !== f.pages) bad.push(f.id + ' 页数对不上 ' + m.pages + '≠' + f.pages);
      for (const p of [1, m.pages]) {
        const pth = path.join(ROOT, m.dir, 'p' + String(p).padStart(4, '0') + '.' + m.ext);
        if (!fs.existsSync(pth)) bad.push(f.id + ' 缺第 ' + p + ' 页');
      }
    }
    assert(!bad.length, '切片文件齐全（抽查首页与末页）', bad.join(' | '));

    const row = [...d.querySelectorAll('#main .dl-row')].find((r) => SL[r.getAttribute('data-fid')]);
    const m = SL[row.getAttribute('data-fid')];
    fire(w, row, 'click');
    await new Promise((r) => setTimeout(r, 200));
    assert(d.getElementById('pdfSlice') && !d.getElementById('pdfSlice').hidden, '切片阅读层已打开');
    assert(d.getElementById('pdfFrame').hidden, '切片模式不挂 iframe（不会先啃几十 MB）');
    /* 手机上的坏下载入口必须收起来：这两个按钮一点就是「下载一个打不开的 PDF」 */
    assert(d.getElementById('pdfNew').hidden && d.getElementById('pdfDl').hidden,
      '切片模式收起「新窗口 / 下载」按钮');
    const tipEl = d.getElementById('pdfTip');
    assert(!!tipEl.querySelector('a.pdf-orig') && /^files\/.+\.pdf$/.test(tipEl.querySelector('a.pdf-orig').getAttribute('href')),
      '原版 PDF 降级为提示行里的次要链接', tipEl.textContent);
    assert(/长按/.test(tipEl.textContent), '提示长按图片可存页（手机上最可靠的保存方式）');
    const img = d.getElementById('slImg');
    assert(img.getAttribute('src') === m.dir + '/p0001.webp', '默认显示第 1 页', img.getAttribute('src'));
    assert(fs.existsSync(path.join(ROOT, img.getAttribute('src'))), '第 1 页切片真实存在');
    assert(d.getElementById('slTot').textContent === String(m.pages), '总页数对得上');
    assert(d.getElementById('slPrev').disabled, '第 1 页时「上一页」禁用');

    fire(w, d.getElementById('slNext'), 'click');
    assert(/\/p0002\.webp$/.test(img.getAttribute('src')), '点「下一页」翻到第 2 页', img.getAttribute('src'));
    d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    assert(/\/p0003\.webp$/.test(img.getAttribute('src')), '方向键也能翻页');
    const num = d.getElementById('slNum');
    num.value = '12';
    num.dispatchEvent(new w.Event('change', { bubbles: true }));
    assert(/\/p0012\.webp$/.test(img.getAttribute('src')), '输入页码可跳转', img.getAttribute('src'));
    assert(fs.existsSync(path.join(ROOT, img.getAttribute('src'))), '跳转到的页真实存在');

    /* 重新打开接着上次读到的那一页 */
    fire(w, d.getElementById('pdfClose'), 'click');
    assert(d.getElementById('pdfMask').hidden, '切片阅读层能关闭');
    assert(!img.getAttribute('src'), '关闭后释放图片引用');
    fire(w, row, 'click');
    await new Promise((r) => setTimeout(r, 150));
    assert(/\/p0012\.webp$/.test(img.getAttribute('src')), '重开接着上次读到的页', img.getAttribute('src'));
    fire(w, d.getElementById('pdfClose'), 'click');
  }

  /* ---------- 12. 资源版本戳：防止"发布成功但手机还在用旧 JS" ---------- */
  {
    const { computeStamp, HTMLS } = require('./stamp.cjs');
    const want = computeStamp(ROOT);
    const bad = [];
    let total = 0;
    for (const f of HTMLS) {
      const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
      const urls = [...html.matchAll(/(?:src|href)="(assets\/[^"?#]+)(\?v=[0-9a-f]+)?"/g)];
      if (!urls.length) { bad.push(f + ' 没有资源引用'); continue; }
      for (const [, u, v] of urls) {
        total += 1;
        if (v !== `?v=${want}`) bad.push(`${f}: ${u}${v || '(无戳)'}`);
      }
    }
    assert(!bad.length, `资源 URL 都带最新版本戳（v=${want}，共 ${total} 处）`,
      bad.slice(0, 4).join(' | ') + (bad.length > 4 ? ` …共 ${bad.length} 处` : ''));
  }

  console.log(problems.length ? '\n❌ 失败：\n - ' + problems.join('\n - ') : `\n✅ 全部通过（${checks} 项）`);
  process.exit(problems.length ? 1 : 0);
})();
