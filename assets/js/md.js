/* ==========================================================================
   md.js —— 轻量 Markdown 渲染器（零依赖，纯前端）
   支持：标题 / 段落 / 粗斜体 / 行内代码 / 代码块 / 无序有序列表 / 多层嵌套 /
        任务清单 / 引用 / 提示块 / 分割线 / 链接 / 图片 / 表格 / 数学公式
   ========================================================================== */
(function (global) {
  'use strict';

  var SENT = '\u0000';

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  /* esc() 的逆运算：KaTeX 要拿到原始 LaTeX，不能喂 &amp; &lt; 这种实体 */
  function unesc(s) {
    return String(s)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }

  /* ---------------- 公式：交给 KaTeX ---------------- */
  function katexOK() {
    return typeof window !== 'undefined' && window.katex && typeof window.katex.renderToString === 'function';
  }
  function renderMath(tex, display, raw) {
    if (!katexOK()) {                        /* KaTeX 没加载时退化成原样显示 */
      return '<span class="' + (display ? 'math-block' : 'math-inline') + '">' + esc(raw) + '</span>';
    }
    try {
      return window.katex.renderToString(tex, {
        displayMode: display,
        throwOnError: false,                 /* 公式写错不要炸掉整页 */
        strict: false,
        trust: false,
        output: 'html'
      });
    } catch (e) {
      return '<span class="' + (display ? 'math-block' : 'math-inline') + '" title="公式解析失败">' + esc(raw) + '</span>';
    }
  }

  function store() {
    var items = [];
    return {
      put: function (html) { items.push(html); return SENT + (items.length - 1) + SENT; },
      restore: function (s) {
        return s.replace(/\u0000(\d+)\u0000/g, function (_, n) { return items[+n]; });
      }
    };
  }

  function blank(l) { return !l || !l.trim(); }
  function indentOf(l) {
    var m = l.match(/^[ \t]*/)[0].replace(/\t/g, '  ');
    return Math.floor(m.length / 2);
  }
  var RE_ITEM   = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
  var RE_HEAD   = /^(#{1,6})\s+(.*)$/;
  var RE_QUOTE  = /^\s*>\s?/;
  var RE_HR     = /^\s*([-*_])\s*\1\s*\1[\s\1]*$/;

  /* ---------------- 行内 ---------------- */
  function inline(text, st) {
    var s = esc(text);

    // 行内代码
    s = s.replace(/`([^`\n]+?)`/g, function (_, c) { return st.put('<code>' + c + '</code>'); });

    // 行内数学 $...$（开 `$` 后不接空格、闭 `$` 前不接空格且后不接数字，规避货币误判）
    s = s.replace(/\$(?!\s)((?:[^$\\\n]|\\.)+?)(?<!\s)\$(?!\d)/g, function (m, tex) {
      return st.put(renderMath(unesc(tex), false, m));
    });

    // 图片
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      function (_, alt, src, title) {
        return '<img src="' + src + '" alt="' + alt + '"' + (title ? ' title="' + title + '"' : '') + ' loading="lazy">';
      });

    // 链接
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g,
      function (_, label, href, title) {
        return '<a href="' + href + '"' + (title ? ' title="' + title + '"' : '') +
          (/^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
      });

    // 裸链接
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');

    // 强调
    s = s.replace(/\*\*\*([^*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*\w])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    s = s.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    s = s.replace(/==([^=\n]+)==/g, '<mark>$1</mark>');

    return s;
  }

  /* ---------------- 表格 ---------------- */
  function splitRow(l) {
    return l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|')
      .map(function (c) { return c.trim(); });
  }

  /* ---------------- 列表（递归缩进解析） ---------------- */
  function parseList(lines, state, st) {
    var i = state.i;

    function level(base) {
      var ordered = null;
      var parts = [];
      while (i < lines.length) {
        var m = lines[i].match(RE_ITEM);
        if (!m) break;
        var ind = indentOf(lines[i]);
        if (ind < base) break;

        if (ind > base) {                       // 更深一层 → 挂到上一个条目
          if (!parts.length) break;
          parts[parts.length - 1].sub = level(ind);
          continue;
        }
        var isOrd = /^\d/.test(m[2]);
        if (ordered === null) ordered = isOrd;
        parts.push({ text: m[3], sub: null, ord: isOrd });
        i++;
      }
      var tag = (ordered ? 'ol' : 'ul');
      var html = '';
      var open = null;
      for (var k = 0; k < parts.length; k++) {
        var p = parts[k];
        var thisTag = p.ord ? 'ol' : 'ul';
        if (open !== thisTag) {
          if (open) html += '</li></' + open + '>';
          html += '<' + (open === null ? tag : thisTag) + '>';
          open = open === null ? tag : thisTag;
        } else if (k > 0) {
          html += '</li>';
        }
        var task = p.text.match(/^\[([ xX])\]\s+(.*)$/);
        var content = task
          ? '<input type="checkbox" disabled' + (task[1].toLowerCase() === 'x' ? ' checked' : '') + '> ' + inline(task[2], st)
          : inline(p.text, st);
        html += '<li>' + content + (p.sub ? p.sub : '');
      }
      if (open) html += '</li></' + open + '>';
      return html;
    }

    var html = level(indentOf(lines[i]));
    state.i = i;
    return html;
  }

  /* ---------------- 块级 ---------------- */
  function blocks(lines, st) {
    var out = [];
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      if (blank(line)) { i++; continue; }

      // 代码块占位
      var cb = line.match(/^\u0000B(\d+)\u0000$/);
      if (cb) { out.push('\u0000C' + cb[1] + '\u0000'); i++; continue; }

      if (RE_HR.test(line)) { out.push('<hr>'); i++; continue; }

      var h = line.match(RE_HEAD);
      if (h) {
        var lv = h[1].length;
        var txt = h[2].trim();
        var body = inline(txt, st);
        if (lv === 1) { out.push('<h1>' + body + '</h1>'); }
        else {
          var id = 'h-' + txt.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
          out.push('<h' + lv + ' id="' + id + '">' + body + '</h' + lv + '>');
        }
        i++; continue;
      }

      // 块级公式
      if (/^\s*\$\$/.test(line)) {
        var buf = [line];
        var closed = line.trim().length > 4 && /\$\$\s*$/.test(line.trim());
        while (!closed && i + 1 < lines.length) {
          i++; buf.push(lines[i]);
          if (/\$\$\s*$/.test(lines[i])) closed = true;
        }
        var raw = buf.join('\n').trim();
        var tex = raw.replace(/^\$\$/, '').replace(/\$\$$/, '').trim();
        out.push('<div class="math-block">' + renderMath(unesc(tex), true, raw) + '</div>');
        i++; continue;
      }

      // 表格
      if (line.indexOf('|') !== -1 && i + 1 < lines.length &&
          /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(lines[i + 1]) && lines[i + 1].indexOf('-') !== -1) {
        var head = splitRow(line);
        i += 2;
        var rows = [];
        while (i < lines.length && lines[i].indexOf('|') !== -1 && lines[i].trim()) {
          rows.push(splitRow(lines[i])); i++;
        }
        out.push('<table><thead><tr>' +
          head.map(function (c) { return '<th>' + inline(c, st) + '</th>'; }).join('') +
          '</tr></thead><tbody>' +
          rows.map(function (r) {
            return '<tr>' + r.map(function (c) { return '<td>' + inline(c, st) + '</td>'; }).join('') + '</tr>';
          }).join('') + '</tbody></table>');
        continue;
      }

      // 引用 / 提示块
      if (RE_QUOTE.test(line)) {
        var q = [];
        while (i < lines.length && RE_QUOTE.test(lines[i])) {
          q.push(lines[i].replace(RE_QUOTE, '')); i++;
        }
        var type = '';
        var mm = q[0] && q[0].match(/^\[!(\w+)\]\s*(.*)$/);
        if (mm) {
          type = mm[1].toUpperCase();
          q[0] = mm[2];
          if (!q[0].trim()) q.shift();
        }
        var inner = blocks(q, st);
        if (type) {
          var labels = { NOTE: '提示', TIP: '技巧', WARNING: '注意', IMPORTANT: '重点', CAUTION: '当心' };
          out.push('<div class="callout"><div><p><strong>' + (labels[type] || type) + '</strong></p>' + inner + '</div></div>');
        } else {
          out.push('<blockquote>' + inner + '</blockquote>');
        }
        continue;
      }

      // 列表
      if (RE_ITEM.test(line)) {
        var state = { i: i };
        out.push(parseList(lines, state, st));
        i = (state.i > i) ? state.i : i + 1;   // 防御：必须前进，避免死循环
        continue;
      }

      // 段落
      var para = [];
      while (i < lines.length && !blank(lines[i]) &&
             !RE_HEAD.test(lines[i]) && !RE_QUOTE.test(lines[i]) &&
             !RE_ITEM.test(lines[i]) && !RE_HR.test(lines[i]) &&
             !/^\s*\$\$/.test(lines[i]) && !/^\u0000B\d+\u0000$/.test(lines[i])) {
        para.push(lines[i]); i++;
      }
      if (para.length) {
        out.push('<p>' + inline(para.join('\n'), st).replace(/\n/g, '<br>') + '</p>');
      } else {
        i++;   // 防御：无法匹配的行直接跳过，避免死循环
      }
    }
    return out.join('\n');
  }

  /* ---------------- 对外接口 ---------------- */
  function render(src) {
    if (!src) return '';
    var st = store();
    var s = String(src).replace(/\r\n?/g, '\n');

    // 摘出围栏代码块
    var codes = [];
    s = s.replace(/^[ \t]*```([^\n]*)\n([\s\S]*?)^[ \t]*```[ \t]*$/gm, function (_, lang, body) {
      var cls = lang.trim() ? ' class="language-' + esc(lang.trim()) + '"' : '';
      codes.push('<pre><code' + cls + '>' + esc(body.replace(/\n$/, '')) + '</code></pre>');
      return '\u0000B' + (codes.length - 1) + '\u0000';
    });

    var html = blocks(s.split('\n'), st);
    html = html.replace(/\u0000C(\d+)\u0000/g, function (_, n) { return codes[+n]; });
    return st.restore(html).split(SENT).join('');
  }

  /* 提取纯文本，用于摘要与搜索 */
  function plain(src, max) {
    var t = String(src || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/\$\$[\s\S]*?\$\$/g, ' ')
      .replace(/\$[^$\n]*?\$/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s*[#>\-*+]+\s*/gm, ' ')
      .replace(/[*_~`|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (max && t.length > max) t = t.slice(0, max) + '……';
    return t;
  }

  global.BlogMD = { render: render, plain: plain };
})(window);
