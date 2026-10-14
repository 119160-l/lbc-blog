/* ==========================================================================
   study.js —— 首页「两大板块」/ 课程页 / 归档页
   依赖：app.js 暴露的 window.SiteKit（工具函数）、catalog.js（由 import.mjs 生成）
   文章正文不在这个文件里，而是由 article.html 按需 fetch
   ========================================================================== */
(function (global) {
  'use strict';

  var K = global.SiteKit || {};
  var S = K.S || global.SITE || {};
  var esc = K.esc || function (s) { return String(s == null ? '' : s); };
  var $ = K.$ || function (s, r) { return (r || document).querySelector(s); };
  var $$ = K.$$ || function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var svg = K.svg || function () { return ''; };

  var POSTS = (global.BLOG_POSTS || []);
  var COURSES = (global.BLOG_COURSES || []);
  var SECTIONS = (global.BLOG_SECTIONS || []);
  /* 教材切片清单（由 pdf-slices.py 生成）：大部头扫描件按页图读，不依赖浏览器 PDF 能力 */
  var SLICES = (global.BLOG_SLICES || {});

  /* ------------------------------ 小工具 ------------------------------ */
  function fmtDate(d) {
    var p = String(d || '').split('-');
    return p.length === 3 ? p[0] + '.' + p[1] + '.' + p[2] : String(d || '');
  }
  function fmtWords(n) {
    n = Number(n) || 0;
    if (n >= 10000) return (n / 10000).toFixed(1).replace(/\.0$/, '') + ' 万字';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + ' 千字';
    return n + ' 字';
  }
  function courseOf(key) {
    for (var i = 0; i < COURSES.length; i++) if (COURSES[i].key === key) return COURSES[i];
    return null;
  }
  function postsOf(key) {
    return POSTS.filter(function (p) { return p.course === key; });
  }
  /* 把一堆篇目按「阶段 → 章」聚起来，顺序沿用 catalog 里的顺序 */
  function groupsOf(list) {
    var stages = [], smap = {};
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      var sk = p.stage || '';
      if (!smap[sk]) { smap[sk] = { stage: sk, chapters: [], cmap: {} }; stages.push(smap[sk]); }
      var st = smap[sk];
      var ck = p.chapter;
      if (!st.cmap[ck]) { st.cmap[ck] = { chapter: ck, items: [] }; st.chapters.push(st.cmap[ck]); }
      st.cmap[ck].items.push(p);
    }
    return stages.map(function (s) {
      return {
        stage: s.stage,
        items: s.chapters.reduce(function (a, c) { return a + c.items.length; }, 0),
        chapters: s.chapters
      };
    });
  }

  /* ------------------------------ 搜索 ------------------------------ */
  function hitRow(p, q) {
    var c = courseOf(p.course) || {};
    var where = [c.short || c.name, p.stage, p.chapter].filter(Boolean).join(' · ');
    return '<a class="hit-row" href="article.html?id=' + encodeURIComponent(p.id) + '">' +
      '<b>' + mark(p.title, q) + '</b>' +
      '<span>' + esc(where) + (p.kind ? ' · ' + mark(p.kind, q) : '') +
        ' · ' + fmtWords(p.chars) + '</span>' +
    '</a>';
  }
  function mark(text, q) {
    var s = esc(text || '');
    if (!q) return s;
    var i = s.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return s;
    return s.slice(0, i) + '<mark>' + s.slice(i, i + q.length) + '</mark>' + s.slice(i + q.length);
  }
  function search(q, scope) {
    var kw = String(q || '').trim().toLowerCase();
    if (!kw) return [];
    return POSTS.filter(function (p) {
      if (scope && p.course !== scope) return false;
      var c = courseOf(p.course) || {};
      var hay = [p.title, p.chapter, p.stage, p.kind, p.excerpt, c.name, c.short]
        .filter(Boolean).join(' ').toLowerCase();
      return hay.indexOf(kw) !== -1;
    });
  }

  /* ------------------------------ 首页 ------------------------------ */
  var HITS = null;   /* 当前搜索词，null 表示正常显示两大板块 */

  function heroHTML() {
    var notices = (S.notices || []).filter(function (n) { return n && n.text; });
    return '<section class="hero-banner glass enter">' +
      '<h1>' + esc(S.tagline || '记录学习，也记录生活') + '</h1>' +
      '<p>' + esc(S.intro || '') + '</p>' +
      (notices.length
        ? '<div class="notice-strip">' + notices.map(function (n) {
            return '<span>' + esc(n.text) + (n.date ? '<time>' + esc(n.date) + '</time>' : '') + '</span>';
          }).join('') + '</div>'
        : '') +
    '</section>';
  }

  function searchBarHTML(scope) {
    var ph = scope
      ? '在这门课里搜索：章节、篇名…'
      : '搜索 ' + POSTS.length + ' 篇资料：课程、章节、篇名…';
    return '<div class="toolbar-panel glass reveal" id="search">' +
      '<label class="searchbox">' + svg('search', 16) +
        '<input id="searchInput" type="search" placeholder="' + esc(ph) + '" autocomplete="off">' +
      '</label>' +
    '</div>';
  }

  function realStages(c) {
    /* 「总览」是课程根的零散文件，不算一个阶段；空串是练习题册/汇总那一档 */
    return (c.stages || []).filter(function (s) { return s && s !== '总览'; });
  }

  function courseCardHTML(c) {
    var stages = realStages(c);
    return '<a class="course-card glass ripple-host reveal" href="course.html?c=' + encodeURIComponent(c.key) + '">' +
      '<div class="cc-head">' +
        '<h3 class="cc-name">' + esc(c.name) + '</h3>' +
        '<span class="cc-badge">' + c.items + ' 篇</span>' +
      '</div>' +
      '<p class="cc-desc">' + esc(c.desc || '') + '</p>' +
      '<div class="cc-meta">' +
        '<span><b>' + c.chapters + '</b> 个章节</span>' +
        '<span>' + fmtWords(c.chars) + '</span>' +
        (stages.length > 1 ? '<span>' + stages.length + ' 个阶段</span>' : '') +
        (c.updated ? '<span>更新 ' + fmtDate(c.updated) + '</span>' : '') +
      '</div>' +
      '<div class="cc-go">进入课程 <span>→</span></div>' +
    '</a>';
  }

  /* --------------------------------------------------------------------------
     首页只渲染「板块」这一层 —— 学习资料 / 生活随笔。
     科目列表、章节列表都放在点进去之后的页面里（学习资料 → library.html），
     首页不再直接摊开科目。
     以后要加板块，只改 catalog.js 里 BLOG_SECTIONS 的配置，本文件不用动：
       { key, name, desc, href, open, icon, tone }
       open:false → 卡片显示「敬请期待」，不可点
     -------------------------------------------------------------------------- */
  function sectionMeta(sec) {
    if (sec.key === 'study') {
      var chars = COURSES.reduce(function (a, c) { return a + (c.chars || 0); }, 0);
      return COURSES.length + ' 门课 · ' + POSTS.length + ' 篇 · ' + fmtWords(chars);
    }
    var n = POSTS.filter(function (p) { return p.section === sec.key; }).length;
    return n ? n + ' 篇' : '暂未开张';
  }

  function sectionEntryHTML(sec) {
    var open = sec.open !== false;
    var cls = 'sec-entry glass' + (sec.tone === 'warm' ? ' tone-warm' : '');
    var inner =
      '<span class="sec-icon">' + svg(sec.icon || 'book', 20) + '</span>' +
      '<div class="se-body">' +
        '<h2>' + esc(sec.name) + (open ? '' : '<em class="se-soon">敬请期待</em>') + '</h2>' +
        '<p>' + esc(sec.desc || '') + '</p>' +
        '<div class="se-meta">' + esc(sectionMeta(sec)) + '</div>' +
      '</div>' +
      (open ? '<span class="se-go">→</span>' : '');
    if (!open) {
      return '<div class="' + cls + ' is-locked" id="' + esc(sec.key) + '">' + inner + '</div>';
    }
    return '<a class="' + cls + ' ripple-host reveal" id="' + esc(sec.key) +
      '" href="' + esc(sec.href || '#') + '">' + inner + '</a>';
  }

  function renderHome() {
    var main = document.getElementById('main');
    var entries = SECTIONS.length
      ? SECTIONS.map(sectionEntryHTML).join('')
      : '<div class="empty-state glass" style="border-radius:var(--radius);"><b>还没有配置板块</b>' +
        '在 catalog.js 的 BLOG_SECTIONS 里加一条即可。</div>';
    main.innerHTML = '<div class="container">' + heroHTML() +
      '<div class="sec-entries">' + entries + '</div>' +
    '</div>';
    if (global.KIT_AFTER_RENDER) global.KIT_AFTER_RENDER();
  }

  function drawHits(q, scope, hitWrap, secWrap) {
    var kw = String(q || '').trim();
    HITS = kw || null;
    if (!kw) { hitWrap.hidden = true; secWrap.hidden = false; return; }
    var arr = search(kw, scope);
    var scopeName = scope ? (courseOf(scope) || {}).name : '';
    hitWrap.hidden = false;
    secWrap.hidden = true;
    hitWrap.innerHTML =
      '<div class="hits-head">找到 <b>' + arr.length + '</b> 篇' + (scopeName ? '（限《' + esc(scopeName) + '》）' : '') +
        '<button type="button" id="hitClear">清空</button></div>' +
      (arr.length
        ? '<div class="hit-list">' + arr.map(function (p) { return hitRow(p, kw); }).join('') + '</div>'
        : '<div class="empty-state glass" style="border-radius:var(--radius);"><b>没有匹配的内容</b>换个关键词试试 —— 搜索覆盖课程名、章节名、篇名与摘要。</div>');
    var btn = document.getElementById('hitClear');
    if (btn) btn.onclick = function () {
      var i = document.getElementById('searchInput');
      if (i) { i.value = ''; i.focus(); }
      drawHits('', scope, hitWrap, secWrap);
    };
    if (global.KIT_AFTER_RENDER) global.KIT_AFTER_RENDER();
  }

  /* ------------------------------ 教材 / 在线阅读 ------------------------------ */
  /* 数据来自 assets/js/files.js（由 import-pdf.mjs 生成）。
     课程页只显示属于这门课的，资料页显示全部。
     主操作是「在网页里读」而不是「下载」：手机上点下载之后文件会落到
     「文件」App 的下载目录里，很多人找不到；直接在站内读最省事。 */
  var FILES = (global.BLOG_FILES || []);

  function fmtSize(n) {
    n = Number(n) || 0;
    if (n >= 1048576) return (n / 1048576).toFixed(1).replace(/\.0$/, '') + ' MB';
    if (n >= 1024) return Math.round(n / 1024) + ' KB';
    return n + ' B';
  }
  function filesOf(courseKey) {
    return FILES.filter(function (f) { return f.course === courseKey; });
  }
  function fileById(id) {
    for (var i = 0; i < FILES.length; i++) if (FILES[i].id === id) return FILES[i];
    return null;
  }
  /* 整行可点 = 在线阅读；右侧小按钮 = 下载到本地 */
  function fileRowHTML(f) {
    return '<div class="dl-row reveal" data-fid="' + esc(f.id) + '" role="button" tabindex="0"' +
        ' aria-label="在线阅读：' + esc(f.title) + '">' +
      '<span class="dl-ico">' + svg('read', 17) + '</span>' +
      '<div class="dl-body">' +
        '<b>' + esc(f.title) +
          (f.tag ? '<em class="dl-tag">' + esc(f.tag) + '</em>' : '') + '</b>' +
        '<span class="dl-sub">' + esc(f.sub || '') +
          (f.pages ? '　·　' + f.pages + ' 页' : '') + '　·　' + fmtSize(f.size) + '</span>' +
        (f.note ? '<span class="dl-note">' + esc(f.note) + '</span>' : '') +
      '</div>' +
      '<span class="dl-acts">' +
        '<a class="dl-mini" data-dl href="' + esc(f.file) + '" download' +
          ' title="下载到本地" aria-label="下载到本地">' + svg('download', 15) + '</a>' +
        '<span class="dl-go">在线阅读</span>' +
      '</span>' +
    '</div>';
  }
  function downloadsBlockHTML(courseKey) {
    var list = courseKey ? filesOf(courseKey) : FILES;
    if (!list.length) return '';
    var bytes = list.reduce(function (a, f) { return a + (f.size || 0); }, 0);
    return '<section class="dl-block">' +
      '<div class="dl-head">' +
        '<span class="dl-hicon">' + svg('book', 18) + '</span>' +
        '<h2>' + (courseKey ? '本课教材与参考书' : '教材与参考资料') + '</h2>' +
        '<span class="dl-count">' + list.length + ' 份 · ' + fmtSize(bytes) + '</span>' +
      '</div>' +
      '<p class="dl-desc">' + (courseKey
        ? '这门课要用到的教材和参考书，点一下直接在网页里读，不用先下载。'
        : '本地攒下的教材与参考书，共 ' + list.length + ' 份。点一下直接在网页里读；想存到本地就点右边的 ↓。') +
      '</p>' +
      '<div class="dl-list">' + list.map(fileRowHTML).join('') + '</div>' +
    '</section>';
  }

  /* ------------------------------ PDF 阅读层 ------------------------------ */
  /* 全屏一层，里面放个 iframe，交给浏览器自带的 PDF 阅读器渲染。
     为什么不用 PDF.js：正本教材 40~65 MB，手机上用 canvas 逐页渲染内存吃不消，
     浏览器自带阅读器反而更省、还能双指缩放。

     手机兜底分三层（2026-10-13 加固）：
       ① 并行预检：挂 iframe 的同时发一个 HEAD，404 / 断网 / 返回网页 都能在几百毫秒内
          判死刑，把 iframe 撤下换成降级面板——不让用户对着空白干等。
          必须预检的原因：iframe 的 load 事件对错误页也会触发，只靠它会把状态层藏掉。
       ② 触屏 6s / 桌面 9s 还没加载出来 → 「用系统阅读器打开」。
       ③ 降级面板自带「重试」，应付移动网络抽风。 */
  var RD = null, rdOpen = false, rdTimer = null, rdCur = null, rdLoaded = false, rdFailed = false, rdNetFail = false, rdSeq = 0;
  var rdBook = null, rdPage = 1;   /* 切片阅读器状态：当前教材清单 / 当前页 */

  function rdEnsure() {
    if (RD) return RD;
    RD = document.createElement('div');
    RD.className = 'pdf-mask';
    RD.id = 'pdfMask';
    RD.hidden = true;
    RD.innerHTML =
      '<div class="pdf-modal glass" role="dialog" aria-modal="true" aria-label="在线阅读">' +
        '<div class="pdf-head">' +
          '<span class="pdf-hicon">' + svg('read', 18) + '</span>' +
          '<div class="pdf-hbody"><b id="pdfTitle"></b><span id="pdfSub"></span></div>' +
          '<div class="pdf-acts">' +
            '<button class="pdf-btn" id="pdfFs" type="button" hidden>' +
              svg('fullscreen', 13) + '<span>横屏全屏</span></button>' +
            '<a class="pdf-btn" id="pdfNew" target="_blank" rel="noopener">' +
              svg('external', 13) + '<span>新窗口</span></a>' +
            '<a class="pdf-btn" id="pdfDl" download>' + svg('download', 13) + '<span>下载</span></a>' +
            '<button class="pdf-btn primary" id="pdfClose" type="button">' +
              svg('close', 13) + '<span>关闭</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="pdf-body">' +
          '<div class="pdf-status" id="pdfStatus">正在打开…</div>' +
          '<iframe id="pdfFrame" title="PDF 阅读器"></iframe>' +
          '<div class="pdf-slice" id="pdfSlice" hidden>' +
            '<div class="sl-stage" id="slStage">' +
              '<img id="slImg" alt="教材页面">' +
              '<div class="sl-badge" id="slBadge">1 / 1</div>' +
            '</div>' +
            '<div class="sl-bar">' +
              '<button class="sl-btn" id="slPrev" type="button">上一页</button>' +
              '<label class="sl-now">第<input id="slNum" type="number" inputmode="numeric" min="1" value="1"><i>/</i><span id="slTot">1</span>页</label>' +
              '<button class="sl-btn" id="slNext" type="button">下一页</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<p class="pdf-tip" id="pdfTip"></p>' +
      '</div>';
    document.body.appendChild(RD);

    /* 「横屏全屏」只在触屏上有意义：手机竖屏按页宽适配会把字压得极小 */
    if (rdIsTouch()) RD.querySelector('#pdfFs').hidden = false;
    RD.querySelector('#pdfFs').addEventListener('click', function () { rdFsToggle(); });
    document.addEventListener('fullscreenchange', rdFsSync);
    document.addEventListener('webkitfullscreenchange', rdFsSync);

    RD.querySelector('#pdfClose').addEventListener('click', function () { rdClose(false); });
    RD.addEventListener('click', function (e) { if (e.target === RD) rdClose(false); });
    RD.querySelector('#pdfFrame').addEventListener('load', function () {
      rdLoaded = true;
      /* 已经判死降级的话，别让 load（about:blank 也会触发一次）把降级面板藏掉 */
      if (!rdOpen || rdFailed) return;
      var st = RD.querySelector('#pdfStatus');
      if (st) st.hidden = true;
    });
    /* 降级面板里的「重试」：重新走一遍打开流程（含预检） */
    RD.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('[data-rd-retry]')) {
        e.preventDefault();
        if (rdCur) rdOpenFile(rdCur);
      }
      /* 切片取图失败时的「回到第 1 页」 */
      if (t && t.closest && t.closest('[data-rd-restart]')) {
        e.preventDefault();
        if (rdCur) { try { global.localStorage.setItem('zb-page:' + rdCur.id, '1'); } catch (e) { } }
        rdGoto(1);
      }
    });

    /* ---- 切片阅读器的交互：左右滑动翻页、点图放大、页码跳转 ---- */
    var stage = RD.querySelector('#slStage');
    var tx = 0, ty = 0, tScroll = false;
    stage.addEventListener('touchstart', function (e) {
      var t = e.touches[0]; tx = t.clientX; ty = t.clientY;
      tScroll = RD.querySelector('#pdfSlice').classList.contains('zoomed');
    }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (!rdBook) return;
      var t = e.changedTouches[0];
      var dx = t.clientX - tx, dy = t.clientY - ty;
      /* 放大态下允许上下滚动阅读，只有明确的横向滑动才翻页 */
      if (Math.abs(dx) < 45 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      if (tScroll && stage.scrollWidth <= stage.clientWidth + 2) { /* 仍按翻页处理 */ }
      rdGoto(rdPage + (dx < 0 ? 1 : -1));
    }, { passive: true });
    stage.addEventListener('click', function (e) {
      if (e.target.id !== 'slImg') return;
      RD.querySelector('#pdfSlice').classList.toggle('zoomed');
    });
    RD.querySelector('#slPrev').addEventListener('click', function () { rdGoto(rdPage - 1); });
    RD.querySelector('#slNext').addEventListener('click', function () { rdGoto(rdPage + 1); });
    RD.querySelector('#slNum').addEventListener('change', function (e) { rdGoto(e.target.value); });
    RD.querySelector('#slImg').addEventListener('load', function () {
      this.classList.remove('loading');
    });
    RD.querySelector('#slImg').addEventListener('error', function () {
      this.classList.remove('loading');
      rdSliceFail(RD, this);
    });
    return RD;
  }

  function rdOpenFile(f) {
    if (!f) return;
    var seq = ++rdSeq;   /* 每次打开一个令牌：旧预检回调作废，快速重点不会误伤 */
    var w = rdEnsure();
    w.querySelector('#pdfTitle').textContent = f.title || 'PDF';
    w.querySelector('#pdfSub').textContent =
      [f.sub, f.pages ? f.pages + ' 页' : '', fmtSize(f.size)].filter(Boolean).join('　·　');
    w.querySelector('#pdfNew').href = f.file;
    w.querySelector('#pdfDl').href = f.file;
    /* 有切片就走切片阅读器：绝不能先把 iframe.src 挂上，否则等于让手机先啃 63 MB */
    if (rdHasSlices(f)) { rdOpenSlices(w, f); return; }
    w.querySelector('#pdfSlice').hidden = true;
    w.querySelector('#pdfFrame').hidden = false;
    w.querySelector('#pdfNew').hidden = false;
    w.querySelector('#pdfDl').hidden = false;
    var st = w.querySelector('#pdfStatus');
    st.hidden = false;
    st.textContent = '正在打开…' + fmtSize(f.size) + (f.pages ? ' / ' + f.pages + ' 页' : '') +
      '，首次加载稍慢';
    /* 触屏竖屏下 #view=FitH（按页宽适配）会把整页 A4 压进手机宽度，字小到全程双指放大；
       触屏改用 #zoom=140 直接给可读字号（配合「横屏全屏」字号还能再大一倍），桌面仍按页宽适配。 */
    w.querySelector('#pdfFrame').src = f.file + (rdIsTouch() ? '#zoom=140' : '#view=FitH');
    w.querySelector('#pdfTip').innerHTML = rdIsTouch()
      ? '字太小？点「横屏全屏」把手机横过来读，能拿到的字号最大；也能双指缩放。教材建议在 Wi-Fi 下打开。'
      : '框里一直空白的话，点「新窗口」——浏览器会用它自带的 PDF 阅读器；大教材建议在 Wi-Fi 下打开。';
    w.hidden = false;
    rdOpen = true;
    document.documentElement.classList.add('pdf-lock');
    try { history.pushState({ pdf: f.id }, '', '#read=' + encodeURIComponent(f.id)); } catch (e) { }
    rdCur = f; rdLoaded = false; rdFailed = false; rdNetFail = false;
    clearTimeout(rdTimer);
    /* 兜底一：等太久了就主动给出路，别让手机用户干等。
       触屏上对着一层空白干等更折磨人，超时砍到 6 秒。
       面板同时给「重试」和「系统阅读器」两个出口。 */
    rdTimer = setTimeout(function () {
      if (!rdOpen || rdFailed) return;
      var s = w.querySelector('#pdfStatus');
      if (!s || s.hidden) return;
      s.innerHTML = rdPanelHTML(f,
        rdNetFail ? '网络似乎不太顺，这份 PDF 还没传过来。' : '加载得有点慢，这份教材比较大。',
        rdNetFail ? '换个网络环境（Wi-Fi / 流量）再试，通常就好了。'
          : '教材建议在 Wi-Fi 下打开；系统自带的阅读器通常立刻就能翻页。');
    }, rdIsTouch() ? 6000 : 9000);
    /* 兜底二：并行预检。iframe 上面已经同步挂上（成功路径零延迟），这个 HEAD 只用来
       抓「铁证」——文件真的没了（4xx/5xx），或服务器返回的是一张网页而不是 PDF。
       fetch 本身失败（浏览器限制、断网）**不**作为判死依据：那种情况下 iframe 可能照样
       能加载，iframe 能不能加载才是唯一可信的判据，所以只记录状态、交给上面的超时兜底。 */
    rdProbe(f, function (r) {
      if (!rdOpen || seq !== rdSeq || rdFailed) return;
      if (r.state === 'net') { rdNetFail = true; return; }
      if (r.state !== 'http' && r.state !== 'type') return;
      clearTimeout(rdTimer);
      rdFailed = true;
      w.querySelector('#pdfFrame').src = 'about:blank';
      var s2 = w.querySelector('#pdfStatus');
      s2.hidden = false;
      s2.innerHTML = rdPanelHTML(f,
        r.state === 'http'
          ? '文件取不回来（HTTP ' + (r.status || '错误') + '），可能被移动或删除了。'
          : '这个地址返回的不是 PDF，链接可能过期了。',
        '如果链接还有效，可以点「新窗口」或 ↓ 让系统自己再试一次。');
    });
  }

  /* 触屏判定：超时分档、字号档位、「横屏全屏」按钮都按它来 */
  function rdIsTouch() {
    try {
      if (global.matchMedia && global.matchMedia('(pointer: coarse)').matches) return true;
      if (global.navigator && global.navigator.maxTouchPoints > 0) return true;
    } catch (e) { }
    return false;
  }

  function rdFsFull() {
    return document.fullscreenElement || document.webkitFullscreenElement || null;
  }

  /* 「横屏全屏」：只把阅读层本身拉满屏，不碰 iframe.src —— 一碰 src 就会从头
     重新加载几十 MB，页码也回到第一页。锁横屏失败不打扰用户（系统多半不让自动转）。 */
  function rdFsToggle() {
    if (rdFsFull()) {
      try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { }
      return;
    }
    var modal = RD && RD.querySelector('.pdf-modal');
    if (!modal) return;
    try {
      if (modal.requestFullscreen) modal.requestFullscreen();
      else if (modal.webkitRequestFullscreen) modal.webkitRequestFullscreen();
    } catch (e) { }
    rdFsSync();
  }

  /* 进入全屏后顺手锁横屏（只能在用户手势触发的全屏里生效，失败就算了）；
     同时把按钮文案切成「退出全屏」，用户随时能退出来。 */
  function rdFsSync() {
    var b = RD && RD.querySelector('#pdfFs');
    if (!b) return;
    var on = !!rdFsFull();
    b.querySelector('span').textContent = on ? '退出全屏' : (rdIsTouch() ? '横屏全屏' : '全屏');
    if (on) {
      try { if (global.screen && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape'); } catch (e) { }
    }
  }

  /* 预检：HEAD 一下，只认「铁证」——文件真的取不到（4xx/5xx），或服务器回的明显是网页。
     拿不准一律放行（服务器不实现 HEAD 很常见；预检自己卡住更不能反过来拖慢打开）。 */
  function rdProbe(f, done) {
    var settled = false;
    var fin = function (r) { if (!settled) { settled = true; done(r); } };
    /* 没有 fetch 的环境（很老的浏览器 / file:// 双击打开）：预检无从谈起，放行 */
    if (typeof fetch !== 'function') { fin({ state: 'unknown' }); return; }
    var timer = setTimeout(function () { fin({ state: 'unknown' }); }, 6000);
    Promise.resolve()
      .then(function () { return fetch(f.file, { method: 'HEAD' }); })
      .then(function (res) {
        clearTimeout(timer);
        if (!res) return fin({ state: 'unknown' });
        if (res.status === 405 || res.status === 501) return fin({ state: 'unknown' });
        if (!res.ok) return fin({ state: 'http', status: res.status });
        var ct = '';
        try { ct = res.headers && res.headers.get ? (res.headers.get('content-type') || '') : ''; } catch (e) { }
        /* 只在「明确是网页/XML」时判死——CDN 常把 404 页返回成 200 的 HTML。
           application/octet-stream、application/download 之类的怪异类型一律放行。 */
        if (ct && /text\/html|application\/xhtml|text\/xml|application\/xml/i.test(ct)) {
          return fin({ state: 'type', ct: ct });
        }
        fin({ state: 'ok' });
      })
      .catch(function () { clearTimeout(timer); fin({ state: 'net' }); });
  }

  /* 降级面板：一句话说清现状 + 两个出口（重试 / 系统阅读器），别让用户干等也没退路 */
  function rdPanelHTML(f, msg, tip) {
    return '<div class="pdf-slow">' +
      '<span>' + msg + '</span>' +
      '<span class="pdf-slow-acts">' +
        '<button class="pdf-btn primary" type="button" data-rd-retry>' +
          svg('read', 13) + '<span>重试</span></button>' +
        '<a class="pdf-btn" href="' + esc(f.file) + '" target="_blank" rel="noopener">' +
          svg('external', 13) + '<span>用系统阅读器打开</span></a>' +
      '</span>' +
      '<span class="pdf-slow-tip">' + (tip || '重试会重新拉取；实在不行就点右边的 ↓ 下载到本地看') + '</span>' +
      '</div>';
  }

  /* ------------------------------ 切片阅读器（大部头扫描教材） ------------------------------
     为什么需要：手机浏览器（国产浏览器 / 微信内置浏览器等）经常不给 iframe 里的 PDF 渲染，
     有的干脆拦截成下载；63 MB 的扫描件就算能渲染，也得先啃完整个文件才有第一页。
     pdf-slices.py 把每页预先渲成 WebP（40~70 KB），这里一页一张图地翻：
     不依赖任何浏览器 PDF 能力，翻一页只传几十 KB，关掉就释放。 */
  function rdHasSlices(f) {
    var m = SLICES[f && f.id];
    return !!(m && m.pages && m.dir);
  }

  function rdImgSrc(m, p) {
    return m.dir + '/p' + ('000' + p).slice(-4) + '.' + (m.ext || 'webp');
  }

  function rdOpenSlices(w, f) {
    var m = SLICES[f.id];
    var total = m.pages;
    rdCur = f; rdBook = m; rdLoaded = true; rdFailed = false; rdNetFail = false;
    clearTimeout(rdTimer);
    var num = w.querySelector('#slNum');
    num.max = String(total);
    num.value = '1';
    w.querySelector('#slTot').textContent = String(total);
    w.querySelector('#pdfStatus').hidden = true;
    w.querySelector('#pdfFrame').hidden = true;
    w.querySelector('#pdfFrame').src = 'about:blank';
    var sl = w.querySelector('#pdfSlice');
    sl.hidden = false;
    sl.classList.remove('zoomed');
    /* 手机上「下载原版 PDF」几乎必然变成一个打不开的文件，还占流量 —— 收进提示行当次要出口，
       头部只留阅读相关的按钮，从源头上断掉坏下载的入口 */
    w.querySelector('#pdfNew').hidden = true;
    w.querySelector('#pdfDl').hidden = true;
    w.querySelector('#pdfTip').innerHTML =
      '左右滑动翻页，点图放大；<b>长按图片</b>可把这页存到手机。' +
      '要查公式或复制文字，用这里的<a class="pdf-orig" href="' + esc(f.file) +
      '" target="_blank" rel="noopener">原版 PDF</a>（几十 MB，建议在电脑上打开）。';
    /* 上次读到哪一页就接着读（localStorage 不可用时静默忽略） */
    var p = 0;
    try { p = parseInt(global.localStorage.getItem('zb-page:' + f.id) || '0', 10) || 0; } catch (e) { }
    w.hidden = false;
    rdOpen = true;
    document.documentElement.classList.add('pdf-lock');
    try { history.pushState({ pdf: f.id }, '', '#read=' + encodeURIComponent(f.id)); } catch (e) { }
    rdShowPage(w, p > 0 ? Math.min(p, total) : 1);
  }

  function rdShowPage(w, p) {
    var m = rdBook;
    if (!m || !w) return;
    var total = m.pages;
    p = Math.min(Math.max(parseInt(p, 10) || 1, 1), total);
    rdPage = p;
    var img = w.querySelector('#slImg');
    w.querySelector('#slNum').value = String(p);
    w.querySelector('#slPrev').disabled = p <= 1;
    w.querySelector('#slNext').disabled = p >= total;
    w.querySelector('#slBadge').textContent = p + ' / ' + total;
    img.classList.remove('bad');
    img.classList.add('loading');
    img.src = rdImgSrc(m, p);
    if (rdCur) { try { global.localStorage.setItem('zb-page:' + rdCur.id, String(p)); } catch (e) { } }
    rdPreload(p + 1); rdPreload(p - 1);
  }

  /* 预热相邻两页，滑动翻页才不会有等待感 */
  function rdPreload(p) {
    var m = rdBook;
    if (!m || p < 1 || p > m.pages) return;
    var im = new Image();
    im.src = rdImgSrc(m, p);
  }

  function rdGoto(p) {
    if (!rdBook || !RD) return;
    var sl = RD.querySelector('#pdfSlice');
    if (sl) sl.classList.remove('zoomed');
    var st = RD.querySelector('#pdfStatus');
    if (st) st.hidden = true;
    rdShowPage(RD, p);
  }

  function rdSliceFail(w, img) {
    img.classList.add('bad');
    var st = w.querySelector('#pdfStatus');
    st.hidden = false;
    st.innerHTML = '<div class="pdf-slow">' +
      '<span>这一页的图片没取到，多半是网络抖了一下。</span>' +
      '<span class="pdf-slow-acts">' +
        '<button class="pdf-btn primary" type="button" data-rd-retry>' +
          svg('read', 13) + '<span>重试本页</span></button>' +
        '<button class="pdf-btn" type="button" data-rd-restart>' +
          svg('up', 13) + '<span>回到第 1 页</span></button>' +
      '</span>' +
      '<span class="pdf-slow-tip">也可以点右上角「新窗口」，用系统阅读器打开原版 PDF。</span>' +
      '</div>';
  }

  function rdClose(fromHistory) {
    if (!rdOpen) return;
    rdOpen = false;
    rdCur = null; rdLoaded = false; rdFailed = false; rdNetFail = false;
    clearTimeout(rdTimer);
    /* 退出时把全屏态也收掉，否则手机上会卡在全屏的空页面上 */
    if (rdFsFull()) {
      try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { }
    }
    var w = RD;
    if (w) {
      /* 先把 iframe 导航走，几十 MB 的 PDF 内存才能还给浏览器 */
      w.querySelector('#pdfFrame').src = 'about:blank';
      /* 切片同理：src 置空让解码器把这张图回收掉 */
      var im = w.querySelector('#slImg');
      if (im) { im.src = ''; im.classList.remove('bad', 'loading'); }
      rdBook = null; rdPage = 1;
      w.hidden = true;
    }
    document.documentElement.classList.remove('pdf-lock');
    if (!fromHistory && history.state && history.state.pdf) {
      try { history.back(); } catch (e) { }
    }
  }

  /* 支持 ?#read=<id> 直链：分享出去的地址打开就是那一本 */
  function rdFromHash() {
    var m = /(?:^|[#&])read=([^&]+)/.exec(global.location.hash || '');
    if (!m) return false;
    var f = fileById(decodeURIComponent(m[1]));
    if (!f) return false;
    rdOpenFile(f);
    return true;
  }

  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    var row = t.closest('.dl-row');
    if (!row) return;
    if (t.closest('[data-dl]')) return;            /* 点的是「下载」小按钮 */
    var f = fileById(row.getAttribute('data-fid'));
    if (!f) return;
    e.preventDefault();
    rdOpenFile(f);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { rdClose(false); return; }
    /* 切片阅读器：翻页快捷键（桌面端 ↑↓/PgUp/PgDn/Home/End） */
    if (rdOpen && rdBook) {
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); rdGoto(rdPage + 1); return; }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); rdGoto(rdPage - 1); return; }
      if (e.key === 'Home') { e.preventDefault(); rdGoto(1); return; }
      if (e.key === 'End') { e.preventDefault(); rdGoto(rdBook.pages); return; }
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target &&
        e.target.classList && e.target.classList.contains('dl-row')) {
      e.preventDefault();
      var f = fileById(e.target.getAttribute('data-fid'));
      if (f) rdOpenFile(f);
    }
  });
  global.addEventListener('popstate', function () { rdClose(true); });

  /* ------------------------------ 资料页（点首页「学习资料」进来） ------------------------------ */
  function renderLibrary() {
    var main = document.getElementById('main');
    var chars = COURSES.reduce(function (a, c) { return a + (c.chars || 0); }, 0);
    var chapters = COURSES.reduce(function (a, c) { return a + (c.chapters || 0); }, 0);

    main.innerHTML = '<div class="container">' +
      '<div class="crumb" style="margin-top:26px;">' +
        '<a href="index.html">首页</a><span>›</span><span>学习资料</span>' +
      '</div>' +
      '<section class="course-hero glass enter">' +
        '<h1>学习资料</h1>' +
        '<p>' + COURSES.length + ' 门课、' + POSTS.length + ' 篇资料，完全按源文件夹的「课程 → 阶段 → 章 → 篇」结构归档，公式用 KaTeX 排版。下面是全部科目。</p>' +
        '<div class="course-stats">' +
          '<div><b>' + COURSES.length + '</b>门课</div>' +
          '<div><b>' + POSTS.length + '</b>篇资料</div>' +
          '<div><b>' + chapters + '</b>个章节</div>' +
          (FILES.length ? '<div><b>' + FILES.length + '</b>份 PDF</div>' : '') +
          '<div><b>' + fmtWords(chars) + '</b>总字数</div>' +
        '</div>' +
      '</section>' +
      searchBarHTML(null) +
      '<div id="hitWrap" hidden></div>' +
      '<div id="secWrap">' +
        '<div class="course-grid">' + COURSES.map(courseCardHTML).join('') + '</div>' +
        '<p class="lib-foot">想按章节一次看全？<a href="archive.html">按章节浏览 →</a></p>' +
        downloadsBlockHTML('') +
      '</div>' +
    '</div>';

    var input = $('#searchInput'), hitWrap = $('#hitWrap'), secWrap = $('#secWrap');
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { drawHits(input.value, null, hitWrap, secWrap); }, 140);
    });
    if (global.KIT_AFTER_RENDER) global.KIT_AFTER_RENDER();
    rdFromHash();
  }

  /* ------------------------------ 课程页 ------------------------------ */
  var STAGE_LABEL = { '': '汇总与练习册', '总览': '总览' };

  function chapterCardHTML(ch, courseKey) {
    var wide = ch.items.length > 3;
    return '<div class="chapter-card glass reveal' + (wide ? ' wide' : '') + '">' +
      '<div class="ch-head">' +
        '<h3 class="ch-title">' + esc(ch.chapter) + '</h3>' +
        '<span class="ch-n">' + ch.items.length + ' 篇</span>' +
      '</div>' +
      '<div class="ch-chips">' + ch.items.map(function (p) {
        return '<a class="chip" href="article.html?id=' + encodeURIComponent(p.id) + '" title="' + esc(p.title) + '">' +
          esc(p.kind) + '<i>' + p.minutes + '′</i></a>';
      }).join('') + '</div>' +
    '</div>';
  }

  function stagesHTML(list, courseKey) {
    if (!list.length) return '<div class="empty-state glass" style="border-radius:var(--radius);"><b>没有匹配的章节</b>换个关键词试试。</div>';
    return groupsOf(list).map(function (st) {
      var label = STAGE_LABEL[st.stage] !== undefined ? STAGE_LABEL[st.stage] : st.stage;
      return '<div class="stage-block">' +
        '<h2 class="stage-title">' + esc(label || '章节目录') +
          '<em>' + st.chapters.length + ' 章 · ' + st.items + ' 篇</em></h2>' +
        '<div class="chapter-grid">' + st.chapters.map(function (ch) {
          return chapterCardHTML(ch, courseKey);
        }).join('') + '</div>' +
      '</div>';
    }).join('');
  }

  function renderCourse() {
    var key = new URLSearchParams(location.search).get('c') || (COURSES[0] || {}).key;
    var c = courseOf(key);
    var main = document.getElementById('main');
    if (!c) {
      main.innerHTML = '<div class="container"><div class="empty-state glass" style="border-radius:var(--radius);margin-top:40px;">' +
        '<b>找不到这门课</b><a href="index.html" style="color:var(--accent-2);">回首页看全部课程</a></div></div>';
      return;
    }
    var list = postsOf(key);
    var stages = realStages(c);

    main.innerHTML = '<div class="container">' +
      '<div class="crumb" style="margin-top:26px;"><a href="index.html">首页</a><span>›</span>' +
        '<a href="library.html">学习资料</a><span>›</span><span>' + esc(c.name) + '</span></div>' +
      '<section class="course-hero glass enter">' +
        '<h1>' + esc(c.name) + '</h1>' +
        '<p>' + esc(c.desc || '') + '</p>' +
        '<div class="course-stats">' +
          '<div><b>' + c.items + '</b>篇资料</div>' +
          '<div><b>' + c.chapters + '</b>个章节</div>' +
          (stages.length > 1 ? '<div><b>' + stages.length + '</b>个阶段</div>' : '') +
          '<div><b>' + fmtWords(c.chars) + '</b>总字数</div>' +
          (c.updated ? '<div><b>' + fmtDate(c.updated) + '</b>最近更新</div>' : '') +
        '</div>' +
      '</section>' +
      downloadsBlockHTML(key) +
      searchBarHTML(key) +
      '<div id="hitWrap" hidden></div><div id="secWrap">' + stagesHTML(list, key) + '</div>' +
    '</div>';

    var input = $('#searchInput'), hitWrap = $('#hitWrap'), secWrap = $('#secWrap');
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { drawHits(input.value, key, hitWrap, secWrap); }, 140);
    });
    if (global.KIT_AFTER_RENDER) global.KIT_AFTER_RENDER();
    rdFromHash();
  }

  /* ------------------------------ 归档页 ------------------------------ */
  function renderArchive() {
    var main = document.getElementById('main');
    var total = POSTS.length;
    main.innerHTML = '<div class="container">' +
      '<div class="crumb" style="margin-top:26px;">' +
        '<a href="index.html">首页</a><span>›</span>' +
        '<a href="library.html">学习资料</a><span>›</span><span>按章节浏览</span>' +
      '</div>' +
      '<section class="course-hero glass enter">' +
        '<h1>全部资料</h1>' +
        '<p>' + COURSES.length + ' 门课、' + total + ' 篇资料，按「课程 → 阶段 → 章 → 篇」完整列出，和源文件夹一一对应。</p>' +
        '<div class="course-stats"><div><b>' + COURSES.length + '</b>门课</div>' +
          '<div><b>' + total + '</b>篇资料</div>' +
          '<div><b>' + COURSES.reduce(function (a, c) { return a + c.chapters; }, 0) + '</b>个章节</div></div>' +
      '</section>' +
      searchBarHTML(null) +
      '<div id="hitWrap" hidden></div>' +
      '<div id="secWrap">' + COURSES.map(function (c) {
        return '<div class="stage-block">' +
          '<h2 class="stage-title"><a href="course.html?c=' + encodeURIComponent(c.key) + '">' + esc(c.name) + '</a>' +
            '<em>' + c.chapters + ' 章 · ' + c.items + ' 篇</em></h2>' +
          '<div class="chapter-grid">' + groupsOf(postsOf(c.key)).map(function (st) {
            return st.chapters.map(function (ch) { return chapterCardHTML(ch, c.key); }).join('');
          }).join('') + '</div>' +
        '</div>';
      }).join('') + '</div>' +
    '</div>';

    var input = $('#searchInput'), hitWrap = $('#hitWrap'), secWrap = $('#secWrap');
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { drawHits(input.value, null, hitWrap, secWrap); }, 140);
    });
    if (global.KIT_AFTER_RENDER) global.KIT_AFTER_RENDER();
    rdFromHash();
  }

  global.StudyUI = {
    renderHome: renderHome,
    renderLibrary: renderLibrary,
    renderCourse: renderCourse,
    renderArchive: renderArchive,
    groupsOf: groupsOf, courseOf: courseOf, postsOf: postsOf
  };
})(window);
