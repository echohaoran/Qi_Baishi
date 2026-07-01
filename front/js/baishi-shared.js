/* ───────────────────────────────────────────────────────────────────
 * baishi-shared.js — 白石 Baishi 前后端共享配置
 *
 * 提供所有页面通用的：
 *   1. API 配置加载/保存 (供应商 + 偏好)
 *   2. 请求体模板替换（把 {{prompt}} / {{n}} / {{size}} / {{seed}} 替换为实际值）
 *   3. 后端地址常量
 *
 * 持久化结构：
 *   baishi.api.image.active  : String   当前激活的供应商名称
 *   baishi.api.image.providers: Array    用户保存的供应商模板
 *   baishi.api.text          : Object   生文 API 配置 { url, key, model }
 *   baishi.prefs             : Object   8 个偏好项
 *   baishi.session           : Object   鉴权会话 { user_id, token }
 * ──────────────────────────────────────────────────────────────── */

(function () {
  var STORAGE = {
    IMAGE_PROVIDERS: 'baishi.api.image.providers',
    IMAGE_ACTIVE: 'baishi.api.image.active',
    IMAGE_API_KEY: 'baishi.api.image.key',
    TEXT_API: 'baishi.api.text',
    PREFS: 'baishi.prefs',
    SESSION: 'baishi.session',
  };

  var DEFAULT_PREFS = {
    defaultAspect: '1:1',
    defaultCount: '3',
    autoSaveHistory: true,
    highPrecision: true,
    brushAnimation: true,
    sizeBase: 'logical',
    notifications: true,
    soundEnabled: false,
  };

  var DEFAULT_PROVIDERS = [
    {
      name: 'OpenAI DALL-E 3',
      endpoint: 'https://api.openai.com/v1/images/generations',
      requestBodyT2I: JSON.stringify({
        model: 'dall-e-3',
        prompt: '<替换为你的提示词>',
        n: 1,
        size: '1024x1024',
        quality: 'standard'
      }, null, 2),
      requestBodyI2I: JSON.stringify({
        model: 'dall-e-2',
        prompt: '<替换为你的提示词>',
        n: 1,
        size: '1024x1024',
        image: '<替换为参考图 dataURL / URL>'
      }, null, 2),
      builtin: true
    },
    {
      name: 'Stability AI (SDXL)',
      endpoint: 'https://api.stability.ai/v2beta/stable-image/generate/core',
      requestBodyT2I: JSON.stringify({
        prompt: '<替换为你的提示词>',
        aspect_ratio: '1:1',
        seed: 0,
        output_format: 'jpeg',
        negative_prompt: ''
      }, null, 2),
      requestBodyI2I: JSON.stringify({
        prompt: '<替换为你的提示词>',
        image: '<替换为参考图 dataURL / URL>',
        strength: 0.7,
        aspect_ratio: '1:1',
        seed: 0,
        output_format: 'jpeg',
        negative_prompt: ''
      }, null, 2),
      builtin: true
    },
    {
      name: 'SiliconFlow (FLUX)',
      endpoint: 'https://api.siliconflow.cn/v1/images/generations',
      requestBodyT2I: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt: '<替换为你的提示词>',
        image_size: '1024x1024',
        num_inference_steps: 20,
        guidance_scale: 7.5
      }, null, 2),
      requestBodyI2I: JSON.stringify({
        model: 'black-forest-labs/FLUX.1-schnell',
        prompt: '<替换为你的提示词>',
        image: '<替换为参考图 dataURL / URL>',
        strength: 0.7,
        image_size: '1024x1024',
        num_inference_steps: 20,
        guidance_scale: 7.5
      }, null, 2),
      builtin: true
    }
  ];

  // ─── 工具 ────────────────────────────────────────────
  function safeGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  // ─── 供应商 ──────────────────────────────────────────
  // 加载并把老字段 requestBody 自动迁移到 requestBodyT2I
  function loadProviders() {
    var arr = safeGet(STORAGE.IMAGE_PROVIDERS, null);
    if (Array.isArray(arr) && arr.length) {
      var dirty = false;
      arr.forEach(function (p) {
        if (p.requestBody && !p.requestBodyT2I) {
          p.requestBodyT2I = p.requestBody;
          if (!p.requestBodyI2I) p.requestBodyI2I = p.requestBody;
          dirty = true;
        }
        if (!p.requestBodyT2I) p.requestBodyT2I = '';
        if (!p.requestBodyI2I) p.requestBodyI2I = '';
      });
      if (dirty) safeSet(STORAGE.IMAGE_PROVIDERS, arr);
      return arr;
    }
    safeSet(STORAGE.IMAGE_PROVIDERS, DEFAULT_PROVIDERS);
    return DEFAULT_PROVIDERS.slice();
  }
  function saveProviders(list) { return safeSet(STORAGE.IMAGE_PROVIDERS, list); }
  function getActiveProvider() {
    var providers = loadProviders();
    var name = safeGet(STORAGE.IMAGE_ACTIVE, null);
    if (!name) return null;
    return providers.find(function (p) { return p.name === name; }) || null;
  }
  function setActiveProvider(name) { return safeSet(STORAGE.IMAGE_ACTIVE, name); }

  // ─── 生图 API Key（独立存储，便于生图页读出） ───
  function getImageApiKey() {
    try { return localStorage.getItem(STORAGE.IMAGE_API_KEY) || ''; } catch (e) { return ''; }
  }
  function setImageApiKey(k) {
    try { if (k) localStorage.setItem(STORAGE.IMAGE_API_KEY, k); else localStorage.removeItem(STORAGE.IMAGE_API_KEY); return true; } catch (e) { return false; }
  }

  // ─── 生文 API ────────────────────────────────────────
  function getTextApi() { return safeGet(STORAGE.TEXT_API, { url: '', key: '', model: '' }); }
  function setTextApi(cfg) { return safeSet(STORAGE.TEXT_API, cfg); }

  // ─── 偏好 ────────────────────────────────────────────
  function getPrefs() {
    var p = safeGet(STORAGE.PREFS, null);
    if (!p || typeof p !== 'object') return Object.assign({}, DEFAULT_PREFS);
    return Object.assign({}, DEFAULT_PREFS, p);
  }
  function setPref(key, value) {
    var p = getPrefs();
    p[key] = value;
    return safeSet(STORAGE.PREFS, p);
  }
  function setPrefs(p) { return safeSet(STORAGE.PREFS, Object.assign({}, DEFAULT_PREFS, p || {})); }

  // ─── 模板替换 ────────────────────────────────────────
  // 把 {{prompt}} / {{n}} / {{size}} / {{seed}} / {{aspect}} / {{width}} / {{height}} 等占位符
  // 替换为生成时实际值，保留其它字段原样
  function applyTemplate(template, vars) {
    if (!template) return '';
    var result = template;
    Object.keys(vars).forEach(function (k) {
      var v = vars[k];
      if (v === undefined || v === null) v = '';
      result = result.split('{{' + k + '}}').join(String(v));
    });
    return result;
  }

  // ─── 比例 → 尺寸 ────────────────────────────────────
  // 与后端 AspectRatio::size_string_with 严格对应 (steps >= 50 = 高精度)
  // 普通模式: SDXL 默认尺寸 (≈ 1024² 像素)
  // 高精度模式: 1.5× 长边 (≈ 2.25× 像素, 适配 SDXL up-scale / FLUX.1-dev 高分辨率)
  var ASPECT_SIZE_NORMAL = {
    '1:1':  { w: 1024, h: 1024, s: '1024x1024' },
    '3:4':  { w: 1152, h: 1536, s: '1152x1536' },
    '4:5':  { w: 1024, h: 1280, s: '1024x1280' },
    '4:3':  { w: 1152, h: 864,  s: '1152x864'  },
    '16:9': { w: 1216, h: 684,  s: '1216x684'  },
    '9:16': { w: 684,  h: 1216, s: '684x1216'  },
    '21:9': { w: 1344, h: 576,  s: '1344x576'  },
  };
  var ASPECT_SIZE_HIGH = {
    '1:1':  { w: 1536, h: 1536, s: '1536x1536' },
    '3:4':  { w: 1536, h: 2048, s: '1536x2048' },
    '4:5':  { w: 1280, h: 1600, s: '1280x1600' },
    '4:3':  { w: 1536, h: 1152, s: '1536x1152' },
    '16:9': { w: 1920, h: 1080, s: '1920x1080' },
    '9:16': { w: 1080, h: 1920, s: '1080x1920' },
    '21:9': { w: 2048, h: 864,  s: '2048x864'  },
  };
  function aspectToSize(aspect, highPrecision) {
    var map = highPrecision ? ASPECT_SIZE_HIGH : ASPECT_SIZE_NORMAL;
    return map[aspect] || (highPrecision ? ASPECT_SIZE_HIGH['1:1'] : ASPECT_SIZE_NORMAL['1:1']);
  }

  // ─── 组装生图请求体 ──────────────────────────────────
  // 用户填的 request_body 模板 + 实际值 = 最终请求体
  // 返回 { endpoint, headers, body }，调用方可直接 fetch
  // mode: 't2i' (文生图) 或 'i2i' (图生图)，决定用哪份模板
  function buildImageRequest(p) {
    var provider = getActiveProvider();
    var prefs = getPrefs();
    var mode = p.mode || 't2i';
    var aspect = p.aspect || prefs.defaultAspect || '1:1';
    var count  = p.count  || parseInt(prefs.defaultCount, 10) || 3;
    var steps  = p.steps  || 30;
    var cfg    = p.cfg_scale != null ? p.cfg_scale : 0.75;
    var seed   = p.seed != null && p.seed > 0 ? p.seed : 0;
    var negative = p.negative_prompt || '';
    // 高精度模式开关: steps >= 50 即视为高精度
    //   1) 优先尊重调用方传的高精度状态 (p.high_precision)
    //   2) 其次读用户偏好 prefs.highPrecision
    //   3) 默认 false
    var isHighPrecision = p.high_precision != null
      ? !!p.high_precision
      : (steps >= 50 || (prefs.highPrecision && steps >= 30));
    var size = aspectToSize(aspect, isHighPrecision);

    var endpoint = (p.endpoint || (provider && provider.endpoint) || '').trim();
    var apiKey   = (p.api_key || '').trim();
    // 文生图 / 图生图各自取各自的模板；若 I2I 模板为空则回退到 T2I
    var t2iBody = (provider && provider.requestBodyT2I) || '';
    var i2iBody = (provider && provider.requestBodyI2I) || '';
    var explicitBody = p.request_body; // 调用方显式传入的最高优先
    var template;
    if (explicitBody && explicitBody.trim()) {
      template = explicitBody;
    } else if (mode === 'i2i') {
      template = i2iBody || t2iBody;
    } else {
      template = t2iBody;
    }

    // 单图：reference_image (dataURL / URL) → 包装为单元素数组 → JSON 字符串
    // 多图：reference_images (dataURL / URL 数组) → 直接 JSON 字符串
    // 后端用 {{images}} 占位符接收，自动适配 Agnes I2I 规范 (extra_body.image: [...])
    var imageArr;
    if (p.reference_images && p.reference_images.length) {
      imageArr = p.reference_images;
    } else if (p.reference_image) {
      imageArr = [p.reference_image];
    } else {
      imageArr = [];
    }
    var imagesJson = JSON.stringify(imageArr);  // "[\"data:...\", ...]" / "[]"

    var body = applyTemplate(template, {
      prompt: p.prompt || '',
      negative_prompt: negative,
      n: count,
      count: count,
      seed: seed,
      steps: steps,
      cfg_scale: cfg,
      aspect: aspect,
      size: size.s,
      width: size.w,
      height: size.h,
      reference_image: imageArr[0] || '',
      image: imageArr[0] || '',   // 兼容 OpenAI/Stability 用 image 字段名
      images: imagesJson,          // 适配 Agnes I2I: extra_body.image: {{images}}
      reference_images: imagesJson, // 备选占位符
      strength: p.strength != null ? p.strength : 0.5,
      high_precision: isHighPrecision ? 'true' : 'false',
    });

    var headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;

    return { endpoint: endpoint, headers: headers, body: body, provider: provider, mode: mode };
  }

  // ─── 会话 ────────────────────────────────────────────
  function getSession() { return safeGet(STORAGE.SESSION, null); }
  function setSession(s) { return safeSet(STORAGE.SESSION, s); }
  function clearSession() { try { localStorage.removeItem(STORAGE.SESSION); } catch (e) {} }

  // 暴露
  window.BaishiShared = {
    STORAGE: STORAGE,
    DEFAULT_PREFS: DEFAULT_PREFS,
    DEFAULT_PROVIDERS: DEFAULT_PROVIDERS,
    // 供应商
    loadProviders: loadProviders,
    saveProviders: saveProviders,
    getActiveProvider: getActiveProvider,
    setActiveProvider: setActiveProvider,
    // 生图 API Key
    getImageApiKey: getImageApiKey,
    setImageApiKey: setImageApiKey,
    // 生文 API
    getTextApi: getTextApi,
    setTextApi: setTextApi,
    // 偏好
    getPrefs: getPrefs,
    setPref: setPref,
    setPrefs: setPrefs,
    // 模板与组装
    applyTemplate: applyTemplate,
    aspectToSize: aspectToSize,
    buildImageRequest: buildImageRequest,
    // 会话
    getSession: getSession,
    setSession: setSession,
    clearSession: clearSession,
  };
})();
