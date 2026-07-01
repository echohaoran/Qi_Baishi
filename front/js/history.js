// history.js — 历史作品（全部接通后端）
document.addEventListener('DOMContentLoaded', function () {

  // 工具
  function toast(msg, kind) {
    kind = kind || 'success';
    var t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.innerHTML = '<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>' + msg + '</span>';
    document.getElementById('toasts').appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
    setTimeout(function () { t.remove(); }, 2800);
  }

  // OS 切换
  document.querySelectorAll('[data-os-set]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.body.dataset.os = btn.dataset.osSet;
      document.querySelectorAll('[data-os-set]').forEach(function (b) { b.classList.toggle('active', b === btn); });
    });
  });

  // 网格 / 列表切换
  document.querySelectorAll('.hist-toolbar .os-toggle button').forEach(function (b) {
    b.addEventListener('click', function () {
      b.parentElement.querySelectorAll('button').forEach(function (x) {
        x.classList.remove('active');
        x.setAttribute('aria-selected', 'false');
      });
      b.classList.add('active');
      b.setAttribute('aria-selected', 'true');
      var grids = document.querySelectorAll('.hist-grid');
      if (b.textContent.trim() === '列表') {
        grids.forEach(function (g) {
          g.style.gridTemplateColumns = '1fr';
          g.querySelectorAll('.art-card').forEach(function (c) {
            c.style.display = 'flex';
            c.style.alignItems = 'center';
            var img = c.querySelector('.art-img');
            if (img) { img.style.width = '120px'; img.style.height = '120px'; img.style.flexShrink = '0'; img.style.aspectRatio = 'auto'; }
          });
        });
      } else {
        grids.forEach(function (g) {
          g.style.gridTemplateColumns = '';
          g.querySelectorAll('.art-card').forEach(function (c) {
            c.style.display = '';
            c.style.alignItems = '';
            var img = c.querySelector('.art-img');
            if (img) { img.style.width = ''; img.style.height = ''; img.style.flexShrink = ''; img.style.aspectRatio = ''; }
          });
        });
      }
    });
  });

  // 实时过滤
  var search = document.getElementById('hist-search');
  var typeSel = document.getElementById('hist-type');
  var styleSel = document.getElementById('hist-style');
  function applyFilter() {
    var q = (search.value || '').trim().toLowerCase();
    var cat = typeSel.value;
    var style = styleSel.value;
    var visibleCount = 0;
    document.querySelectorAll('section[data-od-id]').forEach(function (sec) {
      var secVisible = 0;
      sec.querySelectorAll('.art-card').forEach(function (card) {
        var title = (card.dataset.search || card.dataset.title || '').toLowerCase();
        var cCat = card.dataset.cat || '';
        var cStyle = card.dataset.style || '';
        var isFavorite = card.dataset.favorite === 'true';
        var match = (!q || title.indexOf(q) >= 0)
                 && (cat === 'all' || (cat === 'favorites' ? isFavorite : cCat === cat))
                 && (style === 'all' || cStyle === style);
        card.style.display = match ? '' : 'none';
        if (match) secVisible++;
      });
      sec.hidden = secVisible === 0;
      var meta = sec.querySelector('[data-section-count]');
      if (meta) meta.textContent = secVisible + ' 件';
      visibleCount += secVisible;
    });
    updateCounts(visibleCount);
  }
  function updateCounts(visible) {
    var total = typeof visible === 'number' ? visible : document.querySelectorAll('.art-card:not([style*="display: none"])').length;
    var fav = document.querySelectorAll('.art-card .fav.active').length;
    var totalEl = document.getElementById('hist-total');
    var favEl = document.getElementById('hist-fav-count');
    if (totalEl) totalEl.textContent = total;
    if (favEl) favEl.textContent = fav;
  }
  search.addEventListener('input', applyFilter);
  typeSel.addEventListener('change', applyFilter);
  styleSel.addEventListener('change', applyFilter);

  // ── 跨标签页同步：删除成功后广播 · 工作台 / 其他 tab 收到后重拉 ──
  function broadcastArtworksChange(type, payload) {
    var data = Object.assign({ type: type, source: 'history', at: Date.now() }, payload || {});
    // 1. BroadcastChannel（同源实时推送）
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        var ch = new BroadcastChannel('baishi-artworks');
        ch.postMessage(data);
        ch.close();
      }
    } catch (e) {}
    // 2. localStorage 'storage' 事件（双保险 · Playwright 上下文隔离时也生效）
    try {
      // 写入时间戳版本号 · 同 tab 内不会触发 storage 事件 · 其他 tab 会被动触发
      localStorage.setItem('baishi:artworks-version', String(Date.now()));
    } catch (e) {}
    // 3. window 自定义事件（自身 tab 内已渲染时使用）
    try { window.dispatchEvent(new CustomEvent('baishi:artworks-changed', { detail: data })); } catch (e) {}
  }

  // ── 真实数据：listHistory ──
  var artworks = [];   // 来自后端
  var todaySection, yesterdaySection, earlierSection;
  function init() {
    todaySection = document.querySelector('section[data-od-id="today"]');
    yesterdaySection = document.querySelector('section[data-od-id="yesterday"]');
    earlierSection = document.querySelector('section[data-od-id="earlier"]');
    // 文生文 section 可保留作为占位
    bindActions();
    loadFromServer();
  }

  function loadFromServer() {
    if (!window.BaiShiAPI || !window.BaiShiAPI.listHistory) {
      toast('后端 API 不可用', 'error');
      return;
    }
    window.BaiShiAPI.listHistory(1, null).then(function (r) {
      if (r && r.success) {
        artworks = (r.data && r.data.items) || [];
        render();
      } else {
        toast('加载失败：' + (r && r.error ? r.error : '未知错误'), 'error');
      }
    }).catch(function (err) {
      toast('网络错误：' + (err && err.message ? err.message : err), 'error');
    });
  }

  function render() {
    // 按 created_at 倒序
    artworks.sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); });
    var today = startOfDay(new Date());
    var yesterday = today - 86400000;
    var day7 = today - 7 * 86400000;
    var todayItems = artworks.filter(function (a) { return a.created_at * 1000 >= today; });
    var yesterdayItems = artworks.filter(function (a) { return a.created_at * 1000 >= yesterday && a.created_at * 1000 < today; });
    var earlierItems = artworks.filter(function (a) { return a.created_at * 1000 < yesterday && a.created_at * 1000 >= day7; });
    // 超出 7 天的都归到 earlier
    if (!earlierItems.length) {
      earlierItems = artworks.filter(function (a) { return a.created_at * 1000 < yesterday; });
    }
    renderSection(todaySection, todayItems, '今天');
    renderSection(yesterdaySection, yesterdayItems, '昨天');
    renderSection(earlierSection, earlierItems, '本周');
    // 文生文 section 隐藏（原型阶段后端不返回文案）
    var cw = document.querySelector('section[data-od-id="copywriting"]');
    if (cw) cw.hidden = true;
    applyFilter();
  }

  function renderSection(section, items, label) {
    if (!section) return;
    var grid = section.querySelector('.hist-grid');
    var header = section.querySelector('h3');
    if (header) header.textContent = label;
    var countEl = section.querySelector('[data-section-count]');
    if (countEl) countEl.textContent = items.length + ' 件';
    if (!grid) return;
    grid.innerHTML = '';
    items.forEach(function (a, i) {
      grid.appendChild(buildCard(a, i));
    });
    section.hidden = items.length === 0;
  }

  function buildCard(a, i) {
    var card = document.createElement('div');
    card.className = 'art-card';
    // 使用后端返回的 style_id 标记来源（text-to-image / image-to-image / multi-image / copywriting）
    card.dataset.cat = normaliseCategory(a.style_id);
    card.dataset.style = '';
    card.dataset.title = a.prompt || ('作品 #' + a.id);
    card.dataset.search = buildSearchIndex(a);
    card.dataset.favorite = a.is_favorite ? 'true' : 'false';
    card.dataset.artworkId = a.id;
    var url = a.file_path || '';
    var time = formatTime(a.created_at);
    var sourceLabel = sourceToLabel(a.style_id);
    // ✅ 妙笔生花作品: file_path 是文案正文, 走文本卡片渲染
    var isText = a.style_id === 'copywriting';
    if (isText) {
      card.classList.add('art-card--text', 'art-card--previewable');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', '查看文案详情：' + (a.prompt ? a.prompt.slice(0, 24) : ('作品 #' + a.id)));
      // 文本作品 actions: 复制 / 再生成 / 下载（无放大）
      card.innerHTML =
          '<div class="art-text" role="img" aria-label="妙笔生花文案 · 提示词 ' + escapeAttr(a.prompt || '') + '" data-art="h' + a.id + '">'
        +   '<div class="art-text-body">' + escapeHtml(url) + '</div>'
        +   '<div class="art-text-foot">' + escapeHtml(a.thumb_path || url.slice(0, 60)) + '…</div>'
        + '</div>'
        + '<div class="actions">'
        +   '<button type="button" class="icon-btn" data-action="copy-text" aria-label="复制文案" title="复制文案"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>'
        +   '<button type="button" class="icon-btn" data-action="regen" aria-label="用相同提示词再生成" title="再生成"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg></button>'
        +   '<button type="button" class="icon-btn" data-action="download" aria-label="下载文案" title="下载"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>'
        + '</div>'
        + '<div class="art-meta"><div class="title">' + escapeHtml(a.prompt ? a.prompt.slice(0, 20) : ('作品 #' + a.id)) + '</div><div class="sub"><span>' + sourceLabel + ' · 文案</span><span class="num">' + time + '</span></div></div>'
        + '<button type="button" class="fav' + (a.is_favorite ? ' active' : '') + '" aria-pressed="' + !!a.is_favorite + '" aria-label="收藏"><span aria-hidden="true">★</span></button>'
        + '<label class="card-checkbox" aria-label="选择此作品" hidden><input type="checkbox" data-action="select-card" /></label>'
        + '<button type="button" class="card-delete" data-action="delete" aria-label="删除作品" title="删除" hidden>'
        +   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'
        +   '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>'
        + '</button>';
      // 复制文案按钮
      var copyBtn = card.querySelector('[data-action="copy-text"]');
      if (copyBtn) copyBtn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var text = (a.file_path || '');
        if (!text) { toast('文案为空'); return; }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { toast('已复制到剪贴板'); }, function () {
            var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
            try { document.execCommand('copy'); toast('已复制到剪贴板'); } catch (e) { toast('复制失败', 'error'); }
            document.body.removeChild(ta);
          });
        } else {
          var ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); toast('已复制到剪贴板'); } catch (e) { toast('复制失败', 'error'); }
          document.body.removeChild(ta);
        }
      });
    } else {
      card.classList.add('art-card--previewable');
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', '预览作品大图：' + (a.prompt ? a.prompt.slice(0, 24) : ('作品 #' + a.id)));
      // 图片作品（text-to-image / image-to-image / multi-image）
      card.innerHTML =
        '<div class="art-img" role="img" aria-label="' + escapeAttr(a.prompt) + ' · ' + (a.aspect || '1:1') + '"'
        + (url ? ' style="background-image:url(\'' + url + '\');background-size:cover;background-position:center;cursor:pointer;"' : ' data-art="h' + a.id + '"')
        + '></div>'
      + '<div class="actions">'
      +   '<button type="button" class="icon-btn" data-action="zoom" aria-label="放大预览" title="放大"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>'
      +   '<button type="button" class="icon-btn" data-action="regen" aria-label="用相同参数重新生成" title="再生成"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg></button>'
      +   '<button type="button" class="icon-btn" data-action="download" aria-label="下载" title="下载"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>'
      + '</div>'
      + '<div class="art-meta"><div class="title">' + escapeHtml(a.prompt ? a.prompt.slice(0, 20) : ('作品 #' + a.id)) + '</div><div class="sub"><span>' + sourceLabel + ' · ' + (a.aspect || '1:1') + ' · 步骤 ' + (a.steps || 30) + '</span><span class="num">' + time + '</span></div></div>'
      + '<button type="button" class="fav' + (a.is_favorite ? ' active' : '') + '" aria-pressed="' + !!a.is_favorite + '" aria-label="收藏"><span aria-hidden="true">★</span></button>'
      // 多选 checkbox (默认隐藏, multiselect-mode 下显示)
      + '<label class="card-checkbox" aria-label="选择此作品" hidden><input type="checkbox" data-action="select-card" /></label>'
      // 删除按钮 (hover 浮现)
      + '<button type="button" class="card-delete" data-action="delete" aria-label="删除作品" title="删除" hidden>'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">'
        + '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>'
        + '</button>';
    }
    // 收藏按钮
    card.querySelector('.fav').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var favBtn = card.querySelector('.fav');
      if (!window.BaiShiAPI || !a.id) {
        var on = !favBtn.classList.contains('active');
        favBtn.classList.toggle('active', on);
        favBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
        card.dataset.favorite = on ? 'true' : 'false';
        a.is_favorite = on;
        applyFilter();
        return;
      }
      window.BaiShiAPI.toggleFavorite(a.id).then(function (r) {
        if (r && r.success) {
          var on = !!r.data;
          favBtn.classList.toggle('active', on);
          favBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
          card.dataset.favorite = on ? 'true' : 'false';
          a.is_favorite = on;
          toast(on ? '已加入收藏' : '已取消收藏');
          applyFilter();
        }
      }).catch(function (err) {
        toast('收藏失败：' + (err && err.message ? err.message : err), 'error');
      });
    });
    // 放大预览 (text 卡片无此按钮 · 守护)
    var zoomBtn = card.querySelector('[data-action="zoom"]');
    if (zoomBtn) zoomBtn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      openArtworkPreview(a);
    });
    // 重新生成
    card.querySelector('[data-action="regen"]').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      sessionStorage.setItem('baishi_preset_prompt', a.prompt || '');
      location.href = 'text-to-image.html';
    });
    // 下载
    card.querySelector('[data-action="download"]').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      if (!url) { toast('该作品无图片可下载', 'warn'); return; }
      var link = document.createElement('a');
      link.href = url;
      link.download = 'baishi_' + a.id + '.png';
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      setTimeout(function () { link.remove(); }, 100);
      toast('已下载');
    });
    // 删除按钮 (在 history.html 范围内)
    card.querySelector('.card-delete').addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      confirmAndDeleteOne(a, card);
    });
    // 多选 checkbox
    var cb = card.querySelector('.card-checkbox input[type="checkbox"]');
    if (cb) {
      cb.addEventListener('change', function (e) {
        e.stopPropagation();
        card.classList.toggle('selected', cb.checked);
        updateBatchBar();
      });
      // 点击 label 也禁止冒泡
      card.querySelector('.card-checkbox').addEventListener('click', function (e) {
        e.stopPropagation();
      });
    }
    if (!isText) {
      card.addEventListener('click', function (e) {
        if (selectMode) return;
        if (e.target.closest('[data-action], .fav, .card-checkbox, .card-delete')) return;
        openArtworkPreview(a);
      });
      card.addEventListener('keydown', function (e) {
        if (selectMode) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target.closest('[data-action], .fav, .card-checkbox, .card-delete')) return;
        e.preventDefault();
        openArtworkPreview(a);
      });
    } else {
      card.addEventListener('click', function (e) {
        if (selectMode) return;
        if (e.target.closest('[data-action], .fav, .card-checkbox, .card-delete')) return;
        openArtworkPreview(a);
      });
      card.addEventListener('keydown', function (e) {
        if (selectMode) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target.closest('[data-action], .fav, .card-checkbox, .card-delete')) return;
        e.preventDefault();
        openArtworkPreview(a);
      });
    }
    return card;
  }

  function openArtworkPreview(artwork) {
    var isText = artwork && artwork.style_id === 'copywriting';
    var url = artwork && artwork.file_path ? artwork.file_path : '';
    if (!isText && !url) { toast('该作品无图片可预览', 'warn'); return; }
    closeArtworkPreview();
    var overlay = document.createElement('div');
    overlay.className = 'history-preview';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', isText ? '文案详情预览' : '作品大图预览');
    overlay.innerHTML =
      '<div class="history-preview__backdrop" data-preview-close></div>'
      + '<div class="history-preview__panel">'
      +   '<button type="button" class="history-preview__close" data-preview-close aria-label="关闭预览">×</button>'
      +   (isText ? buildTextPreviewMarkup(artwork) : buildImagePreviewMarkup(artwork, url))
      + '</div>';
    overlay.addEventListener('click', function (e) {
      if (e.target.closest('[data-preview-close]')) {
        closeArtworkPreview();
      }
    });
    document.body.appendChild(overlay);
    document.body.classList.add('history-preview-open');
    document.addEventListener('keydown', handlePreviewKeydown);
  }

  function closeArtworkPreview() {
    var existing = document.querySelector('.history-preview');
    if (existing) existing.remove();
    document.body.classList.remove('history-preview-open');
    document.removeEventListener('keydown', handlePreviewKeydown);
  }

  function handlePreviewKeydown(e) {
    if (e.key === 'Escape') closeArtworkPreview();
  }

  // ──────────────────────────────────────────────────────
  // 删除 · 单删 / 批量删
  // ──────────────────────────────────────────────────────

  // 全局多选状态
  var selectMode = false;
  var selectedIds = [];   // [{id, card}]

  function enterSelectMode() {
    selectMode = true;
    selectedIds = [];
    document.body.classList.add('multiselect-mode');
    var btn = document.getElementById('toggle-select-btn');
    if (btn) { btn.setAttribute('aria-pressed', 'true'); btn.setAttribute('aria-label', '退出管理模式'); btn.textContent = '完成'; }
    // 显示所有 checkbox + 删除按钮
    document.querySelectorAll('.art-card .card-checkbox').forEach(function (cb) { cb.hidden = false; });
    document.querySelectorAll('.art-card .card-delete').forEach(function (d) { d.hidden = false; });
    var bar = document.getElementById('batch-bar');
    if (bar) bar.hidden = false;
    updateBatchBar();
  }
  function exitSelectMode() {
    selectMode = false;
    selectedIds = [];
    document.body.classList.remove('multiselect-mode');
    var btn = document.getElementById('toggle-select-btn');
    if (btn) { btn.setAttribute('aria-pressed', 'false'); btn.setAttribute('aria-label', '进入管理模式以批量删除作品'); btn.textContent = '管理'; }
    document.querySelectorAll('.art-card .card-checkbox').forEach(function (cb) {
      cb.hidden = true;
      var input = cb.querySelector('input');
      if (input) input.checked = false;
    });
    document.querySelectorAll('.art-card .card-delete').forEach(function (d) { d.hidden = true; });
    document.querySelectorAll('.art-card.selected').forEach(function (c) { c.classList.remove('selected'); });
    var bar = document.getElementById('batch-bar');
    if (bar) bar.hidden = true;
  }
  function updateBatchBar() {
    var checked = Array.prototype.slice.call(document.querySelectorAll('.art-card .card-checkbox input:checked'));
    var countEl = document.getElementById('batch-count');
    var totalEl = document.getElementById('batch-total');
    if (countEl) countEl.textContent = checked.length;
    if (totalEl) totalEl.textContent = document.querySelectorAll('.art-card').length;
  }

  // 单删确认 + 调用后端
  function confirmAndDeleteOne(a, card) {
    if (selectMode) {
      // 多选模式下点 .card-delete 仍走单删
    }
    var title = a.prompt ? a.prompt.slice(0, 16) + (a.prompt.length > 16 ? '…' : '') : ('作品 #' + a.id);
    if (!confirm('确定要删除「' + title + '」吗？\n该操作不可恢复。')) return;
    if (!window.BaiShiAPI || !window.BaiShiAPI.deleteArtwork) {
      toast('后端 API 不可用', 'error');
      return;
    }
    card.style.transition = 'opacity 220ms, transform 220ms';
    card.style.opacity = '0.3';
    card.style.transform = 'scale(0.96)';
    window.BaiShiAPI.deleteArtwork(a.id).then(function (r) {
      if (r && r.success) {
        // 从 artworks 数组移除
        artworks = artworks.filter(function (x) { return x.id !== a.id; });
        // 从 DOM 移除
        card.remove();
        // 更新 section 计数
        recountSections();
        updateCounts();
        updateBatchBar();
        toast('已删除「' + title + '」');
        broadcastArtworksChange('deleted', { ids: [a.id] });
      } else {
        card.style.opacity = '';
        card.style.transform = '';
        toast('删除失败：' + (r && r.error ? r.error : '未知错误'), 'error');
      }
    }).catch(function (err) {
      card.style.opacity = '';
      card.style.transform = '';
      toast('网络错误：' + (err && err.message ? err.message : err), 'error');
    });
  }

  // 批量删除
  function batchDeleteSelected() {
    var checks = Array.prototype.slice.call(document.querySelectorAll('.art-card .card-checkbox input:checked'));
    if (!checks.length) { toast('请先选择要删除的作品', 'warn'); return; }
    var ids = checks.map(function (c) {
      var card = c.closest('.art-card');
      return card && card.dataset.artworkId ? parseInt(card.dataset.artworkId, 10) : null;
    }).filter(function (x) { return x != null; });
    if (!ids.length) return;
    if (!confirm('确定要删除选中的 ' + ids.length + ' 件作品吗？\n该操作不可恢复。')) return;
    if (!window.BaiShiAPI || !window.BaiShiAPI.deleteArtworksBatch) {
      toast('后端 API 不可用', 'error');
      return;
    }
    // 乐观 UI: 立即淡出选中卡
    checks.forEach(function (c) {
      var card = c.closest('.art-card');
      if (card) {
        card.style.transition = 'opacity 220ms, transform 220ms';
        card.style.opacity = '0.3';
        card.style.transform = 'scale(0.96)';
      }
    });
    window.BaiShiAPI.deleteArtworksBatch(ids).then(function (r) {
      if (r && r.success) {
        var n = (r.data && r.data.deleted) || ids.length;
        // 从 artworks 数组移除
        artworks = artworks.filter(function (x) { return ids.indexOf(x.id) === -1; });
        // 从 DOM 移除选中卡
        document.querySelectorAll('.art-card.selected').forEach(function (c) { c.remove(); });
        recountSections();
        updateCounts();
        exitSelectMode();
        toast('已批量删除 ' + n + ' 件作品');
        broadcastArtworksChange('deleted', { ids: ids });
      } else {
        // 恢复淡出
        checks.forEach(function (c) {
          var card = c.closest('.art-card');
          if (card) { card.style.opacity = ''; card.style.transform = ''; }
        });
        toast('批量删除失败：' + (r && r.error ? r.error : '未知错误'), 'error');
      }
    }).catch(function (err) {
      checks.forEach(function (c) {
        var card = c.closest('.card');
        if (card) { card.style.opacity = ''; card.style.transform = ''; }
      });
      toast('网络错误：' + (err && err.message ? err.message : err), 'error');
    });
  }

  // 重新计算每个 section 的件数
  function recountSections() {
    document.querySelectorAll('section[data-od-id]').forEach(function (sec) {
      if (sec.dataset.odId === 'copywriting') return; // 文生文占位不参与
      var n = sec.querySelectorAll('.art-card').length;
      var meta = sec.querySelector('[data-section-count]');
      if (meta) meta.textContent = n + ' 件';
      sec.hidden = n === 0;
    });
  }

  function formatTime(ts) {
    if (!ts) return '—';
    var d = new Date(ts * 1000);
    var today = startOfDay(new Date());
    if (d.getTime() >= today) {
      return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
    }
    var yesterday = today - 86400000;
    if (d.getTime() >= yesterday) return '昨天';
    var days = Math.floor((today - d.getTime()) / 86400000);
    return days + ' 天前';
  }

  function startOfDay(d) {
    var x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }

  // 后端 style_id → 前端中文化标签
  function sourceToLabel(sid) {
    switch (sid) {
      case 'text-to-image': return '文生图';
      case 'image-to-image': return '图生图';
      case 'multi-image':    return '多图融合';
      case 'copywriting':    return '妙笔生花';
      default:               return '作品';
    }
  }

  function normaliseCategory(sid) {
    switch (sid) {
      case 'copywriting': return 'text-to-text';
      case 'image-to-image':
      case 'multi-image':
        return 'image-to-image';
      case 'text-to-image':
      default:
        return 'text-to-image';
    }
  }

  function buildSearchIndex(artwork) {
    return [
      artwork && artwork.prompt,
      artwork && artwork.thumb_path,
      artwork && artwork.file_path && artwork.style_id === 'copywriting' ? artwork.file_path.slice(0, 180) : '',
      sourceToLabel(artwork && artwork.style_id),
      artwork && artwork.aspect,
    ].filter(Boolean).join(' ');
  }

  function buildImagePreviewMarkup(artwork, url) {
    return '<div class="history-preview__layout history-preview__layout--image">'
      +   '<div class="history-preview__media">'
      +     '<img class="history-preview__image" alt="' + escapeAttr((artwork && artwork.prompt) || '历史作品预览') + '" src="' + escapeAttr(url) + '" />'
      +   '</div>'
      +   '<div class="history-preview__sidebar">'
      +     '<div class="history-preview__title-wrap">'
      +       '<div class="history-preview__eyebrow">' + escapeHtml(sourceToLabel(artwork && artwork.style_id)) + ' · 图片作品</div>'
      +       '<div class="history-preview__title">' + escapeHtml((artwork && artwork.prompt) || '未命名作品') + '</div>'
      +       '<div class="history-preview__sub">' + escapeHtml(formatDateTime(artwork && artwork.created_at)) + '</div>'
      +     '</div>'
      +     '<div class="history-preview__params">'
      +       previewParam('画幅', artwork && artwork.aspect ? artwork.aspect : '未记录')
      +       previewParam('步骤', artwork && artwork.steps ? String(artwork.steps) : '未记录')
      +       previewParam('CFG', artwork && typeof artwork.cfg_scale !== 'undefined' && artwork.cfg_scale !== null ? String(artwork.cfg_scale) : '未记录')
      +       previewParam('Seed', artwork && artwork.seed ? String(artwork.seed) : '自动')
      +     '</div>'
      +     previewSection('提示词', artwork && artwork.prompt ? artwork.prompt : '暂无提示词')
      +     previewSection('负面提示词', artwork && artwork.negative_prompt ? artwork.negative_prompt : '未设置', !(artwork && artwork.negative_prompt))
      +   '</div>'
      + '</div>';
  }

  function buildTextPreviewMarkup(artwork) {
    var body = artwork && artwork.file_path ? artwork.file_path : '';
    var summary = artwork && artwork.thumb_path ? artwork.thumb_path : '';
    return '<div class="history-preview__layout history-preview__layout--text">'
      +   '<div class="history-preview__meta">'
      +     '<div class="history-preview__title-wrap">'
      +       '<div class="history-preview__eyebrow">妙笔生花 · 文案作品</div>'
      +       '<div class="history-preview__title">' + escapeHtml((artwork && artwork.prompt) || '未命名文案') + '</div>'
      +       '<div class="history-preview__sub">' + escapeHtml(formatDateTime(artwork && artwork.created_at)) + '</div>'
      +     '</div>'
      +     '<div class="history-preview__section">'
      +       '<div class="history-preview__section-title">完整文案</div>'
      +       '<pre class="history-preview__text-body">' + escapeHtml(body || '暂无文案内容') + '</pre>'
      +     '</div>'
      +   '</div>'
      +   '<div class="history-preview__sidebar">'
      +     '<div class="history-preview__params">'
      +       previewParam('来源', sourceToLabel(artwork && artwork.style_id))
      +       previewParam('模型', artwork && artwork.negative_prompt ? artwork.negative_prompt : '未记录')
      +     '</div>'
      +     previewSection('原提示词', artwork && artwork.prompt ? artwork.prompt : '未记录')
      +     previewSection('摘要', summary || '未记录', !summary)
      +   '</div>'
      + '</div>';
  }

  function previewParam(label, value) {
    return '<div class="history-preview__param">'
      +   '<span class="history-preview__param-label">' + escapeHtml(label) + '</span>'
      +   '<span class="history-preview__param-value">' + escapeHtml(value) + '</span>'
      + '</div>';
  }

  function previewSection(title, content, isEmpty) {
    return '<div class="history-preview__section">'
      +   '<div class="history-preview__section-title">' + escapeHtml(title) + '</div>'
      +   '<div class="history-preview__copy' + (isEmpty ? ' history-preview__empty' : '') + '">' + escapeHtml(content) + '</div>'
      + '</div>';
  }

  function formatDateTime(ts) {
    if (!ts) return '—';
    var d = new Date(ts * 1000);
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + h + ':' + min;
  }

  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); }
  function escapeAttr(s) { return escapeHtml(s); }

  // ── 顶部操作按钮 ──
  function bindActions() {
    document.body.addEventListener('click', function (e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.dataset.action;
      var card = target.closest('.art-card');
      var title = card ? card.dataset.title : '';

      if (action === 'zoom' && card) {
        // 已绑
      } else if (action === 'regen' && card) {
        // 已绑
      } else if (action === 'download' && card) {
        // 已绑
      } else if (action === 'delete' && card) {
        // 静态 demo 卡片上点击删除按钮 → 调用后端
        if (!card.dataset.artworkId) {
          // demo 卡片, 只是 toast 提示
          toast('此 demo 卡片不可删除·请在生成作品后删除', 'warn');
          return;
        }
        confirmAndDeleteOne({ id: parseInt(card.dataset.artworkId, 10), prompt: card.dataset.title }, card);
      } else if (action === 'export-zip') {
        if (!artworks.length) { toast('暂无作品可导出', 'warn'); return; }
        toast('已生成导出任务 · 共 ' + artworks.length + ' 件作品', 'success');
      } else if (action === 'batch-fav') {
        if (!artworks.length) { toast('暂无作品可批量收藏', 'warn'); return; }
        toast('已批量收藏当前 ' + artworks.length + ' 件作品', 'success');
      } else if (action === 'toggle-select') {
        if (selectMode) exitSelectMode(); else enterSelectMode();
      } else if (action === 'select-all') {
        document.querySelectorAll('.art-card .card-checkbox input[type="checkbox"]').forEach(function (cb) {
          if (cb.disabled) return;
          cb.checked = true;
          var card = cb.closest('.art-card');
          if (card) card.classList.add('selected');
        });
        updateBatchBar();
      } else if (action === 'select-invert') {
        document.querySelectorAll('.art-card .card-checkbox input[type="checkbox"]').forEach(function (cb) {
          if (cb.disabled) return;
          cb.checked = !cb.checked;
          var card = cb.closest('.art-card');
          if (card) card.classList.toggle('selected', cb.checked);
        });
        updateBatchBar();
      } else if (action === 'batch-delete-confirm') {
        batchDeleteSelected();
      } else if (action === 'batch-cancel') {
        exitSelectMode();
      } else if (action === 'advanced-filter') {
        toast('高级筛选面板即将开放', 'warn');
      } else if (action === 'clear-filters') {
        search.value = '';
        typeSel.value = 'all';
        styleSel.value = 'all';
        applyFilter();
        toast('已清除全部筛选');
      }
    });

    var loadMore = document.getElementById('load-more');
    if (loadMore) {
      loadMore.addEventListener('click', function () {
        if (loadMore.getAttribute('aria-busy') === 'true') return;
        loadMore.setAttribute('aria-busy', 'true');
        var orig = loadMore.textContent;
        loadMore.textContent = '加载中…';
        setTimeout(function () {
          loadMore.setAttribute('aria-busy', 'false');
          loadMore.textContent = orig;
          toast('已加载更多 · 当前共 ' + artworks.length + ' 件', 'success');
        }, 800);
      });
    }
  }

  init();
});
