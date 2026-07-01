# AGENT.md · 白石 BaiShi · Agent 持久记忆

> **用途**：本文件是本项目对所有未来 Agent 的"长期记忆"。任何 Agent 在此项目中接手工作前，**先通读本文件**。
> **更新机制**：增量更新。任何新决策、新约定、新发现，追加到对应小节末尾，并在末尾的「更新日志」里登记一行（日期 + 一句话概要）。

---

## 0. 一句话项目快照

**白石 BaiShi** 是一款面向自媒体创作者 / 营销人 / 平面设计师的**水墨画风格桌面生图应用**，**纯本地部署**，**可自定义在线生图 API**（如 Agnes Image 2.1 Flash），不内置任何本地模型。当前阶段：**前端 HTML/CSS 原型 + Rust 后端（SQLite + 在线 API 引擎）**。项目位于 `/Users/echowang/git/Qi_Baishi/`，前端文件归入 `front/` 目录，后端代码在 `src-tauri/`。

---

## 1. 项目元信息

| 字段 | 值 |
|---|---|
| 项目名 | 白石 · BaiShi |
| 项目类型 | 桌面应用（纯本地部署） |
| 技术栈 | 前端：HTML + CSS + JavaScript ｜ 后端：Rust (SQLite + reqwest) |
| 通信方式 | Tauri IPC（桌面打包后）或 HTTP API（开发测试用） |
| 设计系统 | 白石（in-house）· 水墨画 + Warp 8px 网格纪律 |
| 生图引擎 | 可自定义在线 API（兼容 OpenAI 格式） |
| 当前阶段 | 前后端分离开发：前端 9 屏原型 + Rust 后端（SQLite + API 引擎） |
| 目标用户 | 自媒体创作者 / 营销 / 平面设计师 |
| 视觉风格 | 宣纸底 + 浓淡墨 + 朱砂红印章 + 笔触元素 |
| 主力字体 | Noto Serif SC（显示）+ Noto Sans SC（正文）+ JetBrains Mono（数字）+ Noto Serif SC（笔触字） |
| 语言 | 简体中文（zh-CN）为主，UI 文案中英混排允许 |

---

## 2. 视觉系统（不可重写）

### 2.1 设计令牌（来自 `ink-wash.css`）

**所有派生色必须用 `color-mix()`，不要重新声明 hex。**

```css
/* 纸面 */
--bg:           #f1ead7;   /* 宣纸 */
--bg-2:         #ebe2cc;
--surface:      #f8f3e3;
--surface-2:    #f4ecd6;

/* 墨阶 */
--fg:           #1d1814;   /* 浓墨 · 标题 */
--fg-2:         #4a4138;   /* 中墨 · 正文 */
--muted:        #7a6f5f;   /* 淡墨 */
--meta:         #a89a82;   /* 灰墨 */

/* 朱砂（唯一 accent） */
--accent:       #a8322e;   /* 印泥红 */
--accent-on:    #f8f3e3;
--accent-soft:  rgba(168, 50, 46, 0.10);
--accent-deep:  #7c1f1c;

/* 字体 */
--font-display: "Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", serif;
--font-body:    "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", system-ui, sans-serif;
--font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
--font-brush:   "Noto Serif SC", "ZCOOL XiaoWei", "KaiTi", "STKaiti", serif;

/* 8px 网格 */
--space-1 ~ --space-20  （4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80）

/* 圆角 */
--radius-sm: 4px; --radius: 8px; --radius-lg: 12px; --radius-pill: 9999px; --radius-seal: 6px;

/* 笔触粗细 */
--brush-1: 1px;   /* 发丝 */
--brush-2: 2px;   /* 行书 */
--brush-3: 3px;   /* 楷书 */
--brush-4: 6px;   /* 飞白 */
--brush-5: 12px;  /* 大字 */
```

### 2.2 组件类（已在 `ink-wash.css` + `app-chrome.css` 中实现）

