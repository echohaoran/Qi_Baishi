/* ───────────────────────────────────────────────────────────────────
 * multi-image.js — 白石 Baishi 多图融合交互
 *
 * 功能：
 *   1. 上传 2~6 张参考图（点击 + 拖放）
 *   2. 拖拽排序
 *   3. 融合参数：强度 / 比例 / 批次 / 种子
 *   4. 推理引擎模拟进度 + 中间预览 + 结果展示
 *   5. 大图预览 / 下载 / 保存预设
 *   6. 润色（mock）
 * ──────────────────────────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', function () {
  const TASK_KEY = 'multi-image';

  /* ─── State ────────────────────────────────────────────────── */
  const state = {
    refImages: [],            // Array<{ id, file?, dataUrl }>
    maxRefs: 6,
    minRefs: 2,
    generating: false,
  };

  /* ─── DOM refs ──────────────────────────────────────────────── */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const refGrid       = $('#ref-grid');
  const uploadInput   = $('#multi-upload-input');
  const addSlot       = $('#add-slot');
  const refCount      = $('#ref-count');
  const clearRefs     = $('#clear-refs');
  const promptInput   = $('#prompt');
  const charCount     = $('#char-count');
  const enhanceBtn    = $('#enhance-btn');
  const blendSlider   = $('#blend-slider');
  const blendVal      = $('#blend-val');
  const ratioOpts     = $$('#ratio-opts .opt');
  const batchSlider   = $('#batch-slider');
  const batchVal      = $('#batch-val');
  const seedInput     = $('#seed-input');
  const seedDice      = $('#seed-dice');
  const generateBtn   = $('#generate-btn');
  const clearBtn      = $('#clear-btn');
  const loadingCanvas = $('#loading-canvas');
  const loadingStep   = $('#loading-step');
  const resultEmpty   = $('#result-empty');
  const resultGrid    = $('#result-grid');
  const resultCards   = $$('#result-grid .art-card');
  const previewModal  = $('#preview-modal');
  const previewFrame  = $('#preview-frame');
  const previewImg    = $('#preview-img');
  const previewTitle  = $('#preview-title');
  const previewMeta   = $('#preview-meta');
  const previewDl     = $('#preview-download');
  const previewClose  = $('#preview-close');
  const NEGATIVE_PRESET_MAP = {
    '通用瑕疵': '模糊, 低清晰度, 变形, 畸形, 水印, 签名, logo, 重影, 结构错误',
    '融合脏边': '边缘撕裂, 拼接断层, 双重轮廓, 局部塌陷, 接缝明显, 杂乱纹理',
    '人物修正': '脸部崩坏, 五官错位, 手部畸形, 多手指, 肢体重复, 姿态僵硬'
  };

  document.querySelectorAll('[data-neg-preset]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var target = document.getElementById('negative-prompt');
      if (!target) return;
      var value = NEGATIVE_PRESET_MAP[btn.dataset.negPreset] || '';
      if (!value) return;
      target.value = target.value.trim() ? (target.value.trim() + ', ' + value) : value;
      if (window.BaishiShared && typeof window.BaishiShared.toast === 'function') {
        window.BaishiShared.toast('已填入负面提示词 · ' + btn.dataset.negPreset, 'success');
      }
    });
  });
  const previewPlaceholder = $('#preview-placeholder');
  const toasts        = $('#toasts');
  const refMem        = $('#ref-mem');

  // 右侧预览区：墨笔加载动画的显示/隐藏
  function showLoading() {
    if (resultEmpty) resultEmpty.style.display = 'none';
    if (resultGrid)  resultGrid.style.display = 'none';
    if (loadingCanvas) loadingCanvas.hidden = false;
    if (loadingStep) loadingStep.textContent = '正在连接后端';
  }
  function hideLoading() {
    if (loadingCanvas) loadingCanvas.hidden = true;
  }
  function setLoadingStep(t) {
    if (loadingStep) loadingStep.textContent = t;
  }

  /* ─── Utilities ─────────────────────────────────────────────── */
  function toast(msg, kind) {
    if (window.BaishiShared && typeof window.BaishiShared.toast === 'function') {
      return window.BaishiShared.toast(msg, kind);
    }
  }
  function getTaskStore() {
    return window.BaishiShared || null;
  }

  function setGenerateBusy(isBusy) {
    if (!generateBtn) return;
    generateBtn.disabled = !!isBusy;
    generateBtn.querySelector('span').textContent = isBusy ? '生成中…' : '生成';
  }

  function applyTaskState(task) {
    if (!task) return;
    if (task.input && task.input.prompt && !(promptInput.value || '').trim()) {
      promptInput.value = task.input.prompt;
      if (charCount) charCount.textContent = task.input.prompt.length;
    }
    if (task.status === 'running') {
      state.generating = true;
      setGenerateBusy(true);
      showLoading();
      setLoadingStep(task.stepText || '正在后台生成…');
      return;
    }
    if (task.status === 'success' && task.result && Array.isArray(task.result.images)) {
      state.generating = false;
      setGenerateBusy(false);
      hideLoading();
      resultGrid.style.display = 'grid';
      var ratio = task.result.ratio || '1:1';
      var cssRatio = ratio.replace(':', ' / ');
      var urls = task.result.images.map(function (img) { return img.url || img.b64_json || ''; });
      var cards = $$('#result-grid .art-card');
      cards.forEach(function (card, i) {
        card.style.display = i < urls.length ? 'block' : 'none';
        if (i < urls.length) {
          var imgEl = card.querySelector('.art-img');
          imgEl.style.background = 'none';
          imgEl.style.backgroundImage = 'url(' + urls[i] + ')';
          imgEl.style.backgroundSize = 'cover';
          imgEl.style.backgroundPosition = 'center';
          imgEl.style.aspectRatio = cssRatio;
          imgEl.innerHTML = '';
          card.querySelector('.title').textContent = '生成作品 ' + (i + 1);
          card.querySelector('.sub').innerHTML = '<span>' + ratio + ' · BaiShi-Fusion</span><span class="num">#' + (i + 1) + '</span>';
        }
      });
      return;
    }
    if (task.status === 'error') {
      state.generating = false;
      setGenerateBusy(false);
      hideLoading();
      if (task.error) toast(task.error, 'warn');
    }
  }
  applyTaskState(getTaskStore() && getTaskStore().getTask ? getTaskStore().getTask(TASK_KEY) : null);
  if (getTaskStore() && typeof getTaskStore().subscribeTasks === 'function') {
    getTaskStore().subscribeTasks(function (taskKey, task) {
      if (taskKey !== TASK_KEY || !task) return;
      applyTaskState(task);
    });
  }

  function uid() { return Math.random().toString(36).slice(2, 8); }

  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }

  /* ─── Image compression (same as image-to-image.js) ───────── */
  function compressImage(dataUrl, maxSide, quality, cb) {
    var img = new Image();
    img.onload = function () {
      var w = img.naturalWidth, h = img.naturalHeight;
      if (w <= maxSide && h <= maxSide && dataUrl.length < 1500 * 1024) { cb(dataUrl); return; }
      var scale = Math.min(1, maxSide / Math.max(w, h));
      var cw = Math.round(w * scale), ch = Math.round(h * scale);
      var canvas = document.createElement('canvas');
      canvas.width = cw; canvas.height = ch;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, cw, ch);
      var isPng = dataUrl.indexOf('data:image/png') === 0;
      var out = isPng && hasAlpha(img, w, h)
        ? canvas.toDataURL('image/png')
        : canvas.toDataURL('image/jpeg', quality);
      cb(out);
    };
    img.onerror = function () { cb(dataUrl); };
    img.src = dataUrl;
  }
  function hasAlpha(img, w, h) {
    try {
      var c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      var ctx = c.getContext('2d');
      ctx.drawImage(img, 0, 0, 1, 1);
      var d = ctx.getImageData(0, 0, 1, 1).data;
      return d[3] < 255;
    } catch (e) { return false; }
  }

  /* ─── Image upload (with compression) ─────────────────────── */
  function handleFiles(files) {
    var remaining = state.maxRefs - state.refImages.length;
    if (remaining <= 0) { toast('已达上限 ' + state.maxRefs + ' 张', 'error'); return; }
    var list = Array.prototype.slice.call(files).slice(0, remaining);
    list.forEach(function (f) {
      if (!f.type.startsWith('image/')) return;
      if (f.size > 20 * 1024 * 1024) { toast('图片过大 · 请选择小于 20MB 的文件', 'error'); return; }
      var reader = new FileReader();
      reader._id = uid();
      reader.onload = function (e) {
        var raw = e.target.result;
        var id = e.target._id;
        // 压缩到 ≤1280px / JPEG 0.9, 避免 413 body limit
        compressImage(raw, 1280, 0.9, function (compressed) {
          var origKB = Math.round(raw.length * 3 / 4 / 1024);
          var compKB = Math.round(compressed.length * 3 / 4 / 1024);
          if (compressed !== raw) {
            console.log('[baishi] multi-image compressed: ' + origKB + 'KB → ' + compKB + 'KB');
          }
          state.refImages.push({ id: id, file: f, dataUrl: compressed });
          renderRefGrid();
        });
      };
      reader.readAsDataURL(f);
    });
  }

  function renderRefGrid() {
    var slots = state.refImages.map(function (img) {
      return '<div class="ref-slot filled-slot" data-id="' + img.id + '" draggable="true">' +
        '<img src="' + img.dataUrl + '" alt="ref" />' +
        '<button class="ref-del" data-id="' + img.id + '" title="移除">✕</button>' +
        '</div>';
    });
    var hasRoom = state.refImages.length < state.maxRefs;
    var addHtml = hasRoom ? addSlot.outerHTML : '';
    refGrid.innerHTML = slots.join('') + addHtml;
    refCount.textContent = state.refImages.length;

    var newAdd = document.getElementById('add-slot');
    if (newAdd) newAdd.addEventListener('click', triggerUpload);
    document.querySelectorAll('.ref-del').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.dataset.id;
        state.refImages = state.refImages.filter(function (img) { return img.id !== id; });
        renderRefGrid();
        updateRefMem();
      });
    });
    document.querySelectorAll('.filled-slot').forEach(function (slot) {
      slot.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', slot.dataset.id);
        slot.classList.add('dragging');
      });
      slot.addEventListener('dragend', function () { slot.classList.remove('dragging'); });
      slot.addEventListener('dragover', function (e) { e.preventDefault(); slot.classList.add('drag-over'); });
      slot.addEventListener('drop', function (e) {
        e.preventDefault();
        slot.classList.remove('drag-over');
        var fromId = e.dataTransfer.getData('text/plain');
        var toId = slot.dataset.id;
        if (!fromId || !toId || fromId === toId) return;
        var fromIdx = state.refImages.findIndex(function (i) { return i.id === fromId; });
        var toIdx = state.refImages.findIndex(function (i) { return i.id === toId; });
        if (fromIdx < 0 || toIdx < 0) return;
        var item = state.refImages.splice(fromIdx, 1)[0];
        state.refImages.splice(toIdx, 0, item);
        renderRefGrid();
      });
    });
    updateRefMem();
  }

  function triggerUpload() {
    if (!uploadInput) return;
    uploadInput.value = '';
    uploadInput.click();
  }

  if (uploadInput) {
    uploadInput.addEventListener('change', function () {
      if (uploadInput.files && uploadInput.files.length) handleFiles(uploadInput.files);
      uploadInput.value = '';
    });
  }

  function updateRefMem() {
    var total = 0;
    state.refImages.forEach(function (img) {
      if (img.dataUrl) total += img.dataUrl.length * 0.75;
    });
    refMem.textContent = (total / (1024 * 1024)).toFixed(1);
  }

  addSlot.addEventListener('click', triggerUpload);

  window.addEventListener('pageshow', function () {
    if (uploadInput) uploadInput.value = '';
  });

  refGrid.addEventListener('dragover', function (e) { e.preventDefault(); refGrid.classList.add('drag-over'); });
  refGrid.addEventListener('dragleave', function () { refGrid.classList.remove('drag-over'); });
  refGrid.addEventListener('drop', function (e) {
    e.preventDefault();
    refGrid.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
      handleFiles(e.dataTransfer.files);
    }
  });

  clearRefs.addEventListener('click', function () {
    state.refImages = [];
    renderRefGrid();
    toast('已清空所有参考图');
  });

  promptInput.addEventListener('input', function () {
    var len = promptInput.value.length;
    charCount.textContent = len;
    if (len > 500) { promptInput.value = promptInput.value.slice(0, 500); charCount.textContent = 500; }
  });

  enhanceBtn.addEventListener('click', async function () {
    var val = promptInput.value.trim();
    if (!val) { toast('请先输入融合提示词', 'warn'); return; }
    enhanceBtn.disabled = true;
    var orig = enhanceBtn.innerHTML;
    enhanceBtn.innerHTML = '<span>润色中…</span>';
    var r = await window.BaiShiAPI.enhancePrompt(val);
    enhanceBtn.innerHTML = orig;
    enhanceBtn.disabled = false;
    if (r && r.success && r.data && r.data.enhanced) {
      promptInput.value = r.data.enhanced;
      charCount.textContent = promptInput.value.length;
      toast('已智能润色');
    } else {
      toast('润色失败：' + (r && r.error ? r.error : '未知'), 'error');
    }
  });

  blendSlider.addEventListener('input', function () {
    blendVal.textContent = parseFloat(blendSlider.value).toFixed(2);
  });

  ratioOpts.forEach(function (opt) {
    opt.addEventListener('click', function () {
      ratioOpts.forEach(function (o) { o.classList.remove('active'); });
      opt.classList.add('active');
    });
  });

  batchSlider.addEventListener('input', function () {
    batchVal.textContent = batchSlider.value + ' 张';
  });

  seedDice.addEventListener('click', function () {
    seedInput.value = Math.floor(Math.random() * 2147483647);
  });

  /* ─── Generate (HTTP API) ────────────────────────────────────── */
  generateBtn.addEventListener('click', async function () {
    if (state.generating) return;
    if (state.refImages.length < state.minRefs) {
      toast('至少需要 ' + state.minRefs + ' 张参考图', 'warn');
      return;
    }
    if (!promptInput.value.trim()) {
      toast('请输入融合提示词', 'warn');
      return;
    }

    state.generating = true;
    setGenerateBusy(true);

    showLoading();
    setLoadingStep('正在连接后端…');

    var ratioActive = document.querySelector('#ratio-opts .opt.active');
    var ratio = ratioActive ? ratioActive.dataset.v : '1:1';
    var batch = parseInt(batchSlider.value) || 1;
    // 画面比例 → CSS aspect-ratio 字符串 (e.g. '16:9' → '16 / 9')
    var cssRatio = ratio.replace(':', ' / ');
    // 负面提示词
    var negEl = document.getElementById('negative-prompt');
    var negativePrompt = negEl ? negEl.value.trim() : '';
    // 高精度模式
    var hpEl = document.getElementById('high-precision');
    var highPrecision = hpEl ? hpEl.checked : true;
    var steps = highPrecision ? 50 : 30;
    if (getTaskStore() && typeof getTaskStore().setTask === 'function') {
      getTaskStore().setTask(TASK_KEY, {
        status: 'running',
        startedAt: Date.now(),
        stepText: '正在连接后端…',
        input: {
          prompt: promptInput.value.trim(),
          ratio: ratio,
          count: batch,
          negativePrompt: negativePrompt,
          highPrecision: highPrecision
        }
      });
    }

    try {
      setLoadingStep('发送融合请求…');
      if (getTaskStore() && typeof getTaskStore().setTask === 'function') {
        getTaskStore().setTask(TASK_KEY, { status: 'running', stepText: '发送融合请求…' });
      }

      // 重点：Agnes I2I 规范要求 extra_body.image: [URL/Base64] 数组
      // 多图融合：把上传的多张参考图 dataURL 组装为数组传给后端
      var refImages = state.refImages.map(function (r) { return r.dataUrl; }).filter(Boolean);

      var res = await window.BaiShiAPI.imageToImage({
        prompt: promptInput.value.trim(),
        negative_prompt: negativePrompt,
        style_id: 'multi-image',
        seed: parseInt(seedInput.value) > 0 ? parseInt(seedInput.value) : null,
        steps: steps,
        aspect: ratio,
        count: batch,
        reference_images: refImages,                 // 多图数组
        reference_image: refImages[0] || null,        // 兼容单图 backend
        strength: parseFloat(blendSlider.value),     // Agnes 不支持 strength，仅供占位
        high_precision: highPrecision,
      });

      if (res.success) {
        setLoadingStep('处理完成…');

        hideLoading();
        resultGrid.style.display = 'grid';
        state.generating = false;
        setGenerateBusy(false);

        var urls = res.data.images.map(function(img) { return img.url; });
        var cards = $$('#result-grid .art-card');
        cards.forEach(function (card, i) {
          card.style.display = i < urls.length ? 'block' : 'none';
          if (i < urls.length) {
            var imgEl = card.querySelector('.art-img');
            imgEl.style.background = 'none';
            imgEl.style.backgroundImage = 'url(' + urls[i] + ')';
            imgEl.style.backgroundSize = 'cover';
            imgEl.style.backgroundPosition = 'center';
            imgEl.style.aspectRatio = cssRatio;
            imgEl.innerHTML = '';
            imgEl.style.cursor = 'pointer';
            imgEl.onclick = function () {
              // 复用页面底部 preview-modal (随 aspect 动态调整), 不可用时退化到内联弹窗
              if (previewModal && previewFrame) {
                previewFrame.style.aspectRatio = cssRatio;
                previewImg.src = urls[i];
                previewImg.style.display = 'block';
                if (previewPlaceholder) previewPlaceholder.style.display = 'none';
                previewTitle.textContent = '生成作品 ' + (i + 1);
                previewMeta.textContent = ratio + ' · BaiShi-Fusion';
                previewModal.style.display = 'flex';
              } else {
                var modal = document.createElement('div');
                modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:grid;place-items:center;cursor:pointer';
                var big = document.createElement('img');
                big.src = urls[i];
                big.style.cssText = 'max-width:90vw;max-height:85vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4)';
                modal.appendChild(big);
                modal.onclick = function () { modal.remove(); };
                document.body.appendChild(modal);
              }
            };
            card.querySelector('.title').textContent = '生成作品 ' + (i + 1);
            card.querySelector('.sub').innerHTML = '<span>' + ratio + ' · BaiShi-Fusion</span><span class="num">#' + (i + 1) + '</span>';
          }
        });

        toast('生成完成 · 共 ' + urls.length + ' 张 · ' + (res.data.took_ms / 1000).toFixed(1) + 's');
        if (getTaskStore() && typeof getTaskStore().setTask === 'function') {
          getTaskStore().setTask(TASK_KEY, {
            status: 'success',
            finishedAt: Date.now(),
            stepText: '已完成',
            result: {
              images: res.data.images || [],
              ratio: ratio,
              took_ms: res.data.took_ms || 0
            }
          });
        }
      } else {
        hideLoading();
        state.generating = false;
        setGenerateBusy(false);
        if (getTaskStore() && typeof getTaskStore().setTask === 'function') {
          getTaskStore().setTask(TASK_KEY, {
            status: 'error',
            finishedAt: Date.now(),
            stepText: '生成失败',
            error: res.error || '生成失败'
          });
        }
        toast(res.error || '生成失败', 'error');
      }
    } catch (err) {
      hideLoading();
      state.generating = false;
      setGenerateBusy(false);
      if (getTaskStore() && typeof getTaskStore().setTask === 'function') {
        getTaskStore().setTask(TASK_KEY, {
          status: 'error',
          finishedAt: Date.now(),
          stepText: '网络错误',
          error: err.message || String(err)
        });
      }
      toast('网络错误：' + (err.message || err), 'error');
    }
  });

  /* ─── Clear all ──────────────────────────────────────────────── */
  clearBtn.addEventListener('click', function () {
    state.refImages = [];
    renderRefGrid();
    promptInput.value = '';
    charCount.textContent = '0';
    // 重置为默认值: 融合 0.60 / 比例 1:1 / 1 张 / 种子 0 / 高精度 ON
    seedInput.value = '0';
    blendSlider.value = '0.6';
    blendVal.textContent = '0.60';
    batchSlider.value = '1';
    batchVal.textContent = '1 张';
    document.querySelectorAll('#ratio-opts .opt').forEach(function(o) {
      o.classList.toggle('active', o.dataset.v === '1:1');
    });
    var hpReset = document.getElementById('high-precision');
    if (hpReset) hpReset.checked = true;
    var negReset = document.getElementById('negative-prompt');
    if (negReset) negReset.value = '';
    resultGrid.style.display = 'none';
    resultEmpty.style.display = 'grid';
    hideLoading();
    toast('已清空所有内容');
  });

  /* ─── Keyboard shortcut ──────────────────────────────────────── */
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      generateBtn.click();
    }
  });

  // 预览弹窗关闭/下载
  if (previewClose) {
    previewClose.addEventListener('click', function () { previewModal.style.display = 'none'; });
  }
  if (previewModal) {
    previewModal.addEventListener('click', function (e) {
      if (e.target === previewModal) previewModal.style.display = 'none';
    });
  }
  if (previewDl && previewImg) {
    previewDl.addEventListener('click', function () {
      var a = document.createElement('a');
      a.href = previewImg.src;
      a.download = (previewTitle.textContent || 'image') + '.png';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); }, 100);
    });
  }

  /* ─── Init ────────────────────────────────────────────────────── */
  renderRefGrid();
});
