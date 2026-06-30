# Backend Development · 白石 BaiShi

> 水墨生图桌面应用白石 BaiShi 的后端（Rust）开发说明。
> 项目位置：`/Users/echowang/git/Qi_Baishi/`
> 读者：后端 Rust 开发者 / Agent。
> 用途：了解后端架构、推理引擎、IPC 契约、持久化方案、构建与发布。

---

## 1. 后端整体架构

```
                    Frontend（WebView）
                           │
                    invoke / events
                           │
               ┌───────────┴───────────┐
               │   IPC Bridge           │
               │  Tauri Commands        │
               └───────────┬───────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────┴────┐      ┌─────┴──────┐     ┌────┴────┐
   │  auth   │      │  storage   │     │  event  │
   │  模块   │      │  持久化    │     │  系统   │
   └─────────┘      └────────────┘     └─────────┘
        │                  │
   ┌────┴──────────────────┴──────────────────┐
   │              inference                    │
   │          推理引擎（核心）                  │
   │    ┌────────────┐  ┌────────────────┐    │
   │    │ candle     │  │ ONNX Runtime   │    │
   │    │ (首选)      │  │ (备选)         │    │
   │    └────────────┘  └────────────────┘    │
   └───────────────────────────────────────────┘
```

- **推理优先**：candle（Rust 原生，macOS Metal 友好）为首选，ONNX Runtime 为备选。
- **数据本地化**：SQLite + 文件系统，完全离线运行。

---

## 2. Crate 结构（目标态）

> 以下为 Tauri 工程化后的 Rust 模块结构。当前项目处于 HTML/CSS 原型阶段，尚未初始化 src-tauri。

```
src-tauri/src/
├── main.rs               Tauri Builder 入口，注册 commands
├── commands/             Tauri Command handler（IPC 入口）
│   ├── mod.rs
│   ├── auth.rs           注册 / 登录 / 登出
│   ├── generate.rs       文生图 / 图生图
│   ├── history.rs        历史作品 CRUD
│   ├── presets.rs        风格预设列表 / 保存
│   ├── settings.rs       用户配置读写
│   └── storage.rs        存储用量查询
├── inference/            推理引擎核心
│   ├── mod.rs
│   ├── engine.rs         引擎 trait 与调度
│   ├── candle.rs         首选引擎实现
│   ├── onnx.rs           备选引擎实现
│   ├── pipeline.rs       生成管线（采样器 / CFG / VAE 解码）
│   └── scheduler.rs      采样器（DDIM / DPM++ / Euler）
├── models/               模型注册与下载
│   ├── mod.rs
│   ├── registry.rs       模型元数据与校验（SHA256）
│   └── downloader.rs     模型文件拉取
├── storage/              数据持久化
│   ├── mod.rs
│   ├── db.rs             SQLite 连接与迁移
│   └── repo.rs           各表 CRUD 实现
├── auth/                 密码与会话
│   ├── mod.rs
│   ├── password.rs       Argon2id 哈希
│   └── session.rs        随机 token 生成与验证
└── events/               前端订阅的事件 payload
    ├── mod.rs
    └── types.rs          事件枚举与结构体定义
```

---

## 3. 推理引擎

### 3.1 选择

| 引擎 | 优先级 | 平台支持 | 备注 |
|---|---|---|---|
| [candle](https://github.com/huggingface/candle) | 首选 | macOS（Metal）、部分 Linux | Rust 原生，无 Python 依赖，macOS 加速友好 |
| ONNX Runtime | 备选 | Windows（CUDA/DirectML） | 兼容性好，适合 GPU 方案 |

### 3.2 模型

- **名称**：SDXL-BaiShi-v2
- **基础**：通用 SDXL 上用中国水墨画数据集微调
- **大小**：~6.5 GB
- **首次启动**：检测本地 `models/` 目录，无则从国内 CDN 拉取并校验 SHA256

### 3.3 推理接口（伪代码）

```rust
pub trait InferenceEngine {
    fn load(model: &ModelSpec) -> Result<()>;
    fn generate(req: GenerateRequest) -> Result<Image>;
}

pub struct GenerateRequest {
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub style: Option<StylePreset>,
    pub seed: Option<u64>,
    pub steps: u32,           // 20-50
    pub cfg_scale: f32,       // 1-20
    pub aspect: Aspect,       // 1:1, 16:9, 9:16, 4:5, 21:9
    pub reference_image: Option<EncodedImage>,  // 图生图
    pub strength: Option<f32>,                  // 图生图重绘强度 0-1
}
```

### 3.4 算力消耗计算

PRO 用户每月 5,000 算力，单次出图消耗按以下公式：

```
cost = steps × width × height / 1000
```

配额检查在 `generate` command 入口执行。

---

## 4. IPC 契约

### 4.1 Command 清单（前端 → 后端）

| Command | 参数 | 返回 | 说明 |
|---|---|---|---|
| `auth_register` | `{email, password}` | `{user_id}` | 注册 |
| `auth_login` | `{email, password}` | `{session_token, user}` | 登录 |
| `auth_logout` | `{session_token}` | `()` | 登出 |
| `generate_text_to_image` | `GenerateRequest` | `{job_id}` | 文生图 |
| `generate_image_to_image` | `GenerateRequest + reference` | `{job_id}` | 图生图 |
| `cancel_job` | `{job_id}` | `()` | 取消生成 |
| `list_history` | `{page, filter}` | `{items, total}` | 历史列表 |
| `toggle_favorite` | `{artwork_id}` | `()` | 收藏/取消 |
| `list_presets` | `{category?}` | `[Preset]` | 风格预设列表 |
| `save_preset` | `Preset` | `{preset_id}` | 自定义预设 |
| `get_settings` | `()` | `Settings` | 用户设置 |
| `update_settings` | `Settings` | `()` | 更新设置 |
| `get_storage_info` | `()` | `{used, available, models_size}` | 存储用量 |

### 4.2 Event 清单（后端 → 前端）

| Event | Payload | 说明 |
|---|---|---|
| `job:progress` | `{job_id, step, total_steps, preview?}` | 生成进度 |
| `job:done` | `{job_id, image_path, seed, took_ms}` | 完成 |
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
    pub reference_image: Option<String>,  // base64 或本地路径
    pub strength: Option<f32>,
}
```

前端对应的 TS 类型建议从 Rust 自动推导（推荐 `ts-rs` crate）。

---

## 5. 数据持久化方案

### 5.1 SQLite Schema（v1）

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free'  -- free / pro / pro_plus
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
    file_path TEXT NOT NULL,           -- 本地相对路径
    thumb_path TEXT,
    is_favorite INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL
);

CREATE TABLE presets (
    id INTEGER PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),  -- NULL 表示内置预设
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    prompt TEXT NOT NULL,
    aspect TEXT,
    is_builtin INTEGER DEFAULT 0
);

CREATE TABLE settings (
    user_id INTEGER PRIMARY KEY REFERENCES users(id),
    api_key TEXT,                      -- 第三方 API 备用
    api_endpoint TEXT,
    storage_path TEXT,
    theme TEXT DEFAULT 'ink',
    shortcuts TEXT                      -- JSON
);

CREATE TABLE generation_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    job_id TEXT NOT NULL,
    cost INTEGER NOT NULL,             -- 算力消耗
    created_at INTEGER NOT NULL
);
```

