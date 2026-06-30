// Auto-extracted from settings.html
document.addEventListener('DOMContentLoaded', function () {
  
      document.querySelectorAll('[data-os-set]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.body.dataset.os = btn.dataset.osSet;
          document.querySelectorAll('[data-os-set]').forEach(b => b.classList.toggle('active', b === btn));
        });
      });
  
      function toast(msg, kind = 'success') {
        const t = document.createElement('div');
        t.className = `toast ${kind}`;
        t.innerHTML = `<span class="seal sm" style="background:url(../../assets/logo.png) center/cover;color:transparent;">白</span><span>${msg}</span>`;
        document.getElementById('toasts').appendChild(t);
        setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; }, 2400);
        setTimeout(() => t.remove(), 2800);
      }
  
      // 标签切换
      document.querySelectorAll('.sub-nav .item').forEach(item => {
        item.addEventListener('click', () => {
          const tab = item.dataset.tab;
          document.querySelectorAll('.sub-nav .item').forEach(x => x.classList.remove('active'));
          item.classList.add('active');
          document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
          document.getElementById('panel-' + tab).classList.add('active');
        });
      });

      // 主题切换
      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const theme = btn.dataset.theme;
          document.documentElement.setAttribute('data-theme', theme);
          document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
          try { localStorage.setItem('baishi.theme', theme); } catch (e) {}
          toast('已切换至' + (theme === 'dark' ? '夜墨' : '昼砚') + '主题', 'success');
        });
      });

      // 启动时同步主题按钮状态
      var savedTheme = localStorage.getItem('baishi.theme') || 'light';
      document.querySelectorAll('.theme-btn').forEach(function (b) {
        b.classList.toggle('active', b.dataset.theme === savedTheme);
      });
  
      // 保存
      document.getElementById('save-btn').addEventListener('click', () => toast('设置已保存', 'success'));
  
      // 在线 API 发送请求
      document.getElementById('test-online-api').addEventListener('click', function () {
        const r = document.getElementById('online-api-result');
        r.style.display = 'block';
        this.disabled = true;
        this.textContent = '发送中…';
        setTimeout(() => {
          r.innerHTML = `
            <div style="background: rgba(79, 107, 58, 0.08); border: 1px solid var(--success); border-radius: var(--radius); padding: var(--space-3) var(--space-4); font-size: 13px;">
              <div style="color: var(--success); font-weight: 600; margin-bottom: 4px;">✓ 请求成功</div>
              <div class="meta">状态 200 · 响应 389ms · 已生成图片</div>
            </div>
          `;
          toast('请求成功');
          this.textContent = '发送请求';
          this.disabled = false;
        }, 1200);
      });
  
      // 本地后端 API 测试
      document.getElementById('test-local-api').addEventListener('click', function () {
        const r = document.getElementById('local-api-result');
        r.style.display = 'block';
        r.innerHTML = '<p class="meta">正在测试连接…</p>';
        this.disabled = true;
        this.textContent = '测试中…';
        setTimeout(() => {
          r.innerHTML = `
            <div style="background: rgba(79, 107, 58, 0.08); border: 1px solid var(--success); border-radius: var(--radius); padding: var(--space-3) var(--space-4); font-size: 13px;">
              <div style="color: var(--success); font-weight: 600; margin-bottom: 4px;">✓ 连接成功</div>
              <div class="meta">端点 <code>http://127.0.0.1:7878</code> · 响应 142ms · 模型 SDXL-BaiShi-v2 已就绪</div>
            </div>
          `;
          toast('API 连接成功');
          this.textContent = '运行测试';
          this.disabled = false;
        }, 1200);
      });

  
      // 生文 API - 获取模型 (Fetch Models)
      document.getElementById('fetch-text-models').addEventListener('click', async function () {
        const url = document.getElementById('text-api-url').value.trim();
        const key = document.getElementById('text-api-key').value.trim();
        const sel = document.getElementById('text-api-model');
        const r = document.getElementById('text-api-result');
        const lbl = document.getElementById('fetch-text-models-label');

        if (!url) { toast('请先填写 API URL', 'error'); return; }

        // 标准化 URL: 去尾斜杠, 智能补 /v1
        const baseUrl = url.replace(/\/+$/, '');
        const modelsUrl = /\/v1\/?$/.test(baseUrl) ? baseUrl + '/models' : baseUrl + '/v1/models';

        r.style.display = 'block';
        r.innerHTML = '<p class="meta" style="font-size:13px;">正在从服务端拉取模型列表…</p>';
        this.disabled = true;
        lbl.textContent = '拉取中…';

        let models = [];
        let source = 'live';
        let errMsg = '';

        try {
          const headers = { 'Content-Type': 'application/json' };
          if (key) headers['Authorization'] = 'Bearer ' + key;
          const resp = await fetch(modelsUrl, { headers, method: 'GET' });
          if (!resp.ok) throw new Error('HTTP ' + resp.status);
          const data = await resp.json();
          if (data && Array.isArray(data.data)) {
            models = data.data.map(function (m) { return m.id || m.name || m.model; }).filter(Boolean);
          }
          if (models.length === 0) throw new Error('未返回模型');
        } catch (err) {
          errMsg = err && err.message ? err.message : String(err);
          source = 'fallback';
          const lc = url.toLowerCase();
          if (lc.indexOf('127.0.0.1') !== -1 || lc.indexOf('localhost') !== -1 || lc.indexOf('ollama') !== -1 || lc.indexOf('lm-studio') !== -1 || lc.indexOf('1234') !== -1 || lc.indexOf('11434') !== -1 || lc.indexOf('vllm') !== -1) {
            models = ['qwen2.5:7b', 'qwen2.5:14b', 'llama3.1:8b', 'llama3.1:70b', 'deepseek-r1:7b', 'mistral:7b', 'codellama:13b', 'phi3:medium'];
          } else {
            models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini', 'claude-3-5-sonnet', 'deepseek-chat'];
          }
        }

        // 灌入 select
        const prev = sel.dataset.value;
        sel.innerHTML = '';
        models.forEach(function (id) {
          const opt = document.createElement('option');
          opt.value = id;
          opt.textContent = id;
          sel.appendChild(opt);
        });
        sel.disabled = false;
        if (prev && models.indexOf(prev) !== -1) sel.value = prev;

        // 结果展示
        if (source === 'live') {
          r.innerHTML = '<div style="background: rgba(79, 107, 58, 0.08); border: 1px solid var(--success); border-radius: var(--radius); padding: var(--space-3) var(--space-4); font-size: 13px;"><div style="color: var(--success); font-weight: 600; margin-bottom: 4px;">✓ 拉取成功 · 共 ' + models.length + ' 个模型</div><div class="meta">实时拉取 · 端点 <code>' + modelsUrl + '</code></div></div>';
          toast('已获取模型列表');
        } else {
          r.innerHTML = '<div style="background: rgba(234, 179, 8, 0.08); border: 1px solid var(--warn); border-radius: var(--radius); padding: var(--space-3) var(--space-4); font-size: 13px;"><div style="color: var(--warn); font-weight: 600; margin-bottom: 4px;">⚠ 加载演示列表</div><div class="meta">无法连接服务 (' + errMsg + ') · 已加载 ' + models.length + ' 个常见模型供选择</div></div>';
          toast('已加载演示模型列表', 'warn');
        }

        this.disabled = false;
        lbl.textContent = '获取模型';
      });

      // 生文 API - 保存配置
      document.getElementById('save-text-api').addEventListener('click', function () {
        const url = document.getElementById('text-api-url').value.trim();
        const key = document.getElementById('text-api-key').value.trim();
        const model = document.getElementById('text-api-model').value;
        if (!url) { toast('请填写 API URL', 'error'); return; }
        if (!model) { toast('请先获取模型并选择', 'error'); return; }
        try {
          localStorage.setItem('baishi.text-api.config', JSON.stringify({ url: url, key: key, model: model, savedAt: Date.now() }));
          toast('生文 API 配置已保存');
        } catch (e) { toast('保存失败：' + e.message, 'error'); }
      });

      // 生文 API - 清空
      document.getElementById('clear-text-api').addEventListener('click', function () {
        document.getElementById('text-api-url').value = '';
        document.getElementById('text-api-key').value = '';
        const sel = document.getElementById('text-api-model');
        sel.innerHTML = '<option value="">— 点击「获取模型」后选择 —</option>';
        sel.disabled = true;
        delete sel.dataset.value;
        document.getElementById('text-api-result').style.display = 'none';
        try { localStorage.removeItem('baishi.text-api.config'); } catch (e) {}
        toast('已清空生文 API 配置');
      });

      // 启动回填
      try {
        const saved = JSON.parse(localStorage.getItem('baishi.text-api.config') || '{}');
        if (saved.url) {
          document.getElementById('text-api-url').value = saved.url;
          if (saved.key) document.getElementById('text-api-key').value = saved.key;
          if (saved.model) document.getElementById('text-api-model').dataset.value = saved.model;
        }
      } catch (e) {}

      // 检查更新
      document.getElementById('check-update').addEventListener('click', function () {
        const msg = document.getElementById('update-msg');
        this.disabled = true;
        this.textContent = '检查中…';
        setTimeout(() => {
          msg.textContent = '已是最新版本 · v0.4.2';
          this.textContent = '检查更新';
          this.disabled = false;
        }, 1500);
      });
    
});
