# Frontend Development · 白石 BaiShi

> 水墨生图桌面应用白石 BaiShi 的前端开发说明。
> 项目位置：`/Users/echowang/git/Qi_Baishi/`
> 读者：前端开发者 / Agent。
> 用途：了解前端模块划分、目录约定、组件系统、IPC 调用方式。

---

## 1. 项目定位

**白石 BaiShi** 是一款面向创作者（自媒体 / 营销 / 平面设计师）的**水墨画风格桌面生图应用**。

- **纯本地部署**：应用、数据库、历史作品全部在本地
- **可自定义生图 API**：不内置模型，生图通过用户配置的在线 API 完成
- **视觉风格**：宣纸底 + 浓墨 / 淡墨 / 灰墨 + 朱砂红印章 + 笔触元素

---

## 2. 架构概览（前端视角）

```
┌──────────────────────────────────────┐
│        前端 WebView / 浏览器          │
│                                       │
│   HTML（7 屏 + 着陆页）               │
│     ├─ 各屏独立 .html 文件            │
│     └─ 统一引用 CSS/JS                │
│                                       │
│   CSS（设计系统 + 组件库）             │
│     ├─ ink-wash.css（令牌 + 工具类）   │
│     ├─ app-chrome.css（桌面壳组件）    │
│     └─ 各屏专用样式                   │
│                                       │
│   JavaScript（交互逻辑）              │
│     ├─ 提示词输入 / 参数控制          │
│     ├─ 画廊管理 / 历史筛选            │
│     └─ invoke() → Rust 后端          │
│                                       │
├──────────────────────────────────────┤
│     通信层（二选一）                   │
│                                       │
│   方案A: Tauri IPC（桌面打包后）       │
│   invoke(cmd, args) → Rust Command   │
│                                       │
│   方案B: HTTP API（开发测试用）        │
│   fetch('/api/...') → Rust HTTP 服务 │
│                                       │
├──────────────────────────────────────┤
│         Rust 后端                     │
│   auth → SQLite → 在线生图 API       │
└──────────────────────────────────────┘
```

**数据流**：用户在 HTML 屏输入 → JS 收集参数 → 调用 Rust 后端 → 后端调用在线 API 生图 → 返回结果 URL

---

## 3. 目录结构（前端部分）

```
BaiShi/
├── front/                       前端文件总目录
│   ├── index.html               着陆页（Header + Hero 3D扇卡 + Footer）
│   ├── pages/                   8 个功能页面
│   │   ├── auth.html            登录 / 注册
│   │   ├── workspace.html       工作台（首页）
│   │   ├── text-to-image.html   文生图
│   │   ├── image-to-image.html  图生图
│   │   ├── presets.html         灵感墙 Hub（画廊+妙笔生花+编辑器）
│   │   ├── copywriting.html     妙笔生花（文案生成）
│   │   ├── history.html         历史作品库
│   │   └── settings.html        设置/账户（含 API 配置 + Pro付费）
│   ├── css/
│   │   ├── ink-wash.css         白石设计系统（令牌 + 工具类）
│   │   ├── app-chrome.css       桌面应用窗体栏 / 侧栏 / 组件
│   │   ├── landing.css          着陆页专用
│   │   ├── presets.css          灵感墙专用
│   │   ├── text-to-image.css    文生图专用
│   │   ├── copywriting.css      妙笔生花专用
│   │   └── history.css          历史作品库专用
│   └── js/
│       ├── presets.js           画廊预设 + 编辑器
│       ├── text-to-image.js     文生图逻辑
│       ├── image-to-image.js    图生图逻辑
│       ├── copywriting.js       文案模板
│       ├── history.js           历史逻辑
│       ├── settings.js          设置逻辑
│       └── auth.js              登录逻辑
├── assets/                      静态资源（posters/, drawings/, logo.png）
├── Templete/                    模板素材库
└── docs/                        项目文档
```

---

## 4. 前端架构（HTML + CSS + JS）

### 4.1 HTML：7 屏 + 着陆页

每个屏幕是独立的 `.html` 文件，统一引用 `ink-wash.css` + `app-chrome.css`。用户在不同 `.html` 间跳转（`<a href>`），不需要 SPA 框架。

**统一外壳**：每个屏都包含 `.window > .titlebar + .app(sidebar + .content)`，由 `app-chrome.css` 提供样式。

### 4.2 CSS 设计系统

#### 两套共享文件

| 文件 | 职责 | 体积 |
|---|---|---|
| `ink-wash.css` | 设计令牌（`:root`）· 字体阶 · 按钮/卡片/表单 · 印章 · 笔触 · 动画 | 24 KB |
| `app-chrome.css` | macOS/Windows 标题栏 · 侧栏 · 内容区 · 状态栏 · 模态 · Toast | 25 KB |