### 5.2 文件存储

用户作品保存到 `<user_data>/artworks/<yyyy>/<mm>/<uuid>.png`，元数据写入 SQLite。

| 平台 | 用户数据根路径 |
|---|---|
| macOS | `~/Library/Application Support/studio.BaiShi.desktop/` |
| Windows | `%APPDATA%\studio.BaiShi.desktop\` |

存储使用 SQLite WAL 模式，作品列表分页 50 条/页。

---

## 6. 测试策略（后端）

| 类型 | 命令/方式 |
|---|---|
| Rust 单元测试 | `cargo test`，模块内 `#[cfg(test)]` |
| Rust 集成测试 | `cargo test --test '*'`，推理管线小样本验证 |
| 代码质量 | `cargo clippy -- -D warnings` + `cargo fmt --check` |

---

## 7. 构建与发布

### 7.1 开发环境

```bash
# 1. 安装 Rust 工具链
rustup update

# 2. 安装 Tauri CLI
cargo install tauri-cli --version "^2.0"

# 3. 启动 dev 模式（前端 HMR + Rust 热编译）
cargo tauri dev

# 4. 构建生产
cargo tauri build
```

### 7.2 平台产物

| 平台 | 产物路径 |
|---|---|
| macOS (Apple Silicon) | `target/release/bundle/macos/BaiShi.app` + `.dmg` |
| macOS (Intel) | 同上，x86_64 |
| Windows (x64) | `target/release/bundle/msi/BaiShi_0.4.2_x64_en-US.msi` + `.nsis` 安装器 |

### 7.3 代码签名

| 平台 | 工具 |
|---|---|
| macOS | Developer ID Application 证书 + notarization（`xcrun notarytool`） |
| Windows | Authenticode 证书 + SignTool |

### 7.4 自动更新

接入 Tauri Updater 插件，更新源指向自建 CDN。每次发布需包含：
- 新版 `.app.tar.gz` / `.nsis.zip`
- `latest.json` 元数据文件

---

## 8. 性能与资源

- 模型权重 `~6.5 GB`，首次启动下载 + SHA256 校验
- macOS 推荐 16 GB 内存（Metal 共享）
- Windows 推荐 16 GB + 6 GB VRAM（CUDA/DirectML）
- 单图 1024×1024 / 30 steps 生成速度参考：
  - Apple M2 Max：约 8s
  - RTX 3060：约 6s

---

## 9. 安全与隐私

- 完全离线：默认不出网，第三方 API（备用）需用户主动在设置页配置
- 密码 Argon2id 哈希，不存明文
- session token 随机 256 bit，存后端 + 前端 `localStorage`
- 用户的提示词 / 作品仅存本地，不上传任何云端
- CSP 收紧，禁用 `unsafe-eval`

---

## 10. 路线图（后端）

- [ ] Rust 推理引擎接入 candle
- [ ] Tauri 工程化（src-tauri 初始化）
- [ ] SQLite 持久化（建表 + 迁移）
- [ ] IPC Command 实现（auth / generate / query）
- [ ] 模型下载与校验流程
- [ ] macOS / Windows 打包与签名
- [ ] 自动更新机制
- [ ] 算力消耗与配额管理

---

## 11. 相关文档

- 用户视角：[README.md](../README.md)
- Agent 视角：[AGENT.md](../AGENT.md)
- 前端开发：[front.md](./front.md)
- 开发日志：[vibecoding_log.md](../vibecoding_log.md)
