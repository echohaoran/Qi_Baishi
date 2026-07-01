# Backend Development · 白石 BaiShi

> 水墨生图桌面应用白石 BaiShi 的后端（Rust）开发说明。
> 项目位置：`/Users/echowang/git/Qi_Baishi/`
> 读者：后端 Rust 开发者 / Agent。
> 用途：了解后端架构、API 引擎、IPC 契约、持久化方案。

---

## 核心设计原则

- **纯本地部署**：应用、数据库、作品文件全部在本地，不上传任何数据
- **可自定义生图 API**：不内置任何本地模型，生图通过用户配置的在线 API 完成
- **API 兼容性**：支持任何兼容 OpenAI `v1/images/generations` 格式的接口

---

## 1. 后端整体架构

```
┌──────────────┐      ┌──────────────────────┐
│  前端页面     │      │  生图 API（用户配置）   │
│  (front/)    │      │  e.g. Agnes / 阿里云   │
└──────┬───────┘      └──────────┬───────────┘
       │ HTTP / Tauri IPC        │ HTTPS
       ▼                         ▼
┌─────────────────────────────────────────────┐
│            Rust 后端服务                      │
│                                              │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐    │
│  │  auth   │  │storage  │  │  events  │    │
│  │ 鉴权模块│  │ SQLite  │  │  事件系统 │    │
│  └────┬────┘  └────┬────┘  └──────────┘    │
│       │            │                        │
│  ┌────┴────────────┴──────────────────┐    │
│  │          inference                  │    │
│  │     API 引擎（HTTP 客户端）          │    │
│  │  ┌──────────────────────────┐      │    │
│  │  │  AgnesEngine / 自定义API  │      │    │
│  │  │  reqwest → 用户配置的URL  │      │    │
│  │  └──────────────────────────┘      │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

- **API 引擎**：通过 `reqwest` 调用用户配置的在线 API，不依赖任何本地模型
- **数据本地化**：SQLite + 文件系统，所有作品与设置仅存本地

---

## 2. Crate 结构（当前态）

```
src-tauri/src/
├── main.rs               Tauri 入口（可选，需要 Tauri 构建环境）
├── server.rs             独立 HTTP 服务器入口（开发测试用）
├── lib.rs                库入口，导出所有模块
├── types.rs              共享 IPC 类型（GenerateRequest、Artwork 等）
├── commands/             Tauri Command handler（IPC 入口）
│   └── mod.rs            13 个 Command：auth / generate / history / presets / settings / storage
├── inference/            推理引擎核心 — 调用在线 API
│   └── mod.rs            InferenceEngine trait + AgnesEngine 实现
├── storage/              数据持久化
│   └── mod.rs            SQLite 连接 + 迁移 + 所有实体的 CRUD
├── auth/                 密码与会话
│   └── mod.rs            Argon2id 哈希 + session token
└── events/               前端订阅的事件 payload
    └── mod.rs            事件枚举（job:progress / done / error / system:notify）
```

---

## 3. API 引擎

### 3.1 实现

| 组件 | 说明 |
|------|------|
| `InferenceEngine` trait | `fn generate(&self, req: &GenerateRequest) -> Result<GenerateResult, String>` |
| `AgnesEngine` | 默认实现，调用 Agnes Image 2.1 Flash API |
| 自定义 API | 只需实现 `InferenceEngine` trait，可对接任意后端 |

### 3.2 API 请求格式（以 Agnes Image 2.1 Flash 为例）

端点：`POST https://apihub.agnes-ai.com/v1/images/generations`

请求体：
```json
{
  "model": "agnes-image-2.1-flash",
  "prompt": "远山含黛，江面薄雾，一叶孤舟，水墨画风格",
  "size": "1024x1024",
  "n": 3,
  "seed": 42,
  "image": ["https://..."],
  "image": ["data:image/png;base64,..."]
}
```

响应：
```json
{
  "created": 1712345678,
  "data": [
    { "url": "https://platform-outputs.agnes-ai.space/images/t2i/xxx.png" }
  ]
}
```

### 3.3 API 密钥

密钥通过以下方式获取（优先级从高到低）：
1. 环境变量 `BAISHI_API_KEY`（开发阶段）
2. 前端设置页用户填写（生产阶段）
3. 内置测试密钥（仅开发测试）

密钥加密存储在本地 SQLite `settings` 表中。

---

## 4. IPC 契约

### 4.1 Command 清单（前端 → 后端）

