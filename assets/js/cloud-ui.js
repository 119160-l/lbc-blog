/* ==========================================================================
   cloud-ui.js —— 留言板 + 配图/附件的界面层
   依赖：cloud.js（window.CloudAPI）、app.js 提供的主题令牌与 esc 风格

   app.js 在渲染文章页时会调用 window.BlogCloud.mountArticle(post)
   全站任意页面的导航栏「人像」按钮打开登录面板
   ========================================================================== */
(function () {
  'use strict';

  var API = window.CloudAPI;
  var CFG = (API && API.config) || {};

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  function fmtTime(v) {
    var d = new Date(String(v || '').replace(' ', 'T'));
    if (isNaN(d.getTime())) return '';
    function p2(n) { return n < 10 ? '0' + n : '' + n; }
    return d.getFullYear() + '.' + p2(d.getMonth() + 1) + '.' + p2(d.getDate()) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function fmtSize(n) {
    n = Number(n) || 0;
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(2) + ' MB';
  }
  function errText(e) {
    if (!e) return '操作失败';
    if (e.code === 'NO_SESSION') return '请先登录后再上传';
    if (e.code === 'RLS_BLOCKED') return '操作被安全策略拒绝，可能不属于当前账号';
    if (e.code === 'BAD_PATH') return '文件路径不合法';
    if (e.code === 'CLOUD_NOT_READY') return '云服务未就绪：' + (API.failReason || '');
    var m = String(e.message || '');
    /* 云服务只接受已登记的发布域名，用 file:// 打开或换域名访问时会走这里 */
    if (/failed to fetch|networkerror|load failed|network request failed/i.test(m)) {
      return '连不上云服务：请通过已发布的网址打开（' + (CFG.endpoint || '') + '），本地文件直接打开会被浏览器拦截';
    }
    return m || '操作失败';
  }
  /* preview_b64 是纯 base64，渲染前做一次白名单校验，避免被塞进 data 以外的协议 */
  function previewSrc(b64) {
    var s = String(b64 || '');
    return /^[A-Za-z0-9+/=]+$/.test(s) && s.length > 32 ? 'data:image/jpeg;base64,' + s : '';
  }

  /* ============================ 状态 ============================ */
  var session = null;          /* 当前会话 */
  var ready = false;           /* SDK 是否可用 */
  var currentPost = null;      /* 文章页正在看的 post */

  /* ============================ 模态框 ============================ */
  var modal = null, pendingCode = null, countdownTimer = 0;

  function buildModal() {
    modal = el(
      '<div class="cb-mask" id="cloudModal" hidden>' +
        '<div class="cb-modal glass" role="dialog" aria-modal="true" aria-label="账号">' +
          '<div class="cb-modal-head">' +
            '<h3>博主账号</h3>' +
            '<button class="cb-x ripple-host" id="cbClose" type="button" aria-label="关闭">✕</button>' +
          '</div>' +
          '<div class="cb-modal-body" id="cbBody"></div>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(modal);
    $('#cbClose', modal).onclick = closeModal;
    modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeModal(); });
  }

  function openModal(view) {
    if (!modal) buildModal();
    renderModal(view);
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.style.overflow = '';
    clearInterval(countdownTimer);
  }

  function renderModal(view) {
    var body = $('#cbBody', modal);
    if (!ready) {
      body.innerHTML = '<div class="cb-alert">云服务未就绪：' + esc(API ? API.failReason : 'CloudAPI 缺失') + '</div>';
      return;
    }
    if (session) {
      var u = session.user || {};
      var who = u.email || u.phone || u.name || ('账号 ' + String(u.id || '').slice(0, 8));
      body.innerHTML =
        '<div class="cb-alert ok">已登录：' + esc(who) + '</div>' +
        '<p class="cb-note">登录后可以在文章底部上传配图与附件；原图保存在云存储，只有登录用户可以下载。</p>' +
        '<div class="cb-actions"><button class="btn press" id="cbSignOut" type="button">退出登录</button></div>';
      $('#cbSignOut', body).onclick = function () {
        this.disabled = true;
        API.signOut().then(function () { closeModal(); });
      };
      return;
    }

    var tab = view === 'email' ? 'email' : 'wechat';
    body.innerHTML =
      '<div class="cb-tabs">' +
        '<button class="cb-tab' + (tab === 'wechat' ? ' active' : '') + '" data-tab="wechat" type="button">微信登录</button>' +
        '<button class="cb-tab' + (tab === 'email' ? ' active' : '') + '" data-tab="email" type="button">邮箱验证码</button>' +
      '</div>' +

      '<div class="cb-pane" data-pane="wechat"' + (tab === 'wechat' ? '' : ' hidden') + '>' +
        '<p class="cb-note">在微信里确认即可登录，无需注册账号。登录后用于在文章底部上传配图与附件。</p>' +
        '<div class="cb-actions"><button class="btn primary ripple-host press" id="cbWechat" type="button">微信一键登录 / 扫码登录</button></div>' +
      '</div>' +

      '<div class="cb-pane" data-pane="email"' + (tab === 'email' ? '' : ' hidden') + '>' +
        '<label class="cb-field"><span>邮箱</span>' +
          '<input id="cbEmail" type="email" autocomplete="email" placeholder="you@example.com">' +
        '</label>' +
        '<label class="cb-field"><span>验证码</span>' +
          '<span class="cb-code-row">' +
            '<input id="cbCode" inputmode="numeric" autocomplete="one-time-code" placeholder="6 位验证码">' +
            '<button class="btn press" id="cbSendCode" type="button">获取验证码</button>' +
          '</span>' +
        '</label>' +
        '<label class="cb-field" id="cbPwField" hidden><span>密码</span>' +
          '<input id="cbPw" type="password" autocomplete="new-password" placeholder="新账号需要设置密码">' +
        '</label>' +
        '<div class="cb-actions"><button class="btn primary ripple-host press" id="cbEmailSubmit" type="button">登录 / 注册</button></div>' +
      '</div>' +

      '<div class="cb-msg" id="cbMsg"></div>';

    $$('.cb-tab', body).forEach(function (b) {
      b.onclick = function () {
        $$('.cb-tab', body).forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var t = b.getAttribute('data-tab');
        $$('.cb-pane', body).forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== t; });
        msg('');
      };
    });

    $('#cbWechat', body).onclick = function () {
      var btn = this;
      btn.disabled = true; msg('正在跳转微信授权…');
      API.signInWechat().then(function (r) {
        if (r.error) { btn.disabled = false; msg(errText(r.error)); }
      });
    };

    $('#cbSendCode', body).onclick = function () {
      var btn = this;
      var email = ($('#cbEmail', body).value || '').trim();
      pendingCode = null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg('请输入正确的邮箱地址'); return; }
      btn.disabled = true; msg('正在发送验证码…');
      API.sendEmailCode(email).then(function (r) {
        if (r.error) { btn.disabled = false; msg(errText(r.error)); return; }
        pendingCode = { email: email, isExistingUser: r.data.isExistingUser };
        /* 新账号需要密码：SDK 要求邮箱注册必须带密码 */
        $('#cbPwField', body).hidden = !!r.data.isExistingUser;
        msg(r.data.isExistingUser ? '验证码已发送，请查收邮箱' : '这是新账号，请先设置密码，验证码已发送');
        var n = 60;
        btn.textContent = n + 's 后重发';
        clearInterval(countdownTimer);
        countdownTimer = setInterval(function () {
          n -= 1;
          if (n <= 0) { clearInterval(countdownTimer); btn.disabled = false; btn.textContent = '获取验证码'; }
          else btn.textContent = n + 's 后重发';
        }, 1000);
      });
    };

    $('#cbEmailSubmit', body).onclick = function () {
      var btn = this;
      var email = ($('#cbEmail', body).value || '').trim();
      var code = ($('#cbCode', body).value || '').trim();
      var pw = ($('#cbPw', body).value || '');
      if (!pendingCode || pendingCode.email !== email) { msg('请先为当前邮箱获取验证码'); return; }
      if (!code) { msg('请输入验证码'); return; }
      if (!pendingCode.isExistingUser && pw.length < 6) { msg('密码至少 6 位'); return; }
      btn.disabled = true; msg('正在校验…');
      API.verifyEmailCode(email, code, pw).then(function (r) {
        btn.disabled = false;
        if (r.error) { msg(errText(r.error)); return; }
        pendingCode = null;
        msg('');
        closeModal();
      });
    };

    function msg(t, kind) {
      var m = $('#cbMsg', body);
      if (!m) return;
      m.textContent = t || '';
      m.className = 'cb-msg' + (kind === 'ok' ? ' ok' : '');
    }
    modal._msg = msg;
  }

  /* ============================ 登录态刷新 ============================ */
  function applySession(next) {
    session = next || null;
    var btn = $('#accountBtn');
    if (btn) {
      btn.classList.toggle('on', !!session);
      btn.title = session ? '已登录 · 点开管理' : '登录（上传配图用）';
    }
    $$('.cb-need-login').forEach(function (n) { n.hidden = !!session; });
    $$('.cb-only-login').forEach(function (n) { n.hidden = !session; });
    if (currentPost) {
      renderAssets(currentPost);
    }
  }

  function refreshSession() {
    return API.getSession().then(function (r) {
      applySession(r.error ? null : r.data);
      return session;
    });
  }

  /* ============================ 配图 / 附件 ============================ */
  function renderAssets(post) {
    var box = $('#assetBlock');
    if (!box) return;
    var postId = post.id || post.slug;
    var gallery = $('#assetGallery', box);
    var files = $('#assetFiles', box);
    var count = $('#assetCount', box);

    API.listAssets(postId).then(function (r) {
      if (r.error) {
        gallery.innerHTML = '';
        files.innerHTML = '';
        showNote(box, '配图加载失败：' + errText(r.error));
        return;
      }
      var rows = r.data || [];
      var imgs = rows.filter(function (a) { return a.kind === 'image'; });
      var docs = rows.filter(function (a) { return a.kind !== 'image'; });

      count.textContent = rows.length ? rows.length + ' 项' : '';

      if (!imgs.length) {
        gallery.innerHTML = '<div class="cb-empty">还没有配图' +
          (session ? '' : '，博主登录后可在这里上传') + '</div>';
      } else {
        gallery.innerHTML = imgs.map(function (a) {
          var src = previewSrc(a.preview_b64);
          return '<figure class="gal-item' + (session ? ' own' : '') + '" data-id="' + esc(a.id) + '">' +
            (src
              ? '<img src="' + src + '" alt="' + esc(a.name) + '" loading="lazy">'
              : '<div class="gal-noimg">无预览</div>') +
            '<figcaption><b>' + esc(a.name) + '</b>' +
              (a.caption ? '<em>' + esc(a.caption) + '</em>' : '') +
              '<span>' + fmtSize(a.size_bytes) + '　' + fmtTime(a.created_at) + '</span>' +
            '</figcaption>' +
            (session ? '<button class="gal-del" data-del="' + esc(a.id) + '" type="button" title="删除">✕</button>' : '') +
          '</figure>';
        }).join('');
      }

      if (!docs.length) {
        files.innerHTML = '';
      } else {
        files.innerHTML = '<h4 class="cb-sub">附件</h4>' + docs.map(function (a) {
          return '<div class="file-row">' +
            '<span class="file-ico">📎</span>' +
            '<span class="file-name"><b>' + esc(a.name) + '</b>' +
              '<i>' + fmtSize(a.size_bytes) + '　' + fmtTime(a.created_at) + '</i></span>' +
            '<a class="btn tiny press" data-dl="' + esc(a.id) + '" href="javascript:void(0)">' +
              (session ? '下载' : '登录后下载') + '</a>' +
            (session ? '<button class="btn tiny press" data-del="' + esc(a.id) + '" type="button">删除</button>' : '') +
          '</div>';
        }).join('');
      }

      /* 事件委托 */
      gallery.onclick = function (e) {
        var d = e.target.closest('[data-del]');
        if (d) { doRemove(find(rows, d.getAttribute('data-del'))); return; }
        var fig = e.target.closest('.gal-item');
        if (fig) { var a = find(rows, fig.getAttribute('data-id')); if (a) openLightbox(a); }
      };
      files.onclick = function (e) {
        var d = e.target.closest('[data-del]');
        if (d) { doRemove(find(rows, d.getAttribute('data-del'))); return; }
        var l = e.target.closest('[data-dl]');
        if (l) { e.preventDefault(); doDownload(find(rows, l.getAttribute('data-dl')), l); }
      };
      function find(list, id) {
        var out = null;
        list.forEach(function (a) { if (String(a.id) === String(id)) out = a; });
        return out;
      }
    });
  }

  function showNote(box, text) {
    var n = $('#assetNote', box);
    if (n) n.textContent = text || '';
  }

  function doDownload(asset, link) {
    if (!asset) return;
    if (!session) { openModal(); return; }
    var old = link.textContent;
    link.textContent = '准备中…';
    API.assetLink(asset).then(function (r) {
      link.textContent = old;
      if (r.error) { showNote($('#assetBlock'), '下载失败：' + errText(r.error)); return; }
      window.open(r.data, '_blank', 'noopener');
    });
  }

  function doRemove(asset) {
    if (!asset) return;
    if (!window.confirm('删除「' + asset.name + '」？原图会一并从云存储移除，无法恢复。')) return;
    API.removeAsset(asset).then(function (r) {
      if (r.error) { showNote($('#assetBlock'), errText(r.error)); return; }
      showNote($('#assetBlock'), '已删除「' + asset.name + '」');
      renderAssets(currentPost);
    });
  }

  function openLightbox(asset) {
    var src = previewSrc(asset.preview_b64);
    if (!src) {
      if (session) { doDownload(asset, { textContent: '下载' }); }
      else { openModal(); }
      return;
    }
    var lb = el('<div class="cb-lightbox" role="dialog" aria-label="预览">' +
      '<img alt="' + esc(asset.name) + '">' +
      '<div class="lb-cap">' + esc(asset.name) + (asset.caption ? '　·　' + esc(asset.caption) : '') + '</div>' +
      '<button class="cb-x" type="button" aria-label="关闭">✕</button></div>');
    $('img', lb).src = src;
    lb.addEventListener('click', function (e) {
      if (e.target === lb || e.target.classList.contains('cb-x')) lb.remove();
    });
    document.body.appendChild(lb);
  }

  /* ---- 上传面板 ---- */
  function togglePanel(post) {
    if (!post) return;
    if (!session) { openModal(); return; }
    var panel = $('#assetPanel');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      var zi = $('#dropZone', panel);
      if (zi) zi.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  function handleFiles(post, files) {
    if (!post || !files || !files.length) return;
    var status = $('#upStatus');
    var list = Array.prototype.slice.call(files);
    var cap = ($('#capInput') || {}).value || '';
    status.className = 'cb-status';
    status.textContent = '准备上传 ' + list.length + ' 个文件…';

    var i = 0;
    (function next() {
      if (i >= list.length) {
        status.className = 'cb-status ok';
        status.textContent = '全部上传完成（' + list.length + ' 个）';
        var fi = $('#fileInput'); if (fi) fi.value = '';
        var ci = $('#capInput'); if (ci) ci.value = '';
        renderAssets(post);
        return;
      }
      var f = list[i];
      status.textContent = '正在上传 ' + (i + 1) + '/' + list.length + '：' + f.name + '（' + fmtSize(f.size) + '）';
      API.uploadAsset(post.id || post.slug, f, cap).then(function (r) {
        if (r.error) {
          status.className = 'cb-status bad';
          status.textContent = '「' + f.name + '」上传失败：' + errText(r.error);
          return;
        }
        i += 1;
        next();
      });
    })();
  }

  function mountAssets(post) {
    var block = $('#assetBlock');
    if (!block) return;
    block.innerHTML =
      '<div class="cb-head">' +
        '<h3>配图与附件</h3>' +
        '<span class="cb-count" id="assetCount"></span>' +
        '<button class="btn tiny press" id="assetUploadToggle" type="button">上传</button>' +
      '</div>' +
      '<div class="gallery" id="assetGallery"></div>' +
      '<div class="attach-wrap" id="assetFiles"></div>' +
      '<div class="cb-note soft" id="assetNote"></div>' +
      '<div class="upload-panel" id="assetPanel" hidden>' +
        '<label class="dropzone ripple-host" id="dropZone">' +
          '<input type="file" id="fileInput" multiple hidden>' +
          '<b>点击选择文件，或拖拽到这里</b>' +
          '<span>图片会额外生成一张压缩小图，访客免登录也能看到；原图存进云存储，仅登录后可下载</span>' +
        '</label>' +
        '<input class="cb-cap" id="capInput" maxlength="160" placeholder="配图说明（可选，会显示在图片下方）">' +
        '<div class="cb-status" id="upStatus"></div>' +
      '</div>';

    $('#assetUploadToggle', block).onclick = function () { togglePanel(post); };

    var zi = $('#dropZone', block);
    var fi = $('#fileInput', block);
    zi.onclick = function (e) { if (session) fi.click(); else openModal(); };
    fi.onchange = function () { handleFiles(post, fi.files); };
    ['dragenter', 'dragover'].forEach(function (ev) {
      zi.addEventListener(ev, function (e) { e.preventDefault(); zi.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (ev) {
      zi.addEventListener(ev, function (e) { e.preventDefault(); zi.classList.remove('over'); });
    });
    zi.addEventListener('drop', function (e) {
      if (!session) { openModal(); return; }
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(post, e.dataTransfer.files);
    });

    renderAssets(post);
  }

  /* ============================ 留言板 ============================ */
  function mountComments(post) {
    var block = $('#commentBlock');
    if (!block) return;
    block.innerHTML =
      '<div class="cb-head">' +
        '<h3>留言板</h3>' +
        '<span class="cb-count" id="cmCount"></span>' +
      '</div>' +
      '<form class="comment-form" id="cmForm" novalidate>' +
        '<div class="cm-top">' +
          '<input id="cmNick" maxlength="20" autocomplete="nickname" placeholder="昵称（留空则为「匿名访客」）">' +
          '<span class="cm-free">无需登录即可留言</span>' +
        '</div>' +
        '<textarea id="cmText" maxlength="500" rows="3" placeholder="说点什么…（最多 500 字）"></textarea>' +
        '<div class="cm-foot">' +
          '<span class="cb-tip" id="cmTip"></span>' +
          '<button class="btn primary ripple-host press" id="cmSubmit" type="submit">发表留言</button>' +
        '</div>' +
      '</form>' +
      '<div class="comment-list" id="cmList"></div>';

    var form = $('#cmForm', block);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      submitComment(post);
    });
    loadComments(post);
  }

  function loadComments(post) {
    var list = $('#cmList');
    var count = $('#cmCount');
    if (!list) return;
    list.innerHTML = '<div class="cb-empty">留言加载中…</div>';
    API.listComments(post.id || post.slug).then(function (r) {
      if (r.error) {
        list.innerHTML = '<div class="cb-empty">留言加载失败：' + esc(errText(r.error)) + '</div>';
        return;
      }
      var rows = r.data || [];
      if (count) count.textContent = rows.length ? '共 ' + rows.length + ' 条' : '';
      if (!rows.length) {
        list.innerHTML = '<div class="cb-empty">还没有留言，来做第一个吧。</div>';
        return;
      }
      list.innerHTML = rows.map(function (c) {
        var nick = String(c.nickname || '匿名访客');
        return '<div class="comment-item">' +
          '<span class="cm-avatar">' + esc(nick.slice(0, 1)) + '</span>' +
          '<div class="cm-body">' +
            '<div class="cm-meta"><b>' + esc(nick) + '</b><time>' + fmtTime(c.created_at) + '</time></div>' +
            '<p class="cm-text">' + esc(c.content) + '</p>' +
          '</div>' +
        '</div>';
      }).join('');
    });
  }

  function submitComment(post) {
    var tip = $('#cmTip');
    var btn = $('#cmSubmit');
    var nick = ($('#cmNick').value || '').trim();
    var text = ($('#cmText').value || '').trim();
    function say(t, bad) {
      tip.textContent = t || '';
      tip.className = 'cb-tip' + (bad ? ' bad' : '');
    }
    if (!text) { say('请先写点什么', true); return; }
    if (text.length > 500) { say('留言最多 500 字', true); return; }
    if (nick.length > 20) { say('昵称最多 20 字', true); return; }

    btn.disabled = true;
    say('正在提交…');
    API.addComment(post.id || post.slug, nick || '匿名访客', text).then(function (r) {
      btn.disabled = false;
      if (r.error) { say('提交失败：' + errText(r.error), true); return; }
      $('#cmText').value = '';
      say('留言已发布，谢谢！');
      setTimeout(function () { say(''); }, 2400);
      loadComments(post);
    });
  }

  /* ============================ 文章页挂载点 ============================ */
  function mountArticle(post) {
    if (!post || !API) return;
    currentPost = post;
    var host = $('#postBody');
    if (!host) return;

    /* 幂等：重复挂载前先清掉上一次的容器，避免出现重复的留言板 */
    $$('.cloud-mount').forEach(function (n) { n.remove(); });

    var pager = $('.pager', host.parentNode);
    var anchor = pager || $('.article-reader');

    var wrap = el('<div class="cloud-mount">' +
      '<section class="cloud-block glass enter" id="assetBlock"></section>' +
      '<section class="cloud-block glass enter" id="commentBlock"></section>' +
      '</div>');

    if (pager && pager.parentNode) pager.parentNode.insertBefore(wrap, pager.nextSibling);
    else if (anchor) anchor.appendChild(wrap);

    mountAssets(post);
    mountComments(post);
  }

  /* ============================ 启动 ============================ */
  function init() {
    if (!API) return;
    ready = !!API.available;

    /* 授权回跳会带回 ?code=&state=，必须在任何界面逻辑之前无条件处理一次 */
    if (ready) {
      var hadCode = /[?&]code=/.test(location.search || '');
      API.handleWechatCallback().then(function (r) {
        if (r.data) {
          if (apiHistory()) history.replaceState(null, '', location.pathname + location.hash);
          refreshSession();
        } else if (r.error) {
          if (typeof console !== 'undefined') console.warn('[cloud] wechat callback:', r.error.message);
          /* 只有确实是带着 code 回来的才提示，普通访问不受影响 */
          if (hadCode) refreshSession().then(function () { openModal('wechat'); });
        }
      });
    }

    document.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#accountBtn')) {
        e.preventDefault();
        openModal();
      }
    });

    refreshSession();
    API.onAuth(function (evt, s) { applySession(s); });
  }
  function apiHistory() {
    try { return !!(window.history && history.replaceState); } catch (e) { return false; }
  }

  window.BlogCloud = { mountArticle: mountArticle, openLogin: openModal, refresh: refreshSession };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
