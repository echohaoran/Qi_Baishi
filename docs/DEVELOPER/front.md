# 前端开发说明

本文档说明当前 `front/` 目录的结构、共享机制、页面职责和开发约束。

## 1. 现状概览

- 技术栈：HTML + CSS + 原生 JavaScript
- 组织方式：多页面桌面应用原型
- 页面入口：`front/index.html`
- 功能页数量：8
- 版本：`v0.0.1_test`
- 主题：浅色/深色双模式，依赖 `data-theme`

前端当前不使用框架，也不是 SPA。页面之间直接通过 `<a href="*.html">` 跳转。

## 2. 目录结构

```text
front/
├── index.html
├── css/
│   ├── app-chrome.css
│   ├── copywriting.css
│   ├── history.css
│   ├── ink-wash.css
│   ├── landing.css
│   ├── page-loader.css
│   ├── presets.css
│   ├── settings.css
│   └── text-to-image.css
├── js/
│   ├── api-client.js
│   ├── baishi-shared.js
│   ├── copywriting.js
│   ├── history.js
│   ├── image-to-image.js
│   ├── multi-image.js
│   ├── page-loader.js
│   ├── presets.js
│   ├── settings.js
│   ├── text-styles.js
│   ├── text-to-image.js
│   └── workspace.js
└── pages/
    ├── copywriting.html
    ├── history.html
    ├── image-to-image.html
    ├── multi-image.html
    ├── presets.html
    ├── settings.html
    ├── text-to-image.html
    └── workspace.html
```

## 3. 页面职责

### `index.html`

落地页和首次配置引导页。

### `pages/workspace.html`

工作台，总览入口、最近作品和状态信息。

### `pages/copywriting.html`

文生文工作区。结果区分为：

- 审阅视图：Markdown 渲染后的阅读态
- 编辑视图：原始文本可编辑态

### `pages/text-to-image.html`

文生图主页面。当前关键行为：

- 固定负面提示词
- 智能润色
- 统一尺寸结果卡片
- 点击卡片查看原图

### `pages/image-to-image.html`

图生图页面。当前关键行为：

- 上传参考图
- 可编辑提示词预设
- 结果下载

### `pages/multi-image.html`

多图融合作图页面。

### `pages/presets.html`

灵感墙页面，同时管理：

- 图像风格素材
- 文案风格素材

支持搜索、排序、收藏、编辑模式。

### `pages/history.html`

历史作品页，同时展示图片与文案：

- 收藏筛选
- 图片大图预览
- 文案全文阅读弹层
- 批量删除

### `pages/settings.html`

设置页，包含：

- 图像 API 配置
- 生文 API 配置
- 存储与偏好
- 关于面板

## 4. 共享脚本与样式

### 样式

- `ink-wash.css`：全局设计令牌和基础视觉语言
- `app-chrome.css`：应用壳、侧栏、按钮、toast、弹层等共享组件
- `page-loader.css`：加载层样式

### 脚本

- `baishi-shared.js`
  - 供应商配置
  - 文本 API 配置
  - 偏好读写
  - 共享 `toast`
- `api-client.js`
  - 所有 HTTP API 封装
- `page-loader.js`
  - 页面初始化后隐藏加载层
  - 当前不再接管页面切换动画

## 5. 共享状态

### localStorage 键

- `baishi.api.image.providers`
- `baishi.api.image.active`
- `baishi.api.image.key`
- `baishi.api.text`
- `baishi.prefs`
- `baishi.session`
- `baishi.theme`

### 页面公共约定

- 页面里应保留 `<div class="toast-host" id="toasts"></div>`
- 提示统一调用 `window.BaishiShared.toast(...)`
- 页面 `<head>` 内会先写入当前主题：

```html
<script>
  try {
    var t = localStorage.getItem("baishi.theme") || "light";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
</script>
```

## 6. API 对接方式

前端当前一律走 HTTP：

- 基础地址：`http://localhost:3456`
- 图像生成：
  - `POST /api/generate/text`
  - `POST /api/generate/image`
- 文本生成：
  - `POST /api/text/enhance`
  - `POST /api/text/generate`
- 设置：
  - `GET/POST /api/settings/1`
- 历史：
  - `GET /api/history`
  - `POST /api/history/favorite`
  - `POST /api/history/delete`

## 7. 当前前端必须保持的行为

- 右下角 toast 只保留共享实现，不再页面私有放大/缩放
- 历史预览弹层必须跟随当前主题
- 文生图结果卡片尺寸固定，原图在弹层中查看
- 设置页供应商切换后显示真实官网链接
- 设置页“关于”面板保留开源说明、项目说明和更新入口
- 页面最外层使用统一圆角矩形外框

## 8. 联调与检查

启动后端：

```bash
cargo run --manifest-path src-tauri/Cargo.toml --bin baishi-dev
```

脚本语法检查：

```bash
node --check front/js/settings.js
node --check front/js/history.js
node --check front/js/text-to-image.js
node --check front/js/copywriting.js
```

## 9. 常见误区

- 不要把项目描述成 SPA 或 Electron 应用
- 不要再写“auth.html 登录页”
- 不要再写“页面切换带过渡动画”
- 不要在页面内再造一套 toast 系统
- 不要把旧的本地模型叙述写回 README 或开发文档
