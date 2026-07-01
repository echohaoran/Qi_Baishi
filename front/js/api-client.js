/* ───────────────────────────────────────────────────────────────────
 * api-client.js — 白石 BaiShi 统一 API 客户端
 *
 * 封装所有后端 HTTP API 调用，遵循 server.md 契约。
 * 默认基址 http://localhost:3456
 *
 * 使用方式：
 *   const result = await window.BaiShiAPI.textToImage({ prompt: '…', count: 3 });
 *   if (result.success) { // result.data.images -> [{ id, url, b64_json, seed }]
 *   }
 *
 * 设计原则：
 *   - 前端只传「最终参数」，由后端 inference 引擎做模板替换
 *   - 用户填的 endpoint / api_key / request_body 模板从 localStorage 读出
 *     并合并到每次生图请求里
 * ──────────────────────────────────────────────────────────────── */

(function () {
  var BASE = 'http://localhost:3456';

  async function api(path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    if (options.headers) Object.assign(headers, options.headers);

    var res;
    try {
      res = await fetch(BASE + path, {
        method: options.method || 'GET',
        headers: headers,
        body: options.body || undefined,
      });
    } catch (err) {
      return { success: false, error: '网络错误：' + (err && err.message ? err.message : err) };
    }

    // 后端错误 (413/415/500 等) 会返回 text/plain 而非 application/json,
    // 直接 res.json() 会抛 SyntaxError → 显示为模糊的 "响应不是合法 JSON"。
    // 先看 content-type, 拿到真实错误文本。
    var ct = (res.headers.get('content-type') || '').toLowerCase();
    var raw = await res.text();
    if (ct.indexOf('application/json') === -1) {
      // 非 JSON: 把真实错误透传给用户 (e.g. axum 413 "Failed to buffer the request body: length limit exceeded")
      var snippet = raw ? raw.slice(0, 240) : '(空响应)';
      return {
        success: false,
        status: res.status,
        error: '后端返回 ' + res.status + ' (' + ct.split(';')[0] + '): ' + snippet,
      };
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      return { success: false, status: res.status, error: '响应不是合法 JSON: ' + (raw ? raw.slice(0, 120) : '(空响应)') };
    }
  }

  // 取出当前激活的供应商配置（endpoint + key + request_body）
  function getImageConfig(mode) {
    mode = mode || 't2i';
    var p = (window.BaishiShared && window.BaishiShared.getActiveProvider())
            || { endpoint: '', requestBody: '' };
    var apiKey = (window.BaishiShared && window.BaishiShared.getImageApiKey) ? window.BaishiShared.getImageApiKey() : '';
    var requestBody = (mode === 'i2i')
      ? (p.requestBodyI2I || p.requestBodyT2I || '')
      : (p.requestBodyT2I || '');
    return {
      endpoint: p.endpoint || '',
      request_body: requestBody,
      api_key: apiKey || '',
      mode: mode,
    };
  }

  window.BaiShiAPI = {
    /* ─── 健康检查 ──────────────────────────── */
    health: function () { return api('/api/health'); },

    /* ─── 鉴权（API Key 鉴权，未来用） ───────── */
    register: function (name, email, password) {
      return api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: name, email: email, password: password })
      });
    },
    login: function (emailOrUsername, password) {
      return api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email_or_username: emailOrUsername, password: password })
      });
    },
    logout: function (sessionToken) {
      return api('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ session_token: sessionToken })
      });
    },

    /* ─── 生成 ──────────────────────────── */
    textToImage: function (params) {
      var cfg = getImageConfig('t2i');
      var apiKey = (params.api_key || cfg.api_key || '').trim();
      var payload = {
        prompt: params.prompt,
        negative_prompt: params.negative_prompt || null,
        style_id: params.style_id || null,
        seed: params.seed || null,
        steps: params.steps || 30,
        cfg_scale: params.cfg_scale != null ? params.cfg_scale : 0.75,
        aspect: params.aspect || '1:1',
        count: params.count || 3,
        endpoint: cfg.endpoint || null,
        api_key: apiKey || null,
        request_body: cfg.request_body || null,
        mode: 't2i',
      };
      return api('/api/generate/text', { method: 'POST', body: JSON.stringify(payload) });
    },

    imageToImage: function (params) {
      var cfg = getImageConfig('i2i');
      var apiKey = (params.api_key || cfg.api_key || '').trim();
      var payload = {
        prompt: params.prompt,
        negative_prompt: params.negative_prompt || null,
        style_id: params.style_id || null,
        seed: params.seed || null,
        steps: params.steps || 30,
        cfg_scale: params.cfg_scale != null ? params.cfg_scale : 0.75,
        aspect: params.aspect || '1:1',
        // 重点：Agnes I2I 规范要求 extra_body.image: [URL/Base64] 数组
        // 单图：reference_image；多图：reference_images 数组
        reference_image: params.reference_image || null,
        reference_images: params.reference_images || null,
        strength: params.strength != null ? params.strength : 0.5,
        count: params.count || 1,
        endpoint: cfg.endpoint || null,
        api_key: apiKey || null,
        request_body: cfg.request_body || null,
        mode: 'i2i',
      };
      return api('/api/generate/image', { method: 'POST', body: JSON.stringify(payload) });
    },

    cancelGeneration: function (jobId) {
      return api('/api/generate/cancel', {
        method: 'POST',
        body: JSON.stringify({ job_id: jobId }),
      });
    },

    /* ─── 文本润色（调用户配置的生文 API） ──────────── */
    enhancePrompt: function (prompt) {
      var textApi = (window.BaishiShared && window.BaishiShared.getTextApi()) || {};
      if (!textApi.url) {
        return Promise.resolve({ success: false, error: '未配置生文 API · 请先在「设置 → 生文 API」中填写 URL' });
      }
      if (!textApi.model) {
        return Promise.resolve({ success: false, error: '未选择模型 · 请先在「设置 → 生文 API」中选择模型并保存' });
      }
      return api('/api/text/enhance', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt,
          api_url: textApi.url,
          api_key: textApi.key || '',
          model: textApi.model,
        }),
      });
    },

    /* ─── 妙笔生花 · 生成文案（调用户配置的生文 API） ───── */
    generateCopywriting: function (prompt, opts) {
      opts = opts || {};
      var textApi = (window.BaishiShared && window.BaishiShared.getTextApi()) || {};
      if (!textApi.url) {
        return Promise.resolve({ success: false, error: '未配置生文 API · 请先在「设置 → 生文 API」中填写 URL' });
      }
      if (!textApi.model) {
        return Promise.resolve({ success: false, error: '未选择模型 · 请先在「设置 → 生文 API」中选择模型并保存' });
      }
      return api('/api/text/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt,
          system_prompt: opts.system_prompt || '你是一位专业的中文文案写手，擅长根据用户需求撰写高质量的中文文案。要求：①语言生动、语感好；②根据用户指定的风格（鲁迅风、张爱玲风、商业文案等）调整语气；③结构清晰，逻辑通顺；④遵守用户给出的字数限制。',
          api_url: textApi.url,
          api_key: textApi.key || '',
          model: textApi.model,
          max_tokens: opts.max_tokens || 800,
        }),
      });
    },

    /* ─── 历史 ──────────────────────────── */
    listHistory: function (page, filter) {
      var qs = [];
      qs.push('user_id=1');
      if (page) qs.push('page=' + page);
      if (filter) qs.push('filter=' + encodeURIComponent(filter));
      return api('/api/history?' + qs.join('&'));
    },

    toggleFavorite: function (artworkId) {
      return api('/api/history/favorite', {
        method: 'POST',
        body: JSON.stringify({ artwork_id: artworkId }),
      });
    },

    /* ─── 预设 ──────────────────────────── */
    listPresets: function (category) {
      var qs = category ? '?category=' + encodeURIComponent(category) : '';
      return api('/api/presets' + qs);
    },

    savePreset: function (data) {
      return api('/api/presets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /* ─── 设置 ──────────────────────────── */
    getSettings: function (userId) {
      return api('/api/settings/' + (userId || 1));
    },

    updateSettings: function (userId, data) {
      return api('/api/settings/' + (userId || 1), {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /* ─── 存储 ──────────────────────────── */
    getStorageInfo: function () {
      return api('/api/storage/info');
    },

    /* ─── 历史作品删除 ─────────────────────── */
    // 单删 · body: { id: 57 }
    deleteArtwork: function (id) {
      return api('/api/history/delete', {
        method: 'POST',
        body: JSON.stringify({ id: id }),
      });
    },
    // 批量删 · body: { ids: [1,2,3] }
    deleteArtworksBatch: function (ids) {
      return api('/api/history/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: ids || [] }),
      });
    },
  };
})();
