// image-to-image.js — 图生图引擎
document.addEventListener('DOMContentLoaded', function () {
  // OS 切换
  document.querySelectorAll('[data-os-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.dataset.os = btn.dataset.osSet;
      document.querySelectorAll('[data-os-set]').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  // Toast
  function toast(msg, kind = 'success') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.innerHTML = `<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>${msg}</span>`;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
    setTimeout(() => t.remove(), 2800);
  }

  // 上传
  const dropzone = document.getElementById('dropzone');
  const preview = document.getElementById('preview');
  dropzone.addEventListener('click', () => {
    dropzone.style.display = 'none';
    preview.style.display = 'block';
    toast('参考图已加载');
  });
  dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
  dropzone.addEventListener('drop', e => {
    e.preventDefault();
    dropzone.classList.remove('drag-over');
    dropzone.style.display = 'none';
    preview.style.display = 'block';
    toast('参考图已加载');
  });
  document.getElementById('remove-img').addEventListener('click', () => {
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

  // 比例 / 数量选择
  function bindOptions(group, valEl, prefix, getValue) {
    const opts = group.querySelectorAll('.opt');
    opts.forEach(o => o.addEventListener('click', () => {
      opts.forEach(x => x.classList.remove('active'));
      o.classList.add('active');
      valEl.textContent = (getValue ? getValue(o) : (prefix || '') + o.dataset.v);
    }));
  }
  bindOptions(document.getElementById('ratio-opts'), document.getElementById('ratio-val'), null, function(o) {
    return o.dataset.v === 'orig' ? '原图' : o.dataset.v;
  });
  bindOptions(document.getElementById('batch-opts'), document.getElementById('batch-val'), '');

  // 种子骰
  const seedInput = document.getElementById('seed-input');
  const seedVal = document.getElementById('seed-val');
  seedInput.addEventListener('input', () => { seedVal.textContent = seedInput.value || '-1 (随机)'; });
  document.getElementById('seed-dice').addEventListener('click', () => {
    const n = Math.floor(Math.random() * 9999999);
    seedInput.value = n;
    seedVal.textContent = n;
  });

  // 固定提示词：可编辑 + 编辑器模态
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
  var editToggle   = document.getElementById('prompt-edit-toggle');
  var editToggleLb = document.getElementById('prompt-edit-toggle-label');
  var editor       = document.getElementById('prompt-editor');
  var editorTitle  = document.getElementById('prompt-editor-title');
  var editorName   = document.getElementById('prompt-editor-name');
  var editorText   = document.getElementById('prompt-editor-text');
  var editorSave   = document.getElementById('prompt-editor-save');
  var editorCancel = document.getElementById('prompt-editor-cancel');
  var editorClose  = document.getElementById('prompt-editor-close');

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
      if (idx === 0 && !promptEditMode) chip.classList.add('active');
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

  function closePromptEditor() {
    editor.hidden = true;
    editingPromptId = null;
  }

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

  // 首次渲染固定提示词
  renderPromptPresets();

  // 智能润色
  document.getElementById('enhance-btn').addEventListener('click', function() {
    if (!prompt.value.trim()) { toast('请先输入提示词', 'error'); return; }
    var enhanced = prompt.value + '，飞白与皴法交融，留白三分，笔意疏朗';
    prompt.value = enhanced;
    charCount.textContent = prompt.value.length;
    toast('已润色 · 增加飞白与留白');
  });

  // 清空
  document.getElementById('clear-btn').addEventListener('click', function() {
    prompt.value = '';
    charCount.textContent = 0;
    preview.style.display = 'none';
    dropzone.style.display = 'block';
    document.getElementById('result-empty').style.display = 'grid';
    document.getElementById('result-grid').style.display = 'none';
    strengthSlider.value = 0.65;
    strengthVal.textContent = '0.65';
    seedInput.value = '-1';
    seedVal.textContent = '-1 (随机)';
    toast('已清空所有参数');
  });

  // 生图
  var genBtn = document.getElementById('generate-btn');
  var generating = false;
  genBtn.addEventListener('click', function() {
    if (generating) return;
    if (preview.style.display === 'none') { toast('请先上传参考图', 'error'); return; }
    if (!prompt.value.trim()) { toast('请先输入提示词', 'error'); return; }
    generating = true;
    var orig = genBtn.innerHTML;
    genBtn.innerHTML = '<span>正在化境…</span>';
    genBtn.disabled = true;
    document.getElementById('result-empty').style.display = 'none';
    document.getElementById('result-grid').style.display = 'grid';
    setTimeout(function() {
      genBtn.innerHTML = orig;
      genBtn.disabled = false;
      generating = false;
      toast('化境完成 · 4 张作品已就位');
    }, 1800);
  });

  // 作品图注入
  var arts = {
    i1: 'radial-gradient(ellipse at 30% 30%, #d4a574, #4a3522)',
    i2: 'radial-gradient(ellipse at 70% 70%, #a4a896, #2d3818)',
    i3: 'linear-gradient(135deg, #cba66e, #5a3a20)',
    i4: 'radial-gradient(circle at 50% 50%, #b4a07e, #2a1f15)'
  };
  document.querySelectorAll('[data-art]').forEach(function(el) {
    var k = el.dataset.art;
    if (arts[k]) {
      el.style.background = arts[k];
      el.style.position = 'relative';
    }
  });

  // ⌘ + ⏎
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      genBtn.click();
    }
  });

});
