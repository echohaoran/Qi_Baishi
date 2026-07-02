// workspace.js — 工作台（最近 4 张作品从历史 API 拉取）
// 同步机制：
//   - DOMContentLoaded  → 首次拉取
//   - pageshow (BFCache) → 从 back/forward cache 恢复时重新拉取
//   - visibilitychange  → 标签页切回前台时重新拉取（10s 节流）
//   - BroadcastChannel  → 收到 history 页的删除广播时立即拉取
document.addEventListener('DOMContentLoaded', function () {

  // 标记已访问，后续打开 index.html 自动跳转到 workspace
  try { localStorage.setItem('baishi.has_visited', '1'); } catch (e) {}

  ;

  // Toast
  function toast(msg, kind) {
    if (window.BaishiShared && typeof window.BaishiShared.toast === 'function') {
      return window.BaishiShared.toast(msg, kind);
    }
  }

  // 顶部通知 / 命令面板
  var iconBtns = document.querySelectorAll('header .right .icon-btn');
  if (iconBtns[0]) iconBtns[0].addEventListener('click', () => {
    toast('通知 · 暂无新消息', 'success');
  });
  if (iconBtns[1]) iconBtns[1].addEventListener('click', () => {
    toast('命令面板 ⌘K · 原型阶段尚未实装', 'warn');
  });

  // ==================== 最近作品（实时同步） ====================
  var grid = document.getElementById('recent-artworks');
  var lastFetchAt = 0;
  var FETCH_THROTTLE_MS = 10000; // 10s 节流

  function setStateLoading() {
    if (!grid) return;
    grid.dataset.state = 'loading';
    grid.setAttribute('aria-busy', 'true');
    grid.innerHTML = '';
    var sk = document.createElement('div');
    sk.className = 'recent-empty';
    sk.innerHTML = '<span class="recent-empty__brush"></span><span>正在落墨 · 调取最近作品…</span>';
    grid.appendChild(sk);
  }

  function setStateEmpty() {
    if (!grid) return;
    grid.dataset.state = 'empty';
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = '';
    var empty = document.createElement('a');
    empty.href = 'text-to-image.html';
    empty.className = 'recent-empty recent-empty--action';
    empty.innerHTML =
      '<span class="recent-empty__brush"></span>' +
      '<strong>墨痕未干</strong>' +
      '<span>尚无作品 · 点此开始第一次创作</span>';
    grid.appendChild(empty);
  }

  function setStateError(msg) {
    if (!grid) return;
    grid.dataset.state = 'error';
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = '';
    var e = document.createElement('div');
    e.className = 'recent-empty';
    e.innerHTML = '<span class="recent-empty__brush"></span><span>' + (msg || '调取失败 · 请检查后端连接') + '</span>';
    grid.appendChild(e);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function formatTime(ts) {
    if (!ts) return '—';
    var d = new Date(ts * 1000);
    var today = new Date(); today.setHours(0, 0, 0, 0);
    if (d.getTime() >= today.getTime()) {
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }
    var days = Math.floor((today.getTime() - d.getTime()) / 86400000);
    return days === 1 ? '昨天' : days + ' 天前';
  }

  function renderCards(items) {
    if (!grid) return;
    grid.dataset.state = 'loaded';
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = '';
    items.forEach(function (a) {
      var url = (window.BaishiShared && window.BaishiShared.safeImageSrc)
        ? window.BaishiShared.safeImageSrc(a.file_path)
        : (a.file_path || '');
      var isText = a.style_id === 'copywriting';
      var card = document.createElement('a');
      card.href = 'history.html';
      card.className = 'art-card';
      card.dataset.artworkId = a.id;
      var previewHtml;
      if (isText) {
        var snippet = (a.thumb_path || a.prompt || '').slice(0, 36);
        previewHtml = '<div class="art-img art-img--text"><div class="art-text-body">' +
          escapeHtml(snippet) + (snippet.length >= 36 ? '…' : '') +
          '</div></div>';
      } else if (url) {
        previewHtml = '<div class="art-img" style="background-image:url(\'' + escapeHtml(url) + '\');background-size:cover;background-position:center;"></div>';
      } else {
        previewHtml = '<div class="art-img" style="background:linear-gradient(135deg, #d4a574, #4a3522);"></div>';
      }
      var ratioLabel = a.aspect || '1:1';
      if (isText) ratioLabel = '文案';
      var stepsLabel = isText ? (a.negative_prompt || '文生文') : ('步骤 ' + (a.steps || 30));
      card.innerHTML =
        previewHtml +
        '<div class="art-meta">' +
          '<div class="title">' + escapeHtml(a.prompt ? a.prompt.slice(0, 20) : ('作品 #' + a.id)) + '</div>' +
          '<div class="sub"><span>' + ratioLabel + ' · ' + stepsLabel + '</span><span class="num">' + formatTime(a.created_at) + '</span></div>' +
        '</div>' +
        (a.is_favorite ? '<div class="fav active">★</div>' : '<div class="fav">★</div>');
      grid.appendChild(card);
    });
  }

  // 暴露为可调用：history.js 跨标签页触发 / 自身重拉
  function loadRecent(opts) {
    opts = opts || {};
    var now = Date.now();
    if (!opts.force && now - lastFetchAt < FETCH_THROTTLE_MS) return;
    lastFetchAt = now;

    if (!window.BaiShiAPI || !window.BaiShiAPI.listHistory) {
      setStateError('后端 API 不可用');
      return;
    }
    setStateLoading();
    window.BaiShiAPI.listHistory(1, null).then(function (r) {
      if (!r || !r.success) {
        setStateError((r && r.error) || '调取失败');
        return;
      }
      var items = (r.data && r.data.items) || [];
      if (!items.length) {
        setStateEmpty();
        return;
      }
      renderCards(items.slice(0, 4));
    }).catch(function (err) {
      setStateError('网络错误：' + (err && err.message ? err.message : err));
    });
  }

  // 首次拉取
  loadRecent({ force: true });

  // ① BFCache 恢复（浏览器 back/forward）
  window.addEventListener('pageshow', function (e) {
    if (e.persisted) loadRecent({ force: true });
  });

  // ② 标签页切回前台（10s 节流）
  var lastVisibilityAt = 0;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return;
    var now = Date.now();
    if (now - lastVisibilityAt < FETCH_THROTTLE_MS) return;
    lastVisibilityAt = now;
    loadRecent();
  });

  // ③ 跨标签页同步：history 页删除后广播
  //   - BroadcastChannel（同源 tab 间实时推送，主流浏览器/Playwright 都支持）
  //   - localStorage 'storage' 事件（双保险，Playwright 上下文隔离开启时也生效）
  if (typeof BroadcastChannel !== 'undefined') {
    var channel = new BroadcastChannel('baishi-artworks');
    channel.addEventListener('message', function (e) {
      var msg = e.data || {};
      if (msg.type === 'deleted' || msg.type === 'changed' || msg.type === 'favorite') {
        loadRecent({ force: true });
      }
    });
  }
  window.addEventListener('storage', function (e) {
    if (!e.key) return;
    if (e.key === 'baishi:artworks-version' || e.key === 'baishi:artworks') {
      loadRecent({ force: true });
    }
  });

  // ④ window 事件（兜底：history 页用 window.postMessage 也行）
  window.addEventListener('baishi:artworks-changed', function () {
    loadRecent({ force: true });
  });
});
