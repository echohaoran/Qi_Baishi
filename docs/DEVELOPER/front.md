# Frontend Development · 白石 BaiShi

> 水墨生图桌面应用白石 BaiShi 的前端开发说明。
> 项目位置：`/Users/echowang/git/Qi_Baishi/`
> 读者：前端开发者 / Agent。
> 用途：了解前端模块划分、目录约定、组件系统、IPC 调用方式。

---

## 1. 项目定位

**白石 BaiShi** 是一款面向创作者（自媒体 / 营销 / 平面设计师）的**桌面生图应用**，界面采用水墨画风格，**支持在线API+本地推理**（SDXL-BaiShi-v2 模型 + Rust 推理引擎），打包为 macOS / Windows 原生客户端。

- 桌面端形态（Tauri 打包），非网页
- 完全离线运行 · 数据不出本机
- 7 个核心界面：工作台、文生图、图生图、灵感墙、历史作品、设置/账户、登录/注册
- 视觉语言：宣纸底 + 浓墨 / 淡墨 / 灰墨 + 朱砂红印章 + 笔触元素

---

## 2. 架构概览（前端视角）

```
┌──────────────────────────────────────┐
│            Tauri Shell                │
│   原生窗口 · 菜单栏 · 文件系统       │
├──────────────────────────────────────┤
│         Frontend（WebView）           │
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
│     └─ IPC invoke → Rust 后端        │
│                                       │
├──────────────────────────────────────┤
│      IPC Bridge（Tauri Commands）     │
│   invoke(cmd, args) → Rust 后端      │
│   ← event: job:progress / done /     │
│            system:notify             │
└──────────────────────────────────────┘
```

**数据流**：用户在 HTML 屏输入 → JS 收集参数 → `invoke('generate_image', payload)` → Rust 端推理 → 事件回推进度 → 完成后展示。

---

## 3. 目录结构（前端部分）

```
BaiShi/
├── front/                       前端文件总目录
│   ├── index.html               着陆页（Header + Hero 3D扇卡 + Footer）
│   ├── pages/                   8 个功能页面
│   │   ├── auth.html            登录 / 注册（邮箱+密码）
│   │   ├── workspace.html       工作台（首页）
│   │   ├── text-to-image.html   文生图
│   │   ├── image-to-image.html  图生图
│   │   ├── presets.html         灵感墙 Hub（画廊+妙笔生花+编辑器）
│   │   ├── copywriting.html     妙笔生花（文案生成）
│   │   ├── history.html         历史作品库
│   │   └── settings.html        设置/账户
│   ├── css/
│   │   ├── ink-wash.css         白石设计系统（令牌 + 工具类）
│   │   ├── app-chrome.css       桌面应用窗体栏 / 侧栏 / 组件
│   │   ├── landing.css          着陆页专用
│   │   ├── presets.css          灵感墙专用
│   │   ├── text-to-image.css    文生图专用
│   │   ├── copywriting.css      妙笔生花专用
│   │   └── history.css          历史作品库专用
│   ├── js/
│   │   ├── presets.js           画廊预设 + 编辑器
│   │   ├── text-to-image.js     文生图逻辑
│   │   ├── image-to-image.js    图生图逻辑
│   │   ├── copywriting.js       文案模板
│   │   ├── history.js           历史逻辑
│   │   ├── settings.js          设置逻辑
│   │   └── auth.js              登录逻辑
│   └── meta/                    artifact 记录
├── assets/                      静态资源
│   ├── posters/                 25 张真实海报素材
│   ├── drawings/                绘图缓存
│   └── logo.png
├── Templete/                    模板素材库
│   ├── Copywriting/             10 种文风模板
│   └── Gallery/                 画廊示例
└── docs/
    ├── DEVELOPER/
    │   ├── front.md              本文件
    │   └── server.md             后端开发说明
    ├── AGENT.md
    ├── README.md
    └── vibecoding_log.md
```

---

## 4. 前端架构（HTML + CSS + JS）

### 4.1 HTML：7 屏 + 着陆页

每个屏幕是独立的 `.html` 文件，统一引用 `ink-wash.css` + `app-chrome.css`。这是**屏级路由**的形态：用户在不同 `.html` 间跳转（`<a href>`），不需要 SPA 框架。

**为什么不用 SPA**：
- 7 个屏之间没有强共享状态（账户信息在 `localStorage`）
- 屏间切换稀疏（不会频繁来回）
- 单屏可独立加载/调试，避免首屏过重
- 与 Tauri 的 WebView 多页面模式天然契合

**统一外壳**：每个屏都包含 `.window > .titlebar + .app(sidebar + .content)`，由 `app-chrome.css` 提供样式。

### 4.2 CSS 设计系统

#### 两套共享文件

| 文件 | 职责 | 体积 |
|---|---|---|
| `ink-wash.css` | 设计令牌（`:root`）· 字体阶 · 按钮/卡片/表单 · 印章 · 笔触 · 动画 | 24 KB |
| `app-chrome.css` | macOS/Windows 标题栏 · 侧栏 · 内容区 · 状态栏 · 模态 · Toast | 25 KB |

