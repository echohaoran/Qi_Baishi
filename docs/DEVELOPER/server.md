# 后端开发说明

本文档说明 `src-tauri/` 目录当前的 Rust 后端结构、主要接口和开发方式。

## 1. 现状概览

- 语言：Rust 2021
- HTTP：Axum
- 持久化：Rusqlite（SQLite）
- 网络：Reqwest
- 桌面壳：Tauri 2
- 当前版本：`0.1.4`

后端当前负责 4 件事：

- 本地数据持久化
- 图像生成接口转发
- 文本生成接口转发
- 为前端提供联调 HTTP API

## 2. 二进制目标

`src-tauri/Cargo.toml` 当前定义：

- `baishi`
  - 文件：`src/main.rs`
  - 作用：Tauri 桌面应用入口
- `baishi-server`
  - 文件：`src/server.rs`
  - 作用：命令行功能测试入口，不是常驻 HTTP 服务
- `baishi-dev`
  - 文件：`src/server_http.rs`
  - 作用：开发联调 HTTP 服务，当前主入口

## 3. 开发启动

### 推荐方式

```bash
cargo run --manifest-path src-tauri/Cargo.toml --bin baishi-dev
```

默认端口：

```text
http://localhost:3456
```

可通过环境变量改端口：

```bash
BAISHI_PORT=3458 cargo run --manifest-path src-tauri/Cargo.toml --bin baishi-dev
```

## 4. 目录结构

```text
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── API.md
└── src/
    ├── auth/
    │   └── mod.rs
    ├── commands/
    │   └── mod.rs
    ├── events/
    │   └── mod.rs
    ├── inference/
    │   └── mod.rs
    ├── storage/
    │   └── mod.rs
    ├── lib.rs
    ├── main.rs
    ├── server.rs
    ├── server_http.rs
    └── types.rs
```

## 5. 模块职责

### `storage/mod.rs`

- 打开 SQLite
- 迁移表结构
- 确保开发默认用户存在
- 提供 artworks / presets / settings 等 CRUD

当前 `Storage::open()` 会执行：

1. `migrate()`
2. `ensure_default_user()`

开发联调默认会保证 `user_id = 1` 可用。

### `inference/mod.rs`

- `GenericEngine`
- 供应商请求体模板替换
- 图生图与多图融合请求组装
- 解析上游返回的 URL / Base64 图片

当前不是绑定单一供应商，而是“通用引擎 + 用户配置模板”模式。

### `server_http.rs`

开发 HTTP 服务入口，负责：

- 挂载 `/api/*` 路由
- 返回统一 `{ success, data, error }`
- 提供静态文件服务，直接把 `../front` 暴露给浏览器

### `main.rs`

Tauri 入口，通过 `invoke_handler` 暴露命令给桌面端。

## 6. 接口文档约定

本文件不再维护完整接口清单、请求体和返回结构，避免与 `src-tauri/API.md` 发生双份漂移。

当前约定如下：

- `src-tauri/API.md`：唯一准确的接口文档来源
- `docs/DEVELOPER/server.md`：只描述后端模块结构、运行方式、数据流和实现约束
- `README.md`：只保留面向使用者的高层接口摘要与文档导航

当前真实接口范围包含：

- 鉴权：`/api/auth/*`
- 图像生成：`/api/generate/*`
- 文本能力：`/api/text/*`
- 历史与预设：`/api/history*`、`/api/presets`
- 设置与存储：`/api/settings/{user_id}`、`/api/storage/info`
- 健康检查：`/api/health`

如需查看：

- 精确路由名
- 请求参数
- 返回结构
- 默认值
- Tauri `invoke` 命令列表

请直接查阅 `src-tauri/API.md`。

## 7. 图像供应商模板机制

前端会把以下内容带给后端：

- `endpoint`
- `api_key`
- `request_body`

后端会做两类处理：

### 占位符替换

模板中支持的典型占位符：

- `{{prompt}}`
- `{{negative_prompt}}`
- `{{n}}`
- `{{seed}}`
- `{{steps}}`
- `{{cfg_scale}}`
- `{{aspect}}`
- `{{size}}`
- `{{width}}`
- `{{height}}`
- `{{image}}`
- `{{images}}`

### 兼容修复

为了兼容旧设置模板，后端会自动修正：

- 被错误写成字符串的数值字段
- 被错误写成字符串的布尔字段
- 某些供应商不接受的旧字段

这部分逻辑在 `normalize_loose_template_types()` 和供应商字段规范化流程里。

## 8. 数据持久化

### 数据目录

运行时使用系统应用数据目录：

- macOS：`~/Library/Application Support/studio.baishi.desktop/`
- Windows：`%APPDATA%/studio.baishi.desktop/`

数据库文件名：

```text
baishi.db
```

### 核心表

- `users`
- `sessions`
- `artworks`
- `presets`
- `settings`
- `generation_log`

### 当前业务事实

- 历史作品里的图片和文案都落在 `artworks`
- 文案作品会使用 `style_id = "copywriting"` 标记来源
- 收藏筛选走 `list_artworks(..., filter = Some("favorites"))`

## 9. 环境变量

- `BAISHI_PORT`
  - HTTP 服务端口
- `BAISHI_API_KEY`
  - 默认图像 API Key

注意：代码里仍保留默认测试 Key 回退，正式环境应通过环境变量或设置页显式覆盖。

## 10. 当前需要避免的回退

- 不要把 HTTP 联调主入口写成 `baishi-server`
- 不要把后端描述成“本地 SDXL 模型推理”
- 不要删掉 `ensure_default_user()`，当前很多前端联调默认依赖 `user_id = 1`
- 不要修改响应包格式 `{ success, data, error }`
- 不要把文案历史单独拆离 `artworks`，前端历史页已经按混合内容实现

## 11. 检查命令

```bash
cargo check --manifest-path src-tauri/Cargo.toml --bin baishi-dev
cargo check --manifest-path src-tauri/Cargo.toml --bin baishi
cargo run --manifest-path src-tauri/Cargo.toml --bin baishi-server
```

健康检查：

```bash
curl http://localhost:3456/api/health
```

## 12. 相关文档

- [`README.md`](../../README.md)
- [`src-tauri/API.md`](../../src-tauri/API.md)
- [`docs/AGENT.md`](../AGENT.md)
