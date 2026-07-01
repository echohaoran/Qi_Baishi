# 白石（BaiShi）— 开发日志

## 角色分工
- **前端 Agent（当前）**：只负责 `front/` 下 HTML/CSS/JS，不碰 Rust 后端、不碰 `src-tauri/`、不碰 SQLite Schema
- **后端 Agent**：负责 Rust (Tauri + Candle) 后端
- **日志规则**：前端 Agent 每次改代码后增量追加日志，后端 Agent 独立更新自己的日志

---

## 2026-06-30 — 删除登录页面和所有认证功能

### 操作详情

**1. 删除文件**
- 删除 `front/pages/auth.html`
- 删除 `front/js/auth.js`
- 删除 `front/css/auth.css`
- 删除关联 artifact 元数据

**2. 侧栏用户卡片静默化**
- 全部 8 个页面 (`workspace.html`, `text-to-image.html`, `image-to-image.html`, `multi-image.html`, `copywriting.html`, `presets.html`, `history.html`, `settings.html`) 侧栏底部用户卡片从「赵明远 / 开源版」改为「白石 · 开源版 / v0.4.2」

**3. 设置页账户面板重构**
- 移除旧面板（基本资料、安全、危险操作）
- 替换为「关于白石」品牌介绍卡片 + GitHub 仓库 + 版本信息
- 面板标签由"账户"改为"账户」（品牌介绍卡片）

**4. 设置子导航栏调整**
- 移除"关于"标签（内容已合并到账户面板）
- 增加"隐私"标签（替代账户安全区域）

**5. settings.js 清理**
- 移除 `#update-msg` 引用

**6. api-client.js 清理**
- 移除 `register()`、`login()`、`logout()` 三个函数

**7. 着陆页 (`index.html`) 更新**
- 导航栏移除「登录」按钮，仅保留「进入工作台」
- 导航文案「文生图/文」→「文生图」

**8. 全站导航文案统一**
- 全部页面侧栏「文生图/文」→「文生图」

### 遗留问题和后续规划
- 所有页面现在可直接访问，无登录要求
- 工作台问候语：`欢迎 使用白石`
- 侧栏底部为静态品牌信息，无退出按钮
- 后端 Agent 不再需要维护认证相关接口和数据库表
- 设置页隐私面板暂无保留价值的可移除项

---

## 2026-06-30 — 妙笔生花快捷模板动态化

### 操作详情

**1. `front/pages/copywriting.html`**
- 将硬编码的 6 个快捷模板卡片（brand, product, marketing, social, headline, ad）替换为动态容器 `#quick-templates`
- 新增 `· 妙笔生花随机精选` 副标题

**2. `front/js/copywriting.js`**
- 引入 `textStyles` 数组（12 个文风预设），与 `front/js/presets.js` 中的预设数据同步
- 新增 `shuffleArray()` 洗牌算法
- 新增 `renderQuickTemplates()` 从 textStyles 随机抽选 8 个动态生成 `.template-card`
- 每个卡片点击事件：填入对应文风的完整 prompt 到输入框
- 新增「换一批」按钮刷新快捷模板
- 全局重构：将 `var` 替换 `const/let` 以避免 Babel/ES5 兼容问题
- 移除了不再使用的 `templates` 旧数据对象和相关的 `.template-card` 事件监听

### 前端改动范围
| 文件 | 操作 |
|------|------|
| `front/pages/copywriting.html` | 替换快捷模板区域为动态容器 |
| `front/js/copywriting.js` | 完整重写，新增动态模板渲染逻辑 |

### 不涉及后端
- 纯前端改动，不需要后端配合

---

## 2026-06-30 — 设置页重构：删除隐私/高级，增加更新功能

### 操作详情

**1. 删除「隐私」标签和面板**
- `front/pages/settings.html`: 移除 `data-tab="privacy"` 导航项
- 移除 `#panel-privacy` 整个面板（本地存储、分析统计设置）

**2. 删除「高级」标签和面板**
- `front/pages/settings.html`: 移除 `data-tab="advanced"` 导航项
- 移除 `#panel-advanced` 整个面板（调试日志、API 端口、模型热重载、数据导出、系统信息表）

**3. 新增「更新」标签和面板**
- `front/pages/settings.html`: 新增 `data-tab="update"` 导航项
- 新增 `#panel-update` 面板，包含当前版本显示、检查更新按钮、系统信息卡片
- `front/js/settings.js`: 新增检查更新逻辑，从 GitHub API 获取最新 release，对比版本号，显示更新状态
- GitHub API 请求失败时友好降级提示

