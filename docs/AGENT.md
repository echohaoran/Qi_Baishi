# AGENT.md

本文件记录白石项目对后续 Agent 最重要的当前事实，目的是减少接手时再次踩进过期信息。

## 项目快照

- 项目名：白石 `BaiShi`
- 当前版本：`v0.0.1_test`
- 类型：本地优先的桌面生图原型
- 前端：`front/` 下多页面 HTML/CSS/JS
- 后端：`src-tauri/` 下 Rust + Axum + Rusqlite + Tauri
- 联调主入口：`cargo run --manifest-path src-tauri/Cargo.toml --bin baishi-dev`
- 默认地址：`http://localhost:3456`
- 开源许可证：Apache License 2.0

## 不要再写错的项目事实

- 当前没有独立的 `auth.html` 登录页，旧文档里的登录/注册流程已经过期
- 当前是 `landing + 8 个功能页`，不是“7 屏”
- 项目不内置本地模型，图像生成依赖用户配置的第三方接口
- 设置页中已经有“关于”面板，不需要新增单独 about 页面
- 右下角操作提示已经收敛到共享 `window.BaishiShared.toast(...)`
- 页面切换过渡动画已经取消，`page-loader.js` 只负责初始化后隐藏加载层
- 历史作品页支持图片和文案两类内容，且有“收藏”筛选
- 文生文页面已经有“审阅视图 / 编辑视图”双模式

## 页面清单

- `front/index.html`：落地页与首次配置引导
- `front/pages/workspace.html`：工作台
- `front/pages/copywriting.html`：文生文
- `front/pages/text-to-image.html`：文生图
- `front/pages/image-to-image.html`：图生图
- `front/pages/multi-image.html`：多图融合
- `front/pages/presets.html`：灵感墙
- `front/pages/history.html`：历史作品
- `front/pages/settings.html`：设置与关于

## 前端共享约定

- 页面外壳统一使用 `.window > .titlebar + .app`
- 共用样式基线：
  - `front/css/ink-wash.css`
  - `front/css/app-chrome.css`
  - `front/css/page-loader.css`
- 共用脚本基线：
  - `front/js/baishi-shared.js`
  - `front/js/api-client.js`
  - `front/js/page-loader.js`
- 每个功能页都应保留 `#toasts`
- 主题通过 `localStorage['baishi.theme']` 写入 `data-theme`

## 本地状态与存储

### localStorage

- `baishi.api.image.providers`
- `baishi.api.image.active`
- `baishi.api.image.key`
- `baishi.api.text`
- `baishi.prefs`
- `baishi.session`
- `baishi.theme`

### SQLite

运行时数据库由 `Storage::open()` 在应用数据目录下创建，核心表有：

- `users`
- `sessions`
- `artworks`
- `presets`
- `settings`
- `generation_log`

开发模式会自动调用 `ensure_default_user()` 确保 `user_id = 1` 存在。

## 后端关键事实

- `baishi-dev` 是联调用 HTTP 服务，不是测试脚本
- `baishi-server` 是命令行后端能力测试入口
- 图像生成入口：
  - `POST /api/generate/text`
  - `POST /api/generate/image`
- 文本生成入口：
  - `POST /api/text/enhance`
  - `POST /api/text/generate`
- 健康检查：
  - `GET /api/health`
- 图像供应商请求体支持模板占位符，并且后端会兼容旧模板中的字符串数值字段

## 编辑时避免回退的内容

- 不要重新引入页面切换动画
- 不要新增订阅、计费、套餐 UI
- 不要把共享 toast 再拆回页面私有实现
- 不要把“关于”入口移出 `settings.html`
- 不要把历史预览弹层写死为某个主题
- 不要在文生图结果区恢复“按原图比例撑高卡片”

## 文档约定

- 任何涉及 README 或 `docs/` 的改动，都以当前代码为准
- 遇到过时叙述，应直接纠正，不保留历史误导描述
- `docs/vibecoding_log.md` 记录当前基线与近期待办，不再堆叠失效流水账
- 文档职责需要保持分层，避免同一套接口在多处重复维护：
  - `README.md`：项目总览、启动方式、构建发布、接口高层摘要
  - `src-tauri/API.md`：唯一准确的 HTTP / Tauri 接口文档来源
  - `docs/DEVELOPER/front.md`：前端页面、脚本分工与联调约定
  - `docs/DEVELOPER/server.md`：后端模块结构、运行方式、数据流与实现约束
- 若接口有变更，应优先更新 `src-tauri/API.md`，再检查 README 中的高层摘要是否需要同步