**布局类**：`container`, `section`, `stack`, `row`, `row-between`, `grid-2 / -3 / -4 / -auto / -2-1 / -1-2`
**窗体栏**：`window`, `titlebar`, `lights/light(close|min|max)`, `app`, `sidebar`, `content`, `content-header`, `statusbar`, `os-toggle`
**侧栏**：`brand`, `nav-section`, `nav-item(.active)`, `nav-icon`, `badge`, `user-chip`, `foot`
**按钮**：`btn(-primary | -secondary | -ghost | -ink)(-lg | -sm | -block | -arrow)`
**表单**：`field`, `.input`, `.textarea`, `.select`, `.input-search`, `.slider`, `.toggle`, `.chips`, `.chip`
**卡片**：`card(-flat | -rule | -pad-lg)`, `art-card`, `style-card`
**印章 / 笔触**：`seal(.sm | .lg)`, `eyebrow`, `brush-divider`, `ink-dot`, `ink-wash-bg`
**比较滑块**：`compare`（图生图 before/after）
**反馈**：`toast-host`, `toast(.success | .error)`, `modal-overlay`, `modal`, `dropzone`, `tabs/tab`, `icon-btn`

### 2.3 视觉规则（不可违反）

- **唯一 accent**：朱砂红 `#a8322e`，每屏最多使用两次（eyebrow + 主按钮）
- **禁用项**：
  - ❌ 冷色调（蓝/绿/紫）作为主色
  - ❌ 纯白文字（必须用 `#faf9f6` 暖白 / `#1d1814` 浓墨）
  - ❌ 渐变背景（宣纸纹理 + 印章即可）
  - ❌ 圆角矩形 + 左侧彩色边线的 AI slop 卡片
  - ❌ 通用 emoji 图标（✨🚀🎯），用 SVG 笔触图标
  - ❌ Inter / Roboto / Arial 作为显示字体（Noto Serif SC 是显示体）
  - ❌ 仿古米黄 / 桃粉 / 暖棕 AI 色板（除非与品牌明确相关）
- **字体阶**：h1 28px / h2 24px / h3 20px / body 15px / meta 13px / micro 11px（uppercase + 0.06em tracking）
- **印章**：唯一可容纳文字的方形 accent 容器，方角 6px
- **笔触**：`eyebrow` 元素前的 24×2px 朱砂斜划线是品牌签名
- **暗色模式**：当前不支持；未来版本会加入

### 2.4 与 Warp 设计系统的关系

虽然项目元数据声明活跃设计系统是 Warp，但本项目**已显式覆盖**配色与字体：

- **保留 Warp 的**：8px 网格、节制留白、容器宽度、动效节奏、组件命名直觉、暗色克制哲学
- **替换为水墨的**：配色（暖深 → 宣纸）、字体（Mate → Noto Serif SC）、组件签名（pill 按钮 → 印章）、装饰（照片 → 笔触）

> Agent 不需要也不应该重新回到 Warp 令牌；本项目已定型为「白石」独立设计系统。

---

## 3. 文件地图

### 3.1 文件结构（当前态）

```
/Users/echowang/git/Qi_Baishi/
├── front/                       前端文件总目录
│   ├── index.html              着陆页（仅 Header + Hero + Footer）
│   ├── pages/
│   │   ├── auth.html           登录/注册
│   │   ├── workspace.html      工作台（首页）
│   │   ├── text-to-image.html  文生图 + 固定提示词
│   │   ├── image-to-image.html 图生图 + 负面提示词
│   │   ├── presets.html        灵感墙 Hub + 编辑器
│   │   ├── copywriting.html    妙笔生花文案生成
│   │   ├── history.html        历史作品库
│   │   └── settings.html       设置/账户（含 Pro 付费支持）
│   ├── css/
│   │   ├── ink-wash.css        设计系统令牌 + 工具类 · 24 KB
│   │   ├── app-chrome.css      窗体栏 + 侧栏 + 桌面组件 · 25 KB
│   │   ├── landing.css         着陆页专用
│   │   ├── presets.css         灵感墙专用
│   │   ├── text-to-image.css   文生图文专用
│   │   ├── copywriting.css     妙笔生花专用
│   │   └── history.css         历史作品库专用
│   └── js/
│       ├── presets.js          画廊预设数据 + 编辑器 · 48 KB
│       ├── text-to-image.js    文生图逻辑
│       ├── image-to-image.js   图生图逻辑
│       ├── copywriting.js      文案模板
│       ├── history.js          历史逻辑
│       ├── settings.js         设置逻辑
│       └── auth.js             登录逻辑
│
├── assets/                      静态资源（posters/, drawings/, logo.png）
├── docs/                        项目文档
└── Templete/                    模板素材库
```

