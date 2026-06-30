// copywriting.js — polished 2026-06-29
// a11y: 1 form field + 11 buttons + 6 template cards + 3 history items
// states: 5 dead buttons 已激活
// storage: 编辑输出 + 用户模板库
document.addEventListener('DOMContentLoaded', function () {

  /* ─── Toast ───────────────────────────────────────── */
  function toast(msg, kind = 'success') {
    const host = document.getElementById('toasts');
    if (!host) return;
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = '<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>' + msg + '</span>';
    host.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
    setTimeout(() => t.remove(), 2800);
  }

  /* ─── OS 切换 ─────────────────────────────────────── */
  document.querySelectorAll('[data-os-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.dataset.os = btn.dataset.osSet;
      document.querySelectorAll('[data-os-set]').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  /* ─── 模板数据 ─────────────────────────────────────── */
  const templates = {
    brand: '请撰写一段品牌故事，要求：\n1. 融合中国传统水墨美学与现代极简主义\n2. 面向设计师、艺术家群体\n3. 200字以内\n4. 突出文化传承与创新精神',
    product: '请撰写一段产品描述文案，要求：\n1. 介绍一款 AI 水墨图像生成工具\n2. 强调水墨质感、笔触自然、留白意境\n3. 100字以内，适合电商详情页',
    marketing: '请撰写一段营销推广文案，要求：\n1. 水墨风格主题推广\n2. 适合小红书、微博平台\n3. 吸引年轻设计师群体\n4. 150字以内',
    social: '请撰写适合社交媒体发布的短文案，要求：\n1. 水墨/国风主题\n2. 适合朋友圈、微博、小红书\n3. 有感染力，引发共鸣\n4. 50字以内',
    headline: '请生成10个吸睛标题，要求：\n1. 水墨/国潮主题\n2. 有冲击力，引发好奇\n3. 适合文章、帖子标题',
    ad: '请撰写一句广告语，要求：\n1. 水墨风格产品广告\n2. 一句话打动人心\n3. 不超过20个字'
  };

  /* ─── 模板卡（已 button 化） ───────────────────────── */
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      const key = card.dataset.template;
      const input = document.getElementById('copy-input');
      if (input) input.value = templates[key] || '';
      document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      toast('模板已填入输入框');
    });
  });

  /* ─── 用户模板库（localStorage） ─────────────────── */
  function loadUserTemplates() {
    try {
      const raw = localStorage.getItem('baishi.user.templates');
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function saveUserTemplates(arr) {
    try { localStorage.setItem('baishi.user.templates', JSON.stringify(arr)); }
    catch (e) { /* 静默 */ }
  }

  /* ─── 导入模板 ────────────────────────────────────── */
  const importBtn = document.getElementById('import-template-btn');
  const importFile = document.getElementById('import-template-file');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', () => {
      const f = importFile.files && importFile.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          const items = Array.isArray(data) ? data : (data && data.templates) ? data.templates : null;
          if (!items || !items.length) { toast('文件格式无法识别', 'warn'); return; }
          const merged = loadUserTemplates().concat(items.filter(t => t && t.prompt));
          saveUserTemplates(merged);
          toast('已导入 ' + items.length + ' 个模板');
        } catch (err) {
          toast('JSON 解析失败：' + err.message, 'warn');
        }
        importFile.value = '';
      };
      reader.onerror = () => toast('读取文件失败', 'warn');
      reader.readAsText(f);
    });
  }

  /* ─── 生成文案（模拟） ─────────────────────────────── */
  const sampleText = '「名为制造混乱，实则制造艺术」\n\n白石，源自千年水墨传统的当代图像生成工具。以 SDXL 为基座，融合中国文人山水、花鸟工笔的笔意与留白精髓，让 AI 懂得什么叫"墨分五色"，什么叫"意到笔不到"。\n\n枯笔飞白，浓淡由心。\n每一下笔，都是一次传统与未来的对话。';

  function doGenerate() {
    const input = document.getElementById('copy-input');
    if (!input || !input.value.trim()) { toast('请先输入需求', 'warn'); input && input.focus(); return; }

    const output = document.getElementById('output-text');
    const placeholder = document.getElementById('output-placeholder');
    const actions = document.getElementById('output-actions');
    const btn1 = document.getElementById('generate-btn');
    const btn2 = document.getElementById('generate-btn2');
    const regenBtn = document.getElementById('regenerate-result');

    const setBusy = (b) => { if (b) { b.setAttribute('aria-busy', 'true'); b.disabled = true; } };
    const clearBusy = (b, label) => { if (b) { b.removeAttribute('aria-busy'); b.disabled = false; if (label) b.textContent = label; } };

    const defaultLabel1 = (btn1 && btn1.dataset.defaultLabel) || (btn1 && btn1.textContent) || '生成文案';
    setBusy(btn1); setBusy(btn2); setBusy(regenBtn);

    setTimeout(() => {
      if (placeholder) placeholder.style.display = 'none';
      if (output) {
        output.style.display = 'block';
        output.textContent = sampleText;
        output.dataset.original = sampleText;
      }
      const editFlag = document.getElementById('output-edit-flag');
      if (editFlag) editFlag.hidden = true;
      if (actions) actions.style.display = 'flex';
      updateCharCount();

      clearBusy(btn1, defaultLabel1); clearBusy(btn2, '生成文案'); clearBusy(regenBtn, '重新生成');
      toast('文案已生成');
    }, 1800);
  }
  // 为顶部「生成文案」按钮记录默认 label 便于恢复
  const _topGenBtn = document.getElementById('generate-btn');
  if (_topGenBtn) _topGenBtn.dataset.defaultLabel = _topGenBtn.textContent || '生成文案';

  const _generateBtn = document.getElementById('generate-btn');
  const _generateBtn2 = document.getElementById('generate-btn2');
  if (_generateBtn) _generateBtn.addEventListener('click', doGenerate);
  if (_generateBtn2) _generateBtn2.addEventListener('click', doGenerate);

  /* ─── 输出 actions：复制 / 润色 / 重新生成 ─────────── */
  const copyAllBtn = document.getElementById('copy-result-all');
  if (copyAllBtn) copyAllBtn.addEventListener('click', () => {
    const text = (document.getElementById('output-text') || {}).textContent || '';
    if (!text) { toast('暂无内容', 'warn'); return; }
    navigator.clipboard.writeText(text).then(() => toast('全文已复制到剪贴板'));
  });

  const polishBtn = document.getElementById('polish-result');
  if (polishBtn) polishBtn.addEventListener('click', () => {
    const output = document.getElementById('output-text');
    if (!output || output.style.display === 'none') { toast('先生成内容再润色', 'warn'); return; }
    const orig = output.textContent || '';
    if (!orig.trim()) { toast('暂无内容', 'warn'); return; }
    polishBtn.setAttribute('aria-busy', 'true'); polishBtn.disabled = true;
    setTimeout(() => {
      // 模拟润色：在每段前加引导词 / 替换部分句式
      const polished = orig
        .replace(/「([^」]+)」/g, '「$1 · 凝练为一句」')
        .replace(/每一下笔/g, '每一次落笔')
        .replace(/浓淡由心/g, '浓淡之间，自有分寸');
      output.textContent = polished;
      output.dataset.original = ''; // 标记已编辑
      const flag = document.getElementById('output-edit-flag');
      if (flag) flag.hidden = false;
      updateCharCount();
      polishBtn.removeAttribute('aria-busy'); polishBtn.disabled = false;
      toast('润色完成 · 已应用 3 处');
    }, 1400);
  });

  const regenBtn = document.getElementById('regenerate-result');
  if (regenBtn) regenBtn.addEventListener('click', doGenerate);

  /* ─── 复制（panel-header 右上角） ──────────────────── */
  const _copyResult = document.getElementById('copy-result');
  if (_copyResult) _copyResult.addEventListener('click', () => {
    const text = (document.getElementById('output-text') || {}).textContent || '';
    if (!text) { toast('暂无内容', 'warn'); return; }
    navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板'));
  });

  /* ─── 清空 ────────────────────────────────────────── */
  const _clearInput = document.getElementById('clear-input');
  if (_clearInput) _clearInput.addEventListener('click', () => {
    const input = document.getElementById('copy-input');
    if (input) input.value = '';
    document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'));
    toast('已清空');
  });

  /* ─── 套用模板 ────────────────────────────────────── */
  const _useTemplate = document.getElementById('use-template');
  if (_useTemplate) _useTemplate.addEventListener('click', () => {
    const selected = document.querySelector('.template-card.selected');
    if (!selected) { toast('请先选中一个模板', 'warn'); return; }
    const input = document.getElementById('copy-input');
    if (input) {
      input.value = templates[selected.dataset.template] || '';
      toast('已套用「' + (selected.querySelector('.t-name') || {}).textContent + '」');
    }
  });

  /* ─── 历史回填（3 条 button 化） ───────────────────── */
  document.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const prompt = item.dataset.prompt;
      const input = document.getElementById('copy-input');
      if (!prompt || !input) return;
      input.value = prompt;
      input.focus();
      const meta = (item.querySelector('.meta') || {}).textContent || '';
      const preview = (item.querySelector('.preview-text') || {}).textContent || '';
      toast('已回填 · ' + (preview.split('：')[0] || meta));
    });
  });

  /* ─── 文案可编辑：状态跟踪 + 自动保存 + 快捷键 ───── */
  function updateCharCount() {
    const outputEl = document.getElementById('output-text');
    const counter = document.getElementById('output-char-count');
    if (!outputEl || !counter) return;
    const len = (outputEl.textContent || '').length;
    counter.textContent = len + ' 字';
    counter.hidden = outputEl.style.display === 'none';
  }

  (function wireOutputEditing() {
    const outputEl = document.getElementById('output-text');
    const editFlag = document.getElementById('output-edit-flag');
    if (!outputEl) return;

    let saveTimer = null;
    const updateEditState = () => {
      const original = outputEl.dataset.original || '';
      const current = outputEl.textContent || '';
      if (editFlag) editFlag.hidden = (current === original);
      updateCharCount();
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try { localStorage.setItem('baishi.text-output', current); } catch (e) { /* 静默 */ }
      }, 500);
    };
    outputEl.addEventListener('input', updateEditState);
    outputEl.addEventListener('blur', updateEditState);

    outputEl.addEventListener('paste', (e) => {
      if (e.clipboardData && e.clipboardData.getData) {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        const sel = window.getSelection();
        if (!sel || sel.rangeCount === 0) return;
        sel.deleteFromDocument();
        const range = sel.getRangeAt(0);
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
        outputEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });

    outputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); outputEl.blur(); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); doGenerate(); }
    });
  })();

  /* ─── 启动时回填上次编辑的文案 ───────────────────── */
  try {
    const savedOutput = localStorage.getItem('baishi.text-output');
    if (savedOutput) {
      const outputEl = document.getElementById('output-text');
      const placeholder = document.getElementById('output-placeholder');
      const actions = document.getElementById('output-actions');
      if (outputEl && savedOutput.trim()) {
        outputEl.textContent = savedOutput;
        outputEl.dataset.original = '';  // 标记为已编辑
        outputEl.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        if (actions) actions.style.display = 'flex';
        const editFlag = document.getElementById('output-edit-flag');
        if (editFlag) editFlag.hidden = false;
        updateCharCount();
      }
    }
  } catch (e) { /* 静默 */ }

  /* ─── 「存为模板」模态 ────────────────────────────── */
  const savePresetBtn = document.getElementById('save-preset');
  const savePresetModal = document.getElementById('save-preset-modal');
  const savePresetConfirm = document.getElementById('save-preset-confirm');
  const savePresetName = document.getElementById('save-preset-name');
  const savePresetCat = document.getElementById('save-preset-cat');
  let lastFocused = null;

  function openModal(modal) {
    if (!modal) return;
    lastFocused = document.activeElement;
    modal.hidden = false;
    const focusable = modal.querySelector('input, select, button, textarea');
    if (focusable) setTimeout(() => focusable.focus(), 50);
  }
  function closeModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    if (lastFocused && typeof lastFocused.focus === 'function') lastFocused.focus();
  }

  if (savePresetBtn && savePresetModal) {
    savePresetBtn.addEventListener('click', () => {
      const output = document.getElementById('output-text');
      if (!output || output.style.display === 'none') {
        toast('先生成内容再保存为模板', 'warn');
        return;
      }
      openModal(savePresetModal);
      if (savePresetName) savePresetName.value = '';
    });

    savePresetModal.querySelectorAll('[data-modal-close]').forEach(el => {
      el.addEventListener('click', () => closeModal(savePresetModal));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !savePresetModal.hidden) closeModal(savePresetModal);
    });

    if (savePresetConfirm) savePresetConfirm.addEventListener('click', () => {
      const output = document.getElementById('output-text');
      const name = savePresetName ? savePresetName.value.trim() : '';
      const cat = savePresetCat ? savePresetCat.value : '其他';
      if (!name) {
        if (savePresetName) savePresetName.focus();
        toast('请输入模板名称', 'warn');
        return;
      }
      const prompt = (output && output.textContent) || '';
      if (!prompt.trim()) {
        toast('生成内容为空，无法保存', 'warn');
        return;
      }
      const item = { name, cat, prompt, createdAt: new Date().toISOString() };
      const arr = loadUserTemplates();
      arr.unshift(item);
      saveUserTemplates(arr);
      closeModal(savePresetModal);
      toast('已存为模板 · ' + name);
    });
  }

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