| Command | 参数 | 返回 | 说明 |
|---|---|---|---|
| `auth_register` | `{email, password}` | `{user_id}` | 注册 |
| `auth_login` | `{email, password}` | `{session_token, user}` | 登录 |
| `auth_logout` | `{session_token}` | `()` | 登出 |
| `generate_text_to_image` | `GenerateRequest` | `{job_id, images[]}` | 文生图 → 在线 API |
| `generate_image_to_image` | `GenerateRequest + reference` | `{job_id, images[]}` | 图生图 → 在线 API |
| `cancel_job` | `{job_id}` | `()` | 取消生成（预留） |
| `list_history` | `{page, filter}` | `{items, total}` | 历史列表 |
| `toggle_favorite` | `{artwork_id}` | `bool` | 收藏/取消 |
| `delete_artwork` | `{artwork_id}` | `()` | 删除作品 |
| `get_artwork` | `{artwork_id}` | `Artwork?` | 作品详情 |
| `list_presets` | `{category?}` | `[Preset]` | 风格预设列表 |
| `save_preset` | `{name, category, prompt, aspect?}` | `{preset_id}` | 自定义预设 |
| `get_settings` | `{user_id}` | `Settings` | 用户设置 |
| `update_settings` | `{user_id, settings}` | `()` | 更新设置（含 API 密钥） |
| `get_storage_info` | `()` | `{used, available}` | 存储用量 |

### 4.2 Event 清单（后端 → 前端）

| Event | Payload | 说明 |
|---|---|---|
| `job:progress` | `{job_id, step, total_steps, preview?}` | 生成进度（预留） |
| `job:done` | `{job_id, image_url, seed, took_ms}` | 完成 |
| `job:error` | `{job_id, message}` | 失败 |
| `system:notify` | `{kind, title, body}` | 系统通知 |

### 4.3 共享类型

```rust
#[derive(Serialize, Deserialize)]
pub struct GenerateRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub style_id: Option<String>,
    pub seed: Option<u64>,
    pub steps: u32,
    pub cfg_scale: f32,
    pub aspect: String,            // "1:1" / "16:9" / "9:16" / "4:5" / "21:9"
    pub reference_image: Option<String>,  // 图生图：图片 URL
    pub strength: Option<f32>,
    pub count: u32,                // 出图数量 1-4
}

#[derive(Serialize, Deserialize)]
pub struct GenerateResult {
    pub job_id: String,
    pub images: Vec<GeneratedImage>,
    pub seed_used: u64,
    pub took_ms: u64,
}
```

---

## 5. 数据持久化方案

### 5.1 SQLite Schema（v1）

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free'
);

CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE TABLE artworks (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    style_id TEXT,
    seed INTEGER,
    steps INTEGER,
    cfg_scale REAL,
    aspect TEXT,
    file_path TEXT NOT NULL,
    thumb_path TEXT,
    is_favorite INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE presets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    prompt TEXT NOT NULL,
    aspect TEXT,
    is_builtin INTEGER DEFAULT 0
);

CREATE TABLE settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    api_key TEXT,
    api_endpoint TEXT,
    storage_path TEXT,
    theme TEXT DEFAULT 'ink',
    shortcuts TEXT
);

CREATE TABLE generation_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    job_id TEXT NOT NULL,
    cost INTEGER NOT NULL,
    created_at INTEGER NOT NULL
);
```

### 5.2 文件存储

用户作品元数据写入 SQLite，图片文件由 API 端托管返回 URL。  
本地仅存储作品记录、收藏、预设、设置等结构化数据。

| 平台 | 数据根路径 |
|---|---|
| macOS | `~/Library/Application Support/studio.baishi.desktop/` |
| Windows | `%APPDATA%\studio.baishi.desktop\` |

---

## 6. 开发与测试

### 6.1 开发环境

```bash
# 编译库
cargo check --lib

# 运行独立测试（含真实 API 调用）
cargo run --bin baishi-server
```

### 6.2 测试策略

| 类型 | 方式 |
|---|---|
| 单元测试 | `cargo test` |
| 集成测试 | `cargo run --bin baishi-server`（含 SQLite + Agnes API） |
| 代码质量 | `cargo clippy` + `cargo fmt` |

### 6.3 API 密钥配置

```bash
# 使用环境变量传递 API 密钥
BAISHI_API_KEY=sk-xxx cargo run --bin baishi-server
```

---

## 7. 安全与隐私

- **完全本地**：默认不出网，仅向用户配置的 API 发送生图请求
- **密码**：Argon2id 哈希，不存明文
- **Session token**：随机 256 bit，7 天有效期
- **API 密钥**：存储在本地 SQLite，不发送到任何第三方
- **用户作品**：仅存本地，不上传任何云端

---

## 8. 路线图（后端）

- [x] SQLite 持久化（6 张表 + 自动迁移）
- [x] 鉴权模块（Argon2id + session）
- [x] 在线 API 引擎（Agnes Image 2.1 Flash）
- [x] IPC Command 骨架（13 个 Command）
- [ ] HTTP API 服务器（开发用，替代 Tauri IPC）（开发用，替代 Tauri IPC）
- [ ] 生成队列与并发控制
- [ ] API 密钥加密存储
- [ ] Tauri 工程化
- [ ] macOS / Windows 打包

---

## 9. 相关文档

- 用户视角：[README.md](../../README.md)
- Agent 视角：[AGENT.md](../AGENT.md)
- 前端开发：[front.md](./front.md)
- 开发日志：[vibecoding_log.md](../vibecoding_log.md)