### 3.2 屏级职责

| 文件 | 路由职责 | 关键模块 |
|---|---|---|
| `front/index.html` | 营销落地（仅 Header + Hero + Footer） | 3D 扇形抽卡交互（8 张海报）| 2026-06-30 简化 |
| `front/pages/auth.html` | 登录 / 注册 | 邮箱+密码 · 社交登录 · 左侧水墨 hero |
| `front/pages/workspace.html` | 应用首页 | 快速入口 · 最近作品 · 风格趋势 · 算力统计 |
| `front/pages/text-to-image.html` | 文生图 | 提示词 · 8 个真实固定提示词 · 智能润色 · 出图数量 1-5 拖动条 · 4 候选图 |
| `front/pages/image-to-image.html` | 图生图 | 上传参考图 · 8 个风格转换固定提示词 · 负面提示词 · 对比滑块 + 结果网格 |
| `front/pages/presets.html` | 灵感墙 Hub | 画廊（25 幅真实海报）+ 妙笔生花（12 款文风）双面板 · 管理模式（增删改）· 图片上传 · 自定义分类 · 标签编辑 · 文风详情可编辑 |
| `front/pages/copywriting.html` | 妙笔生花文案生成 | 12 类模板 · 双栏工作区 · 管理增删改 |
| `front/pages/history.html` | 历史作品库 | 日期分组 · 网格/列表 · 筛选 · 收藏 · 批量操作 |
| `front/pages/settings.html` | 设置/账户 | 在线/本地 API 两栏配置 · 存储 · 快捷键 · Pro 付费支持 |

### 3.3 共享资源约定

- **每个屏的 HTML 文件头部统一引用**：
  ```html
  <link rel="stylesheet" href="../css/ink-wash.css" />
  <link rel="stylesheet" href="../css/app-chrome.css" />
  ```
- **字体 CDN**：
  ```html
  <link href="https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  ```
- **HTML 静态引用相对路径**：因为这是原型，未走 vite/webpack 构建。项目位于 `front/` 目录，页面间链接使用裸文件名（同目录 `pages/`），资源路径根据文件层级正确指向上级或上上级。

---

## 4. 已确立的决策（不要再讨论）

> 以下决策在过往会话中已与用户确认。Agent 接手时**不要重新询问**或推翻，直接遵守。

1. **技术栈**：HTML + CSS + JS（前端） + Rust（推理引擎 / 业务后端） + Tauri（桌面壳）。**不允许**改为 Electron / Flutter / 原生 Swift 。
2. **目标平台**：macOS（Apple Silicon 优先，Intel 兼容） + Windows x64。**不**做 Linux / Web / 移动端。
3. **架构：每屏独立 HTML 文件**，不用 SPA / 路由框架。`index.html` 是入口/着陆页，不是 SPA 容器。
4. **设计系统锁定为「白石」**：不回到 Warp、不引入其他设计系统、不创建新主题。
5. **视觉签名**：朱砂印章（`seal` 类）+ 笔触斜线（`eyebrow::before`）每屏必出现至少一次。
6. **登录方式**：邮箱 + 密码（不是手机号、不是 OAuth 唯一）。GitHub / Apple ID 作为可选社交登录。
7. **配色约束**：暖中性（宣纸 / 墨）+ 朱砂。**禁止**冷色（蓝/紫/绿）作为主色或品牌色。
8. **字体**：Noto Serif SC（显示 + 笔触）+ Noto Sans SC（正文）+ JetBrains Mono（数字）。**禁止** Inter / Roboto / Arial 作为显示体。
9. **算力模型**：Free 500 / PRO 5,000 / PRO+ 20,000 算力 · 单次 1 算力（在线 API 按张计费）。
10. **历史作品是用户私有财产**：仅存本地，**不上传云端**。
11. **i18n**：UI 文案简体中文为主，技术名词允许英文。
12. **不填的表单默认值**：所有数值参数都有合理默认（如 `steps=30`, `cfg=7.5`, `seed=随机`）。
13. **生图 API 可自定义**：用户可在设置页自行填写 Endpoint 与 API Key，不绑定任何特定服务商。
14. **不内置本地模型**：不包含任何模型权重文件，不依赖 candle / ONNX / GPU。

