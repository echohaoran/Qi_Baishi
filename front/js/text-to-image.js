// text-to-image.js — 文生图（落笔生画）
// 智能润色 / 生图 全部接通后端
document.addEventListener('DOMContentLoaded', function () {
  const TASK_KEY = 'text-to-image';
  let resultPreviewModal = null;
  let resultPreviewImage = null;
  let resultPreviewMeta = null;

  ;

  // Toast
  function toast(msg, kind) {
    if (window.BaishiShared && typeof window.BaishiShared.toast === 'function') {
      return window.BaishiShared.toast(msg, kind);
    }
  }
  function getTaskStore() {
    return window.BaishiShared || null;
  }

  // 字符计数
  const prompt = document.getElementById('prompt');
  const charCount = document.getElementById('char-count');
  prompt.addEventListener('input', () => { charCount.textContent = prompt.value.length; });

  // 从灵感墙 / 画廊预设载入提示词（URL 参数优先，sessionStorage 回退）
  const urlParams = new URLSearchParams(location.search);
  const pendingPrompt = urlParams.get('prompt') || sessionStorage.getItem('baishi_preset_prompt');
  if (pendingPrompt) {
    prompt.value = pendingPrompt;
    charCount.textContent = pendingPrompt.length;
    const pendingRatio = urlParams.get('ratio') || sessionStorage.getItem('baishi_preset_ratio');
    if (pendingRatio) {
      document.querySelectorAll('#ratio-opts .opt').forEach(function(o) {
        o.classList.toggle('active', o.dataset.v === pendingRatio);
      });
      document.getElementById('ratio-val').textContent = pendingRatio;
    }
    sessionStorage.removeItem('baishi_preset_prompt');
    sessionStorage.removeItem('baishi_preset_name');
    sessionStorage.removeItem('baishi_preset_ratio');
    toast('已载入预设 · 提示词就绪');
  }

  // 比例 / 数量选择
  function bindOptions(group, valEl, prefix) {
    const opts = group.querySelectorAll('.opt');
    opts.forEach(o => o.addEventListener('click', () => {
      opts.forEach(x => x.classList.remove('active'));
      o.classList.add('active');
      valEl.textContent = (prefix || '') + o.dataset.v;
    }));
  }
  bindOptions(document.getElementById('ratio-opts'), document.getElementById('ratio-val'));

  // 出图数量滑动条
  const batchSlider = document.getElementById('batch-slider');
  const batchVal = document.getElementById('batch-val');
  batchSlider.addEventListener('input', () => { batchVal.textContent = batchSlider.value + ' 张'; });

  // 风格强度
  const slider = document.getElementById('style-slider');
  const styleVal = document.getElementById('style-val');
  slider.addEventListener('input', () => { styleVal.textContent = parseFloat(slider.value).toFixed(2); });

  // 种子骰
  const seedInput = document.getElementById('seed-input');
  const seedVal = document.getElementById('seed-val');
  seedInput.addEventListener('input', () => { seedVal.textContent = seedInput.value; });
  document.getElementById('seed-dice').addEventListener('click', () => {
    const n = Math.floor(Math.random() * 9999999);
    seedInput.value = n;
    seedVal.textContent = n;
  });

  // ── 固定负面提示词 ──
  const negativePromptPresets = [
    { id: 'np01', name: '四肢', prompt: '不要出现多个手臂，超过五根手指的四肢，扭曲关节，断裂手脚，畸形肢体' },
    { id: 'np02', name: '手部', prompt: '不要出现畸形手掌，融合手指，缺失手指，多余手指，手部结构错误，手指方向混乱' },
    { id: 'np03', name: '面部', prompt: '不要出现五官错位，面部崩坏，双脸，多张脸，嘴部畸形，鼻梁塌陷，面部阴影脏污' },
    { id: 'np04', name: '眼睛', prompt: '不要出现斗鸡眼，大小眼，多余眼睛，眼球错位，眼神涣散，瞳孔畸变' },
    { id: 'np05', name: '构图', prompt: '不要出现主体出框，头顶被裁切，构图拥挤，画面失衡，主体过小，透视混乱' },
    { id: 'np06', name: '文字水印', prompt: '不要出现文字，水印，签名，logo，边框，时间戳，二维码，界面截图元素' },
    { id: 'np07', name: '低清瑕疵', prompt: '不要出现低清晰度，模糊，噪点，过曝，欠曝，伪影，脏点，像素化，压缩痕迹' },
    { id: 'np08', name: '解剖比例', prompt: '不要出现身体比例失衡，头身比异常，肩膀塌陷，脖子过长，腰部扭曲，骨骼结构错误' },
  ];
  let promptEditMode = false;
  let editingPromptId = null;
  let pendingDeletePromptId = null;

  const promptGrid   = document.getElementById('prompt-presets-grid');
  const editToggle   = document.getElementById('prompt-edit-toggle');
  const editToggleLb = document.getElementById('prompt-edit-toggle-label');
  const editor       = document.getElementById('prompt-editor');
  const editorTitle  = document.getElementById('prompt-editor-title');
  const editorName   = document.getElementById('prompt-editor-name');
  const editorText   = document.getElementById('prompt-editor-text');
  const editorSave   = document.getElementById('prompt-editor-save');
  const editorCancel = document.getElementById('prompt-editor-cancel');
  const editorClose  = document.getElementById('prompt-editor-close');
  const negativePromptInput = document.getElementById('negative-prompt');
  const negativePromptDetails = document.getElementById('negative-prompt-details');

  function appendNegativePrompt(text) {
    const incoming = (text || '').trim();
    if (!incoming || !negativePromptInput) return false;
    const current = negativePromptInput.value.trim();
    if (!current) {
      negativePromptInput.value = incoming;
      return true;
    }
    const exists = current === incoming || current.indexOf(incoming) !== -1;
    if (exists) return false;
    negativePromptInput.value = current + '，' + incoming;
    return true;
  }

  function renderPromptPresets() {
    promptGrid.innerHTML = '';
    if (promptEditMode) {
      const addBtn = document.createElement('span');
      addBtn.className = 'prompt-add-card';
      addBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>添加';
      addBtn.addEventListener('click', () => openPromptEditor(null));
      promptGrid.appendChild(addBtn);
    }
    negativePromptPresets.forEach((p) => {
      const wrap = document.createElement('span');
      wrap.className = 'prompt-chip-wrap';
      wrap.style.position = 'relative';
      wrap.style.display = 'inline-flex';
      wrap.dataset.promptId = p.id;

      const chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.prompt = p.prompt;
      // 默认不选中任何固定提示词 (用户要求)
      chip.textContent = '+ ' + p.name;

      if (!promptEditMode) {
        chip.addEventListener('click', () => {
          if (negativePromptDetails) negativePromptDetails.open = true;
          const appended = appendNegativePrompt(p.prompt);
          if (negativePromptInput) negativePromptInput.focus();
          chip.classList.add('active');
          setTimeout(() => chip.classList.remove('active'), 400);
          toast(appended ? `已填入负面提示词 · ${p.name}` : `已存在负面提示词 · ${p.name}`);
        });
      } else {
        chip.style.cursor = 'pointer';
        chip.addEventListener('click', () => openPromptEditor(p.id));
      }

      if (promptEditMode) {
        const overlay = document.createElement('span');
        overlay.className = 'prompt-card-edit-overlay';
        overlay.innerHTML = `
          <button class="edit" type="button" title="编辑">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>
          </button>
          <button class="del" type="button" title="删除">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"></path></svg>
          </button>
        `;
        overlay.querySelector('.edit').addEventListener('click', (e) => {
          e.stopPropagation();
          openPromptEditor(p.id);
        });
        overlay.querySelector('.del').addEventListener('click', (e) => {
          e.stopPropagation();
          showPromptDeleteConfirm(p.id, wrap);
        });
        const confirm = document.createElement('span');
        confirm.className = 'prompt-delete-confirm';
        confirm.innerHTML = `<span>删除？</span><button class="ok" type="button">确定</button><button class="cancel" type="button">取消</button>`;
        confirm.querySelector('.ok').addEventListener('click', (e) => { e.stopPropagation(); executePromptDelete(p.id); });
        confirm.querySelector('.cancel').addEventListener('click', (e) => { e.stopPropagation(); confirm.classList.remove('show'); pendingDeletePromptId = null; });
        wrap.appendChild(chip);
        wrap.appendChild(overlay);
        wrap.appendChild(confirm);
      } else {
        wrap.appendChild(chip);
      }
      promptGrid.appendChild(wrap);
    });
  }
  function showPromptDeleteConfirm(id, wrapEl) {
    const all = promptGrid.querySelectorAll('.prompt-delete-confirm.show');
    all.forEach(el => el.classList.remove('show'));
    pendingDeletePromptId = id;
    const cf = wrapEl.querySelector('.prompt-delete-confirm');
    if (cf) cf.classList.add('show');
  }
  function executePromptDelete(id) {
    const idx = negativePromptPresets.findIndex(x => x.id === id);
    if (idx >= 0) {
      const removed = negativePromptPresets.splice(idx, 1)[0];
      renderPromptPresets();
      toast(`已删除 · ${removed.name}`);
    }
    pendingDeletePromptId = null;
  }
  function openPromptEditor(id) {
    editingPromptId = id;
    if (id) {
      const p = negativePromptPresets.find(x => x.id === id);
      if (!p) return;
      editorTitle.textContent = '编辑固定负面提示词';
      editorName.value = p.name;
      editorText.value = p.prompt;
    } else {
      editorTitle.textContent = '新建固定负面提示词';
      editorName.value = '';
      editorText.value = '';
    }
    editor.hidden = false;
    setTimeout(() => editorName.focus(), 30);
  }
  function closePromptEditor() { editor.hidden = true; editingPromptId = null; }
  function savePromptPreset() {
    const name = editorName.value.trim();
    const txt  = editorText.value.trim();
    if (!name) { toast('请填写名称', 'error'); editorName.focus(); return; }
    if (!txt)  { toast('请填写负面提示词', 'error'); editorText.focus(); return; }
    if (editingPromptId) {
      const p = negativePromptPresets.find(x => x.id === editingPromptId);
      if (p) { p.name = name; p.prompt = txt; toast(`已更新 · ${name}`); }
    } else {
      negativePromptPresets.unshift({ id: 'np' + Date.now().toString(36), name, prompt: txt });
      toast(`已新建 · ${name}`);
    }
    closePromptEditor();
    renderPromptPresets();
  }
  editToggle.addEventListener('click', () => {
    promptEditMode = !promptEditMode;
    editToggle.classList.toggle('active', promptEditMode);
    editToggleLb.textContent = promptEditMode ? '完成' : '编辑';
    document.body.classList.toggle('prompt-edit-on', promptEditMode);
    pendingDeletePromptId = null;
    promptGrid.querySelectorAll('.prompt-delete-confirm.show').forEach(el => el.classList.remove('show'));
    renderPromptPresets();
  });
  editorSave.addEventListener('click', savePromptPreset);
  editorCancel.addEventListener('click', closePromptEditor);
  editorClose.addEventListener('click', closePromptEditor);
  editor.addEventListener('click', (e) => { if (e.target === editor) closePromptEditor(); });
  renderPromptPresets();

  // ── 智能润色（调后端 LLM） ──
  const enhanceBtn = document.getElementById('enhance-btn');
  let enhancing = false;
  enhanceBtn.addEventListener('click', async () => {
    if (enhancing) return;
    const val = prompt.value.trim();
    if (!val) { toast('请先输入提示词', 'error'); return; }
    enhancing = true;
    const orig = enhanceBtn.innerHTML;
    enhanceBtn.innerHTML = '<span>润色中…</span>';
    enhanceBtn.disabled = true;
    const r = await window.BaiShiAPI.enhancePrompt(val);
    enhancing = false;
    enhanceBtn.innerHTML = orig;
    enhanceBtn.disabled = false;
    if (r && r.success && r.data && r.data.enhanced) {
      prompt.value = r.data.enhanced;
      charCount.textContent = prompt.value.length;
      toast('已润色 · LLM 改写完成');
    } else {
      toast('润色失败：' + (r && r.error ? r.error : '未知'), 'error');
    }
  });

  // 清空
  document.getElementById('clear-btn').addEventListener('click', () => {
    prompt.value = '';
    charCount.textContent = 0;
    // 重置为默认值: 1:1 / 1 张 / 种子 0 / 高精度 ON
    document.querySelectorAll('#ratio-opts .opt').forEach(function(o) {
      o.classList.toggle('active', o.dataset.v === '1:1');
    });
    document.getElementById('ratio-val').textContent = '1 : 1';
    batchSlider.value = '1';
    batchVal.textContent = '1 张';
    seedInput.value = '0';
    seedVal.textContent = '0';
    var hpReset = document.getElementById('high-precision');
    if (hpReset) hpReset.checked = true;
    var negReset = document.getElementById('negative-prompt');
    if (negReset) negReset.value = '';
    document.getElementById('result-empty').style.display = 'grid';
    document.getElementById('result-grid').style.display = 'none';
    var lc = document.getElementById('loading-canvas');
    if (lc) lc.hidden = true;
  });

  // 右侧预览区：墨笔加载动画的显示/隐藏
  function showLoading() {
    var empty = document.getElementById('result-empty');
    var grid = document.getElementById('result-grid');
    var lc = document.getElementById('loading-canvas');
    var step = document.getElementById('loading-step');
    if (empty) empty.style.display = 'none';
    if (grid) grid.style.display = 'none';
    if (lc) lc.hidden = false;
    if (step) step.textContent = '正在连接后端';
  }
  function hideLoading() {
    var lc = document.getElementById('loading-canvas');
    if (lc) lc.hidden = true;
  }
  function setLoadingStep(t) {
    var step = document.getElementById('loading-step');
    if (step) step.textContent = t;
  }

  function setGenerateBusy(isBusy) {
    const genBtn = document.getElementById('generate-btn');
    if (!genBtn) return;
    genBtn.disabled = !!isBusy;
    genBtn.innerHTML = isBusy ? '<span>落笔中…</span>' : '<span>开始生成</span>';
  }

  function applyTaskState(task) {
    if (!task) return;
    if (task.input && !prompt.value.trim() && task.input.prompt) {
      prompt.value = task.input.prompt;
      charCount.textContent = task.input.prompt.length;
    }
    if (task.input && task.input.ratio) {
      document.querySelectorAll('#ratio-opts .opt').forEach(function (opt) {
        opt.classList.toggle('active', opt.dataset.v === task.input.ratio);
      });
      var ratioVal = document.getElementById('ratio-val');
      if (ratioVal) ratioVal.textContent = task.input.ratio;
    }
    if (task.input && task.input.count) {
      batchSlider.value = String(task.input.count);
      batchVal.textContent = String(task.input.count) + ' 张';
    }
    if (task.status === 'running') {
      generating = true;
      setGenerateBusy(true);
      showLoading();
      setLoadingStep(task.stepText || '正在后台生成…');
      return;
    }
    if (task.status === 'success' && task.result && Array.isArray(task.result.images)) {
      generating = false;
      setGenerateBusy(false);
      hideLoading();
      renderResults(task.result.images || [], task.result.ratio || '1:1', '生图');
      return;
    }
    if (task.status === 'error') {
      generating = false;
      setGenerateBusy(false);
      hideLoading();
      document.getElementById('result-empty').style.display = 'grid';
      if (task.error) toast(task.error, 'warn');
    }
  }

  function ensureResultPreviewModal() {
    if (resultPreviewModal) return resultPreviewModal;
    resultPreviewModal = document.createElement('div');
    resultPreviewModal.className = 'result-preview-modal';
    resultPreviewModal.hidden = true;
    resultPreviewModal.innerHTML =
      '<div class="result-preview-backdrop" data-close-preview="true"></div>' +
      '<div class="result-preview-dialog" role="dialog" aria-modal="true" aria-label="原图预览">' +
        '<button class="result-preview-close" type="button" aria-label="关闭预览" data-close-preview="true">×</button>' +
        '<img class="result-preview-image" alt="生成结果原图预览">' +
        '<div class="result-preview-meta"></div>' +
      '</div>';
    document.body.appendChild(resultPreviewModal);
    resultPreviewImage = resultPreviewModal.querySelector('.result-preview-image');
    resultPreviewMeta = resultPreviewModal.querySelector('.result-preview-meta');
    resultPreviewModal.addEventListener('click', function (event) {
      if (event.target.closest('[data-close-preview="true"]')) {
        closeResultPreview();
      }
    });
    return resultPreviewModal;
  }

  function openResultPreview(url, title, meta) {
    var modal = ensureResultPreviewModal();
    if (!resultPreviewImage || !resultPreviewMeta) return;
    resultPreviewImage.src = url;
    resultPreviewImage.alt = title || '生成结果原图预览';
    resultPreviewMeta.textContent = meta || '';
    modal.hidden = false;
    document.body.classList.add('result-preview-open');
  }

  function closeResultPreview() {
    if (!resultPreviewModal) return;
    resultPreviewModal.hidden = true;
    document.body.classList.remove('result-preview-open');
    if (resultPreviewImage) {
      resultPreviewImage.removeAttribute('src');
    }
  }

  // ── 生图（调后端） ──
  const genBtn = document.getElementById('generate-btn');
  let generating = false;
  applyTaskState(getTaskStore() && getTaskStore().getTask ? getTaskStore().getTask(TASK_KEY) : null);
  if (getTaskStore() && typeof getTaskStore().subscribeTasks === 'function') {
    getTaskStore().subscribeTasks(function (taskKey, task) {
      if (taskKey !== TASK_KEY || !task) return;
      applyTaskState(task);
    });
  }
  genBtn.addEventListener('click', async () => {
    if (generating) return;
    if (!prompt.value.trim()) { toast('请先输入提示词', 'error'); return; }
    generating = true;
    setGenerateBusy(true);
    showLoading();
    setLoadingStep('正在连接后端…');

    var ratioActive = document.querySelector('#ratio-opts .opt.active');
    var ratio = ratioActive ? ratioActive.dataset.v : '1:1';
    var count = parseInt(batchSlider.value, 10) || 3;
    var seed = parseInt(seedInput.value, 10);
    var cfg = parseFloat(slider.value) || 0.75;
    // 负面提示词：HTML 中 <details> 内 textarea 的值（可能为空）
    var negEl = document.getElementById('negative-prompt');
    var negativePrompt = negEl ? negEl.value.trim() : '';
    // 高精度模式：开启时 steps 50，关闭时 steps 30
    var hpEl = document.getElementById('high-precision');
    var highPrecision = hpEl ? hpEl.checked : false;
    var steps = highPrecision ? 50 : 30;
    if (getTaskStore() && typeof getTaskStore().setTask === 'function') {
      getTaskStore().setTask(TASK_KEY, {
        status: 'running',
        startedAt: Date.now(),
        stepText: '正在连接后端…',
        input: {
          prompt: prompt.value.trim(),
          ratio: ratio,
          count: count,
          seed: seed > 0 ? seed : 0,
          cfg: cfg,
          negativePrompt: negativePrompt,
          highPrecision: highPrecision
        }
      });
    }

    setLoadingStep('发送生图请求…');
    if (getTaskStore() && typeof getTaskStore().setTask === 'function') {
      getTaskStore().setTask(TASK_KEY, { status: 'running', stepText: '发送生图请求…' });
    }
    const r = await window.BaiShiAPI.textToImage({
      prompt: prompt.value.trim(),
      negative_prompt: negativePrompt,
      style_id: 'text-to-image',
      seed: seed > 0 ? seed : null,
      steps: steps,
      cfg_scale: cfg,
      aspect: ratio,
      count: count,
    });

    generating = false;
    setGenerateBusy(false);
    hideLoading();

    if (r && r.success) {
      renderResults(r.data.images || [], ratio, '生图');
      if (getTaskStore() && typeof getTaskStore().setTask === 'function') {
        getTaskStore().setTask(TASK_KEY, {
          status: 'success',
          finishedAt: Date.now(),
          stepText: '已完成',
          result: {
            images: r.data.images || [],
            ratio: ratio,
            took_ms: r.data.took_ms || 0,
          }
        });
      }
      var tagBits = [ratio, count + '张', cfg.toFixed(2)];
      if (highPrecision) tagBits.push('高精度');
      if (negativePrompt) tagBits.push('有负向');
      toast('生图完成 · ' + (r.data.images || []).length + ' 张 · ' + (r.data.took_ms / 1000).toFixed(1) + 's · ' + tagBits.join(' · '));
    } else {
      if (getTaskStore() && typeof getTaskStore().setTask === 'function') {
        getTaskStore().setTask(TASK_KEY, {
          status: 'error',
          finishedAt: Date.now(),
          stepText: '生成失败',
          error: (r && r.error) ? r.error : '未知错误'
        });
      }
      document.getElementById('result-empty').style.display = 'grid';
      toast('生图失败：' + (r && r.error ? r.error : '未知'), 'error');
    }
  });

  // 渲染结果网格
  function renderResults(images, ratio, label) {
    var grid = document.getElementById('result-grid');
    grid.innerHTML = '';
    grid.style.display = 'grid';
    images.forEach(function (img, i) {
      var url = img.url || img.b64_json || '';
      var div = document.createElement('div');
      div.className = 'art-card result-art-card';
      div.innerHTML =
        '<button class="art-img result-art-trigger" type="button" aria-label="查看' + label + ' #' + (i + 1) + '原图">' +
          '<img class="result-art-thumb" src="' + url + '" alt="' + label + ' #' + (i + 1) + '">' +
          '<span class="result-art-zoom">点击查看原图</span>' +
        '</button>' +
        '<div class="art-meta"><div class="title">' + label + ' #' + (i + 1) + '</div>' +
        '<div class="sub"><span>' + ratio + ' · BaiShi</span><span class="num">' +
        '<button class="dl-btn" data-url="' + url + '" data-title="' + label + '_' + (i + 1) + '" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;">下载</button>' +
        '</span></div></div>';
      div.querySelector('.result-art-trigger').addEventListener('click', (function (u, t, r, idx) {
        return function () {
          openResultPreview(u, t + ' #' + idx, r + ' · 原图预览');
        };
      })(url, label, ratio, i + 1));
      // 下载
      div.querySelector('.dl-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        var u = this.dataset.url;
        var t = this.dataset.title;
        downloadImage(u, t);
      });
      grid.appendChild(div);
    });
  }

  function downloadImage(url, title) {
    var a = document.createElement('a');
    a.href = url;
    a.download = (title || 'image') + '.png';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => a.remove(), 100);
    toast('已下载 · ' + title);
  }

  // ⌘ + ⏎
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && resultPreviewModal && !resultPreviewModal.hidden) {
      closeResultPreview();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      genBtn.click();
    }
  });
});
