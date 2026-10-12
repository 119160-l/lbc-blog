/* ==========================================================================
   app.js —— 站点逻辑
   页面：index（首页）/ article（文章）/ archive（归档）/ about（关于）
   数据：site.js（站点信息）、posts.js（由 build.mjs 生成）
   Markdown：md.js（本地渲染器，零依赖）
   ========================================================================== */
(function () {
  'use strict';

  var S       = window.SITE || {};
  var POSTS   = (window.BLOG_POSTS || []).slice();
  var PAGE    = document.body.getAttribute('data-page') || 'home';
  var PARAM   = new URLSearchParams(location.search);
  var CATS    = S.categories || ['学习资料', '学习笔记', '生活感想'];
  var THEME_KEY = 'lbc-theme';

  var SHORT = { '学习资料': '资料', '学习笔记': '笔记', '生活感想': '生活' };

  var ICON = {
    search : '<path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215ZM11.5 7a4.5 4.5 0 1 0-9 0 4.5 4.5 0 0 0 9 0Z"/>',
    sun    : '<path d="M8 11a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm0 1a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM8 0h1v3H8V0Zm0 13h1v3H8v-3ZM0 8V7h3v1H0Zm13 0V7h3v1h-3ZM2.34 2.34l.7-.7L5.16 3.8l-.7.7-2.12-2.16Zm8.5 8.5.7-.7 2.12 2.16-.7.7-2.12-2.16Zm0-8.5 2.12-2.16.7.7-2.12 2.16-.7-.7ZM2.34 13.66l2.12-2.16.7.7-2.12 2.16-.7-.7Z"/>',
    moon   : '<path d="M9.598 1.591a.749.749 0 0 1 .785-.175 7.001 7.001 0 1 1-8.967 8.967.75.75 0 0 1 .961-.96 5.5 5.5 0 0 0 7.046-7.046.75.75 0 0 1 .175-.786Z"/>',
    menu   : '<path d="M1 2.75A.75.75 0 0 1 1.75 2h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 2.75Zm0 5A.75.75 0 0 1 1.75 7h12.5a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 7.75ZM1.75 12h12.5a.75.75 0 0 1 0 1.5H1.75a.75.75 0 0 1 0-1.5Z"/>',
    chart  : '<path d="M1.75 1a.75.75 0 0 1 .75.75v11.5h11.75a.75.75 0 0 1 0 1.5H1.75A.75.75 0 0 1 1 14.25V1.75A.75.75 0 0 1 1.75 1Zm11.03 3.28a.75.75 0 0 1 0 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0L6.5 7.06 3.78 9.78a.75.75 0 0 1-1.06-1.06l3.25-3.25a.75.75 0 0 1 1.06 0l1.72 1.72 2.97-2.97a.75.75 0 0 1 1.06 0Z"/>',
    bell   : '<path d="M8 16a2 2 0 0 0 1.985-1.75h-3.97A2 2 0 0 0 8 16Zm6-4.5V8a6 6 0 1 0-12 0v3.5L.72 13.28A.75.75 0 0 0 1.25 14.5h13.5a.75.75 0 0 0 .53-1.22L14 11.5Z"/>',
    tag    : '<path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h5.086a2 2 0 0 1 1.414.586l5.414 5.414a2 2 0 0 1 0 2.828l-4.586 4.586a2 2 0 0 1-2.828 0L1.586 8.999A2 2 0 0 1 1 7.585V2.5Zm4 3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"/>',
    book   : '<path d="M1.75 1h5.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 7.25 15h-5.5A1.75 1.75 0 0 1 0 13.25V2.75C0 1.784.784 1 1.75 1Zm7.75 1.75v10.5c0 .966.784 1.75 1.75 1.75h3.5c.966 0 1.75-.784 1.75-1.75v-7.72a1.75 1.75 0 0 0-.513-1.237L13.03 1.267A1.75 1.75 0 0 0 11.793.754H11.25c-.966 0-1.75.784-1.75 1.75Z"/>',
    archive: '<path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v1.5A1.75 1.75 0 0 1 14.25 6H1.75A1.75 1.75 0 0 1 0 4.25v-1.5ZM1.75 7.5h12.5l-.25 6.75A1.75 1.75 0 0 1 12.26 16H3.74A1.75 1.75 0 0 1 2 14.25L1.75 7.5Zm4.75 2a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Z"/>',
    up     : '<path d="M3.47 7.78a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1-1.06 1.06L8.75 4.56v8.69a.75.75 0 0 1-1.5 0V4.56L4.53 7.78a.75.75 0 0 1-1.06 0Z"/>',
    info   : '<path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>',
    user   : '<path d="M8 8.25a3.375 3.375 0 1 0 0-6.75 3.375 3.375 0 0 0 0 6.75Zm0 1.5c-3.14 0-5.75 1.94-5.75 4.35 0 .66.54 1.2 1.2 1.2h9.1c.66 0 1.2-.54 1.2-1.2 0-2.41-2.61-4.35-5.75-4.35Z"/>'
  };
  function svg(name, size) {
    return '<svg width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">' + ICON[name] + '</svg>';
  }

  /* ------------------------------ 工具 ------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function fmtDate(d) {
    var p = String(d || '').split('-');
    return p.length === 3 ? p[0] + '.' + p[1] + '.' + p[2] : String(d || '');
  }
  function fmtDateCN(d) {
    var p = String(d || '').split('-');
    return p.length === 3 ? p[0] + ' 年 ' + (+p[1]) + ' 月 ' + (+p[2]) + ' 日' : String(d || '');
  }
  function relDate(d) {
    var t = new Date(String(d || '').replace(/-/g, '/') + ' 00:00:00');
    if (isNaN(t)) return '';
    var days = Math.floor((Date.now() - t.getTime()) / 86400000);
    if (days <= 0) return '今天';
    if (days === 1) return '昨天';
    if (days < 30) return days + ' 天前';
    if (days < 365) return Math.floor(days / 30) + ' 个月前';
    return Math.floor(days / 365) + ' 年前';
  }
  function minutes(p) { return p.minutes || Math.max(1, Math.round((p.chars || 0) / 350)); }
  function shortOf(cat) { return SHORT[cat] || String(cat || '文章').slice(0, 2); }
  function catClass(cat) { return 'cat-' + String(cat || '').replace(/[^\w\u4e00-\u9fa5]/g, ''); }
  function bodyText(p) { return window.BlogMD ? window.BlogMD.plain(p.body || '') : (p.body || ''); }

  /* ------------------------------ 主题 ------------------------------ */
  var currentTheme = 'light';
  function readTheme() {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch (e) { return 'light'; }
  }
  function setTheme(t, animate, ox, oy) {
    var root = document.documentElement;
    var apply = function () {
      root.setAttribute('data-theme', t);
      currentTheme = t;
      try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
      var btn = $('#themeBtn');
      if (btn) btn.innerHTML = svg(t === 'dark' ? 'sun' : 'moon', 17);
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', t === 'dark' ? '#0f172a' : '#fbfaf7');
    };
    if (!animate) { apply(); return; }

    /* 从点击处扩散的圆形「液面」过渡 */
    var r = Math.hypot(Math.max(ox, innerWidth - ox), Math.max(oy, innerHeight - oy)) * 1.05;
    var w = document.createElement('div');
    w.style.cssText = 'position:fixed;z-index:9999;pointer-events:none;border-radius:50%;' +
      'left:' + ox + 'px;top:' + oy + 'px;width:' + (r * 2) + 'px;height:' + (r * 2) + 'px;' +
      'margin-left:' + (-r) + 'px;margin-top:' + (-r) + 'px;transform:scale(0);' +
      'background:' + (t === 'dark' ? '#0f172a' : '#fbfaf7') + ';' +
      'transition:transform .56s cubic-bezier(.22,.68,.28,1);';
    document.body.appendChild(w);
    requestAnimationFrame(function () {
      w.style.transform = 'scale(1)';
      setTimeout(function () {
        apply();
        w.style.transition = 'opacity .32s ease';
        w.style.opacity = '0';
        setTimeout(function () { w.remove(); }, 340);
      }, 330);
    });
  }

  /* ------------------------------ 玻璃指针高光 ------------------------------ */
  function noHover() {
    try { return !!(window.matchMedia && window.matchMedia('(hover: none)').matches); }
    catch (e) { return false; }
  }
  function initGlass() {
    if (noHover() || typeof document.addEventListener !== 'function') return;
    var pending = null, raf = 0;
    document.addEventListener('pointermove', function (e) {
      pending = e;
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = 0;
        var ev = pending; if (!ev) return;
        var el = ev.target.closest && ev.target.closest('.glass');
        if (!el) return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((ev.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((ev.clientY - r.top) / r.height * 100) + '%');
      });
    }, { passive: true });
  }

  /* ------------------------------ 点击涟漪 ------------------------------ */
  function initRipple() {
    document.addEventListener('pointerdown', function (e) {
      var el = e.target.closest && e.target.closest('.ripple-host');
      if (!el) return;
      var r = el.getBoundingClientRect();
      var size = Math.max(r.width, r.height) * 1.1;
      var s = document.createElement('span');
      s.className = 'ripple';
      s.style.width = s.style.height = size + 'px';
      s.style.left = (e.clientX - r.left - size / 2) + 'px';
      s.style.top = (e.clientY - r.top - size / 2) + 'px';
      el.appendChild(s);
      setTimeout(function () { s.remove(); }, 660);
    });
  }

  /* ------------------------------ 页面骨架 ------------------------------ */
  function navbarHTML(active) {
    var items = [
      { href: 'index.html', label: '首页', key: 'home' },
      { href: 'index.html?cat=' + encodeURIComponent(CATS[0] || ''), label: CATS[0], key: 'c0' },
      { href: 'index.html?cat=' + encodeURIComponent(CATS[1] || ''), label: CATS[1], key: 'c1' },
      { href: 'index.html?cat=' + encodeURIComponent(CATS[2] || ''), label: CATS[2], key: 'c2' },
      { href: 'archive.html', label: '归档', key: 'archive' },
      { href: 'about.html', label: '关于', key: 'about' }
    ];
    var selCat = PARAM.get('cat') || '';
    return '<header class="site-header glass" id="siteHeader"><div class="navbar">' +
      '<a class="logo" href="index.html">' +
        '<span class="logo-mark">' + esc(S.logoText || '知') + '</span>' +
        '<span class="logo-text">' + esc(S.name || '知行手记') + '</span>' +
      '</a>' +
      '<nav class="nav-links" id="navLinks">' +
        items.map(function (it) {
          var on = it.key === active || (active === 'home' && selCat && it.label === selCat);
          return '<a href="' + it.href + '"' + (on ? ' class="active"' : '') + '>' + esc(it.label) + '</a>';
        }).join('') +
      '</nav>' +
      '<div class="header-actions">' +
        '<button class="icon-btn ripple-host" id="accountBtn" title="登录（上传配图用）" aria-label="账号">' + svg('user', 17) + '</button>' +
        '<button class="icon-btn ripple-host" id="searchBtn" title="搜索" aria-label="搜索">' + svg('search', 17) + '</button>' +
        '<button class="icon-btn ripple-host" id="themeBtn" title="切换主题" aria-label="切换主题">' + svg('moon', 17) + '</button>' +
        '<button class="icon-btn menu-btn ripple-host" id="menuBtn" title="菜单" aria-label="菜单">' + svg('menu', 17) + '</button>' +
      '</div>' +
    '</div></header>';
  }

  function footerHTML() {
    return '<footer class="site-footer">' +
      '<p>© ' + new Date().getFullYear() + ' ' + esc(S.name || '') +
        '　·　共 ' + POSTS.length + ' 篇文章　·　' + esc(S.footer || '') + '</p>' +
      (S.email ? '<p><a href="mailto:' + esc(S.email) + '">' + esc(S.email) + '</a></p>' : '') +
    '</footer>' +
    '<button class="to-top glass press" id="toTop" aria-label="回到顶部">' + svg('up', 17) + '</button>';
  }

  function mobileNavHTML(active) {
    var items = [
      { href: 'index.html', label: '首页', icon: 'book', key: 'home' },
      { href: 'archive.html', label: '归档', icon: 'archive', key: 'archive' },
      { href: '#search', label: '搜索', icon: 'search', key: 'search' },
      { href: 'about.html', label: '关于', icon: 'info', key: 'about' }
    ];
    return '<nav class="mobile-nav glass">' + items.map(function (it) {
      return '<a href="' + it.href + '"' + (it.key === active ? ' class="active"' : '') + '>' +
        svg(it.icon, 17) + '<span>' + it.label + '</span></a>';
    }).join('') + '</nav>';
  }

  function buildChrome() {
    var active = PAGE === 'article' ? 'home' : PAGE;
    var h = $('#siteHeaderMount'); if (h) h.outerHTML = navbarHTML(active);
    var f = $('#siteFooterMount'); if (f) f.outerHTML = footerHTML();
    var m = $('#mobileNavMount'); if (m) m.outerHTML = mobileNavHTML(active);
    if (!document.querySelector('.bg-blobs')) {
      document.body.insertAdjacentHTML('afterbegin', '<div class="bg-blobs" aria-hidden="true"><i></i><i></i><i></i></div>');
    }

    var mb = $('#menuBtn');
    if (mb) mb.onclick = function (e) { e.stopPropagation(); $('#navLinks').classList.toggle('open'); };
    document.addEventListener('click', function (e) {
      var nl = $('#navLinks');
      if (nl && nl.classList.contains('open') && !e.target.closest('.navbar')) nl.classList.remove('open');
    });

    var tb = $('#themeBtn');
    if (tb) tb.onclick = function (e) {
      var r = tb.getBoundingClientRect();
      setTheme(currentTheme === 'dark' ? 'light' : 'dark', true, r.left + r.width / 2, r.top + r.height / 2);
    };

    var sb = $('#searchBtn');
    if (sb) sb.onclick = function () {
      if (PAGE !== 'home') { location.href = 'index.html#search'; return; }
      var i = $('#searchInput');
      if (i) { i.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function () { i.focus(); }, 320); }
    };

    var tt = $('#toTop');
    if (tt) {
      tt.onclick = function () { window.scrollTo({ top: 0, behavior: 'smooth' }); };
      window.addEventListener('scroll', function () {
        tt.classList.toggle('show', window.scrollY > 520);
      }, { passive: true });
    }

    var hdr = $('#siteHeader');
    if (hdr) window.addEventListener('scroll', function () {
      hdr.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });

    /* 移动端底部导航的「搜索」 */
    $$('.mobile-nav a[href="#search"]').forEach(function (a) {
      a.onclick = function (e) {
        if (PAGE !== 'home') return;
        e.preventDefault();
        var i = $('#searchInput');
        if (i) { i.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function () { i.focus(); }, 320); }
      };
    });
  }

  /* ------------------------------ 滚动揭示 ------------------------------ */
  function initReveal() {
    var els = $$('.reveal').filter(function (el) { return !el.dataset.rv; });
    if (!els.length) return;
    els.forEach(function (el) { el.dataset.rv = '1'; });
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .04 });
    els.forEach(function (el, i) {
      el.style.transitionDelay = Math.min(i % 6, 5) * 55 + 'ms';
      io.observe(el);
    });
  }

  /* ------------------------------ 代码块复制 ------------------------------ */
  function initCodeCopy(root) {
    $$('pre', root || document).forEach(function (pre) {
      if (pre.querySelector('.copy-btn')) return;
      var b = document.createElement('button');
      b.className = 'copy-btn';
      b.type = 'button';
      b.textContent = '复制';
      b.onclick = function () {
        var code = pre.querySelector('code');
        var txt = code ? code.innerText : pre.innerText;
        var done = function () {
          b.textContent = '已复制';
          setTimeout(function () { b.textContent = '复制'; }, 1400);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(done, function () { fallback(txt); done(); });
        } else { fallback(txt); done(); }
      };
      pre.appendChild(b);
    });
    function fallback(txt) {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.cssText = 'position:fixed;opacity:0;';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      ta.remove();
    }
  }

  /* ------------------------------ 侧栏 ------------------------------ */
  function sidebarHTML(tagClickPrefix) {
    var tagCount = {};
    POSTS.forEach(function (p) {
      (p.tags || []).forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; });
    });
    var tags = Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a]; });
    var catCount = {};
    POSTS.forEach(function (p) { catCount[p.category] = (catCount[p.category] || 0) + 1; });
    var catN = Object.keys(catCount).length;
    var pre = tagClickPrefix || 'index.html?tag=';

    return '<aside class="sidebar">' +

      '<div class="panel glass reveal">' +
        '<h3>' + svg('chart', 16) + '站点数据</h3>' +
        '<div class="stat-grid">' +
          '<div class="stat-cell"><b>' + POSTS.length + '</b><span>篇文章</span></div>' +
          '<div class="stat-cell"><b>' + catN + '</b><span>个分类</span></div>' +
          '<div class="stat-cell"><b>' + tags.length + '</b><span>个标签</span></div>' +
          '<div class="stat-cell"><b>' + POSTS.reduce(function (a, p) { return a + minutes(p); }, 0) + '</b><span>分钟阅读</span></div>' +
        '</div>' +
      '</div>' +

      ((S.notices && S.notices.length)
        ? '<div class="panel glass reveal">' +
            '<h3>' + svg('bell', 16) + '站点通知</h3>' +
            '<ul class="notice-list" style="list-style:none;margin:0;padding:0;">' +
              S.notices.map(function (n) {
                return '<li><span class="dot">·</span><span>' + esc(n.text) +
                  (n.date ? '<time>' + esc(n.date) + '</time>' : '') + '</span></li>';
              }).join('') +
            '</ul>' +
          '</div>'
        : '') +

      '<div class="panel glass reveal">' +
        '<h3>' + svg('tag', 16) + '标签</h3>' +
        '<div class="tag-cloud">' +
          (tags.length
            ? tags.map(function (t) {
                return '<a href="' + pre + encodeURIComponent(t) + '">' + esc(t) + '<b>' + tagCount[t] + '</b></a>';
              }).join('')
            : '<span style="font-size:14px;color:var(--muted-2);">暂无标签</span>') +
        '</div>' +
      '</div>' +

    '</aside>';
  }

  /* ------------------------------ 首页 ------------------------------ */
  function renderHome() {
    var cat = PARAM.get('cat') || '';
    var tag = PARAM.get('tag') || '';
    var q = PARAM.get('q') || '';

    var hero = '<section class="hero-banner glass enter">' +
      '<h1>' + esc(S.tagline || '记录学习，也记录生活') + '</h1>' +
      '<p>' + esc(S.intro || '') + '</p>' +
      '<div class="hero-actions">' +
        '<a class="btn primary ripple-host press" href="archive.html">' + svg('archive', 15) + '浏览归档</a>' +
        '<a class="btn ripple-host press" href="about.html">认识我</a>' +
      '</div>' +
    '</section>';

    var toolbar = '<div class="toolbar-panel glass reveal">' +
      '<label class="searchbox">' + svg('search', 16) +
        '<input id="searchInput" type="search" placeholder="搜索标题、标签或正文…" value="' + esc(q) + '" autocomplete="off">' +
      '</label>' +
      '<div class="pills" id="pills">' +
        '<button class="pill ripple-host' + (!cat && !tag ? ' active' : '') + '" data-cat="">全部</button>' +
        CATS.map(function (c) {
          var n = POSTS.filter(function (p) { return p.category === c; }).length;
          return '<button class="pill ripple-host' + (cat === c ? ' active' : '') + '" data-cat="' + esc(c) + '">' +
            esc(c) + ' ' + n + '</button>';
        }).join('') +
        (tag ? '<button class="pill ripple-host active" data-clear="1">#' + esc(tag) + ' ✕</button>' : '') +
      '</div>' +
    '</div>';

    var main =
      '<section class="section">' +
        '<div class="section-head">' + svg('book', 18).replace('<svg ', '<span class="section-icon"><svg ') + '</span>' +
          '<h2>' + (cat || tag ? esc(cat || ('#' + tag)) : '推荐文章') + '</h2>' +
          '<span class="more" id="countTip"></span>' +
        '</div>' +
        '<div class="article-list" id="postList"></div>' +
      '</section>';

    document.getElementById('main').innerHTML =
      '<div class="container">' + hero + toolbar +
        '<div class="page-grid"><div class="main-col">' + main + '</div>' + sidebarHTML() + '</div>' +
      '</div>';

    var listEl = $('#postList');
    var state = { cat: cat, tag: tag };

    function draw() {
      var kw = ($('#searchInput').value || '').trim().toLowerCase();
      var arr = POSTS.filter(function (p) {
        if (state.cat && p.category !== state.cat) return false;
        if (state.tag && (p.tags || []).indexOf(state.tag) === -1) return false;
        if (kw) {
          var hay = (p.title + ' ' + (p.excerpt || '') + ' ' + (p.tags || []).join(' ') + ' ' + p.category + ' ' + bodyText(p)).toLowerCase();
          if (hay.indexOf(kw) === -1) return false;
        }
        return true;
      });

      $('#countTip').textContent = arr.length ? arr.length + ' 篇' : '';
      listEl.innerHTML = arr.length ? arr.map(cardHTML).join('')
        : '<div class="empty-state glass" style="border-radius:var(--radius);"><b>没有找到匹配的内容</b>换个关键词，或点上面的「全部」看看。</div>';

      $$('.post-card', listEl).forEach(function (el, i) {
        el.classList.add('reveal');
        el.style.transitionDelay = Math.min(i, 6) * 45 + 'ms';
      });
      initReveal();
    }
    draw();

    var timer = null;
    $('#searchInput').addEventListener('input', function () {
      clearTimeout(timer); timer = setTimeout(draw, 160);
    });

    $('#pills').addEventListener('click', function (e) {
      var b = e.target.closest('.pill'); if (!b) return;
      if (b.hasAttribute('data-clear')) { location.href = 'index.html'; return; }
      var v = b.getAttribute('data-cat');
      state.cat = v; state.tag = '';
      $$('.pill', $('#pills')).forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      var t = $('#countTip'), sh = $('.section-head h2');
      if (sh) sh.textContent = v || '推荐文章';
      draw();
      history.replaceState(null, '', v ? 'index.html?cat=' + encodeURIComponent(v) : 'index.html');
    });
  }

  function cardHTML(p) {
    var tags = (p.tags || []).slice(0, 2).map(function (t) { return '#' + t; }).join(' ');
    return '<a class="post-card glass ripple-host reveal" href="article.html?id=' + encodeURIComponent(p.id || p.slug) + '">' +
      '<div class="post-thumb thumb-' + esc(p.category || '') + '"><span>' + esc(shortOf(p.category)) + '</span></div>' +
      '<div class="post-info">' +
        '<h2>' + esc(p.title) + '</h2>' +
        '<p>' + esc(p.excerpt || bodyText(p).slice(0, 90)) + '</p>' +
        '<div class="meta-row">' +
          '<span class="tag ' + catClass(p.category) + '">' + esc(p.category || '未分类') + '</span>' +
          '<span>' + fmtDate(p.date) + '</span>' +
          '<span>' + relDate(p.date) + '</span>' +
          (tags ? '<span>' + esc(tags) + '</span>' : '') +
          '<span class="spacer">' + minutes(p) + ' 分钟</span>' +
        '</div>' +
      '</div>' +
    '</a>';
  }

  /* ------------------------------ 文章页 ------------------------------ */
  function renderArticle() {
    var id = PARAM.get('id') || '';
    var idx = -1;
    POSTS.forEach(function (p, i) { if ((p.id || p.slug) === id) idx = i; });
    var main = document.getElementById('main');

    if (idx === -1) {
      main.innerHTML = '<div class="container"><div class="empty-state glass" style="border-radius:var(--radius);">' +
        '<b>找不到这篇文章</b>它可能已被移动或删除。 <a href="index.html" style="color:var(--accent-2);">返回首页</a></div></div>';
      return;
    }

    var p = POSTS[idx];
    var prev = POSTS[idx + 1];
    var next = POSTS[idx - 1];

    main.innerHTML = '<div class="container"><div class="article-shell">' +
      '<article class="article-reader glass enter">' +
        '<a class="back-link" href="index.html">← 返回首页</a>' +
        '<header class="article-header">' +
          '<span class="tag ' + catClass(p.category) + '">' + esc(p.category || '未分类') + '</span>' +
          '<h1>' + esc(p.title) + '</h1>' +
          '<div class="meta-row">' +
            '<span>' + fmtDateCN(p.date) + '</span><span>·</span>' +
            '<span>约 ' + minutes(p) + ' 分钟</span><span>·</span>' +
            '<span>' + (p.chars || 0) + ' 字</span>' +
            ((p.tags || []).length ? '<span>·</span><span>' + p.tags.map(function (t) {
              return '<a href="index.html?tag=' + encodeURIComponent(t) + '" style="color:var(--accent-2);">#' + esc(t) + '</a>';
            }).join(' ') + '</span>' : '') +
          '</div>' +
        '</header>' +
        '<div class="markdown-body" id="postBody">' + window.BlogMD.render(p.body || '') + '</div>' +
        '<div class="pager">' +
          (next ? '<a class="press" href="article.html?id=' + encodeURIComponent(next.id || next.slug) + '"><span class="lbl">← 上一篇</span><span class="ttl">' + esc(next.title) + '</span></a>' : '<span></span>') +
          (prev ? '<a class="press right" href="article.html?id=' + encodeURIComponent(prev.id || prev.slug) + '"><span class="lbl">下一篇 →</span><span class="ttl">' + esc(prev.title) + '</span></a>' : '<span></span>') +
        '</div>' +
      '</article>' +
      '<div id="tocMount"></div>' +
    '</div></div>';

    document.title = p.title + ' · ' + (S.name || '');
    var md = document.querySelector('meta[name="description"]');
    if (md && p.excerpt) md.setAttribute('content', p.excerpt);

    initCodeCopy($('#postBody'));
    buildToc();
    initReveal();
    initProgress();

    /* 文章底部的「配图与附件」「留言板」由 cloud-ui.js 负责挂载 */
    if (window.BlogCloud && window.BlogCloud.mountArticle) window.BlogCloud.mountArticle(p);
  }

  function buildToc() {
    var body = $('#postBody');
    var heads = $$('h2, h3', body);
    if (heads.length < 3) return;

    heads.forEach(function (h, i) { h.id = 'sec-' + i; });

    $('#tocMount').innerHTML = '<aside class="article-toc glass">' +
      '<h3>目录</h3><ul>' +
      heads.map(function (h, i) {
        return '<li' + (h.tagName === 'H3' ? ' class="lv3"' : '') + '>' +
          '<a href="#sec-' + i + '" data-target="sec-' + i + '">' + esc(h.textContent) + '</a></li>';
      }).join('') +
      '</ul></aside>';

    var links = $$('#tocMount a');
    var ticking = false;
    function spy() {
      ticking = false;
      var y = window.scrollY + 140;
      var cur = links[0];
      for (var i = 0; i < heads.length; i++) {
        if (heads[i].offsetTop <= y) cur = links[i];
      }
      links.forEach(function (a) { a.classList.toggle('current', a === cur); });
    }
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(spy);
    }, { passive: true });
    spy();
  }

  function initProgress() {
    var bar = document.createElement('div');
    bar.className = 'read-progress';
    document.body.appendChild(bar);
    window.addEventListener('scroll', function () {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      bar.style.width = (h > 0 ? Math.min(100, window.scrollY / h * 100) : 0) + '%';
    }, { passive: true });
  }

  /* ------------------------------ 归档页 ------------------------------ */
  function renderArchive() {
    var groups = {};
    POSTS.forEach(function (p) {
      var k = String(p.date || '0000-00').slice(0, 7);
      (groups[k] = groups[k] || []).push(p);
    });
    var keys = Object.keys(groups).sort().reverse();

    var body = keys.length ? keys.map(function (k) {
      var a = k.split('-');
      return '<section class="archive-group glass reveal" id="' + k + '">' +
        '<h3>' + a[0] + ' 年 ' + (+a[1]) + ' 月<span>' + groups[k].length + ' 篇</span></h3>' +
        '<ul>' + groups[k].map(function (p) {
          return '<li><a class="ripple-host" href="article.html?id=' + encodeURIComponent(p.id || p.slug) + '">' +
            '<time>' + String(p.date).slice(5) + '</time>' +
            '<span class="ttl">' + esc(p.title) + '</span>' +
            '<span class="tag ' + catClass(p.category) + '">' + esc(p.category || '') + '</span>' +
          '</a></li>';
        }).join('') + '</ul>' +
      '</section>';
    }).join('') : '<div class="empty-state glass" style="border-radius:var(--radius);"><b>还没有文章</b>去首页看看。</div>';

    document.getElementById('main').innerHTML =
      '<div class="container">' +
        '<section class="hero-banner glass enter" style="min-height:220px;padding:40px 46px;">' +
          '<h1 style="font-size:38px;">归档</h1>' +
          '<p>共 ' + POSTS.length + ' 篇文章，按时间倒序排列。左侧点月份可跳转，右侧可按标签筛选。</p>' +
        '</section>' +
        '<div class="page-grid"><div class="main-col">' + body + '</div>' + sidebarHTML() + '</div>' +
      '</div>';

    initReveal();
  }

  /* ------------------------------ 关于页 ------------------------------ */
  function renderAbout() {
    var info = (S.info || []).map(function (it) {
      return '<div class="info-cell glass reveal"><span>' + esc(it.k) + '</span><b>' + esc(it.v) + '</b></div>';
    }).join('');

    var links = (S.links || []).map(function (l) {
      return '<a class="btn ripple-host press" href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
    }).join('');

    var mount = $('#aboutMount');
    if (!mount) return;

    mount.insertAdjacentHTML('beforebegin',
      '<section class="about-hero glass enter">' +
        '<div class="about-avatar">' + esc(S.logoText || '知') + '</div>' +
        '<div>' +
          '<h1>' + esc(S.author || S.name || '') + '</h1>' +
          '<p>' + esc(S.tagline || '') + '</p>' +
        '</div>' +
      '</section>' +
      (info ? '<div class="info-grid">' + info + '</div>' : ''));
    mount.className = 'about-body glass enter';

    if (links) mount.insertAdjacentHTML('afterend', '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:26px;">' + links + '</div>');
    initReveal();
  }

  /* ------------------------------ 启动 ------------------------------ */
  var booted = false;
  function boot() {
    if (booted) return;   /* 防止重复初始化导致内容重复插入 */
    booted = true;

    currentTheme = readTheme();
    document.documentElement.setAttribute('data-theme', currentTheme);

    buildChrome();
    if ($('#themeBtn')) $('#themeBtn').innerHTML = svg(currentTheme === 'dark' ? 'sun' : 'moon', 17);

    if (PAGE === 'home')    renderHome();
    if (PAGE === 'article') renderArticle();
    if (PAGE === 'archive') renderArchive();
    if (PAGE === 'about')   renderAbout();

    initGlass();
    initRipple();
    initReveal();

    if (location.hash === '#search' && PAGE === 'home') {
      var i = $('#searchInput');
      if (i) setTimeout(function () { i.focus(); }, 300);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