---

## 5. 编码规范

### 5.1 HTML

- 全部 `<html lang="zh-CN">`
- 每屏独立 `<title>` 包含屏名 + 「· 白石 BaiShi」
- 屏根元素结构：`.window > .titlebar + .app(sidebar + .content)`
- 每个有意义的区块加 `data-od-id="..."` 便于后续注释模式定位
- 命名类用 kebab-case（如 `.art-card`, `.nav-item`, `.log-row`）

### 5.2 CSS

- 不在屏级 `<style>` 中重写 `:root` 令牌，必要时用 `color-mix()`
- 屏级 `<style>` 只放**屏专属**样式（如 `auth.html` 的 `.promo` 左侧 hero）
- 类名沿用 `ink-wash.css` / `app-chrome.css` 的命名，新增类要符合现有命名直觉
- 写新 CSS 时**不要**引入 Tailwind / Bootstrap / 设计令牌重声明
- 媒体查询断点：920px（手机/平板分界）、720px（折叠屏）
- `prefers-reduced-motion` 关闭装饰动画（当前未实现，未来加入）

### 5.3 JavaScript

- 当前每屏内嵌 `<script>`，不抽公共模块（原型阶段无需）
- DOM 操作优先 querySelector 而非框架
- 命名：函数 `camelCase`、常量 `UPPER_SNAKE`
- 不要引入 React / Vue / 任何前端框架
- Tauri 化后用 `invoke()` 调用 Rust，所有 IPC 调用放在 `src/ipc/*.ts`
- 全局 toast 函数：每屏复制一份 `toast(msg, kind)` 即可

### 5.4 命名约定

- **品牌**：白石 / BaiShi（不要写「ChaosBuilder」「PixelForge」「墨宝」等过往项目名）
- **核心类**：`.seal`（印章）、`.eyebrow`（小标 + 笔触斜线）、`.brush-divider`（笔触分割线）
- **参数键**：`prompt`, `negative_prompt`, `style_id`, `seed`, `steps`, `cfg_scale`, `aspect`, `reference_image`, `strength`
- **比例字串**：`"1:1"`, `"16:9"`, `"9:16"`, `"4:5"`, `"21:9"`（冒号英文半角）
- **风格 ID**：`feibai-landscape`, `gongbi-bird-flower`, `xieyi-figure`, `dunhuang-heavycolor`, `modern-ink`, `song-academy` 等 kebab-case

---

## 6. 强制约束（红线）

### 6.1 不要做的事

- ❌ **不要重写已经完成的 7 屏**（除非用户明确要求改进某屏）。`workspace.html` / `text-to-image.html` 等已经过详细设计，**改之前先问**。
- ❌ **不要新增未在简报中的屏**（如单独的「批量出图屏」「视频生图屏」）。需要时先确认。
- ❌ **不要修改 `ink-wash.css` / `app-chrome.css` 的 `:root` 令牌**。如需派生，用 `color-mix()`。
- ❌ **不要替换朱砂红**为其他 accent 色。
- ❌ **不要引入 Tailwind / Bootstrap / Material UI**。
- ❌ **不要在产品 UI 中暴露设计师控制**（如平台切换器、视口切换器、demo controls）。`os-toggle` 是**演示用**（预览给用户看 macOS / Windows 两种风格），Tauri 工程化后由原生窗体栏替代。
- ❌ **不要使用 emoji 图标**（✨🚀🎯），用 SVG。
- ❌ **不要编造没有来源的数据**（「10× 更快」「99.9% uptime」）。没有真实数据时留 `—` 或灰色块。
- ❌ **不要把整个项目合并成一个长滚动单页**。屏必须独立。

