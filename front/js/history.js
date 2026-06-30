// history.html — Polished
document.addEventListener('DOMContentLoaded', function () {

  // ─── 工具 ─────────────────────────────────────────────
  function toast(msg, kind) {
    const t = document.createElement('div');
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.innerHTML = '<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>' + msg + '</span>';
    document.getElementById('toasts').appendChild(t);
    setTimeout(function () { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
    setTimeout(function () { t.remove(); }, 2800);
  }

  // ─── OS 切换 ─────────────────────────────────────────
  document.querySelectorAll('[data-os-set]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.body.dataset.os = btn.dataset.osSet;
      document.querySelectorAll('[data-os-set]').forEach(function (b) { b.classList.toggle('active', b === btn); });
    });
  });

  // ─── 网格 / 列表切换（保留原行为）────────────────────
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

  // ─── 收藏（button + aria-pressed）──────────────────
  document.querySelectorAll('.art-card .fav').forEach(function (fav) {
    fav.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      var on = !fav.classList.contains('active');
      fav.classList.toggle('active', on);
      fav.setAttribute('aria-pressed', String(on));
      var title = fav.closest('.art-card').dataset.title || '作品';
      fav.setAttribute('aria-label', (on ? '取消收藏 ' : '收藏 ') + title);
      toast(on ? '已加入收藏 · ' + title : '已取消收藏 · ' + title);
      updateCounts();
    });
  });

  // ─── 实时过滤 ───────────────────────────────────────
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
        var title = (card.dataset.title || '').toLowerCase();
        var cCat = card.dataset.cat || '';
        var cStyle = card.dataset.style || '';
        var match = (!q || title.indexOf(q) >= 0)
                 && (cat === 'all' || cCat === cat)
                 && (style === 'all' || cStyle === style);
        card.style.display = match ? '' : 'none';
        if (match) secVisible++;
      });
      sec.hidden = secVisible === 0;
      var meta = sec.querySelector('[data-section-count]');
      if (meta) meta.textContent = secVisible + ' 件';
      visibleCount += secVisible;
    });
    var empty = document.getElementById('empty-state');
    if (empty) empty.hidden = visibleCount > 0;
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

  // 启动时初始化计数
  applyFilter();

  // ─── 5 个死按钮的 data-action 委托 ─────────────────
  document.body.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;
    var action = target.dataset.action;
    var card = target.closest('.art-card');
    var title = card ? card.dataset.title : '';

    if (action === 'zoom' && card) {
      toast('已打开预览 · ' + title);
    } else if (action === 'regen' && card) {
      toast('已加入重新生成队列 · ' + title);
    } else if (action === 'download' && card) {
      toast('已下载到本地 · ' + title);
    } else if (action === 'export-zip') {
      var n = document.querySelectorAll('.art-card:not([style*="display: none"])').length;
      toast('已生成 ZIP · 共 ' + n + ' 件作品');
    } else if (action === 'batch-fav') {
      var m = document.querySelectorAll('.art-card:not([style*="display: none"])').length;
      toast('已批量收藏当前 ' + m + ' 件作品');
    } else if (action === 'advanced-filter') {
      toast('高级筛选面板即将开放');
    } else if (action === 'clear-filters') {
      search.value = '';
      typeSel.value = 'all';
      styleSel.value = 'all';
      applyFilter();
      toast('已清除全部筛选');
    }
  });

  // ─── 加载更早作品 ──────────────────────────────────
  var loadMore = document.getElementById('load-more');
  var moreSeq = 0;
  var moreArtStyles = [
    { g: 'linear-gradient(180deg, #f0e8d0 0%, #8a7a5a 50%, #2a1a14 100%)', t: '云山', s: '水墨', r: '16:9' },
    { g: 'radial-gradient(ellipse at 50% 40%, #e8d4a8, #5a3a20)', t: '秋意', s: '写意', r: '4:5' },
    { g: 'linear-gradient(135deg, #d4c8a8 0%, #6a5a3a 50%, #1a1410 100%)', t: '远岫', s: '青绿', r: '21:9' },
    { g: 'linear-gradient(45deg, #f8f3e3 0%, #b89a6a 50%, #3a2a18 100%)', t: '归舟', s: '水墨', r: '1:1' }
  ];
  loadMore.addEventListener('click', function () {
    if (loadMore.getAttribute('aria-busy') === 'true') return;
    loadMore.setAttribute('aria-busy', 'true');
    var orig = loadMore.textContent;
    loadMore.textContent = '加载中…';
    setTimeout(function () {
      moreSeq++;
      var sec = document.createElement('section');
      sec.setAttribute('data-od-id', 'older-' + moreSeq);
      sec.setAttribute('aria-labelledby', 'date-older-' + moreSeq);
      var cards = '';
      moreArtStyles.forEach(function (it, i) {
        var idx = 12 + moreSeq * 4 + i;
        var aId = 'h' + (idx + 1);
        cards += '<div class="art-card" data-cat="text-to-image" data-style="' + it.s + '" data-title="' + it.t + '">'
          + '<div class="art-img" data-art="' + aId + '" role="img" aria-label="' + it.t + ' · ' + it.s + ' · ' + it.r + '" style="background:' + it.g + ';"></div>'
          + '<div class="actions">'
          +   '<button type="button" class="icon-btn" data-action="zoom" aria-label="放大预览 ' + it.t + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></button>'
          +   '<button type="button" class="icon-btn" data-action="regen" aria-label="用相同参数重新生成"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5"/></svg></button>'
          +   '<button type="button" class="icon-btn" data-action="download" aria-label="下载 ' + it.t + '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></button>'
          + '</div>'
          + '<div class="art-meta"><div class="title">' + it.t + '</div><div class="sub"><span>' + it.s + ' · ' + it.r + '</span><span class="num">更早</span></div></div>'
          + '<button type="button" class="fav" aria-pressed="false" aria-label="收藏 ' + it.t + '"><span aria-hidden="true">★</span></button>'
          + '</div>';
      });
      sec.innerHTML = '<div class="date-header"><h3 id="date-older-' + moreSeq + '">更早 · 6 月 18 - 22 日</h3><span class="meta" data-section-count>4 件</span></div>'
        + '<div class="hist-grid">' + cards + '</div>';
      // 插到 empty-state 之前
      var empty = document.getElementById('empty-state');
      empty.parentNode.insertBefore(sec, empty);
      // 给新卡片的 fav 重新绑事件
      sec.querySelectorAll('.fav').forEach(function (fav) {
        fav.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          var on = !fav.classList.contains('active');
          fav.classList.toggle('active', on);
          fav.setAttribute('aria-pressed', String(on));
          var t2 = fav.closest('.art-card').dataset.title;
          fav.setAttribute('aria-label', (on ? '取消收藏 ' : '收藏 ') + t2);
          toast(on ? '已加入收藏 · ' + t2 : '已取消收藏 · ' + t2);
          updateCounts();
        });
      });
      loadMore.setAttribute('aria-busy', 'false');
      loadMore.textContent = orig;
      toast('已加载 4 件更早作品');
      applyFilter(); // 让新 section 也参与过滤 & 计数
    }, 1500);
  });
});
