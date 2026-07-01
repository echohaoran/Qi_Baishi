// image-to-image.js — 图生图（笔意化境）
// 上传 / 拖放 真实存储，智能润色 / 生成 全部接通后端
document.addEventListener('DOMContentLoaded', function () {
  // OS 切换
  document.querySelectorAll('[data-os-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.dataset.os = btn.dataset.osSet;
      document.querySelectorAll('[data-os-set]').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // Toast
  function toast(msg, kind) {
    kind = kind || 'success';
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = `<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>${msg}</span>`;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
    setTimeout(() => t.remove(), 2800);
  }

  // ── 上传参考图（点击 + 拖放） ──
  const dropzone = document.getElementById('dropzone');
  const preview = document.getElementById('preview');
  const previewImg = document.getElementById('preview-img');
  const previewName = document.getElementById('preview-name');
  const previewMeta = document.getElementById('preview-meta');
  let refImageDataUrl = null;
  let refImageName = '';

  // 压缩到最长边 1280px / JPEG 0.9 质量, 避免 2MB axum body limit
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
      // 优先 JPEG (小), 仅在原图带 alpha 通道时退回 PNG
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

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) {
      toast('请选择图片文件（PNG / JPG / WebP）', 'error');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast('图片过大 · 请选择小于 20MB 的文件', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      var raw = e.target.result;
      // 压缩到 ≤1280px / JPEG 0.9, 目标 ≤1.5MB dataURL
      compressImage(raw, 1280, 0.9, function (compressed) {
        refImageDataUrl = compressed;
        refImageName = file.name;
        previewImg.src = compressed;
        if (previewName) previewName.textContent = file.name;
        var sizeMB = (compressed.length * 0.75 / (1024 * 1024)).toFixed(2);
        if (previewMeta) previewMeta.textContent =
          '已压缩至 ≤1280px · 约 ' + sizeMB + ' MB' + (compressed !== raw ? '（已优化）' : '');
        dropzone.style.display = 'none';
        preview.style.display = 'block';
        var origMB = (file.size / (1024 * 1024)).toFixed(1);
        if (compressed !== raw) toast('参考图已加载 · ' + origMB + ' MB → ' + sizeMB + ' MB');
        else toast('参考图已加载');
      });
    };
    reader.readAsDataURL(file);
  }

  function pickFile() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/webp';
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
    });
    input.click();
  }

  dropzone.addEventListener('click', pickFile);
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  });
  document.getElementById('remove-img').addEventListener('click', () => {
    refImageDataUrl = null;
    refImageName = '';
    preview.style.display = 'none';
    dropzone.style.display = 'block';
  });

  // 字符计数
  const prompt = document.getElementById('prompt');
  const charCount = document.getElementById('char-count');
  prompt.addEventListener('input', () => { charCount.textContent = prompt.value.length; });

  // 化境强度
  const strengthSlider = document.getElementById('strength-slider');
  const strengthVal = document.getElementById('strength-val');
  strengthSlider.addEventListener('input', () => { strengthVal.textContent = parseFloat(strengthSlider.value).toFixed(2); });

  // 比例 / 数量
  function bindOptions(group, valEl, prefix, getValue) {
    const opts = group.querySelectorAll('.opt');
    opts.forEach(o => o.addEventListener('click', () => {
      opts.forEach(x => x.classList.remove('active'));
      o.classList.add('active');
      valEl.textContent = (getValue ? getValue(o) : (prefix || '') + o.dataset.v);
    }));
  }
  bindOptions(document.getElementById('ratio-opts'), document.getElementById('ratio-val'), null, function(o) {
    return o.dataset.v;
  });
  bindOptions(document.getElementById('batch-opts'), document.getElementById('batch-val'), '');

  // 种子
  const seedInput = document.getElementById('seed-input');
  const seedVal = document.getElementById('seed-val');
  seedInput.addEventListener('input', () => { seedVal.textContent = seedInput.value || '-1 (随机)'; });
  document.getElementById('seed-dice').addEventListener('click', () => {
    const n = Math.floor(Math.random() * 9999999);
    seedInput.value = n;
    seedVal.textContent = n;
  });

  // ── 固定提示词（同 text-to-image） ──
  var promptPresets = [
    { id: 'pp01', name: '飞白山水',     prompt: '将输入图像转换为飞白水墨风格：远山以焦墨枯笔写意写出，近处古松苍劲虬曲，云海翻涌于山腰。以飞白法表现山石肌理，留白处见宣纸本色，干湿浓淡相生相发。整体气势雄浑而静谧，意境悠远深邃，保持原图构图主体位置，细节转化为飞白山水笔法。' },
    { id: 'pp02', name: '工笔花鸟',     prompt: '将输入图像转为宋代院体工笔花鸟风格：画面主体精细勾勒，线条细劲圆润。色彩以中国传统矿物颜料晕染，层次丰富。背景大面积留白，花瓣层叠渲染，叶脉勾勒分明。设色清雅明丽，格调工致婉约，保留原图构图与主体形态，以工笔技法重新描绘每个细节，传达静观自然之神韵。' },
    { id: 'pp03', name: '写意人物',     prompt: '将输入图像中的人物转换为写意水墨风格：以减笔法勾勒人物，宽袍大袖线条疏朗而不羸弱，面部用笔极简却神采内含。背景以淡墨渲染或留白处理，与环境元素融为一体，意境以神写形、气韵生动。保留原人物动态与神态特征，以水墨写意的方式重新诠释，传达超然物外的旷达气质。' },
    { id: 'pp04', name: '敦煌重彩',     prompt: '将输入图像转换为敦煌莫高窟壁画风格：色彩以天然矿物颜料层层叠染，石青、石绿、朱砂、土黄等矿物质色彩饱和而古雅。画面主体线条流畅圆润，背景饰以唐代卷草祥云纹样。色调斑驳古朴，光影处理为扁平化、装饰化效果。保留原图构图主体，以盛唐壁画的辉煌色彩与庄严气度重新渲染整幅画面。' },
    { id: 'pp05', name: '水墨氤氲',     prompt: '将输入图像转换为水墨氤氲风格：以泼墨大写意手法重新诠释画面，大笔阔墨横扫泼洒，墨色分明分五色。枯焦处如干裂秋风，湿润处如雨中春山，浓淡交融之间水汽蒸腾氤氲，墨彩淋漓酣畅。保留原图构图骨架，以狂放不羁的笔墨与极具张力的情感重新书写，传达大写意艺术的灵魂与生命力。' },
    { id: 'pp06', name: '青绿山水',     prompt: '将输入图像转换为青绿山水风格：以王希孟《千里江山图》为风格参考，山石以赭石打底，再以石青石绿层层积染，山脚淡染轻罩。云气以淡粉或白粉勾染，山间点缀楼阁、飞瀑、老松。色彩浓丽而不艳俗，画面充满贵族式的典雅与庄重。保留原图山水布局，以青绿重彩技法重新绘制每一处细节。' },
    { id: 'pp07', name: '油画厚涂',     prompt: '将输入图像转换为油画厚涂风格：以印象派与表现主义之间的厚涂技法重新诠释画面，颜色堆叠富有肌理感，光影对比强烈。笔触明显，颜色在画面中相互交织碰撞。色彩层次丰富，暗部富有色彩变化而非单纯黑色。保留原图构图与主体，以油画的厚涂肌理与光影节奏重新描绘，画面具有强烈的物质感与绘画感。' },
    { id: 'pp08', name: '浮世绘',       prompt: '将输入图像转换为日本浮世绘风格：画面以清晰流畅的黑色线条勾勒轮廓，色彩平涂饱满，红、蓝、黄、绿为主色调。光影简化为二维装饰性效果。背景处理为木版画特有的渐变条纹或几何纹样。保留原图构图主体，以浮世绘的装饰性语言重新诠释，线条肯定有力，色彩鲜明而不跳脱，具有北斋与广重的画面特质。' },
  ];
  var promptEditMode = false;
  var editingPromptId = null;
  var pendingDeletePromptId = null;
  var promptGrid = document.getElementById('prompt-presets-grid');
  var editToggle = document.getElementById('prompt-edit-toggle');
  var editToggleLb = document.getElementById('prompt-edit-toggle-label');
  var editor = document.getElementById('prompt-editor');
  var editorTitle = document.getElementById('prompt-editor-title');
  var editorName = document.getElementById('prompt-editor-name');
  var editorText = document.getElementById('prompt-editor-text');
  var editorSave = document.getElementById('prompt-editor-save');
  var editorCancel = document.getElementById('prompt-editor-cancel');
  var editorClose = document.getElementById('prompt-editor-close');

  function renderPromptPresets() {
    promptGrid.innerHTML = '';
    if (promptEditMode) {
      var addBtn = document.createElement('span');
      addBtn.className = 'prompt-add-card';
      addBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"></path></svg>添加';
      addBtn.addEventListener('click', function() { openPromptEditor(null); });
      promptGrid.appendChild(addBtn);
    }
    promptPresets.forEach(function(p, idx) {
      var wrap = document.createElement('span');
      wrap.className = 'prompt-chip-wrap';
      wrap.style.position = 'relative';
      wrap.style.display = 'inline-flex';
      wrap.dataset.promptId = p.id;
      var chip = document.createElement('span');
      chip.className = 'chip';
      chip.dataset.prompt = p.prompt;
      // 默认不选中任何固定提示词 (用户要求)
      chip.textContent = '+ ' + p.name;
      if (!promptEditMode) {
        chip.addEventListener('click', function() {
          var cur = prompt.value.trim();
          prompt.value = cur ? cur + '，' + p.prompt : p.prompt;
          charCount.textContent = prompt.value.length;
          chip.classList.add('active');
          setTimeout(function() { chip.classList.remove('active'); }, 400);
          toast('已追加提示词 · ' + p.name);
        });
      } else {
        chip.style.cursor = 'pointer';
        chip.addEventListener('click', function() { openPromptEditor(p.id); });
      }
      if (promptEditMode) {
        var overlay = document.createElement('span');
        overlay.className = 'prompt-card-edit-overlay';
        overlay.innerHTML = [
          '<button class="edit" type="button" title="编辑">',
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">',
          '<path d="M12 20h9"></path>',
          '<path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg></button>',
          '<button class="del" type="button" title="删除">',
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">',
          '<path d="M6 6l12 12M18 6 6 18"></path></svg></button>'
        ].join('');
        overlay.querySelector('.edit').addEventListener('click', function(e) { e.stopPropagation(); openPromptEditor(p.id); });
        overlay.querySelector('.del').addEventListener('click', function(e) { e.stopPropagation(); showPromptDeleteConfirm(p.id, wrap); });
        var confirmEl = document.createElement('span');
        confirmEl.className = 'prompt-delete-confirm';
        confirmEl.innerHTML = '<span>删除？</span><button class="ok" type="button">确定</button><button class="cancel" type="button">取消</button>';
        confirmEl.querySelector('.ok').addEventListener('click', function(e) { e.stopPropagation(); executePromptDelete(p.id); });
        confirmEl.querySelector('.cancel').addEventListener('click', function(e) { e.stopPropagation(); confirmEl.classList.remove('show'); pendingDeletePromptId = null; });
        wrap.appendChild(chip);
        wrap.appendChild(overlay);
        wrap.appendChild(confirmEl);
      } else {
        wrap.appendChild(chip);
      }
      promptGrid.appendChild(wrap);
    });
  }
  function showPromptDeleteConfirm(id, wrapEl) {
    var all = promptGrid.querySelectorAll('.prompt-delete-confirm.show');
    all.forEach(function(el) { el.classList.remove('show'); });
    pendingDeletePromptId = id;
    var cf = wrapEl.querySelector('.prompt-delete-confirm');
    if (cf) cf.classList.add('show');
  }
  function executePromptDelete(id) {
    var idx = promptPresets.findIndex(function(x) { return x.id === id; });
    if (idx >= 0) {
      var removed = promptPresets.splice(idx, 1)[0];
      renderPromptPresets();
      toast('已删除 · ' + removed.name);
    }
    pendingDeletePromptId = null;
  }
  function openPromptEditor(id) {
    editingPromptId = id;
    if (id) {
      var p = promptPresets.find(function(x) { return x.id === id; });
      if (!p) return;
      editorTitle.textContent = '编辑固定提示词';
      editorName.value = p.name;
      editorText.value = p.prompt;
    } else {
      editorTitle.textContent = '新建固定提示词';
      editorName.value = '';
      editorText.value = '';
    }
    editor.hidden = false;
    setTimeout(function() { editorName.focus(); }, 30);
  }
  function closePromptEditor() { editor.hidden = true; editingPromptId = null; }
  function savePromptPreset() {
    var name = editorName.value.trim();
    var txt  = editorText.value.trim();
    if (!name) { toast('请填写名称', 'error'); editorName.focus(); return; }
    if (!txt)  { toast('请填写提示词', 'error'); editorText.focus(); return; }
    if (editingPromptId) {
      var p = promptPresets.find(function(x) { return x.id === editingPromptId; });
      if (p) { p.name = name; p.prompt = txt; toast('已更新 · ' + name); }
    } else {
      promptPresets.unshift({ id: 'pp' + Date.now().toString(36), name: name, prompt: txt });
      toast('已新建 · ' + name);
    }
    closePromptEditor();
    renderPromptPresets();
  }
  editToggle.addEventListener('click', function() {
    promptEditMode = !promptEditMode;
    editToggle.classList.toggle('active', promptEditMode);
    editToggleLb.textContent = promptEditMode ? '完成' : '编辑';
    document.body.classList.toggle('prompt-edit-on', promptEditMode);
    pendingDeletePromptId = null;
    promptGrid.querySelectorAll('.prompt-delete-confirm.show').forEach(function(el) { el.classList.remove('show'); });
    renderPromptPresets();
  });
  editorSave.addEventListener('click', savePromptPreset);
  editorCancel.addEventListener('click', closePromptEditor);
  editorClose.addEventListener('click', closePromptEditor);
  editor.addEventListener('click', function(e) { if (e.target === editor) closePromptEditor(); });
  renderPromptPresets();

  // ── 智能润色 ──
  var enhanceBtn = document.getElementById('enhance-btn');
  var enhancing = false;
  enhanceBtn.addEventListener('click', async function () {
    if (enhancing) return;
    var val = prompt.value.trim();
    if (!val) { toast('请先输入提示词', 'error'); return; }
    enhancing = true;
    var orig = enhanceBtn.innerHTML;
    enhanceBtn.innerHTML = '<span>润色中…</span>';
    enhanceBtn.disabled = true;
    var r = await window.BaiShiAPI.enhancePrompt(val);
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
  document.getElementById('clear-btn').addEventListener('click', function () {
    prompt.value = '';
    charCount.textContent = 0;
    refImageDataUrl = null;
    refImageName = '';
    preview.style.display = 'none';
    dropzone.style.display = 'block';
    document.getElementById('result-empty').style.display = 'grid';
    document.getElementById('result-grid').style.display = 'none';
    var lc = document.getElementById('loading-canvas');
    if (lc) lc.hidden = true;
    // 重置为默认值: 化境 0.8 / 比例 1:1 / 1 张 / 种子 0 / 高精度 ON
    strengthSlider.value = 0.8;
    strengthVal.textContent = '0.80';
    document.querySelectorAll('#ratio-opts .opt').forEach(function(o) {
      o.classList.toggle('active', o.dataset.v === '1:1');
    });
    document.getElementById('ratio-val').textContent = '1 : 1';
    document.querySelectorAll('#batch-opts .opt').forEach(function(o) {
      o.classList.toggle('active', o.dataset.v === '1');
    });
    document.getElementById('batch-val').textContent = '1 张';
    seedInput.value = '0';
    seedVal.textContent = '0';
    var hpReset = document.getElementById('high-precision');
    if (hpReset) hpReset.checked = true;
    var negReset = document.getElementById('negative-prompt');
    if (negReset) negReset.value = '';
    toast('已清空所有参数');
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

  // ── 生成（图生图） ──
  var genBtn = document.getElementById('generate-btn');
  var generating = false;
  genBtn.addEventListener('click', async function () {
    if (generating) return;
    if (!refImageDataUrl) { toast('请先上传参考图', 'error'); return; }
    if (!prompt.value.trim()) { toast('请先输入提示词', 'error'); return; }
    generating = true;
    var origHtml = genBtn.innerHTML;
    genBtn.innerHTML = '<span>化境中…</span>';
    genBtn.disabled = true;
    showLoading();
    setLoadingStep('正在连接后端…');

    var ratioActive = document.querySelector('#ratio-opts .opt.active');
    var ratio = ratioActive ? ratioActive.dataset.v : '1:1';
    var batchActive = document.querySelector('#batch-opts .opt.active');
    var count = batchActive ? parseInt(batchActive.dataset.v, 10) || 1 : 1;
    var seed = parseInt(seedInput.value, 10);
    var strength = parseFloat(strengthSlider.value) || 0.8;
    // 负面提示词
    var negEl = document.getElementById('negative-prompt');
    var negativePrompt = negEl ? negEl.value.trim() : '';
    // 高精度模式
    var hpEl = document.getElementById('high-precision');
    var highPrecision = hpEl ? hpEl.checked : true;
    var steps = highPrecision ? 50 : 30;

    setLoadingStep('发送化境请求…');
    var r = await window.BaiShiAPI.imageToImage({
      prompt: prompt.value.trim(),
      reference_image: refImageDataUrl,
      strength: strength,
      style_id: 'image-to-image',
      seed: seed > 0 ? seed : null,
      steps: steps,
      cfg_scale: strength,
      aspect: ratio,
      count: count,
      negative_prompt: negativePrompt,
      high_precision: highPrecision,
    });

    generating = false;
    genBtn.innerHTML = origHtml;
    genBtn.disabled = false;
    hideLoading();

    if (r && r.success) {
      renderResults(r.data.images || [], ratio, '生成');
      toast('生成完成 · ' + (r.data.images || []).length + ' 张 · ' + (r.data.took_ms / 1000).toFixed(1) + 's');
    } else {
      document.getElementById('result-empty').style.display = 'grid';
      toast('生成失败：' + (r && r.error ? r.error : '未知'), 'error');
    }
  });

  function renderResults(images, ratio, label) {
    var grid = document.getElementById('result-grid');
    grid.innerHTML = '';
    grid.style.display = 'grid';
    // 画面比例 → CSS aspect-ratio 字符串 (e.g. '16:9' → '16 / 9')
    var cssRatio = (ratio || '1:1').replace(':', ' / ');
    images.forEach(function (img, i) {
      var url = img.url || img.b64_json || '';
      var div = document.createElement('div');
      div.className = 'art-card';
      div.innerHTML =
        '<div class="art-img" style="background-image:url(\'' + url + '\');background-size:cover;background-position:center;cursor:pointer;aspect-ratio:' + cssRatio + ';"></div>' +
        '<div class="art-meta"><div class="title">' + label + ' #' + (i + 1) + '</div>' +
        '<div class="sub"><span>' + ratio + ' · BaiShi</span><span class="num">' +
        '<button class="dl-btn" data-url="' + url + '" data-title="' + label + '_' + (i + 1) + '" style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:12px;">下载</button>' +
        '</span></div></div>';
      div.querySelector('.art-img').addEventListener('click', (function (u) {
        return function () {
          var modal = document.createElement('div');
          modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:grid;place-items:center;cursor:pointer';
          var big = document.createElement('img');
          big.src = u;
          big.style.cssText = 'max-width:90vw;max-height:85vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,0.4)';
          modal.appendChild(big);
          modal.onclick = function () { modal.remove(); };
          document.body.appendChild(modal);
        };
      })(url));
      div.querySelector('.dl-btn').addEventListener('click', function (e) {
        e.stopPropagation();
        downloadImage(this.dataset.url, this.dataset.title);
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

  // 对比滑块
  var compare = document.getElementById('compare');
  var divider = document.getElementById('divider');
  if (compare && divider) {
    var dragging = false;
    function setPos(pct) {
      pct = Math.max(0, Math.min(100, pct));
      divider.style.left = pct + '%';
      var after = compare.querySelector('.after');
      if (after) after.style.clipPath = 'inset(0 0 0 ' + pct + '%)';
    }
    compare.addEventListener('mousedown', function (e) { dragging = true; setPos(((e.clientX - compare.getBoundingClientRect().left) / compare.offsetWidth) * 100); });
    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      setPos(((e.clientX - compare.getBoundingClientRect().left) / compare.offsetWidth) * 100);
    });
    document.addEventListener('mouseup', function () { dragging = false; });
    setPos(50);
  }

  // ⌘ + ⏎
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      genBtn.click();
    }
  });
});