### 6.2 必须做的事

- ✅ **新加 HTML 文件必须 link `ink-wash.css` + `app-chrome.css`**。
- ✅ **新加的屏必须有 `.window > .titlebar + .app(sidebar + .content)`** 结构。
- ✅ **侧栏导航顺序固定**：工作台 → 文生图 → 图生图 → 灵感墙 → 历史作品 → 设置。
- ✅ **每个屏都有 `data-od-id` 标注关键区块**。
- ✅ **中文字体必须 Noto Serif/Sans SC**，不能退化到系统默认中文字体（PingFang SC 是 fallback）。
- ✅ **大标题用 `.h1` 或 `<h1>`**，不直接写内联 `font-size`。
- ✅ **图片占位用 `.ph-img` 或 `.art-img` 渐变类**，不要外链 stock photo URL。
- ✅ **交互用真 JS**（不是静态截图）：按钮、tab、对话框、滑块、生成进度都必须能操作。

---

## 7. 用户偏好（来自过往会话沉淀）

> 这些是用户反复表达过、并被写入其个人偏好的事实。Agent 接手时**视为默认**，不需重新询问。

1. **续作而非重做**：用户希望直接续作未完成任务，不要重新设计已经完成的部分（用户曾明确表达过）。
2. **品牌方向由助手选**：用户选了「帮我选一个方向」，意味着本项目的品牌/视觉方向由 Agent 拍板。**不要再问**用户「要暖色还是冷色」「要现代还是古典」。
3. **桌面应用优先**：用户已确认是桌面应用（非网页/移动）。**不要再问**「要不要做网页版」。
4. **毛笔 / 水墨笔触**：用户明确需要毛笔 bi shua 元素。设计必须包含笔触、印章等水墨符号。
5. **细节完整**：用户偏好细节完整的原型，包括 icon、状态、过渡。**不要偷懒做草图**。
6. **CSS 注释更新**：用户曾要求确认 CSS 注释已更新，未来新增/修改 CSS 时同步注释。
7. **固定提示词**：生图相关页面必须支持固定/快捷提示词（`+ 飞白山水` 等）。
8. **预设风格从真实海报读**：预设风格页的图片如涉及本地海报，从 `/Users/echowang/Downloads/posters/` 读取（这是用户整理好的素材目录）。
9. **细节如中英对照**：Hero / 标题 / 关键按钮支持中英对照（中文为主，英文辅助）。

---

## 8. 当前完成度

### 8.1 已完成 ✅

- [x] **设计系统**（`ink-wash.css`）：令牌、字体、按钮、表单、卡片、印章、笔触、动画
- [x] **应用窗体**（`app-chrome.css`）：macOS/Windows 切换、侧栏、状态栏、模态、Toast、对比滑块
- [x] **落地页**（`index.html`）：品牌着陆 + Hero 3D 扇形抽卡（8 张海报）
- [x] **登录注册**（`pages/auth.html`）：左右分屏 · 邮箱+密码 · 社交登录
- [x] **工作台**（`pages/workspace.html`）：快速入口 · 最近作品 · 风格趋势 · 算力统计
- [x] **文生图**（`text-to-image.html`）：提示词 · 固定提示词 · 润色 · 参数 · 生成进度 · 4 候选图
- [x] **图生图**（`image-to-image.html`）：上传参考图 · 重绘强度 · before/after 对比
- [x] **灵感墙 Hub**（`pages/presets.html`）：画廊（25 款预设）+ 妙笔生花（12 类文案）双面板 · 管理模式
- [x] **妙笔生花**（`pages/copywriting.html`）：12 类文案模板 · 双栏工作区 · 管理增删改
- [x] **历史作品库**（`pages/history.html`）：日期分组 · 网格/列表 · 筛选 · 收藏 · 批量操作
- [x] **设置/账户**（`pages/settings.html`）：账户信息 · API 配置（Endpoint + Key）· 存储 · 快捷键 · 主题切换 · Pro 付费
- [x] **暗色主题**（夜墨）：深墨底 + 冷月白 · 所有页面适配
- [x] **多图融合屏**（`pages/multi-image.html`）：上传 2-6 张参考图 · 拖拽排序 · 融合模式选择
- [x] **Rust 后端 SQLite 持久化**：6 张表（users/sessions/artworks/presets/settings/generation_log）· 自动迁移
- [x] **Rust 后端鉴权模块**：Argon2id 密码哈希 · 256-bit session token
- [x] **在线 API 引擎**：Agnes Image 2.1 Flash 集成 · 可自定义 Endpoint 和 Key
- [x] **IPC Command 骨架**：13 个 Command（auth/generate/history/presets/settings/storage）

