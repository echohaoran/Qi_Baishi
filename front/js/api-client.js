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

  function getTauriInvoke() {
    if (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') {
      return window.__TAURI_INTERNALS__.invoke;
    }
    if (window.__TAURI__ && window.__TAURI__.core && typeof window.__TAURI__.core.invoke === 'function') {
      return window.__TAURI__.core.invoke;
    }
    if (window.__TAURI__ && typeof window.__TAURI__.invoke === 'function') {
      return window.__TAURI__.invoke;
    }
    return null;
  }

  async function invokeCommand(cmd, args, mapper) {
    var invoke = getTauriInvoke();
    if (!invoke) return null;
    try {
      var result = await invoke(cmd, args || {});
      return mapper ? mapper(result) : { success: true, data: result };
    } catch (err) {
      return {
        success: false,
        error: 'Tauri invoke 失败（' + cmd + '）：' + ((err && err.message) ? err.message : String(err)),
      };
    }
  }

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
      var msg = (err && err.message ? err.message : String(err || '未知错误'));
      var tauriReady = !!getTauriInvoke();
      return {
        success: false,
        error: tauriReady
          ? ('本地 HTTP 服务不可达（已检测到 Tauri，可是当前请求仍走到 ' + BASE + path + '）：' + msg)
          : ('网络错误：' + msg + '（未检测到 Tauri invoke，当前运行环境可能不是打包态，或注入失败。诊断：__TAURI__=' + !!window.__TAURI__ + '，__TAURI_INTERNALS__=' + !!window.__TAURI_INTERNALS__ + '）')
      };
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

  async function invokeOrApi(cmd, payload, path) {
    var tauriRes = await invokeCommand(cmd, { req: payload }, function (result) {
      return { success: true, data: result };
    });
    if (tauriRes && tauriRes.success) return tauriRes;
    return api(path, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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
      };
      return invokeOrApi('generate_text_to_image_remote', payload, '/api/generate/text');
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
      };
      return invokeOrApi('generate_image_to_image_remote', payload, '/api/generate/image');
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
      var payload = {
        prompt: prompt,
        api_url: textApi.url,
        api_key: textApi.key || '',
        model: textApi.model,
      };
      return invokeOrApi('enhance_text_remote', payload, '/api/text/enhance');
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
      var payload = {
        prompt: prompt,
        system_prompt: opts.system_prompt || '你是一位专业的中文文案写手，擅长根据用户需求撰写高质量的中文文案。要求：①语言生动、语感好；②根据用户指定的风格（鲁迅风、张爱玲风、商业文案等）调整语气；③结构清晰，逻辑通顺；④遵守用户给出的字数限制。',
        api_url: textApi.url,
        api_key: textApi.key || '',
        model: textApi.model,
        max_tokens: opts.max_tokens || 800,
      };
      return invokeOrApi('generate_text_remote', payload, '/api/text/generate');
    },

    testImageApiConnection: function (params) {
      var payload = {
        endpoint: params.endpoint,
        api_key: params.api_key || '',
        body_json: params.body_json,
      };
      return invokeCommand('test_image_api_connection', { req: payload }, function (result) {
        return { success: true, data: result };
      }).then(function (tauriRes) {
        if (tauriRes) return tauriRes;
        var parsed = JSON.parse(payload.body_json || '{}');
        var headers = { 'Content-Type': 'application/json' };
        if (payload.api_key) headers.Authorization = 'Bearer ' + payload.api_key;
        var startedAt = Date.now();
        return fetch(payload.endpoint, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(parsed),
        }).then(function (resp) {
          return {
            success: true,
            data: {
              status: resp.status,
              content_type: resp.headers.get('content-type') || '',
              took_ms: Date.now() - startedAt,
            },
          };
        });
      }).catch(function (err) {
        return { success: false, error: normalizeInvokeError(err) };
      });
    },

    /* ─── 历史 ──────────────────────────── */
    listHistory: async function (page, filter) {
      var tauriRes = await invokeCommand('list_history', {
        sessionToken: null,
        page: page || 1,
        filter: filter || null,
      }, function (result) {
        return { success: true, data: result };
      });
      if (tauriRes) return tauriRes;
      var qs = [];
      qs.push('user_id=1');
      if (page) qs.push('page=' + page);
      if (filter) qs.push('filter=' + encodeURIComponent(filter));
      return api('/api/history?' + qs.join('&'));
    },

    toggleFavorite: async function (artworkId) {
      var tauriRes = await invokeCommand('toggle_favorite', { artworkId: artworkId }, function (result) {
        return { success: true, data: result };
      });
      if (tauriRes) return tauriRes;
      return api('/api/history/favorite', {
        method: 'POST',
        body: JSON.stringify({ artwork_id: artworkId }),
      });
    },

    /* ─── 预设 ──────────────────────────── */
    listPresets: async function (category) {
      var tauriRes = await invokeCommand('list_presets', { category: category || null }, function (result) {
        return { success: true, data: result };
      });
      if (tauriRes) return tauriRes;
      var qs = category ? '?category=' + encodeURIComponent(category) : '';
      return api('/api/presets' + qs);
    },

    savePreset: async function (data) {
      var tauriRes = await invokeCommand('save_preset', {
        name: data.name,
        category: data.category,
        prompt: data.prompt,
        aspect: data.aspect || null,
      }, function (result) {
        return { success: true, data: result };
      });
      if (tauriRes) return tauriRes;
      return api('/api/presets', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /* ─── 设置 ──────────────────────────── */
    getSettings: async function (userId) {
      var tauriRes = await invokeCommand('get_settings', { userId: userId || 1 }, function (result) {
        return { success: true, data: result };
      });
      if (tauriRes) return tauriRes;
      return api('/api/settings/' + (userId || 1));
    },

    updateSettings: async function (userId, data) {
      var tauriRes = await invokeCommand('update_settings', {
        userId: userId || 1,
        settings: data,
      }, function () {
        return { success: true };
      });
      if (tauriRes) return tauriRes;
      return api('/api/settings/' + (userId || 1), {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },

    /* ─── 存储 ──────────────────────────── */
    getStorageInfo: async function () {
      var tauriRes = await invokeCommand('get_storage_info', {}, function (result) {
        return { success: true, data: result };
      });
      if (tauriRes) return tauriRes;
      return api('/api/storage/info');
    },

    cleanupHistory: async function (days) {
      var tauriRes = await invokeCommand('cleanup_history', { days: days }, function (result) {
        return { success: true, data: result };
      });
      if (tauriRes) return tauriRes;
      throw new Error('当前开发 HTTP 服务暂未提供历史清理接口');
    },

    /* ─── 历史作品删除 ─────────────────────── */
    // 单删 · body: { id: 57 }
    deleteArtwork: async function (id) {
      var tauriRes = await invokeCommand('delete_artwork', { artworkId: id }, function () {
        return { success: true };
      });
      if (tauriRes) return tauriRes;
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
