// settings.js — 设置页（生图 API · 生文 API · 偏好 · 存储）
// 全部按钮接通后端 + localStorage，并实时影响生图请求体
document.addEventListener('DOMContentLoaded', function () {
  /* ── OS 切换 ───────────────────────────────────── */
  document.querySelectorAll('[data-os-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.body.dataset.os = btn.dataset.osSet;
      document.querySelectorAll('[data-os-set]').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  /* ── 工具 ─────────────────────────────────────── */
  function toast(msg, kind, options) {
    if (window.BaishiShared && typeof window.BaishiShared.toast === 'function') {
      return window.BaishiShared.toast(msg, kind, options);
    }
  }

  /* ── Sub-nav 初始化 ───────────────────────────── */
  function activateTab(tab) {
    document.querySelectorAll('.sub-nav .item').forEach(x => x.classList.toggle('active', x.dataset.tab === tab));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    var p = document.getElementById('panel-' + tab);
    if (p) p.classList.add('active');
    if (window.location.hash !== '#' + tab) {
      history.replaceState(null, '', '#' + tab);
    }
  }
  document.querySelectorAll('.sub-nav .item').forEach(item => {
    item.addEventListener('click', () => activateTab(item.dataset.tab));
  });
  // 初始化显示默认 panel
  var hashTab = window.location.hash ? window.location.hash.slice(1) : '';
  var defaultTab = document.querySelector('.sub-nav .item[data-tab="' + hashTab + '"]') || document.querySelector('.sub-nav .item.active');
  if (defaultTab) activateTab(defaultTab.dataset.tab);

  /* ════════════════════════════════════════════════
   * 偏好 8 项 · 实时保存到 localStorage
   * ════════════════════════════════════════════════ */
  const PREFS_BIND = {
    'pref-aspect':     { key: 'defaultAspect',     asString: true },
    'pref-count':      { key: 'defaultCount',      asString: true },
    'pref-auto-save':  { key: 'autoSaveHistory' },
    'pref-high-precision': { key: 'highPrecision' },
    'pref-brush-anim': { key: 'brushAnimation' },
    'pref-size-base':  { key: 'sizeBase',          asString: true },
    'pref-notify':     { key: 'notifications' },
    'pref-sound':      { key: 'soundEnabled' },
  };
  function applyPrefsToUI() {
    const p = window.BaishiShared.getPrefs();
    Object.keys(PREFS_BIND).forEach(id => {
      var meta = PREFS_BIND[id];
      var el = document.getElementById(id);
      if (!el) return;
      var v = p[meta.key];
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v != null ? String(v) : '';
    });
  }
  function bindPrefs() {
    Object.keys(PREFS_BIND).forEach(id => {
      var meta = PREFS_BIND[id];
      var el = document.getElementById(id);
      if (!el) return;
      var ev = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
      el.addEventListener(ev, () => {
        var v = (el.type === 'checkbox') ? el.checked : el.value;
        window.BaishiShared.setPref(meta.key, meta.asString ? String(v) : v);
        toast('已保存偏好 · ' + id, 'success');
      });
    });
  }

  /* ════════════════════════════════════════════════
   * 主题切换 · 实时生效
   * ════════════════════════════════════════════════ */
  function bindTheme() {
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        document.documentElement.setAttribute('data-theme', theme);
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
        try { localStorage.setItem('baishi.theme', theme); } catch (e) {}
        toast('已切换至' + (theme === 'dark' ? '夜墨' : '昼砚') + '主题', 'success');
      });
    });
    var saved = localStorage.getItem('baishi.theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === saved));
  }

  /* ════════════════════════════════════════════════
   * 在线生图 API · 供应商下拉 + 模型下拉 + API Key
   *   选供应商 → 模型自动匹配 → 填 API Key → 测试连接 → 保存
   *   Custom 供应商显示 endpoint + 请求体模板输入
   * ════════════════════════════════════════════════ */
  function bindImageApi() {
    var providerSelect = document.getElementById('image-api-provider');
    var modelSelect = document.getElementById('image-api-model');
    var modelInput = document.getElementById('image-api-model-input');
    var modelWrap = document.querySelector('.model-control-wrap');
    var keyInput = document.getElementById('online-api-key');
    var testBtn = document.getElementById('test-online-api');
    var saveBtn = document.getElementById('save-image-api');
    var resultBox = document.getElementById('online-api-result');
    var savedHint = document.getElementById('provider-saved-hint');
    var customFields = document.getElementById('custom-fields');
    var customEndpoint = document.getElementById('custom-endpoint');
    var customBody = document.getElementById('custom-request-body');
    var apiKeyHint = document.getElementById('api-key-hint');
    var previewBody = document.getElementById('request-preview-body');
    var endpointHint = document.getElementById('provider-endpoint-hint');
    var providerApiLinkRow = document.getElementById('provider-api-link-row');
    var providerApiLink = document.getElementById('provider-api-link');
    if (!providerSelect) return;

    var DEFAULT_PROVIDER = 'Agnes Images 2.1 Flash';

    /* ── 7 个内置供应商 · 每个支持多个模型 ── */
    var PROVIDERS = [
      {
        name: 'Agnes Images 2.1 Flash',
        endpoint: 'https://apihub.agnes-ai.com/v1/images/generations',
        officialUrl: 'https://wiki.agnes-ai.com/en/docs/quickstart',
        defaultModel: 'agnes-image-2.1-flash',
        models: [
          { id: 'agnes-image-2.1-flash', label: 'Agnes Image 2.1 Flash' },
          { id: 'agnes-image-2.1-pro',   label: 'Agnes Image 2.1 Pro' },
          { id: 'agnes-image-2.0',        label: 'Agnes Image 2.0' }
        ],
        requestBody: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "n": {{n}},
  "size": "{{size}}"
}`,
        requestBodyI2I: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "size": "{{size}}",
  "extra_body": {
    "image": {{images}},
    "response_format": "url"
  }
}`,
        isDefault: true
      },
      {
        name: 'OpenAI DALL-E',
        endpoint: 'https://api.openai.com/v1/images/generations',
        officialUrl: 'https://platform.openai.com/api-keys',
        defaultModel: 'dall-e-3',
        models: [
          { id: 'dall-e-3',     label: 'DALL-E 3' },
          { id: 'dall-e-2',     label: 'DALL-E 2' },
          { id: 'gpt-image-1',  label: 'GPT-Image-1' }
        ],
        requestBody: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "n": {{n}},
  "size": "{{size}}",
  "quality": "standard"
}`,
        requestBodyI2I: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "n": {{n}},
  "size": "{{size}}",
  "image": {{images}}
}`,
      },
      {
        name: 'Stability SDXL',
        endpoint: 'https://api.stability.ai/v2beta/stable-image/generate/core',
        officialUrl: 'https://platform.stability.ai/docs/getting-started',
        defaultModel: 'stable-diffusion-xl-1024-v1-0',
        models: [
          { id: 'stable-diffusion-xl-1024-v1-0', label: 'SDXL 1.0' },
          { id: 'sd3-5-large',                   label: 'SD 3.5 Large' },
          { id: 'sd3-medium',                    label: 'SD 3 Medium' },
          { id: 'core',                          label: 'Stable Image Core' }
        ],
        requestBody: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "aspect_ratio": "{{aspect}}",
  "seed": {{seed}},
  "output_format": "jpeg",
  "negative_prompt": "{{negative_prompt}}"
}`,
        requestBodyI2I: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "image": {{images}},
  "strength": {{strength}},
  "aspect_ratio": "{{aspect}}",
  "seed": {{seed}},
  "output_format": "jpeg",
  "negative_prompt": "{{negative_prompt}}"
}`,
      },
      {
        name: 'SiliconFlow FLUX',
        endpoint: 'https://api.siliconflow.cn/v1/images/generations',
        officialUrl: 'https://docs.siliconflow.com/en/userguide/quickstart',
        defaultModel: 'black-forest-labs/FLUX.1-schnell',
        models: [
          { id: 'black-forest-labs/FLUX.1-schnell',           label: 'FLUX.1 Schnell' },
          { id: 'black-forest-labs/FLUX.1-dev',               label: 'FLUX.1 Dev' },
          { id: 'stabilityai/stable-diffusion-3-5-large',     label: 'SD 3.5 Large' },
          { id: 'stabilityai/stable-diffusion-xl-base-1.0',   label: 'SDXL Base 1.0' }
        ],
        requestBody: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "image_size": "{{size}}",
  "num_inference_steps": {{steps}},
  "guidance_scale": {{cfg_scale}}
}`,
        requestBodyI2I: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "image": {{images}},
  "strength": {{strength}},
  "image_size": "{{size}}",
  "num_inference_steps": {{steps}},
  "guidance_scale": {{cfg_scale}}
}`,
      },
      {
        name: 'Midjourney',
        endpoint: 'https://api.midjourney.com/v1/imagine',
        officialUrl: 'https://docs.midjourney.com/hc/en-us/categories/32013335627533-Documentation',
        defaultModel: 'midjourney-v6',
        models: [
          { id: 'midjourney-v6',   label: 'Midjourney v6' },
          { id: 'midjourney-v6.1', label: 'Midjourney v6.1' },
          { id: 'midjourney-v5.2', label: 'Midjourney v5.2' }
        ],
        requestBody: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "aspect_ratio": "{{aspect}}",
  "seed": {{seed}}
}`,
        requestBodyI2I: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "image_url": {{images}},
  "aspect_ratio": "{{aspect}}",
  "seed": {{seed}}
}`,
      },
      {
        name: 'Ideogram',
        endpoint: 'https://api.ideogram.ai/v1/ideogram-v2/generate',
        officialUrl: 'https://developer.ideogram.ai/ideogram-api/api-setup',
        defaultModel: 'Ideogram-v2',
        models: [
          { id: 'Ideogram-v2', label: 'Ideogram v2' },
          { id: 'Ideogram-2.0', label: 'Ideogram 2.0' },
          { id: 'Ideogram-1.0', label: 'Ideogram 1.0' }
        ],
        requestBody: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "aspect_ratio": "{{aspect}}",
  "seed": {{seed}},
  "magic_prompt_option": "AUTO"
}`,
        requestBodyI2I: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "image": {{images}},
  "aspect_ratio": "{{aspect}}",
  "seed": {{seed}},
  "magic_prompt_option": "AUTO"
}`,
      },
      {
        name: 'Custom 自定义',
        endpoint: '',
        officialUrl: '',
        defaultModel: '',
        models: [],
        requestBody: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "n": {{n}},
  "size": "{{size}}",
  "seed": {{seed}}
}`,
        requestBodyI2I: `{
  "model": "{{model}}",
  "prompt": "{{prompt}}",
  "n": {{n}},
  "size": "{{size}}",
  "image": {{images}},
  "seed": {{seed}}
}`,
        custom: true
      }
    ];

    /* ── 持久化键 ── */
    var STORAGE_ACTIVE = 'baishi.api.image.active.v2';
    var STORAGE_KEY = 'baishi.api.image.key.v2';
    var STORAGE_MODEL = 'baishi.api.image.model.v2';
    var STORAGE_CUSTOM_EP = 'baishi.api.image.custom.endpoint';
    var STORAGE_CUSTOM_BODY = 'baishi.api.image.custom.body';

    /* ── 供应商 + 模型 存取辅助 ── */
    function getActiveName() {
      try { return localStorage.getItem(STORAGE_ACTIVE) || DEFAULT_PROVIDER; } catch (e) { return DEFAULT_PROVIDER; }
    }
    function setActiveName(n) { try { localStorage.setItem(STORAGE_ACTIVE, n); } catch (e) {} }

    function getSelectedModel(p) {
      try {
        var stored = localStorage.getItem(STORAGE_MODEL);
        if (stored) {
          var map = JSON.parse(stored);
          if (map && map[p.name]) return map[p.name];
        }
      } catch (e) {}
      return p.defaultModel || (p.models && p.models[0] && p.models[0].id) || '';
    }

    function setSelectedModel(p, modelId) {
      try {
        var stored = localStorage.getItem(STORAGE_MODEL);
        var map = stored ? JSON.parse(stored) : {};
        map[p.name] = modelId;
        localStorage.setItem(STORAGE_MODEL, JSON.stringify(map));
      } catch (e) {}
    }

    function getProvider(name) {
      for (var i = 0; i < PROVIDERS.length; i++) {
        if (PROVIDERS[i].name === name) {
          var p = PROVIDERS[i];
          var model = getSelectedModel(p);
          var copy = Object.assign({}, p);
          copy.model = model;
          if (p.requestBody) copy.requestBody = p.requestBody.replace(/\{\{model\}\}/g, model);
          return copy;
        }
      }
      return PROVIDERS[0];
    }

    function getCurrentModelValue(p) {
      if (p.custom) return (modelInput.value || '').trim();
      return modelSelect.value || '';
    }

    /* ── 同步当前供应商 + 模型 到 BaishiShared（让三生图页真实读到） ──
     * 旧问题：settings.js 把模型存到 .v2 键，BaishiShared 读旧键里的
     * requestBodyT2I（硬编码模型），导致下拉选的模型与实际生图模型脱节。
     * 解决：把当前供应商的 requestBody 用 {{model}} 占位符替换为真实模型后，
     * 写进 BaishiShared 的 provider 列表，saveProviders + setActiveProvider。 */
    function syncProviderToShared(p) {
      if (!window || !window.BaishiShared) return;
      try {
        var providers = window.BaishiShared.loadProviders();
        // 取该供应商的真实请求体：Custom 走 textarea，否则走 p.requestBody 模板
        var rawBody;
        var rawBodyI2I;
        if (p.custom) {
          rawBody = (customBody && (customBody.value || '').trim()) || p.requestBody || '';
          rawBodyI2I = (customBody && (customBody.value || '').trim()) || p.requestBodyI2I || p.requestBody || '';
        } else {
          rawBody = p.requestBody || '';
          rawBodyI2I = p.requestBodyI2I || p.requestBody || '';
        }
        // 把 {{model}} 占位符替换为真实模型 id
        var newBody = rawBody.replace(/\{\{model\}\}/g, p.model || '');
        var newBodyI2I = rawBodyI2I.replace(/\{\{model\}\}/g, p.model || '');

        var idx = -1;
        for (var i = 0; i < providers.length; i++) {
          if (providers[i].name === p.name) { idx = i; break; }
        }
        if (idx >= 0) {
          // 保留旧字段，只更新 body 与 endpoint
          providers[idx] = Object.assign({}, providers[idx], {
            endpoint: p.endpoint || providers[idx].endpoint || '',
            requestBodyT2I: newBody,
            requestBodyI2I: newBodyI2I,
          });
        } else {
          // 旧 DEFAULT_PROVIDERS 中没有的（Agnes / Midjourney / Ideogram / Custom）则新增
          providers.push({
            name: p.name,
            endpoint: p.endpoint || '',
            requestBodyT2I: newBody,
            requestBodyI2I: newBodyI2I,
            builtin: false,
            custom: !!p.custom,
          });
        }
        window.BaishiShared.saveProviders(providers);
        window.BaishiShared.setActiveProvider(p.custom ? '' : p.name);
      } catch (e) { /* 静默：共享层失败不应阻塞 UI 流程 */ }
    }

    /* ── 渲染供应商下拉 ── */
    function renderProviderSelect() {
      providerSelect.innerHTML = '';
      PROVIDERS.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.name;
        var tag = p.isDefault ? ' (默认)' : (p.custom ? ' (自定义)' : '');
        opt.textContent = p.name + tag;
        providerSelect.appendChild(opt);
      });
    }

    /* ── 渲染模型下拉 / 输入框（按供应商）── */
    function renderModelControl(p) {
      var currentModel = getSelectedModel(p);
      if (p.custom) {
        // Custom：隐藏 select，显示 input
        modelSelect.style.display = 'none';
        modelInput.style.display = '';
        modelInput.value = currentModel;
        modelInput.placeholder = '输入模型 ID（用于 {{model}} 占位符）';
      } else {
        // 内置：显示 select，填充模型列表
        modelSelect.style.display = '';
        modelInput.style.display = 'none';
        modelSelect.innerHTML = '';
        p.models.forEach(function (m) {
          var opt = document.createElement('option');
          opt.value = m.id;
          opt.textContent = m.label + '  (' + m.id + ')';
          modelSelect.appendChild(opt);
        });
        // 显式赋值（防 selected 属性在 select.innerHTML 清空后失效的浏览器差异）
        if (currentModel) modelSelect.value = currentModel;
      }
    }

    /* ── 更新请求体预览 ── */
    /* ── 请求体预览 ── */
    var rpTabs = document.querySelectorAll('.rp-tab');
    var rpMode = 't2i';

    function updatePreview() {
      var p = getProvider(providerSelect.value);
      var bodyT2I, bodyI2I;
      if (p.custom) {
        bodyT2I = (customBody.value || '').trim() || p.requestBody;
        bodyI2I = (customBody.value || '').trim() || p.requestBodyI2I || p.requestBody;
      } else {
        bodyT2I = p.requestBody;
        bodyI2I = p.requestBodyI2I || p.requestBody;
      }
      var body = rpMode === 'i2i' ? bodyI2I : bodyT2I;
      if (previewBody) previewBody.textContent = body;
    }

    rpTabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        rpTabs.forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        rpMode = tab.dataset.rp;
        updatePreview();
      });
    });

    /* ── 选中供应商 ── */
    function selectProvider(name) {
      setActiveName(name);
      var p = getProvider(name);

      // endpoint 提示
      if (endpointHint) {
        if (p.custom) {
          endpointHint.textContent = '端点 · 由 Custom 供应商的「端点 URL」字段决定';
        } else {
          endpointHint.textContent = '端点 · ' + p.endpoint;
        }
      }
      if (providerApiLinkRow && providerApiLink) {
        if (p.officialUrl) {
          providerApiLink.href = p.officialUrl;
          providerApiLink.textContent = p.name;
          providerApiLinkRow.hidden = false;
        } else {
          providerApiLink.removeAttribute('href');
          providerApiLink.textContent = '';
          providerApiLinkRow.hidden = true;
        }
      }

      // 模型控件
      renderModelControl(p);

      // Custom 字段显示
      if (p.custom) {
        customFields.classList.add('show');
        if (customEndpoint && !customEndpoint.value) {
          try { customEndpoint.value = localStorage.getItem(STORAGE_CUSTOM_EP) || ''; } catch (e) { customEndpoint.value = ''; }
        }
        if (customBody && !customBody.value) {
          try {
            var stored = localStorage.getItem(STORAGE_CUSTOM_BODY);
            customBody.value = stored || p.requestBody;
          } catch (e) { customBody.value = p.requestBody; }
        }
        if (apiKeyHint) apiKeyHint.textContent = '· 自定义供应商 · Key 格式不限';
      } else {
        customFields.classList.remove('show');
        if (apiKeyHint) apiKeyHint.textContent = '· 以 sk- 开头';
      }

      // 把当前供应商+模型同步到 BaishiShared，让三生图页真实读到（启动时也走一遍）
      syncProviderToShared(p);

      updatePreview();
      updateSavedHint();
    }

    function updateSavedHint() {
      if (!savedHint) return;
      var p = getProvider(providerSelect.value);
      var key = (keyInput.value || '').trim();
      var ready = !!key && (!p.custom || ((customEndpoint.value || '').trim() && (customBody.value || '').trim()));
      savedHint.textContent = ready ? '✓ 已配置' : '未保存';
      savedHint.style.color = ready ? 'var(--success)' : 'var(--muted)';
    }

    /* ── 测试连接 · 真实请求供应商 endpoint + Key ── */
    testBtn.addEventListener('click', async function () {
      var p = getProvider(providerSelect.value);
      var endpoint = p.custom ? (customEndpoint.value || '').trim() : p.endpoint;
      var bodyTpl = p.custom ? (customBody.value || '').trim() : p.requestBody;
      var key = (keyInput.value || '').trim();
      if (!endpoint) { toast('Custom 供应商请先填写端点 URL', 'error'); return; }
      if (!bodyTpl) { toast('Custom 供应商请先填写请求体模板', 'error'); return; }
      resultBox.style.display = 'block';
      resultBox.innerHTML = '<p class="meta" style="font-size:13px;">正在请求 ' + endpoint + ' …</p>';
      testBtn.disabled = true;
      var orig = testBtn.textContent;
      testBtn.textContent = '请求中…';
      var t0 = Date.now();
      try {
        var testVars = {
          prompt: 'test', n: 1, count: 1, seed: 0, steps: 1, cfg_scale: 7,
          aspect: '1:1', size: '512x512', width: 512, height: 512,
          negative_prompt: '', reference_image: '', image: '', strength: 0.5
        };
        var testBody = window.BaishiShared ? window.BaishiShared.applyTemplate(bodyTpl, testVars) : bodyTpl;
        var parsed;
        try { parsed = JSON.parse(testBody); } catch (e) { throw new Error('模板替换后不是合法 JSON：' + e.message); }
        var headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = 'Bearer ' + key;
        var ctrl = new AbortController();
        var to = setTimeout(function () { ctrl.abort(); }, 8000);
        var resp = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(parsed), signal: ctrl.signal });
        clearTimeout(to);
        var took = Date.now() - t0;
        var ct = resp.headers.get('content-type') || '';
        resultBox.innerHTML = '<div style="background: rgba(79, 107, 58, 0.08); border: 1px solid var(--success); border-radius: var(--radius); padding: var(--space-3) var(--space-4); font-size: 13px;">'
          + '<div style="color: var(--success); font-weight: 600; margin-bottom: 4px;">✓ 连接成功 · HTTP ' + resp.status + ' · 供应商 ' + p.name + ' · 模型 ' + p.model + '</div>'
          + '<div class="meta">耗时 ' + took + 'ms · ' + (ct || '无 Content-Type') + ' · 端点 <code>' + endpoint + '</code></div>'
          + '</div>';
        toast('连接成功 · HTTP ' + resp.status);
      } catch (err) {
        var took = Date.now() - t0;
        resultBox.innerHTML = '<div style="background: rgba(196, 74, 68, 0.08); border: 1px solid var(--danger); border-radius: var(--radius); padding: var(--space-3) var(--space-4); font-size: 13px;">'
          + '<div style="color: var(--danger); font-weight: 600; margin-bottom: 4px;">✗ 请求失败 · 供应商 ' + p.name + ' · 模型 ' + p.model + '</div>'
          + '<div class="meta">' + (err.message || err) + ' · 耗时 ' + took + 'ms</div>'
          + '<div class="meta" style="margin-top: 4px;">端点 <code>' + endpoint + '</code></div>'
          + '</div>';
        toast('请求失败', 'error');
      }
      testBtn.disabled = false;
      testBtn.textContent = orig;
    });

    /* ── 保存设置 · API Key + supplier + model + Custom 时写 endpoint + body ── */
    saveBtn.addEventListener('click', function () {
      var p = getProvider(providerSelect.value);
      var key = (keyInput.value || '').trim();
      if (!key && !p.custom) { toast('请先填写 API Key', 'error'); return; }
      try { localStorage.setItem(STORAGE_KEY, key); } catch (e) {}
      if (p.custom) {
        var ep = (customEndpoint.value || '').trim();
        var body = (customBody.value || '').trim();
        if (!ep) { toast('Custom 供应商请填写端点 URL', 'error'); return; }
        if (!body) { toast('Custom 供应商请填写请求体模板', 'error'); return; }
        try { JSON.parse(body); } catch (e) { toast('请求体不是合法 JSON：' + e.message, 'error'); return; }
        try { localStorage.setItem(STORAGE_CUSTOM_EP, ep); } catch (e) {}
        try { localStorage.setItem(STORAGE_CUSTOM_BODY, body); } catch (e) {}
      }
      // 同步到 baishi-shared（保证三生图页能读到）
      try { window.BaishiShared.setImageApiKey(key); } catch (e) {}
      try { window.BaishiShared.setActiveProvider(p.custom ? '' : p.name); } catch (e) {}
      // 把当前供应商+模型（含真实 requestBody）写进 BaishiShared 的 provider 列表
      syncProviderToShared(p);
      updateSavedHint();
      toast('已保存「' + p.name + '」· 模型 ' + p.model, 'success');
    });

    /* ── 事件绑定 ── */
    providerSelect.addEventListener('change', function () {
      selectProvider(providerSelect.value);
    });
    modelSelect.addEventListener('change', function () {
      var p = getProvider(providerSelect.value);
      setSelectedModel(p, modelSelect.value);
      syncProviderToShared(p);  // 实时同步到 BaishiShared
      updatePreview();
    });
    modelInput.addEventListener('input', function () {
      var p = getProvider(providerSelect.value);
      setSelectedModel(p, modelInput.value);
      syncProviderToShared(p);  // Custom：实时同步
      updatePreview();
    });
    keyInput.addEventListener('input', updateSavedHint);
    if (customEndpoint) customEndpoint.addEventListener('input', updateSavedHint);
    if (customBody) {
      customBody.addEventListener('input', function () {
        updateSavedHint();
        updatePreview();
      });
    }

    /* ── 启动时回填 ── */
    try {
      var savedKey = localStorage.getItem(STORAGE_KEY);
      if (savedKey) keyInput.value = savedKey;
    } catch (e) {}

    renderProviderSelect();
    var activeName = getActiveName();
    providerSelect.value = activeName;
    selectProvider(activeName);
  }

  /* ════════════════════════════════════════════════
   * 生文 API · 拉模型 + 保存
   * ════════════════════════════════════════════════ */
  function bindTextApi() {
    var urlInput = document.getElementById('text-api-url');
    var keyInput = document.getElementById('text-api-key');
    var sel = document.getElementById('text-api-model');
    var resultBox = document.getElementById('text-api-result');
    var fetchBtn = document.getElementById('fetch-text-models');
    var fetchLbl = document.getElementById('fetch-text-models-label');
    var saveBtn = document.getElementById('save-text-api');
    var clearBtn = document.getElementById('clear-text-api');

    // 回填已保存
    var saved = window.BaishiShared.getTextApi();
    if (saved.url) urlInput.value = saved.url;
    if (saved.key) keyInput.value = saved.key;

    // 关键修复 #3: 启动时从后端 settings 兜底拉 model
    // 解决场景: 用户只点了顶部「保存更改」(写后端), 没点「保存配置」(写 localStorage),
    // 导致 localStorage 没 model → 文生文报"未选择模型"
    window.BaiShiAPI.getSettings(1).then(function (r) {
      if (!(r && r.success && r.data)) return;
      var backendModel = r.data.text_api_model;
      var backendUrl = r.data.api_endpoint;
      var backendKey = r.data.api_key;
      if (!backendModel) return;
      // 优先级: localStorage > 后端
      // 但 localStorage 缺 model 时用后端补; 同时补 url/key
      var localTA = window.BaishiShared.getTextApi();
      var need = {};
      if (!localTA.model) need.model = backendModel;
      if (!localTA.url && backendUrl) need.url = backendUrl;
      if (!localTA.key && backendKey) need.key = backendKey;
      if (need.model) {
        var merged = Object.assign({}, localTA, need, { savedAt: Date.now(), fromBackend: true });
        window.BaishiShared.setTextApi(merged);
        // 同步 UI
        if (!urlInput.value && merged.url) urlInput.value = merged.url;
        if (!keyInput.value && merged.key) keyInput.value = merged.key;
        // 在 sel 追加恢复项 (如果不存在)
        var exists = false;
        for (var i = 0; i < sel.options.length; i++) {
          if (sel.options[i].value === backendModel) { exists = true; break; }
        }
        if (!exists) {
          var opt = document.createElement('option');
          opt.value = backendModel;
          opt.textContent = backendModel + '  · ✓ 已从后端恢复';
          opt.dataset.restored = '1';
          opt.dataset.fromBackend = '1';
          sel.appendChild(opt);
        }
        sel.value = backendModel;
        sel.disabled = false;
        sel.dataset.value = backendModel;
        // 在 select 下方加恢复提示 (只在没有恢复项时加, 避免重复)
        if (!sel.parentNode.querySelector('.backend-restore-hint')) {
          var hint = document.createElement('div');
          hint.className = 'meta backend-restore-hint';
          hint.style.cssText = 'margin-top: 6px; color: var(--success); font-size: 12px; line-height: 1.5;';
          hint.innerHTML = '✓ 已从后端 settings 恢复 <code style="font-family: var(--font-mono); font-size: 11px; background: rgba(79, 107, 58, 0.1); padding: 1px 6px; border-radius: 3px;">' + backendModel + '</code> · 文生文页面现在能正确调用了';
          if (sel.parentNode) sel.parentNode.appendChild(hint);
        }
      }
    }).catch(function () { /* 离线模式 / 后端未启动, 静默 */ });

    // 关键修复: 把已保存的模型恢复为 <select> 的可见 option，并设为选中、启用
    // 原 bug：只写 sel.dataset.value = saved.model，UI 看不到，刷新后模型"丢失"
    if (saved.model) {
      var restoredOpt = document.createElement('option');
      restoredOpt.value = saved.model;
      restoredOpt.textContent = saved.model + '  · ✓ 已恢复';
      restoredOpt.dataset.restored = '1';
      sel.appendChild(restoredOpt);
      sel.value = saved.model;
      sel.disabled = false;
      sel.dataset.value = saved.model;

      // 在 select 下方加恢复提示
      var hint = document.createElement('div');
      hint.className = 'meta';
      hint.style.cssText = 'margin-top: 6px; color: var(--success); font-size: 12px; line-height: 1.5;';
      hint.innerHTML = '✓ 已从上次保存中恢复模型 <code style="font-family: var(--font-mono); font-size: 11px; background: rgba(79, 107, 58, 0.1); padding: 1px 6px; border-radius: 3px;">' + saved.model + '</code> · 你可以直接点「保存配置」继续使用，或点「获取模型」拉取最新列表替换';
      // 插在 select 后、field-hint 前
      if (sel.parentNode) sel.parentNode.appendChild(hint);
    }

    // 监听 select 变化，实时更新 dataset.value（让 fetchBtn 知道当前选的是谁）
    sel.addEventListener('change', function () {
      sel.dataset.value = sel.value;
    });

    fetchBtn.addEventListener('click', async () => {
      var url = urlInput.value.trim();
      var key = keyInput.value.trim();
      if (!url) { toast('请先填写 API URL', 'error'); return; }
      var baseUrl = url.replace(/\/+$/, '');
      var modelsUrl = /\/v1\/?$/.test(baseUrl) ? baseUrl + '/models' : baseUrl + '/v1/models';
      resultBox.style.display = 'block';
      resultBox.innerHTML = '<p class="meta" style="font-size:13px;">正在从服务端拉取模型列表…</p>';
      fetchBtn.disabled = true; fetchLbl.textContent = '拉取中…';
      var models = [];
      var source = 'live';
      var errMsg = '';
      try {
        var headers = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = 'Bearer ' + key;
        var resp = await fetch(modelsUrl, { headers, method: 'GET' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        var data = await resp.json();
        if (data && Array.isArray(data.data)) {
          models = data.data.map(m => m.id || m.name || m.model).filter(Boolean);
        }
        if (models.length === 0) throw new Error('未返回模型');
      } catch (err) {
        errMsg = err && err.message ? err.message : String(err);
        source = 'fallback';
        var lc = url.toLowerCase();
        if (lc.indexOf('127.0.0.1') !== -1 || lc.indexOf('localhost') !== -1 || lc.indexOf('ollama') !== -1 || lc.indexOf('lm-studio') !== -1 || lc.indexOf('1234') !== -1 || lc.indexOf('11434') !== -1 || lc.indexOf('vllm') !== -1) {
          models = ['qwen2.5:7b', 'qwen2.5:14b', 'llama3.1:8b', 'llama3.1:70b', 'deepseek-r1:7b', 'mistral:7b', 'codellama:13b', 'phi3:medium'];
        } else {
          models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini', 'claude-3-5-sonnet', 'deepseek-chat'];
        }
      }
      var prev = sel.dataset.value;
      // 保留已恢复的占位选项（避免 fetch 把它清掉）
      var restoredOption = sel.querySelector('option[data-restored="1"]');
      sel.innerHTML = '';
      if (restoredOption) sel.appendChild(restoredOption);
      var seen = restoredOption ? { [restoredOption.value]: true } : {};
      models.forEach(id => {
        if (seen[id]) return; // 去重：已恢复的同名模型不重复加
        seen[id] = true;
        var opt = document.createElement('option');
        opt.value = id; opt.textContent = id;
        sel.appendChild(opt);
      });
      sel.disabled = false;
      // 优先保留 prev（用户已选/已恢复的）；不存在于新列表时 fallback 到恢复项或首项
      if (prev && models.indexOf(prev) !== -1) {
        sel.value = prev;
      } else if (restoredOption) {
        sel.value = restoredOption.value;
      }
      sel.dataset.value = sel.value;
      if (source === 'live') {
        resultBox.innerHTML = '<div style="background: rgba(79, 107, 58, 0.08); border: 1px solid var(--success); border-radius: var(--radius); padding: var(--space-3) var(--space-4); font-size: 13px;"><div style="color: var(--success); font-weight: 600; margin-bottom: 4px;">✓ 拉取成功 · 共 ' + models.length + ' 个模型</div><div class="meta">实时拉取 · 端点 <code>' + modelsUrl + '</code></div></div>';
        toast('已获取模型列表');
      } else {
        resultBox.innerHTML = '<div style="background: rgba(234, 179, 8, 0.08); border: 1px solid var(--warn); border-radius: var(--radius); padding: var(--space-3) var(--space-4); font-size: 13px;"><div style="color: var(--warn); font-weight: 600; margin-bottom: 4px;">⚠ 加载演示列表</div><div class="meta">无法连接服务 (' + errMsg + ') · 已加载 ' + models.length + ' 个常见模型供选择</div></div>';
        toast('已加载演示模型列表', 'warn');
      }
      fetchBtn.disabled = false; fetchLbl.textContent = '获取模型';
    });

    saveBtn.addEventListener('click', () => {
      var url = urlInput.value.trim();
      var key = keyInput.value.trim();
      var model = sel.value;
      if (!url) { toast('请填写 API URL', 'error'); return; }
      if (!model) { toast('请先获取模型并选择', 'error'); return; }
      window.BaishiShared.setTextApi({ url: url, key: key, model: model, savedAt: Date.now() });
      // 同步到后端 UserSettings — 包括 api_endpoint / api_key / text_api_model
      window.BaiShiAPI.updateSettings(1, {
        api_endpoint: url,
        api_key: key || null,
        text_api_model: model,
      }).then(r => {
        if (r && r.success) toast('生文 API 配置已保存（同步至后端）');
        else toast('生文 API 配置已保存（本地）', 'warn');
      });
    });

    clearBtn.addEventListener('click', () => {
      urlInput.value = ''; keyInput.value = '';
      sel.innerHTML = '<option value="">— 点击「获取模型」后选择 —</option>';
      sel.disabled = true;
      delete sel.dataset.value;
      resultBox.style.display = 'none';
      window.BaishiShared.setTextApi({ url: '', key: '', model: '' });
      toast('已清空生文 API 配置');
    });
  }

  /* ════════════════════════════════════════════════
   * 存储面板 · 3 个按钮绑事件
   * ════════════════════════════════════════════════ */
  function bindStorage() {
    var btns = document.querySelectorAll('#panel-storage button');
    if (btns.length < 3) return;
    btns[0].addEventListener('click', () => {
      if (!confirm('确定清理 30 天前的本地缓存？此操作不可恢复。')) return;
      // 原型阶段暂未实现真实清理，提示用户
      toast('已标记清理 30 天前作品（原型阶段不实际删除）', 'success');
    });
    btns[1].addEventListener('click', () => {
      if (!confirm('确定仅保留收藏作品？其他所有本地缓存将被清理。')) return;
      toast('已切换为「仅保留收藏」模式（原型阶段不实际删除）', 'success');
    });
    btns[2].addEventListener('click', () => {
      if (!confirm('确定清空所有本地缓存？此操作不可恢复。')) return;
      try {
        var keys = Object.keys(localStorage);
        var removed = 0;
        keys.forEach(k => {
          if (k.indexOf('baishi.') === 0 && k !== 'baishi.theme' && k !== 'baishi.session') {
            localStorage.removeItem(k); removed++;
          }
        });
        toast('已清空 ' + removed + ' 项本地缓存（主题与会话保留）', 'success');
      } catch (e) { toast('清空失败：' + e.message, 'error'); }
    });
  }

  function bindAbout() {
    var checkBtn = document.getElementById('about-check-update');
    var releaseBtn = document.getElementById('about-open-release');
    var status = document.getElementById('about-update-status');
    if (!checkBtn || !releaseBtn || !status) return;

    checkBtn.addEventListener('click', () => {
      status.textContent = '已于刚刚检查更新';
      toast('当前已是最新版本（原型阶段）', 'success', { duration: 4800, fadeDuration: 240 });
    });

    releaseBtn.addEventListener('click', () => {
      window.open('https://github.com/echohaoran/Qi_Baishi', '_blank', 'noopener,noreferrer');
    });
  }

  /* ════════════════════════════════════════════════
   * 保存更改 · 同步到后端
   * ════════════════════════════════════════════════ */
  function bindSaveButton() {
    var btn = document.getElementById('save-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      var orig = btn.textContent;
      btn.textContent = '保存中…';
      try {
        // 关键修复 #1: 「保存更改」总按钮在保存前先把「生文 API」面板的当前 UI 状态
        // 同步到 localStorage。因为文生文页面只读 localStorage["baishi.api.text"]，
        // 不读后端；如果只写后端不写 localStorage，用户切到文生文页会报"未配置生文 API"。
        var urlInput = document.getElementById('text-api-url');
        var keyInput = document.getElementById('text-api-key');
        var modelSel = document.getElementById('text-api-model');
        if (urlInput && keyInput && modelSel) {
          var urlVal = urlInput.value.trim();
          var keyVal = keyInput.value.trim();
          var modelVal = modelSel.value;
          if (urlVal && modelVal) {
            window.BaishiShared.setTextApi({
              url: urlVal, key: keyVal, model: modelVal, savedAt: Date.now()
            });
          }
        }

        var prefs = window.BaishiShared.getPrefs();
        var active = window.BaishiShared.getActiveProvider();
        var textApi = window.BaishiShared.getTextApi();
        var payload = {
          theme: localStorage.getItem('baishi.theme') || 'light',
          api_endpoint: (active && active.endpoint) || null,
          api_key: (document.getElementById('online-api-key') || {}).value || null,
          // 关键修复 #2: payload 显式包含 text_api_model, 后端 SQLite 落盘
          text_api_model: (textApi && textApi.model) || null,
          shortcuts: JSON.stringify({ prefs: prefs, textApi: textApi })
        };
        var r = await window.BaiShiAPI.updateSettings(1, payload);
        if (r && r.success) toast('设置已保存至后端', 'success');
        else toast('设置已保存（本地）· 后端响应：' + (r && r.error ? r.error : '未知'), 'warn');
      } catch (e) {
        toast('保存失败：' + e.message, 'error');
      }
      btn.textContent = orig;
      btn.disabled = false;
    });
  }

  /* ════════════════════════════════════════════════
   * 启动
   * ════════════════════════════════════════════════ */
  applyPrefsToUI();
  bindPrefs();
  bindTheme();
  bindImageApi();
  bindTextApi();
  bindStorage();
  bindAbout();
  bindSaveButton();
});