### 8.2 待办（按优先级） 🔜

- [ ] **HTTP API 服务器**：创建开发用的 HTTP 服务器，供前端直接联调
- [ ] **生成队列与并发控制**：当前为同步阻塞请求
- [ ] **API 密钥加密存储**：当前明文存储在 SQLite
- [ ] **Tauri 工程化**：src-tauri 目录已有 · 需 build.rs + 前端构建集成
- [ ] **macOS / Windows 打包**：.dmg / .msi + 代码签名 + 自动更新
- [ ] **命令面板 ⌘K**：所有屏共享的快捷命令入口
- [ ] **多图生图屏**：文生图的扩展，支持参考多张图融合
- [ ] **键盘快捷键完整覆盖**：当前文档列出但未全部实现

### 8.3 已知妥协 ⚠️

- **原型阶段无持久化**：登录、收藏、历史修改只存内存，SQLite 虽已实现但前后端尚未对接
- **`os-toggle` 是演示用**：预览 macOS / Windows 两种风格，正式 Tauri 化后由原生窗体栏取代
- **生成队列为同步阻塞**：当前调用在线 API 为同步等待，影响 UI 响应
- **API 密钥明文存储**：需加密后再写入 SQLite
- **多图生图未独立成屏**：用户简报提到过，但当前未实现
- **`index.html` 较紧凑**：已比原版精简，但仍包含较多内容

---

## 9. 增量更新指南

### 9.1 何时更新本文件

- 新增 / 删除 / 重命名任何 HTML / CSS 文件 → 更新 §3 文件地图
- 视觉系统增加 / 修改令牌或组件 → 更新 §2
- 与用户达成新决策 → 更新 §4
- 发现新的"红线" → 更新 §6
- 完成 / 新增待办 → 更新 §8
- 发现用户偏好沉淀 → 更新 §7

### 9.2 更新流程

1. **先确认**：在用户已确认某决策后再写入本文件，**不要把临时探索当决策**
2. **最小变更**：用 `edit` 工具精准替换或追加，**不要整文件重写**
3. **登记日志**：在末尾「更新日志」追加一行：`YYYY-MM-DD · 一句话概要`
4. **保持章节稳定**：不要重排章节顺序，后续 Agent 依赖章节编号定位

### 9.3 更新日志

> 每次更新追加到下方，不要修改历史条目。

| 2026-06-29 | 初版建立。覆盖 7 屏原型、设计系统、文件地图、用户偏好、编码规范、当前完成度与待办。同步建立 Developer.md（架构）与 README.md（用户手册）。 |
| 2026-06-29 | 全量任务盘点与核验。 |
| 2026-06-29 | 增量更新：文件地图修正、完成度更新。 |
| 2026-06-30 | 项目完整迁移至 `/Users/echowang/git/Qi_Baishi/`，前端文件归入 `front/`。Hero 3D 扇卡、画廊编辑器、暗色主题、多图融合、品牌人设更新。 |
| 2026-06-30 | **后端重构**：移除所有本地模型依赖（SDXL-BaiShi-v2/candle/ONNX），接入 Agnes Image 2.1 Flash API，SQLite 持久化，Argon2id 鉴权。**文档更新**：README.md、AGENT.md、front.md、server.md 全部更新为纯本地部署 + 可自定义在线 API 架构。 |