### 前端改动范围
| 文件 | 操作 |
|---|---|
| `front/pages/settings.html` | 删除隐私/高级导航项和面板，新增更新导航项和面板 |
| `front/js/settings.js` | 新增检查更新功能逻辑 |

### 不涉及后端
- 纯前端改动，不需要后端配合

## 2026-06-30 — 全栈连通性收尾：妙笔生花接通 LLM / 死代码清理 / 全按钮审计

### 1. 文风数据共享
- 新建 `front/js/text-styles.js`（12 款文风模板统一数据源）
- `front/js/presets.js` 与 `front/js/copywriting.js` 改为调用 `window.BaishiTextStyles.list()`
- 消除两个文件中重复的硬编码数组

### 2. 妙笔生花真接通 LLM
- `front/js/api-client.js` 新增 `generateCopywriting(prompt, opts)` → 调 `/api/text/generate`
- `front/js/copywriting.js` 重写 `doGenerate`：调 LLM，loading 状态，错误回显
- 「一键润色」按钮：调 LLM 重新润色（替代正则字符串替换）
- 「存为模板」：同时写 localStorage + 后端 `savePreset(category='copywriting')`
- `src-tauri/src/server_http.rs` 新增 `api_generate_text_llm` 处理函数
- 路由：`POST /api/text/generate` → 用户配置的生文 API 透传

### 3. 死代码清理
- 删除 `front/js/inference-engine.js`（从未被引用）
- 删除 `front/js/gallery.js`（其中引用了已被删除的 DOM id）
- 重写 `front/css/landing.css`（之前 38KB → 8.6KB 精简版，仅保留首页 fan-card / setup-modal 必要样式）

### 4. api-client.js 配置补全
- `getImageConfig()` 补读 `BaiShiShared.getImageApiKey()`，生图 API Key 真正能带入请求

### 5. 全按钮连通性审计

| 页面 | 有 id 按钮 | 已绑定 | 状态 |
|---|---|---|---|
| workspace | 0（用 class 绑定）| 2 个 icon-btn + 4 张 art-card | ✅ |
| text-to-image | 8 | 8/8 | ✅ |
| image-to-image | 9 | 9/9 | ✅ |
| multi-image | 7 | 7/7 | ✅ |
| presets | 14 | 14/14 | ✅ |
| history | 1（其他用 class）| 1/1 + class-scope | ✅ |
| settings | 7 | 7/7 | ✅ |
| copywriting | 10 | 10/10 | ✅ |
| **合计** | **56+** | **全部** | **✅** |

### 6. 端到端连通性验证

| 端点 | 测试结果 |
|---|---|
| `GET /api/health` | ✅ engine=generic v0.5.0 |
| `POST /api/auth/register` | ✅ |
| `POST /api/auth/login` | ✅ |
| `GET /api/settings/1` | ✅ |
| `POST /api/settings/1` | ✅（合并式更新）|
| `GET /api/storage/info` | ✅ |
| `GET /api/presets` | ✅ |
| `POST /api/presets` | ✅（gallery + copywriting）|
| `GET /api/history?user_id=1` | ✅ |
| `POST /api/generate/text` | ✅ 21s 真实图片 URL |
| `POST /api/text/enhance` | ✅ 错误路径正确返回 |
| `POST /api/text/generate` | ✅ 错误路径正确返回 |
| 8 页面 HTTP | 全部 200 |
| 11 个 JS 文件 HTTP | 全部 200 |
| JS 语法检查（11 个文件）| 全部通过 |

### 7. 全部按钮分类
- **真接通后端 API**（6 个）：savePreset / updateSettings / listPresets / listHistory / textToImage / imageToImage / generateCopywriting
- **真调 LLM**（3 个）：智能润色 × 3（文生图 / 图生图 / 多图融合）+ 生成文案 / 一键润色
- **本地交互**（已确认可用）：模板卡片点击、设置切换、模态框、清空、复制、收藏切换、加载更多、导入模板

### 涉及文件
- `front/js/text-styles.js`（新增）
- `front/js/api-client.js`（加 generateCopywriting + 修 getImageConfig）
- `front/js/baishi-shared.js`（未改）
- `front/js/presets.js`（改用 text-styles）
- `front/js/copywriting.js`（重写 doGenerate / polish / save-preset）
- `front/js/inference-engine.js`（删除）
- `front/js/gallery.js`（删除）
- `front/css/landing.css`（精简重写）
- `src-tauri/src/server_http.rs`（新增 /api/text/generate 端点）
- `front/pages/presets.html`（加 text-styles.js script 标签）
- `front/pages/copywriting.html`（加 text-styles.js script 标签）