**规则**：任何屏都不要重写 `:root` 令牌。需要派生颜色用 `color-mix(in oklab, var(--accent), black 20%)`。

#### 核心令牌一览

- **纸面**：`--bg #f1ead7` · `--surface #f8f3e3` · `--surface-2 #f4ecd6`
- **墨阶**：`--fg #1d1814` · `--fg-2 #4a4138` · `--muted #7a6f5f` · `--meta #a89a82`
- **朱砂**：`--accent #a8322e` · `--accent-deep #7c1f1c` · `--accent-soft rgba(168,50,46,.1)`
- **字体**：`--font-display` Noto Serif SC · `--font-body` Noto Sans SC · `--font-mono` JetBrains Mono · `--font-brush` Noto Serif SC（笔触字）
- **8px 网格**：`--space-1 ~ --space-20`
- **圆角**：`--radius-sm 4px` · `--radius 8px` · `--radius-lg 12px` · `--radius-pill 9999px` · `--radius-seal 6px`（印章）
- **签名元素**：`.seal` 印章 + `.eyebrow::before` 笔触斜线

### 4.3 JavaScript 交互层

当前原型阶段每个 HTML 内嵌一段 `<script>`。Tauri 工程化后的拆分目标：

| 目录/文件 | 职责 |
|---|---|
| `src/ipc/*.ts` | 每个 Tauri Command 对应一个 TS 模块，导出类型安全的 `invoke` 函数 |
| `src/screens/*.ts` | 每个屏挂载逻辑 |
| `src/stores/` | 账户/算力/设置的全局状态（轻量 Zustand 或自写） |

#### 当前已实现的交互模式

| 页面 | 交互要点 |
|---|---|
| 文生图 | 提示词计数 · 固定提示词片段 · 智能润色（mock） · 参数滑块 · 生成按钮 |
| 图生图 | 上传 · 拖拽 · 风格预设套用 · before/after 对比 |
| 灵感墙 | 风格卡片网格 · 点击弹出详情（左侧大图 + 右侧元数据） |
| 历史 | 日期分组 · 网格/列表切换 · 筛选标签 · 收藏 |
| 设置 | API 密钥单独配置 · 本地存储路径 · 主题（未来扩展） |
| 命令面板 | `⌘K` 唤起（待补全） |
| OS 切换 | 顶栏右上 `macOS / Windows` 切换器，纯 CSS 切换窗体栏样式 |

---

## 5. IPC 契约（前端调用）

### 5.1 Command 调用清单

所有后端调用通过 `invoke(cmd, args)` 完成。参考类型：

```typescript
// 文生图请求
interface GenerateRequest {
  prompt: string;
  negative_prompt?: string;
  style_id?: string;
  seed?: number;
  steps: number;          // 20-50
  cfg_scale: number;      // 1-20
  aspect: string;         // "1:1" | "16:9" | "9:16" | "4:5" | "21:9"
  reference_image?: string;  // 图生图 base64
  strength?: number;      // 0-1 图生图重绘强度
}
```

### 5.2 可订阅事件

| Event | Payload | 触发时机 |
|---|---|---|
| `job:progress` | `{job_id, step, total_steps, preview?}` | 生成进度更新 |
| `job:done` | `{job_id, image_path, seed, took_ms}` | 生成完成 |
| `job:error` | `{job_id, message}` | 生成失败 |
| `system:notify` | `{kind, title, body}` | 系统通知 |

### 5.3 前端调用示例（伪代码）

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// 发起生成
const { job_id } = await invoke('generate_text_to_image', request);

// 监听进度
const unlisten = await listen('job:progress', (event) => {
  const { step, total_steps } = event.payload;
  updateProgress(step / total_steps);
});

// 监听完成
await listen('job:done', (event) => {
  displayImage(event.payload.image_path);
  unlisten();
});
```

---

## 6. 测试策略（前端）

| 类型 | 方式 |
|---|---|
| 目视检查 | 各 HTML 文件在浏览器直接打开 |
| 交互验证 | 表单录入、滑块、拖拽、弹窗流程 |
| 响应式 | 检查 macOS/Windows 顶栏切换效果 |
| E2E | Tauri Driver + WebDriver（未来） |

---

## 7. 路线图（前端项目）

- [x] HTML/CSS 原型（7 屏 + 着陆页 + 25 款真实海报预设 + 妙笔生花文案）
- [x] 画廊编辑器支持图片上传、自定义分类、标签编辑，文风详情可编辑
- [x] 项目迁移到独立仓库 `front/` 目录
- [x] 全站侧边栏统一，首页简化，设置页功能完善
- [ ] 命令面板 `⌘K`
- [ ] 多图生图屏
- [ ] 主题扩展（暗色宣纸 / 仿古纸）
- [ ] Tauri 工程化后迁移至 `src/` + Vite 构建

---

## 8. 相关文档

- 用户视角：[README.md](../README.md)
- Agent 视角：[AGENT.md](../AGENT.md)
- 后端开发：[server.md](./server.md)
- 开发日志：[vibecoding_log.md](../vibecoding_log.md)