**规则**：任何屏都不要重写 `:root` 令牌。需要派生颜色用 `color-mix()`。

#### 核心令牌一览

- **纸面**：`--bg #f1ead7` · `--surface #f8f3e3` · `--surface-2 #f4ecd6`
- **墨阶**：`--fg #1d1814` · `--fg-2 #4a4138` · `--muted #7a6f5f` · `--meta #a89a82`
- **朱砂**：`--accent #a8322e` · `--accent-deep #7c1f1c`
- **字体**：Noto Serif SC（显示）· Noto Sans SC（正文）· JetBrains Mono（数字）
- **签名元素**：`.seal` 印章 + `.eyebrow::before` 笔触斜线

### 4.3 JavaScript 交互层

当前原型阶段每个 HTML 内嵌一段 `<script>`。所有后端调用通过 `invoke()` 或 `fetch()` 完成。

#### 当前已实现的交互模式

| 页面 | 交互要点 |
|---|---|
| 文生图 | 提示词计数 · 固定提示词片段 · 智能润色 · 参数滑块 · 生成按钮 |
| 图生图 | 上传 · 拖拽 · 风格预设套用 · before/after 对比 |
| 灵感墙 | 风格卡片网格 · 点击弹出详情（左侧大图 + 右侧元数据） |
| 历史 | 日期分组 · 网格/列表切换 · 筛选标签 · 收藏 |
| 设置 | API 密钥/端点配置 · 存储路径 · 主题切换（宣纸/夜墨） |
| 命令面板 | `⌘K` 唤起（待补全） |

---

## 5. IPC 契约（前端调用）

### 5.1 Command 调用清单

所有后端调用通过 `invoke(cmd, args)`（Tauri）或 `fetch('/api/cmd', {...})`（HTTP）完成。

```typescript
// 文生图请求
interface GenerateRequest {
  prompt: string;
  negative_prompt?: string;
  style_id?: string;
  seed?: number;
  steps: number;
  cfg_scale: number;
  aspect: string;            // "1:1" | "16:9" | "9:16" | "4:5" | "21:9"
  reference_image?: string;  // 图生图：图片 URL
  strength?: number;         // 0-1
  count: number;             // 1-4
}

// 生成结果
interface GenerateResult {
  job_id: string;
  images: { id: string; url: string; seed: number }[];
  seed_used: number;
  took_ms: number;
}
```

### 5.2 可订阅事件

| Event | Payload | 触发时机 |
|---|---|---|
| `job:progress` | `{job_id, step, total_steps}` | 生成进度（预留） |
| `job:done` | `{job_id, image_url, seed, took_ms}` | 生成完成 |
| `job:error` | `{job_id, message}` | 生成失败 |
| `system:notify` | `{kind, title, body}` | 系统通知 |

### 5.3 前端调用示例

```javascript
// Tauri IPC 方式（桌面打包后）
import { invoke } from '@tauri-apps/api/core';

const result = await invoke('generate_text_to_image', {
  prompt: '远山含黛，江面薄雾',
  steps: 30,
  aspect: '1:1',
  count: 3,
});
// result.images[0].url → 图片 URL

// HTTP 方式（开发测试用）
const res = await fetch('/api/generate/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ prompt: '远山含黛', steps: 30, aspect: '1:1', count: 3 }),
});
const result = await res.json();
```

---

## 6. 测试策略（前端）

| 类型 | 方式 |
|---|---|
| 目视检查 | 各 HTML 文件在浏览器直接打开 |
| 交互验证 | 表单录入、滑块、拖拽、弹窗流程 |
| 响应式 | 检查 macOS/Windows 顶栏切换效果 |
| 后端联调 | `cargo run --bin baishi-server` + 浏览器访问 |

---

## 7. 路线图（前端项目）

- [x] HTML/CSS 原型（7 屏 + 着陆页 + 25 款真实海报预设 + 妙笔生花文案）
- [x] 画廊编辑器支持图片上传、自定义分类、标签编辑
- [x] 项目迁移到独立仓库 `front/` 目录
- [x] 全站侧边栏统一，首页简化，设置页功能完善
- [x] 暗色主题（夜墨）
- [x] API 配置页（可自定义 Endpoint + Key）
- [ ] 命令面板 `⌘K`
- [ ] 多图生图屏
- [ ] HTTP API 对接（开发阶段替代 Tauri IPC）

---

## 8. 相关文档

- 用户视角：[README.md](../../README.md)
- Agent 视角：[AGENT.md](../AGENT.md)
- 后端开发：[server.md](./server.md)
- 开发日志：[vibecoding_log.md](../vibecoding_log.md)