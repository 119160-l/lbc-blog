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
      '<div class="hero-actions">' +
        '<a class="btn primary ripple-host press" href="#study">' + svg('book', 15) + '学习资料</a>' +
        '<a class="btn ripple-host press" href="archive.html">' + svg('archive', 15) + '按章节浏览</a>' +
        '<a class="btn ripple-host press" href="about.html">认识我</a>' +
      '</div>' +
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

  function studyBlockHTML() {
    var total = POSTS.length;
    var chars = COURSES.reduce(function (a, c) { return a + (c.chars || 0); }, 0);
    return '<section class="sec-block" id="study">' +
      '<div class="sec-head">' +
        '<span class="sec-icon">' + svg('book', 19) + '</span>' +
        '<h2>学习资料</h2>' +
        '<span class="sec-count">' + COURSES.length + ' 门课 · ' + total + ' 篇 · ' + fmtWords(chars) + '</span>' +
        '<a class="sec-more" href="archive.html">按章节浏览 →</a>' +
      '</div>' +
      '<p class="sec-desc">课程笔记、公式推导、练习题与仿真代码，完全按源文件夹的「课程 → 阶段 → 章 → 篇」结构归档。</p>' +
      '<div class="course-grid">' + COURSES.map(courseCardHTML).join('') + '</div>' +
    '</section>';
  }

  function essayBlockHTML() {
    var sec = SECTIONS.filter(function (s) { return s.key === 'essay'; })[0] || { desc: '随手记录，想到什么写什么' };
    var n = POSTS.filter(function (p) { return p.section === 'essay'; }).length;
    return '<section class="sec-block" id="essay">' +
      '<div class="sec-head">' +
        '<span class="sec-icon" style="background:linear-gradient(135deg,#fbbf24,#f97316);box-shadow:0 8px 18px rgba(251,191,36,.3);">' +
          svg('user', 18) + '</span>' +
        '<h2>生活随笔</h2>' +
        '<span class="sec-count">' + (n ? n + ' 篇' : '暂未开张') + '</span>' +
      '</div>' +
      '<p class="sec-desc">' + esc(sec.desc || '') + '</p>' +
      '<div class="empty-state glass reveal" style="border-radius:var(--radius-lg);padding:44px 20px;">' +
        '<b>这个板块先留个位置</b>' +
        '现在还没有随笔内容。等想写的时候，把 Markdown 放进随笔目录再重新导入一次就行 —— 板块、样式、列表都是现成的。' +
      '</div>' +
    '</section>';
  }

  function renderHome() {
    var main = document.getElementById('main');
    main.innerHTML = '<div class="container">' + heroHTML() + searchBarHTML() +
      '<div id="hitWrap" hidden></div><div id="secWrap">' + studyBlockHTML() + essayBlockHTML() + '</div>' +
      '</div>';

    var input = $('#searchInput'), hitWrap = $('#hitWrap'), secWrap = $('#secWrap');
    var timer = null;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { drawHits(input.value, null, hitWrap, secWrap); }, 140);
    });
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
        '<a href="index.html#study">学习资料</a><span>›</span><span>' + esc(c.name) + '</span></div>' +
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
  }

  /* ------------------------------ 归档页 ------------------------------ */
  function renderArchive() {
    var main = document.getElementById('main');
    var total = POSTS.length;
    main.innerHTML = '<div class="container">' +
      '<section class="course-hero glass enter" style="margin-top:26px;">' +
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
  }

  global.StudyUI = { renderHome: renderHome, renderCourse: renderCourse, renderArchive: renderArchive, groupsOf: groupsOf, courseOf: courseOf, postsOf: postsOf };
})(window);
