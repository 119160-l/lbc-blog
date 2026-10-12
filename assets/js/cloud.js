/* ==========================================================================
   cloud.js —— 云服务接口层（纯逻辑，不管界面）
   依赖：vendor/workbuddy-cloud/index.global.js（全局 WorkBuddyCloud）、cloud-config.js

   对外暴露 window.CloudAPI：
     available            布尔，SDK + 配置是否就绪
     failReason           未就绪原因
     onAuth(cb)           订阅登录态变化，返回取消订阅函数

     getSession()         取当前会话
     signInWechat()       微信登录（会跳转）
     handleWechatCallback()  页面启动时无条件调用，处理微信回调
     signOut()
     sendEmailCode(email) / verifyEmailCode(email, token, password)

     listComments(postId) / addComment(postId, nickname, content)
     listAssets(postId) / uploadAsset(postId, file, caption) / removeAsset(a) / assetLink(a)

   约定：所有方法都返回 { data, error }，error 为 null 表示成功。
   ========================================================================== */
(function () {
  'use strict';

  var CFG = window.CLOUD_CONFIG || {};
  var sdk = window.WorkBuddyCloud;

  var cloud = null, available = false, failReason = '';

  if (!sdk || typeof sdk.createWorkBuddyCloud !== 'function') {
    failReason = '云 SDK 未加载（缺 assets/vendor/workbuddy-cloud/index.global.js）';
  } else if (!CFG.endpoint || !CFG.publishableKey) {
    failReason = '云配置不完整（缺 endpoint 或 publishableKey）';
  } else {
    try {
      cloud = sdk.createWorkBuddyCloud({
        endpoint:          CFG.endpoint,
        oauthRelayBaseUrl: CFG.oauthRelayBaseUrl || '',
        publishableKey:    CFG.publishableKey
      });
      available = true;
    } catch (e) {
      failReason = (e && e.message) || String(e);
    }
  }

  var T_COMMENTS = CFG.tableComments || 'comments';
  var T_ASSETS   = CFG.tableAssets   || 'post_assets';

  function msgOf(e) { return (e && (e.message || e.errMsg)) || String(e || '未知错误'); }
  function err(message, code) { return { data: null, error: { message: message, code: code || '' } }; }
  function ok(data) { return { data: data, error: null }; }
  function norm(r) {
    if (r && typeof r === 'object' && ('data' in r || 'error' in r)) {
      return { data: r.data === undefined ? null : r.data, error: r.error || null };
    }
    return ok(r);
  }
  function guard() { return available ? null : err(failReason, 'CLOUD_NOT_READY'); }

  /* ============================ 登录态 ============================ */

  function getSession() {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.auth.getSession()
      .then(function (r) { var n = norm(r); return n.error ? { data: null, error: n.error } : ok(n.data || null); })
      .catch(function (e) { return err(msgOf(e)); });
  }

  function onAuth(cb) {
    if (!available) return function () {};
    try { return cloud.auth.onAuthStateChange(cb) || function () {}; }
    catch (e) { return function () {}; }
  }

  function signOut() {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.auth.signOut()
      .then(function (r) { return norm(r); })
      .catch(function (e) { return err(msgOf(e)); });
  }

  /* 微信登录：signInWithOAuth 不自己跳转，返回地址由我们 assign */
  function signInWechat() {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.auth.signInWithOAuth({ provider: 'wechat', redirectTo: location.origin })
      .then(function (r) {
        var n = norm(r);
        if (n.error) return n;
        var url = n.data && (n.data.url || n.data.redirectUrl || n.data.authorizeUrl);
        if (!url) return err('未取得授权地址');
        location.assign(url);
        return ok(url);
      })
      .catch(function (e) { return err(msgOf(e)); });
  }

  /* 授权回跳到站点根后会带 ?code=&state=，启动时必须无条件调用一次 */
  function handleWechatCallback() {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.auth.handleWechatWebCallback()
      .then(function (r) { var n = norm(r); return n.error ? { data: null, error: n.error } : ok(n.data || null); })
      .catch(function (e) { return err(msgOf(e)); });
  }

  /* ------------------------- 邮箱验证码 ------------------------- */
  /* 验证码挑战保存在模块变量里，发码与校验分开绑定两个按钮
     （SDK 的 sendOtp / signInWithOtp 都是「发新码」，不能用来校验已输入的码） */
  var pendingOtp = null;

  function sendEmailCode(email) {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.auth.sendOtp({ email: email })
      .then(function (r) {
        var n = norm(r);
        if (n.error) return n;
        var d = n.data || {};
        if (!d.verificationId) return err('未取得验证码凭据，请重试');
        pendingOtp = {
          email: email,
          verificationId: d.verificationId,
          isExistingUser: !!d.isExistingUser
        };
        return ok({ isExistingUser: pendingOtp.isExistingUser });
      })
      .catch(function (e) { return err(msgOf(e)); });
  }

  function verifyEmailCode(email, token, password) {
    var g = guard(); if (g) return Promise.resolve(g);
    if (!pendingOtp || pendingOtp.email !== email) {
      return Promise.resolve(err('请先为当前邮箱获取验证码', 'NO_CHALLENGE'));
    }
    if (!pendingOtp.isExistingUser && !password) {
      return Promise.resolve(err('新账号需要设置一个密码', 'NEED_PASSWORD'));
    }
    var payload = {
      email: pendingOtp.email,
      verificationId: pendingOtp.verificationId,
      isExistingUser: pendingOtp.isExistingUser,
      token: token
    };
    if (!pendingOtp.isExistingUser) payload.password = password;

    return cloud.auth.verifyOtp(payload)
      .then(function (r) {
        var n = norm(r);
        if (n.error) return n;               /* 码错：保留挑战，可重试，不再发新码 */
        pendingOtp = null;
        return ok(n.data);
      })
      .catch(function (e) { return err(msgOf(e)); });
  }

  /* ============================ 留言板 ============================ */

  function listComments(postId) {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.database.from(T_COMMENTS)
      .select('id, nickname, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: false })
      .limit(CFG.commentLimit || 80)
      .then(function (r) { return norm(r); })
      .catch(function (e) { return err(msgOf(e)); });
  }

  /* 不传 owner_id（游客没有身份，表里也没有这一列） */
  function addComment(postId, nickname, content) {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.database.from(T_COMMENTS)
      .insert({ post_id: postId, nickname: nickname, content: content })
      .select('id, nickname, content, created_at')
      .then(function (r) {
        var n = norm(r);
        if (n.error) return n;
        if (!n.data || !n.data.length) return err('留言没有写入成功，请稍后再试', 'RLS_BLOCKED');
        return ok(n.data[0]);
      })
      .catch(function (e) { return err(msgOf(e)); });
  }

  /* ============================ 配图 / 附件 ============================ */

  var ASSET_COLS = 'id, owner_id, post_id, name, kind, mime, size_bytes, preview_b64, caption, object_path, created_at';

  function listAssets(postId) {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.database.from(T_ASSETS)
      .select(ASSET_COLS)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .limit(CFG.assetLimit || 60)
      .then(function (r) { return norm(r); })
      .catch(function (e) { return err(msgOf(e)); });
  }

  /* ---- 路径片段清洗：不接受外部传入的完整对象键 ---- */
  function safeSeg(s, fallback) {
    var v = String(s == null ? '' : s).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    return v || fallback;
  }
  function safeExt(name, mime) {
    var m = /\.([A-Za-z0-9]{1,8})$/.exec(String(name || ''));
    if (m) return m[1].toLowerCase();
    var t = String(mime || '').split('/')[1];
    return t ? t.replace(/[^A-Za-z0-9]/g, '').slice(0, 8) || 'bin' : 'bin';
  }

  /* ---- 生成公开可见的小图：canvas 压到 1400px / JPEG，控制在 ~150KB 内 ---- */
  function decodeImage(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('图片无法解码')); };
      img.src = url;
    });
  }

  function makePreview(file) {
    var MAX = 1400, LIMIT = 210 * 1024;   /* LIMIT 是 base64 字符数上限 */
    return decodeImage(file).then(function (o) {
      try {
        var iw = o.img.naturalWidth || 1, ih = o.img.naturalHeight || 1;
        var scale = Math.min(1, MAX / iw, MAX / ih);
        var w = Math.max(1, Math.round(iw * scale));
        var h = Math.max(1, Math.round(ih * scale));
        var c = document.createElement('canvas');
        var ctx;
        function paint() {
          c.width = w; c.height = h;
          ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(o.img, 0, 0, w, h);
        }
        paint();
        var q = 0.82, data = '';
        for (var i = 0; i < 7; i++) {
          data = c.toDataURL('image/jpeg', q);
          if (data.length - data.indexOf(',') - 1 <= LIMIT) break;
          q -= 0.14;
          if (q < 0.32) {                 /* 压不动了，缩图再来 */
            w = Math.max(1, Math.round(w * 0.75));
            h = Math.max(1, Math.round(h * 0.75));
            paint();
            q = 0.62;
          }
        }
        var comma = data.indexOf(',');
        return comma > -1 ? data.slice(comma + 1) : null;
      } finally {
        URL.revokeObjectURL(o.url);
      }
    });
  }

  function uploadAsset(postId, file, caption) {
    var g = guard(); if (g) return Promise.resolve(g);
    return getSession().then(function (s) {
      if (s.error) return s;
      if (!s.data || !s.data.user || !s.data.user.id) {
        return err('请先登录后再上传', 'NO_SESSION');
      }
      var uid = s.data.user.id;
      var kind = /^image\//.test(file.type || '') ? 'image' : 'file';

      var objPath;
      try {
        objPath = cloud.storage.sharedPath(
          uid,
          'posts/' + safeSeg(postId, 'misc') + '/' +
          Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + safeExt(file.name, file.type)
        );
      } catch (e) {
        return err('文件路径不合法：' + msgOf(e), 'BAD_PATH');
      }

      return cloud.storage.upload(objPath, file, {
        contentType: file.type || 'application/octet-stream',
        upsert: false
      }).then(function (up) {
        var un = norm(up);
        if (un.error) return { data: null, error: un.error };

        var previewP = kind === 'image'
          ? makePreview(file).catch(function () { return null; })
          : Promise.resolve(null);

        return previewP.then(function (preview) {
          return cloud.database.from(T_ASSETS).insert({
            post_id: postId,
            name: String(file.name || '未命名').slice(0, 160),
            object_path: objPath,
            kind: kind,
            mime: file.type || null,
            size_bytes: file.size || null,
            preview_b64: preview,
            caption: caption ? String(caption).slice(0, 160) : null
          }).select(ASSET_COLS).then(function (ins) {
            var inn = norm(ins);
            if (inn.error || !inn.data || !inn.data.length) {
              /* 记录没落库就把对象删掉，避免留下孤儿文件 */
              return cloud.storage.remove([objPath])
                .catch(function () {})
                .then(function () {
                  return err(inn.error ? inn.error.message : '附件记录未写入（安全策略拦截）',
                             inn.error ? inn.error.code : 'RLS_BLOCKED');
                });
            }
            return ok(inn.data[0]);
          });
        });
      }).catch(function (e) {
        var name = e && e.name;
        if (name === 'CloudStoragePathError' || (sdk && sdk.CloudStoragePathError && e instanceof sdk.CloudStoragePathError)) {
          return err('文件路径不合法：' + msgOf(e), 'BAD_PATH');
        }
        return err(msgOf(e));
      });
    });
  }

  /* 先删数据库行（受 RLS 管控），成功后再删存储对象 */
  function removeAsset(asset) {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.database.from(T_ASSETS).delete().eq('id', asset.id).select('id')
      .then(function (r) {
        var n = norm(r);
        if (n.error) return n;
        if (!n.data || !n.data.length) {
          return err('删除被拒绝：这条记录不属于当前登录账号', 'RLS_BLOCKED');
        }
        return cloud.storage.remove([asset.object_path])
          .catch(function () {})
          .then(function () { return ok({ id: asset.id }); });
      })
      .catch(function (e) { return err(msgOf(e)); });
  }

  /* 原图/附件的临时下载链接（最长 1 小时，需登录） */
  function assetLink(asset, ttl) {
    var g = guard(); if (g) return Promise.resolve(g);
    return cloud.storage.createSignedUrl(asset.object_path, ttl || 600)
      .then(function (r) {
        var n = norm(r);
        if (n.error) return n;
        var url = n.data && (n.data.signedUrl || n.data.signedURL);
        return url ? ok(url) : err('未取得下载链接');
      })
      .catch(function (e) { return err(msgOf(e)); });
  }

  window.CloudAPI = {
    available: available,
    failReason: failReason,
    config: CFG,

    onAuth: onAuth,
    getSession: getSession,
    signInWechat: signInWechat,
    handleWechatCallback: handleWechatCallback,
    signOut: signOut,
    sendEmailCode: sendEmailCode,
    verifyEmailCode: verifyEmailCode,

    listComments: listComments,
    addComment: addComment,

    listAssets: listAssets,
    uploadAsset: uploadAsset,
    removeAsset: removeAsset,
    assetLink: assetLink
  };
})();
