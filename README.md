# 白石 BaiShi

白石是一个本地优先的桌面生图原型项目，面向自媒体创作者、营销和设计师。当前仓库包含一套可直接打开联调的前端页面，以及一套 Rust 后端，用于本地持久化、历史记录管理、预设管理和第三方图像/文本生成接口转发。

当前版本：`v0.0.1_test`
开源许可证：Apache License 2.0

## 当前状态

- 前端为多页面桌面应用原型，入口在 `front/index.html`
- 功能页共 8 个：工作台、文生文、文生图、图生图、多图融合、灵感墙、历史作品、设置
- 设置页已内置“关于”面板，包含开源说明、项目说明和检查更新入口
- 后端以 `baishi-dev` HTTP 服务为主，默认端口 `3456`
- 图像生成走“用户可配置供应商 + 请求体模板”模式，不内置本地模型
- 文案生成走独立的生文 API 配置
- 历史作品、收藏状态、预设和设置保存在本地 SQLite

## 项目结构

```text
Qi_Baishi/
├── front/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── pages/
├── src-tauri/
│   ├── src/
│   ├── API.md
│   ├── Cargo.toml
│   └── tauri.conf.json
├── assets/
├── docs/
└── README.md
```

## 页面说明

### `front/index.html`

项目入口和落地页，提供版本信息和首次配置引导。

### `front/pages/workspace.html`

工作台首页，展示快捷入口、最近作品、趋势和概览信息。

### `front/pages/copywriting.html`

文生文页面。生成完成后默认进入“审阅视图”，可切换到“编辑视图”直接编辑原始文本。

### `front/pages/text-to-image.html`

文生图页面，支持固定负面提示词、参数控制、结果卡片预览和原图放大。

### `front/pages/image-to-image.html`

图生图页面，支持上传参考图、负面提示词、重绘强度和结果对比。

### `front/pages/multi-image.html`

多图融合作图页面，支持多张参考图输入。

### `front/pages/presets.html`

灵感墙页面，包含图像风格和文案风格两类素材的浏览、管理和编辑。

### `front/pages/history.html`

历史作品页，支持图片和文案混合展示、收藏筛选、批量管理、图片大图预览、文案全文弹层。

### `front/pages/settings.html`

设置页，包含图像 API、生文 API、存储、偏好和“关于”面板。

## 技术栈

- 前端：HTML、CSS、原生 JavaScript
- 后端：Rust、Axum、Reqwest、Rusqlite、Tauri 2
- 持久化：SQLite + 本地 `localStorage`
- 联调方式：
  - 开发期：HTTP 服务 `baishi-dev`
  - 打包期：Tauri `invoke` 命令

## 快速开始

### 1. 启动开发 HTTP 服务

```bash
cargo run --manifest-path src-tauri/Cargo.toml --bin baishi-dev
```

默认会启动在：

```text
http://localhost:3456
```

启动后可直接访问：

- `http://localhost:3456/`
- `http://localhost:3456/pages/workspace.html`

### 2. 自定义端口

```bash
BAISHI_PORT=3458 cargo run --manifest-path src-tauri/Cargo.toml --bin baishi-dev
```

### 3. 配置 API

进入“设置”页后：

- 在“图像 API”中选择供应商、填写 API Key、端点和请求体模板
- 在“生文 API”中填写 URL、API Key 和模型

未配置时，相关页面会给出本地提示，不会隐式调用远端服务。

## 后端二进制

`src-tauri/Cargo.toml` 当前定义了 3 个二进制目标：

- `baishi-dev`：开发联调用 HTTP 服务器，最常用
- `baishi-server`：命令行测试入口，会做一轮后端能力验证
- `baishi`：Tauri 桌面入口

## 数据与隐私

- SQLite 在运行时写入应用数据目录下的 `baishi.db`
- 当前仓库中的 `src-tauri/baishi.db` 已在 `.gitignore` 中忽略
- 图像 API Key 会保存在本地设置中；前端还会将部分配置写入 `localStorage`
- 历史作品页中的收藏、预设、文案历史都属于本地数据

## 开发约定

- 前端是多页面结构，不是 SPA
- 页面共用 `front/css/app-chrome.css` 和 `front/js/baishi-shared.js`
- 右下角操作提示统一走共享 `toast`
- 页面切换动画当前已取消，`page-loader.js` 只负责安全隐藏加载层
- 文档以当前代码为准，不再沿用旧版本中的本地模型、登录页和订阅体系描述

## 常用检查

前端脚本语法检查：

```bash
node --check front/js/settings.js
node --check front/js/history.js
node --check front/js/text-to-image.js
node --check front/js/copywriting.js
```

后端编译检查：

```bash
cargo check --manifest-path src-tauri/Cargo.toml --bin baishi-dev
```

## 相关文档

- [docs/Developer.md](docs/Developer.md)
- [docs/AGENT.md](docs/AGENT.md)
- [docs/DEVELOPER/front.md](docs/DEVELOPER/front.md)
- [docs/DEVELOPER/server.md](docs/DEVELOPER/server.md)
- [src-tauri/API.md](src-tauri/API.md)
