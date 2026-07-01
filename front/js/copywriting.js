// copywriting.js — polished 2026-06-29
// a11y: 1 form field + 11 buttons + 6 template cards + 3 history items
// states: 5 dead buttons 已激活
// storage: 编辑输出 + 用户模板库
document.addEventListener('DOMContentLoaded', function () {

  /* ─── Toast ───────────────────────────────────────── */
  function toast(msg, kind = 'success') {
    if (window.BaishiShared && typeof window.BaishiShared.toast === 'function') {
      return window.BaishiShared.toast(msg, kind);
    }
  }

  /* ─── OS 切换 ─────────────────────────────────────── */
  document.querySelectorAll('[data-os-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.dataset.os = btn.dataset.osSet;
      document.querySelectorAll('[data-os-set]').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  /* ─── 模板数据 — 从 text-styles.js 同步加载 ─────────── */
  const textStyles = (window.BaishiTextStyles ? window.BaishiTextStyles.list() : []);

  /* ─── 快捷模板 — 从妙笔生花随机抽选8个 ──────────── */
  function shuffleArray(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  function renderQuickTemplates() {
    var container = document.getElementById('quick-templates');
    if (!container) return;
    // 从 textStyles 随机选 8 个（不足则全选）
    var pool = textStyles.slice();
    shuffleArray(pool);
    var selected = pool.slice(0, 8);
    container.innerHTML = '';
    selected.forEach(function (item) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'template-card';
      card.setAttribute('aria-label', '选择模板：' + item.name);
      card.innerHTML =
        '<span class="t-cat">' + item.cat + '</span>' +
        '<span class="t-name">' + item.name + '</span>' +
        '<span class="t-desc">' + (item.prompt ? item.prompt.slice(0, 20) + '…' : '') + '</span>';
      card.addEventListener('click', function () {
        var input = document.getElementById('copy-input');
        if (input) input.value = item.prompt || '';
        document.querySelectorAll('.template-card').forEach(function (c) { c.classList.remove('selected'); });
        card.classList.add('selected');
        toast('已填入「' + item.name + '」模板');
      });
      container.appendChild(card);
    });
  }
  // 在页面加载时渲染，并在每次刷新时随机
  renderQuickTemplates();
  // 加一个「换一批」刷新按钮
  var refreshBtn = document.createElement('button');
  refreshBtn.type = 'button';
  refreshBtn.className = 'btn btn-ghost btn-sm';
  refreshBtn.style.cssText = 'font-size: 11px; color: var(--muted); margin-left: var(--space-3);';
  refreshBtn.textContent = '换一批';
  refreshBtn.addEventListener('click', function () {
    renderQuickTemplates();
    toast('已刷新快捷模板');
  });
  var hTpl = document.getElementById('h-templates');
  if (hTpl) hTpl.appendChild(refreshBtn);

  /* ─── 用户模板库（localStorage） ─────────────────── */
  function loadUserTemplates() {
    try {
      var raw = localStorage.getItem('baishi.user.templates');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveUserTemplates(arr) {
    try { localStorage.setItem('baishi.user.templates', JSON.stringify(arr)); }
    catch (e) { /* 静默 */ }
  }

  /* ─── 导入模板 ────────────────────────────────────── */
  var importBtn = document.getElementById('import-template-btn');
  var importFile = document.getElementById('import-template-file');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', function () { importFile.click(); });
    importFile.addEventListener('change', function () {
      var f = importFile.files && importFile.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(e.target.result);
          var items = Array.isArray(data) ? data : (data && data.templates) ? data.templates : null;
          if (!items || !items.length) { toast('文件格式无法识别', 'warn'); return; }
          var merged = loadUserTemplates().concat(items.filter(function (t) { return t && t.prompt; }));
          saveUserTemplates(merged);
          toast('已导入 ' + items.length + ' 个模板');
        } catch (err) {
          toast('JSON 解析失败：' + err.message, 'warn');
        }
        importFile.value = '';
      };
      reader.onerror = function () { toast('读取文件失败', 'warn'); };
      reader.readAsText(f);
    });
  }

  /* ─── 生成文案（调 LLM） ───────────────────────────── */
  /* loading 三态工具: showLoading(stepText) → setLoadingStep(text) → hideLoading */
  function hideLoading() {
    var loading = document.getElementById('output-loading');
    var placeholder = document.getElementById('output-placeholder');
    if (loading) loading.hidden = true;
    if (placeholder) placeholder.style.display = '';
  }
  function showLoading(stepText) {
    var loading = document.getElementById('output-loading');
    var placeholder = document.getElementById('output-placeholder');
    var output = document.getElementById('output-text');
    var review = document.getElementById('output-review');
    var actions = document.getElementById('output-actions');
    var editFlag = document.getElementById('output-edit-flag');
    var viewToggle = document.getElementById('output-view-toggle');
    if (placeholder) placeholder.style.display = 'none';
    if (output) output.style.display = 'none';
    if (review) review.style.display = 'none';
    if (actions) actions.style.display = 'none';
    if (editFlag) editFlag.hidden = true;
    if (viewToggle) viewToggle.hidden = true;
    if (loading) {
      loading.hidden = false;
      var stepEl = document.getElementById('output-loading-step');
      if (stepEl && stepText) stepEl.textContent = stepText;
    }
  }
  function setLoadingStep(text) {
    var stepEl = document.getElementById('output-loading-step');
    if (stepEl) stepEl.textContent = text;
  }

  var outputState = { view: 'review' };

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderInlineMarkdown(text) {
    var escaped = escapeHtml(text);
    var codeTokens = [];
    escaped = escaped.replace(/`([^`]+)`/g, function (_, code) {
      var key = '__CODE_TOKEN_' + codeTokens.length + '__';
      codeTokens.push('<code>' + code + '</code>');
      return key;
    });
    escaped = escaped.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer noopener">$1</a>');
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    escaped = escaped.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
    escaped = escaped.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');
    escaped = escaped.replace(/\n/g, '<br>');
    codeTokens.forEach(function (html, index) {
      escaped = escaped.replace('__CODE_TOKEN_' + index + '__', html);
    });
    return escaped;
  }

  function renderMarkdown(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var html = [];
    var paragraph = [];
    var listItems = [];
    var listType = '';
    var quote = [];
    var codeLines = [];
    var inCode = false;

    function flushParagraph() {
      if (!paragraph.length) return;
      html.push('<p>' + renderInlineMarkdown(paragraph.join('\n')) + '</p>');
      paragraph = [];
    }

    function flushList() {
      if (!listItems.length) return;
      html.push('<' + listType + '>' + listItems.map(function (item) {
        return '<li>' + renderInlineMarkdown(item) + '</li>';
      }).join('') + '</' + listType + '>');
      listItems = [];
      listType = '';
    }

    function flushQuote() {
      if (!quote.length) return;
      html.push('<blockquote>' + renderInlineMarkdown(quote.join('\n')) + '</blockquote>');
      quote = [];
    }

    function flushCode() {
      if (!codeLines.length) return;
      html.push('<pre><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
      codeLines = [];
    }

    lines.forEach(function (line) {
      if (/^```/.test(line)) {
        flushParagraph();
        flushList();
        flushQuote();
        if (inCode) {
          flushCode();
          inCode = false;
        } else {
          inCode = true;
        }
        return;
      }

      if (inCode) {
        codeLines.push(line);
        return;
      }

      if (!line.trim()) {
        flushParagraph();
        flushList();
        flushQuote();
        return;
      }

      if (/^---+$/.test(line.trim())) {
        flushParagraph();
        flushList();
        flushQuote();
        html.push('<hr>');
        return;
      }

      var heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        flushList();
        flushQuote();
        html.push('<h' + heading[1].length + '>' + renderInlineMarkdown(heading[2]) + '</h' + heading[1].length + '>');
        return;
      }

      var blockquote = line.match(/^>\s?(.*)$/);
      if (blockquote) {
        flushParagraph();
        flushList();
        quote.push(blockquote[1]);
        return;
      }
      flushQuote();

      var ordered = line.match(/^\d+\.\s+(.+)$/);
      if (ordered) {
        flushParagraph();
        if (listType && listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(ordered[1]);
        return;
      }

      var unordered = line.match(/^[-*+]\s+(.+)$/);
      if (unordered) {
        flushParagraph();
        if (listType && listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(unordered[1]);
        return;
      }

      flushList();
      paragraph.push(line);
    });

    flushParagraph();
    flushList();
    flushQuote();
    if (inCode) flushCode();

    return html.join('');
  }

  function renderOutputReview() {
    var reviewEl = document.getElementById('output-review');
    var outputEl = document.getElementById('output-text');
    if (!reviewEl || !outputEl) return;
    var text = outputEl.textContent || '';
    if (!text.trim()) {
      reviewEl.classList.add('is-empty');
      reviewEl.innerHTML = '<p>生成结果将显示在这里，审阅视图会自动渲染 markdown。</p>';
      return;
    }
    reviewEl.classList.remove('is-empty');
    reviewEl.innerHTML = renderMarkdown(text);
  }

  function syncOutputView() {
    var outputEl = document.getElementById('output-text');
    var reviewEl = document.getElementById('output-review');
    var viewToggle = document.getElementById('output-view-toggle');
    var reviewBtn = document.getElementById('review-view-btn');
    var editBtn = document.getElementById('edit-view-btn');
    if (!outputEl || !reviewEl || !viewToggle || !reviewBtn || !editBtn) return;

    var hasContent = !!(outputEl.textContent || '').trim();
    viewToggle.hidden = !hasContent;
    reviewBtn.classList.toggle('active', outputState.view === 'review');
    reviewBtn.setAttribute('aria-pressed', outputState.view === 'review' ? 'true' : 'false');
    editBtn.classList.toggle('active', outputState.view === 'edit');
    editBtn.setAttribute('aria-pressed', outputState.view === 'edit' ? 'true' : 'false');

    if (!hasContent) {
      reviewEl.style.display = 'none';
      outputEl.style.display = 'none';
      return;
    }

    if (outputState.view === 'review') {
      renderOutputReview();
      reviewEl.style.display = 'block';
      outputEl.style.display = 'none';
    } else {
      reviewEl.style.display = 'none';
      outputEl.style.display = 'block';
    }
  }

  function setOutputView(view) {
    outputState.view = view === 'edit' ? 'edit' : 'review';
    syncOutputView();
  }

  /* ─── ensureTextApi · 生成前兜底 ──────────────────────────
   * 关键修复: 解决「bootstrap 异步但 doGenerate 同步触发」的竞态。
   * 用户操作: 打开 copywriting.html → 立即点「生成文案」→
   *   bootstrap 还没完成 → 读到空配置 → 报"未配置生文 API"
   * 解决: doGenerate 开头 await ensureTextApi()，缺啥从后端补啥。
   * 行为: localStorage 已有完整配置 → 立即返回 (0ms);
   *       缺 url/model → 拉后端 settings(1) → 合并写回 localStorage → 返回。
   */
  function ensureTextApi() {
    return new Promise(function (resolve) {
      var cur = (window.BaishiShared && window.BaishiShared.getTextApi) ? window.BaishiShared.getTextApi() : {};
      if (cur && cur.url && cur.model) { resolve(cur); return; }
      // 配置不全 → 拉后端
      if (!(window.BaiShiAPI && window.BaiShiAPI.getSettings)) { resolve(cur || {}); return; }
      window.BaiShiAPI.getSettings(1).then(function (r) {
        if (!(r && r.success && r.data)) { resolve(window.BaishiShared ? window.BaishiShared.getTextApi() : (cur || {})); return; }
        var d = r.data;
        var latest = (window.BaishiShared && window.BaishiShared.getTextApi) ? window.BaishiShared.getTextApi() : (cur || {});
        var merged = Object.assign({}, latest, {
          url:   latest.url   || d.api_endpoint    || '',
          key:   latest.key   || d.api_key         || '',
          model: latest.model || d.text_api_model  || '',
        }, { savedAt: Date.now(), fromBackend: true });
        if (window.BaishiShared && window.BaishiShared.setTextApi) {
          try { window.BaishiShared.setTextApi(merged); } catch (e) { /* 静默 */ }
        }
        resolve(merged);
      }).catch(function () { resolve(window.BaishiShared ? window.BaishiShared.getTextApi() : (cur || {})); });
    });
  }

  async function doGenerate() {
    var input = document.getElementById('copy-input');
    if (!input || !input.value.trim()) { toast('请先输入需求', 'warn'); if (input) input.focus(); return; }

    var output = document.getElementById('output-text');
    var actions = document.getElementById('output-actions');
    var btn1 = document.getElementById('generate-btn');
    var btn2 = document.getElementById('generate-btn2');
    var regenBtn = document.getElementById('regenerate-result');

    function setBusy(b) {
      if (b) { b.setAttribute('aria-busy', 'true'); b.disabled = true; }
    }
    function clearBusy(b, label) {
      if (b) { b.removeAttribute('aria-busy'); b.disabled = false; if (label) b.textContent = label; }
    }

    var defaultLabel1 = (btn1 && btn1.dataset.defaultLabel) || (btn1 && btn1.textContent) || '生成文案';

    // ① 点击瞬间: 显示 loading (隐藏 placeholder / output / actions)
    showLoading('正在连接后端');
    setBusy(btn1); setBusy(btn2); setBusy(regenBtn);

    // 关键修复: 生成前先 ensure 配置就位 (如未配置则从后端兜底)
    // 这样即使 bootstrap 还没完成, doGenerate 也不会读到空配置
    var ta = await ensureTextApi();
    if (!ta || !ta.url) {
      hideLoading();
      clearBusy(btn1, defaultLabel1); clearBusy(btn2, '生成文案'); clearBusy(regenBtn, '重新生成');
      toast('未配置生文 API · 请先在「设置 → 生文 API」中填写 URL', 'warn');
      return;
    }
    if (!ta.model) {
      hideLoading();
      clearBusy(btn1, defaultLabel1); clearBusy(btn2, '生成文案'); clearBusy(regenBtn, '重新生成');
      toast('未选择模型 · 请先在「设置 → 生文 API」中选择模型并保存', 'warn');
      return;
    }

    // 阶段文字时序: 连接后端 → 发送请求 → 等待 LLM → 处理完成
    var stepTimer  = setTimeout(function () { setLoadingStep('发送文案生成请求'); }, 400);
    var stepTimer2 = setTimeout(function () { setLoadingStep('等待 LLM 响应…'); }, 1600);
    var stepTimer3 = setTimeout(function () { setLoadingStep('处理完成 · 返回文案中…'); }, 3000);

    function finishWithSuccess(text) {
      clearTimeout(stepTimer); clearTimeout(stepTimer2); clearTimeout(stepTimer3);
      var loading = document.getElementById('output-loading');
      if (loading) loading.hidden = true;
      // 成功后永久隐藏 placeholder 图标和文字
      var placeholder = document.getElementById('output-placeholder');
      if (placeholder) placeholder.style.display = 'none';
      if (output) {
        output.textContent = text;
        output.dataset.original = text;
      }
      var editFlag = document.getElementById('output-edit-flag');
      if (editFlag) editFlag.hidden = true;
      if (actions) actions.style.display = 'flex';
      updateCharCount();
      setOutputView('review');
      clearBusy(btn1, defaultLabel1); clearBusy(btn2, '生成文案'); clearBusy(regenBtn, '重新生成');
    }
    function finishWithError(errMsg) {
      clearTimeout(stepTimer); clearTimeout(stepTimer2); clearTimeout(stepTimer3);
      // 错误: 回到 placeholder, 错误信息走 toast
      var loading = document.getElementById('output-loading');
      if (loading) loading.hidden = true;
      var placeholder = document.getElementById('output-placeholder');
      if (placeholder) placeholder.style.display = '';
      syncOutputView();
      toast(errMsg || '生成失败', 'warn');
      clearBusy(btn1, defaultLabel1); clearBusy(btn2, '生成文案'); clearBusy(regenBtn, '重新生成');
    }

    if (window.BaiShiAPI && window.BaiShiAPI.generateCopywriting) {
      window.BaiShiAPI.generateCopywriting(input.value.trim()).then(function (res) {
        if (res && res.success && res.data && res.data.text) {
          finishWithSuccess(res.data.text);
          toast('文案已生成 · 已保存到「历史作品」');
        } else {
          finishWithError((res && res.error) || '生成失败');
        }
      }).catch(function (err) {
        finishWithError('网络错误：' + (err && err.message ? err.message : err));
      });
    } else {
      finishWithError('尚未加载 API 客户端');
    }
  }

  var _topGenBtn = document.getElementById('generate-btn');
  if (_topGenBtn) _topGenBtn.dataset.defaultLabel = _topGenBtn.textContent || '\u751F\u6210\u6587\u6848';

  var _generateBtn = document.getElementById('generate-btn');
  var _generateBtn2 = document.getElementById('generate-btn2');
  if (_generateBtn) _generateBtn.addEventListener('click', doGenerate);
  if (_generateBtn2) _generateBtn2.addEventListener('click', doGenerate);

  /* ─── 输出 actions：复制 / 润色 / 重新生成 ─────────── */
  var copyAllBtn = document.getElementById('copy-result-all');
  if (copyAllBtn) {
    copyAllBtn.addEventListener('click', function () {
      var text = (document.getElementById('output-text') || {}).textContent || '';
      if (!text) { toast('暂无内容', 'warn'); return; }
      navigator.clipboard.writeText(text).then(function () { toast('全文已复制到剪贴板'); });
    });
  }

  var polishBtn = document.getElementById('polish-result');
  if (polishBtn) {
    polishBtn.addEventListener('click', function () {
      var output = document.getElementById('output-text');
      if (!output || !(output.textContent || '').trim()) { toast('先生成内容再润色', 'warn'); return; }
      var orig = output.textContent || '';
      if (!orig.trim()) { toast('暂无内容', 'warn'); return; }
      polishBtn.setAttribute('aria-busy', 'true'); polishBtn.disabled = true;

      var polishPrompt = '请对以下文案进行润色，要求：①保留原意但提升文采；②调整节奏与韵律；③去除冗余；④直接返回润色后的文案，不要解释。\n\n' + orig;

      if (window.BaiShiAPI && window.BaiShiAPI.generateCopywriting) {
        window.BaiShiAPI.generateCopywriting(polishPrompt, { max_tokens: 1200 }).then(function (res) {
          if (res && res.success && res.data && res.data.text) {
            output.textContent = res.data.text;
            output.dataset.original = '';
            var flag = document.getElementById('output-edit-flag');
            if (flag) flag.hidden = false;
            updateCharCount();
            renderOutputReview();
            syncOutputView();
            toast('润色完成');
          } else {
            toast((res && res.error) || '润色失败', 'warn');
          }
          polishBtn.removeAttribute('aria-busy'); polishBtn.disabled = false;
        });
      } else {
        polishBtn.removeAttribute('aria-busy'); polishBtn.disabled = false;
        toast('尚未加载 API 客户端', 'warn');
      }
    });
  }

  var regenBtn = document.getElementById('regenerate-result');
  if (regenBtn) regenBtn.addEventListener('click', doGenerate);

  var _copyResult = document.getElementById('copy-result');
  if (_copyResult) {
    _copyResult.addEventListener('click', function () {
      var text = (document.getElementById('output-text') || {}).textContent || '';
      if (!text) { toast('暂无内容', 'warn'); return; }
      navigator.clipboard.writeText(text).then(function () { toast('已复制到剪贴板'); });
    });
  }

  document.querySelectorAll('[data-output-view]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var outputEl = document.getElementById('output-text');
      if (!outputEl || !(outputEl.textContent || '').trim()) return;
      setOutputView(btn.dataset.outputView);
      if (btn.dataset.outputView === 'edit') outputEl.focus();
    });
  });

  /* ─── 清空 ────────────────────────────────────────── */
  var _clearInput = document.getElementById('clear-input');
  if (_clearInput) {
    _clearInput.addEventListener('click', function () {
      var input = document.getElementById('copy-input');
      if (input) input.value = '';
      document.querySelectorAll('.template-card').forEach(function (c) { c.classList.remove('selected'); });
      toast('已清空');
    });
  }

  /* ─── 套用模板 ────────────────────────────────────── */
  var _useTemplate = document.getElementById('use-template');
  if (_useTemplate) {
    _useTemplate.addEventListener('click', function () {
      var selected = document.querySelector('.template-card.selected');
      if (!selected) { toast('请先选中一个模板', 'warn'); return; }
      // 由于快捷模板已改用 textStyles，回退到从 DOM 获取
      var name = (selected.querySelector('.t-name') || {}).textContent || '';
      toast('已选中「' + name + '」');
    });
  }

  /* ─── 历史回填（3 条 button 化） ───────────────────── */
  document.querySelectorAll('.history-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var prompt = item.dataset.prompt;
      var input = document.getElementById('copy-input');
      if (!prompt || !input) return;
      input.value = prompt;
      input.focus();
      var meta = (item.querySelector('.meta') || {}).textContent || '';
      var preview = (item.querySelector('.preview-text') || {}).textContent || '';
      toast('已回填 · ' + (preview.split('：')[0] || meta));
    });
  });

  /* ─── 文案可编辑：状态跟踪 + 自动保存 + 快捷键 ───── */
  function updateCharCount() {
    var outputEl = document.getElementById('output-text');
    var counter = document.getElementById('output-char-count');
    if (!outputEl || !counter) return;
    var text = outputEl.textContent || '';
    var len = text.length;
    counter.textContent = len + ' 字';
    counter.hidden = !text.trim();
  }

  (function wireOutputEditing() {
    var outputEl = document.getElementById('output-text');
    var editFlag = document.getElementById('output-edit-flag');
    if (!outputEl) return;

    var saveTimer = null;
    function updateEditState() {
      var original = outputEl.dataset.original || '';
      var current = outputEl.textContent || '';
      if (editFlag) editFlag.hidden = (current === original);
      updateCharCount();
      renderOutputReview();
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        try { localStorage.setItem('baishi.text-output', current); } catch (e) { /* 静默 */ }
      }, 500);
    }
    outputEl.addEventListener('input', updateEditState);
    outputEl.addEventListener('blur', updateEditState);

    outputEl.addEventListener('paste', function (e) {
      if (e.clipboardData && e.clipboardData.getData) {
        e.preventDefault();
        var text = e.clipboardData.getData('text/plain');
        var sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        sel.deleteFromDocument();
        var range = sel.getRangeAt(0);
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        outputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    outputEl.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.preventDefault(); outputEl.blur(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doGenerate(); }
    });
  })();

  /* ─── 启动时回填上次编辑的文案 ───────────────────── */
  try {
    var savedOutput = localStorage.getItem('baishi.text-output');
    if (savedOutput) {
      var outputEl = document.getElementById('output-text');
      var placeholder = document.getElementById('output-placeholder');
      var actions = document.getElementById('output-actions');
      if (outputEl && savedOutput.trim()) {
        outputEl.textContent = savedOutput;
        outputEl.dataset.original = '';
        if (placeholder) placeholder.style.display = 'none';
        if (actions) actions.style.display = 'flex';
        var editFlag = document.getElementById('output-edit-flag');
        if (editFlag) editFlag.hidden = false;
        updateCharCount();
        setOutputView('review');
      }
    }
  } catch (e) { /* 静默 */ }
  syncOutputView();

  /* ─── 「存为模板」模态 ────────────────────────────── */
  var savePresetBtn = document.getElementById('save-preset');
  var savePresetModal = document.getElementById('save-preset-modal');
  var savePresetConfirm = document.getElementById('save-preset-confirm');
  var savePresetName = document.getElementById('save-preset-name');
  var savePresetCat = document.getElementById('save-preset-cat');
  var lastFocused = null;

  function openModal(modal) {
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.hidden = false;
    var focusable = modal.querySelector('input, select, button, textarea');
    if (focusable) setTimeout(function () { focusable.focus(); }, 50);
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  if (savePresetBtn && savePresetModal) {
    savePresetBtn.addEventListener('click', function () {
      var output = document.getElementById('output-text');
      if (!output || !(output.textContent || '').trim()) {
        toast('先生成内容再保存为模板', 'warn');
        return;
      }
      openModal(savePresetModal);
      if (savePresetName) savePresetName.value = '';
    });

    savePresetModal.querySelectorAll('[data-modal-close]').forEach(function (el) {
      el.addEventListener('click', function () { closeModal(savePresetModal); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !savePresetModal.hidden) closeModal(savePresetModal);
    });

    if (savePresetConfirm) {
      savePresetConfirm.addEventListener('click', function () {
        var output = document.getElementById('output-text');
        var name = savePresetName ? savePresetName.value.trim() : '';
        var cat = savePresetCat ? savePresetCat.value : '其他';
        if (!name) {
          if (savePresetName) savePresetName.focus();
          toast('请输入模板名称', 'warn');
          return;
        }
        var prompt = (output && output.textContent) || '';
        if (!prompt.trim()) {
          toast('生成内容为空，无法保存', 'warn');
          return;
        }

        // 同时写 localStorage（向后兼容）和后端
        var item = {
          name: name,
          cat: cat,
          prompt: prompt,
          createdAt: new Date().toISOString()
        };
        var arr = loadUserTemplates();
        arr.unshift(item);
        saveUserTemplates(arr);

        // 写后端 presets
        if (window.BaiShiAPI && window.BaiShiAPI.savePreset) {
          savePresetConfirm.setAttribute('aria-busy', 'true');
          savePresetConfirm.disabled = true;
          window.BaiShiAPI.savePreset({
            category: 'copywriting',
            name: name,
            desc: '用户自定义文案模板',
            prompt: prompt,
            sample: '',
            tags: [cat]
          }).then(function (res) {
            savePresetConfirm.removeAttribute('aria-busy');
            savePresetConfirm.disabled = false;
            if (res && res.success) {
              closeModal(savePresetModal);
              toast('已存为模板 · ' + name);
            } else {
              // 后端失败不阻塞本地保存
              closeModal(savePresetModal);
              toast('已存为本地模板（云端同步失败）', 'warn');
            }
          });
        } else {
          closeModal(savePresetModal);
          toast('已存为本地模板');
        }
      });
    }
  }

  /* ─── 启动时从后端兜底拉文 API 配置（防 localStorage 被清空） ─── */
  (function bootstrapTextApi() {
    // 页面加载时先预热: 调 ensureTextApi() 完整兜底 (拉后端 → 写 localStorage)
    // 这样后接 doGenerate 调用时可以直接同步读到配置
    if (typeof ensureTextApi === 'function') {
      ensureTextApi().then(function (ta) {
        if (ta && ta.url && ta.model) {
          console.log('[baishi] text api config loaded from backend:', ta.model);
        }
      });
    }
  })();

  /* ─── 从妙笔生花预设载入提示词 ───────────────────── */
  (function loadPresetConfig() {
    var params = new URLSearchParams(location.search);
    var prompt = params.get('prompt') || '';
    var name = params.get('name') || '';
    if (!prompt) {
      try {
        prompt = sessionStorage.getItem('baishi_preset_prompt') || '';
        name = sessionStorage.getItem('baishi_preset_name') || '';
        sessionStorage.removeItem('baishi_preset_prompt');
        sessionStorage.removeItem('baishi_preset_name');
      } catch(e) {}
    }
    if (prompt) {
      var input = document.getElementById('copy-input');
      if (input) {
        input.value = prompt;
        toast('已载入预设 · 文风：' + (name || '预设'));
        doGenerate();
      }
    }
  })();

});
