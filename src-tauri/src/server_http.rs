/// 白石 BaiShi 开发 HTTP 服务器
///
/// 提供 REST API + 静态文件服务，供前端直接联调测试
///
/// 启动：cargo run --bin baishi-dev
/// 访问：http://localhost:3456

use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::{DefaultBodyLimit, Path, Query, State},
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use baishi_lib::auth;
use baishi_lib::inference::{GenericEngine, UserGenerationConfig};
use baishi_lib::storage::Storage;
use baishi_lib::types::*;

// ─── 应用状态 ─────────────────────────────────────────────

struct AppState {
    storage: Storage,
    engine: GenericEngine,
}

fn load_retention_days(storage: &Storage) -> i64 {
    let default_days = 2i64;
    let settings = match storage.get_settings(1) {
        Ok(s) => s,
        Err(_) => return default_days,
    };
    let shortcuts = match settings.shortcuts {
        Some(s) if !s.trim().is_empty() => s,
        _ => return default_days,
    };
    let parsed: serde_json::Value = match serde_json::from_str(&shortcuts) {
        Ok(v) => v,
        Err(_) => return default_days,
    };
    parsed
        .get("storage")
        .and_then(|v| v.get("retentionDays"))
        .and_then(|v| v.as_i64())
        .map(|days| days.clamp(1, 5))
        .unwrap_or(default_days)
}

// ─── API 请求类型 ─────────────────────────────────────────

#[derive(Deserialize)]
struct ApiRegisterRequest {
    name: String,
    email: String,
    password: String,
}
#[derive(Deserialize)]
struct ApiLoginRequest {
    email_or_username: String,
    password: String,
}
#[derive(Deserialize)]
struct ApiLogoutRequest {
    session_token: String,
}

/// 文生图请求（支持用户自定义 endpoint/key/request_body）
#[derive(Deserialize, Default)]
struct ApiTextToImageRequest {
    prompt: String,
    negative_prompt: Option<String>,
    style_id: Option<String>,
    seed: Option<u64>,
    steps: Option<u32>,
    cfg_scale: Option<f32>,
    aspect: Option<String>,
    count: Option<u32>,
    // 用户配置
    #[serde(default)]
    endpoint: Option<String>,
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    request_body: Option<String>,
}

/// 图生图请求（支持用户自定义 endpoint/key/request_body）
#[derive(Deserialize, Default)]
struct ApiImageToImageRequest {
    prompt: String,
    negative_prompt: Option<String>,
    style_id: Option<String>,
    seed: Option<u64>,
    steps: Option<u32>,
    cfg_scale: Option<f32>,
    aspect: Option<String>,
    reference_image: String,
    /// 多张参考图（多图融合） · Agnes I2I 规范要求 extra_body.image: [array]
    #[serde(default)]
    reference_images: Option<Vec<String>>,
    strength: Option<f32>,
    count: Option<u32>,
    // 用户配置
    #[serde(default)]
    endpoint: Option<String>,
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    request_body: Option<String>,
}

/// 列表查询参数
#[derive(Deserialize, Default)]
struct ListHistoryQuery {
    #[serde(default)]
    user_id: Option<i64>,
    #[serde(default)]
    page: Option<i32>,
    #[serde(default)]
    filter: Option<String>,
}

/// 设置更新 payload
#[derive(Deserialize, Default)]
struct UpdateSettingsPayload {
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    api_endpoint: Option<String>,
    #[serde(default)]
    text_api_model: Option<String>,
    #[serde(default)]
    storage_path: Option<String>,
    #[serde(default)]
    theme: Option<String>,
    #[serde(default)]
    shortcuts: Option<String>,
}

#[derive(Serialize)]
struct ApiResponse<T: Serialize> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T: Serialize> ApiResponse<T> {
    fn ok(data: T) -> Json<Self> {
        Json(Self {
            success: true,
            data: Some(data),
            error: None,
        })
    }
}

fn api_error<T: Serialize>(msg: &str) -> (axum::http::StatusCode, Json<ApiResponse<T>>) {
    (
        axum::http::StatusCode::BAD_REQUEST,
        Json(ApiResponse {
            success: false,
            data: None,
            error: Some(msg.to_string()),
        }),
    )
}

fn parse_aspect(s: &str) -> Result<AspectRatio, String> {
    match s {
        "1:1" => Ok(AspectRatio::Square),
        "3:4" => Ok(AspectRatio::Portrait3x4),
        "4:5" => Ok(AspectRatio::Portrait4x5),
        "16:9" => Ok(AspectRatio::Landscape),
        "9:16" => Ok(AspectRatio::Portrait),
        "21:9" => Ok(AspectRatio::Ultrawide),
        "4:3" => Ok(AspectRatio::Landscape),  // 兼容旧值
        _ => Err(format!("不支持的画面比例: {}", s)),
    }
}

// ─── 入口 ─────────────────────────────────────────────────

#[tokio::main]
async fn main() {
    env_logger::init();

    let port = std::env::var("BAISHI_PORT").unwrap_or_else(|_| "3456".to_string());
    let repo_root = resolve_repo_root();
    let front_dir = repo_root.join("front");
    let assets_dir = front_dir.join("assets");
    let data_dir = get_data_dir();
    let api_key = std::env::var("BAISHI_API_KEY").unwrap_or_else(|_| {
        "sk-ZpxAQINPD8XUWRkWdSzugoT2a3Q3Cj48CHTtEVJaodPgUxkF".to_string()
    });

    println!("╔══════════════════════════════════════════╗");
    println!("║     白石 BaiShi · 开发 HTTP 服务器       ║");
    println!("╠══════════════════════════════════════════╣");
    println!("║  数据目录: {:?}", data_dir);
    println!("║  前端目录: {:?}", front_dir);
    println!("║  资源目录: {:?}", assets_dir);
    println!("║  默认 API: {}...", &api_key[..12.min(api_key.len())]);
    println!("║  服务端口: http://localhost:{}", port);
    println!("╚══════════════════════════════════════════╝");

    let storage = Storage::open(data_dir).expect("无法初始化数据库");
    let retention_days = load_retention_days(&storage);
    match storage.cleanup_history_older_than_days(retention_days) {
        Ok(removed) => println!(
            "║  启动清理: {} 天周期 · 已清理 {} 条非收藏历史",
            retention_days, removed
        ),
        Err(err) => println!(
            "║  启动清理: {} 天周期 · 清理失败: {}",
            retention_days, err
        ),
    }
    let engine = GenericEngine::new(api_key);

    let state = Arc::new(AppState { storage, engine });

    let app = Router::new()
        .nest_service("/assets", ServeDir::new(&assets_dir))
        .route("/api/auth/register", post(api_register))
        .route("/api/auth/login", post(api_login))
        .route("/api/auth/logout", post(api_logout))
        .route("/api/generate/text", post(api_generate_text))
        .route("/api/generate/image", post(api_generate_image))
        .route("/api/generate/cancel", post(api_cancel_job))
        .route("/api/history", get(api_list_history))
        .route("/api/history/favorite", post(api_toggle_favorite))
        // 单删 · body: { id: 57 }  (避免 DELETE + {id} 路由与静态文件 fallback 冲突)
        .route("/api/history/delete", post(api_delete_artwork))
        // 批量删除 (body: { ids: [1, 2, 3] })
        .route("/api/history/batch-delete", post(api_delete_artworks_batch))
        .route("/api/presets", get(api_list_presets).post(api_save_preset))
        .route("/api/settings/{user_id}", get(api_get_settings).post(api_update_settings))
        .route("/api/storage/info", get(api_storage_info))
        // 健康检查
        .route("/api/health", get(api_health))
        // 文本润色（生文 API 调用）
        .route("/api/text/enhance", post(api_enhance_text))
        .route("/api/text/generate", post(api_generate_text_llm))
        .fallback_service(ServeDir::new(&front_dir).append_index_html_on_directories(true))
        // body limit 必须在外层，覆盖所有路由（含 fallback_service）
        .layer(DefaultBodyLimit::max(50 * 1024 * 1024))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = format!("0.0.0.0:{}", port);
    println!("→ 浏览器打开 http://localhost:{}", port);
    println!("→ API 基础路径 http://localhost:{}/api/", port);
    println!();

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

fn resolve_repo_root() -> PathBuf {
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let manifest_path = PathBuf::from(manifest_dir);
        if let Some(parent) = manifest_path.parent() {
            return parent.to_path_buf();
        }
        return manifest_path;
    }
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

// ─── API 处理器 ───────────────────────────────────────────

async fn api_health() -> Json<ApiResponse<serde_json::Value>> {
    ApiResponse::ok(json!({
        "status": "ok",
        "version": "v0.0.1_test",
        "engine": "generic",
    }))
}

async fn api_register(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ApiRegisterRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, (axum::http::StatusCode, Json<ApiResponse<AuthResponse>>)> {
    match auth::register(&state.storage, &req.name, &req.email, &req.password) {
        Ok(resp) => Ok(ApiResponse::ok(resp)),
        Err(e) => Err(api_error(&e)),
    }
}

async fn api_login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ApiLoginRequest>,
) -> Result<Json<ApiResponse<AuthResponse>>, (axum::http::StatusCode, Json<ApiResponse<AuthResponse>>)> {
    match auth::login(&state.storage, &req.email_or_username, &req.password) {
        Ok(resp) => Ok(ApiResponse::ok(resp)),
        Err(e) => Err(api_error(&e)),
    }
}

async fn api_logout(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ApiLogoutRequest>,
) -> Result<Json<ApiResponse<()>>, (axum::http::StatusCode, Json<ApiResponse<()>>)> {
    match auth::logout(&state.storage, &req.session_token) {
        Ok(_) => Ok(ApiResponse::ok(())),
        Err(e) => Err(api_error(&e)),
    }
}

async fn api_generate_text(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ApiTextToImageRequest>,
) -> Result<Json<ApiResponse<GenerateResult>>, (axum::http::StatusCode, Json<ApiResponse<GenerateResult>>)> {
    let aspect = parse_aspect(req.aspect.as_deref().unwrap_or("1:1"))
        .map_err(|e| api_error::<GenerateResult>(&e))?;

    // 在 gen_req 构造前拍下 source 供落库使用
    let source = req.style_id.clone().unwrap_or_else(|| "text-to-image".to_string());

    let gen_req = GenerateRequest {
        prompt: req.prompt,
        negative_prompt: req.negative_prompt,
        style_id: req.style_id,
        seed: req.seed,
        steps: req.steps.unwrap_or(30),
        cfg_scale: req.cfg_scale.unwrap_or(7.5),
        aspect,
        reference_image: None,
        reference_images: Vec::new(),
        strength: None,
        count: req.count.unwrap_or(3),
    };

    let cfg = UserGenerationConfig {
        endpoint: req.endpoint,
        api_key: req.api_key,
        request_body: req.request_body,
    };

    match state.engine.generate_async(&gen_req, &cfg).await {
        Ok(resp) => {
            // ✅ 落库:每张生成图都加入历史作品
            for img in &resp.images {
                let file_path = img.url.clone()
                    .or_else(|| img.b64_json.clone())
                    .unwrap_or_default();
                if file_path.is_empty() { continue; }
                let _ = state.storage.create_artwork(
                    1,
                    &gen_req.prompt,
                    gen_req.negative_prompt.as_deref(),
                    Some(&source),
                    gen_req.seed.map(|s| s as i64),
                    gen_req.steps as i32,
                    gen_req.cfg_scale as f64,
                    &gen_req.aspect.to_string(),
                    &file_path,
                    None,
                );
            }
            Ok(ApiResponse::ok(resp))
        }
        Err(e) => Err(api_error(&e)),
    }
}

async fn api_generate_image(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ApiImageToImageRequest>,
) -> Result<Json<ApiResponse<GenerateResult>>, (axum::http::StatusCode, Json<ApiResponse<GenerateResult>>)> {
    let aspect = parse_aspect(req.aspect.as_deref().unwrap_or("1:1"))
        .map_err(|e| api_error::<GenerateResult>(&e))?;

    // 在 gen_req 构造前拍下 source
    let source = req.style_id.clone().unwrap_or_else(|| "image-to-image".to_string());

    let gen_req = GenerateRequest {
        prompt: req.prompt,
        negative_prompt: req.negative_prompt,
        style_id: req.style_id,
        seed: req.seed,
        steps: req.steps.unwrap_or(30),
        cfg_scale: req.cfg_scale.unwrap_or(7.5),
        aspect,
        reference_image: Some(req.reference_image),
        reference_images: req.reference_images.unwrap_or_default(),
        strength: req.strength,
        count: req.count.unwrap_or(3),
    };

    let cfg = UserGenerationConfig {
        endpoint: req.endpoint,
        api_key: req.api_key,
        request_body: req.request_body,
    };

    match state.engine.generate_async(&gen_req, &cfg).await {
        Ok(resp) => {
            // ✅ 落库:每张生成图都加入历史作品
            for img in &resp.images {
                let file_path = img.url.clone()
                    .or_else(|| img.b64_json.clone())
                    .unwrap_or_default();
                if file_path.is_empty() { continue; }
                let _ = state.storage.create_artwork(
                    1,
                    &gen_req.prompt,
                    gen_req.negative_prompt.as_deref(),
                    Some(&source),
                    gen_req.seed.map(|s| s as i64),
                    gen_req.steps as i32,
                    gen_req.cfg_scale as f64,
                    &gen_req.aspect.to_string(),
                    &file_path,
                    None,
                );
            }
            Ok(ApiResponse::ok(resp))
        }
        Err(e) => Err(api_error(&e)),
    }
}

async fn api_cancel_job() -> Json<ApiResponse<()>> {
    ApiResponse::ok(())
}

async fn api_list_history(
    State(state): State<Arc<AppState>>,
    Query(q): Query<ListHistoryQuery>,
) -> Result<Json<ApiResponse<ArtworkListResponse>>, (axum::http::StatusCode, Json<ApiResponse<ArtworkListResponse>>)> {
    let user_id = q.user_id.unwrap_or(1);
    let page = q.page.unwrap_or(1).max(1);
    match state.storage.list_artworks(user_id, page, q.filter.as_deref()) {
        Ok(resp) => Ok(ApiResponse::ok(resp)),
        Err(e) => Err(api_error(&e.to_string())),
    }
}

async fn api_toggle_favorite(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<bool>>, (axum::http::StatusCode, Json<ApiResponse<bool>>)> {
    let artwork_id = body["artwork_id"]
        .as_i64()
        .ok_or_else(|| api_error::<bool>("缺少 artwork_id"))?;
    match state.storage.toggle_favorite(artwork_id) {
        Ok(val) => Ok(ApiResponse::ok(val)),
        Err(e) => Err(api_error(&e.to_string())),
    }
}

// POST /api/history/delete { id: 57 } — 单删
async fn api_delete_artwork(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<serde_json::Value>>, (axum::http::StatusCode, Json<ApiResponse<serde_json::Value>>)> {
    let id = body["id"]
        .as_i64()
        .ok_or_else(|| api_error::<serde_json::Value>("缺少 id"))?;
    match state.storage.delete_artwork(id) {
        Ok(()) => Ok(ApiResponse::ok(json!({ "deleted": id }))),
        Err(e) => Err(api_error(&e.to_string())),
    }
}

// POST /api/history/batch-delete { ids: [1, 2, 3] } — 批量删除
// 返回 { deleted: N } 实际删除的记录数 (用户有可能传不存在的 id)
async fn api_delete_artworks_batch(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<serde_json::Value>>, (axum::http::StatusCode, Json<ApiResponse<serde_json::Value>>)> {
    let ids: Vec<i64> = match body["ids"].as_array() {
        Some(arr) => arr.iter().filter_map(|v| v.as_i64()).collect(),
        None => return Err(api_error("缺少 ids 数组")),
    };
    if ids.is_empty() {
        return Ok(ApiResponse::ok(json!({ "deleted": 0 })));
    }
    match state.storage.delete_artworks_batch(&ids) {
        Ok(n) => Ok(ApiResponse::ok(json!({ "deleted": n }))),
        Err(e) => Err(api_error(&e.to_string())),
    }
}

async fn api_list_presets(State(state): State<Arc<AppState>>) -> Json<ApiResponse<Vec<Preset>>> {
    match state.storage.list_presets(None) {
        Ok(presets) => ApiResponse::ok(presets),
        Err(e) => Json(ApiResponse {
            success: false,
            data: None,
            error: Some(e.to_string()),
        }),
    }
}

async fn api_save_preset(
    State(state): State<Arc<AppState>>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<ApiResponse<i64>>, (axum::http::StatusCode, Json<ApiResponse<i64>>)> {
    let name = body["name"]
        .as_str()
        .ok_or_else(|| api_error::<i64>("缺少 name"))?;
    let category = body["category"]
        .as_str()
        .ok_or_else(|| api_error::<i64>("缺少 category"))?;
    let prompt = body["prompt"]
        .as_str()
        .ok_or_else(|| api_error::<i64>("缺少 prompt"))?;
    let aspect = body["aspect"].as_str();
    match state.storage.save_preset(None, name, category, prompt, aspect) {
        Ok(id) => Ok(ApiResponse::ok(id)),
        Err(e) => Err(api_error(&e.to_string())),
    }
}

async fn api_get_settings(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<i64>,
) -> Result<Json<ApiResponse<UserSettings>>, (axum::http::StatusCode, Json<ApiResponse<UserSettings>>)> {
    match state.storage.get_settings(user_id) {
        Ok(settings) => Ok(ApiResponse::ok(settings)),
        Err(e) => Err(api_error(&e.to_string())),
    }
}

async fn api_update_settings(
    State(state): State<Arc<AppState>>,
    Path(user_id): Path<i64>,
    Json(body): Json<UpdateSettingsPayload>,
) -> Result<Json<ApiResponse<()>>, (axum::http::StatusCode, Json<ApiResponse<()>>)> {
    // 先读旧设置，再覆盖提供的字段
    let current = state
        .storage
        .get_settings(user_id)
        .unwrap_or_else(|_| UserSettings {
            api_key: None,
            api_endpoint: None,
            text_api_model: None,
            storage_path: None,
            theme: "ink".into(),
            shortcuts: None,
        });
    let new_settings = UserSettings {
        api_key: body.api_key.or(current.api_key),
        api_endpoint: body.api_endpoint.or(current.api_endpoint),
        text_api_model: body.text_api_model.or(current.text_api_model),
        storage_path: body.storage_path.or(current.storage_path),
        theme: body.theme.unwrap_or(current.theme),
        shortcuts: body.shortcuts.or(current.shortcuts),
    };
    match state.storage.update_settings(user_id, &new_settings) {
        Ok(_) => Ok(ApiResponse::ok(())),
        Err(e) => Err(api_error(&e.to_string())),
    }
}

async fn api_storage_info(State(state): State<Arc<AppState>>) -> Json<ApiResponse<StorageInfo>> {
    ApiResponse::ok(state.storage.get_storage_info())
}

// ─── 文本润色（透传到用户配置的生文 API）────────────────────

#[derive(Deserialize, Default)]
struct ApiEnhanceRequest {
    prompt: String,
    /// 用户配置
    #[serde(default)]
    api_url: Option<String>,
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    model: Option<String>,
}

async fn api_enhance_text(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ApiEnhanceRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, (axum::http::StatusCode, Json<ApiResponse<serde_json::Value>>)> {
    let url = req.api_url.as_deref().map(|s| s.trim().to_string()).unwrap_or_default();
    if url.is_empty() {
        return Err(api_error("缺少 api_url · 请先在「生文 API」中配置"));
    }
    // 优先取请求中的 model,其次从后端 UserSettings 兑底读出
    let model = match req.model.as_deref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        Some(m) => m,
        None => state
            .storage
            .get_settings(1)
            .ok()
            .and_then(|s| s.text_api_model)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "gpt-4o-mini".to_string()),
    };
    let system = "你是一位精通视觉艺术的提示词工程师。用户会给你一句中文短语或粗略描述，请改写为一段富有画面感的中文提示词，要求：①保留原意但增加具体视觉细节（光线、构图、色彩、笔触、氛围）；②使用适合 AI 图像生成的描述性语言；③直接返回润色后的提示词，不要解释、不要加引号、不要 markdown 标记。";
    let user = req.prompt.clone();

    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user }
        ],
        "temperature": 0.7
    });

    let endpoint = if url.ends_with("/v1") || url.ends_with("/v1/") {
        format!("{}/chat/completions", url.trim_end_matches('/'))
    } else {
        format!("{}/v1/chat/completions", url.trim_end_matches('/'))
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| api_error::<serde_json::Value>(&format!("创建 client 失败: {}", e)))?;
    let mut request = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .json(&body);
    if let Some(key) = req.api_key.as_deref() {
        if !key.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", key.trim()));
        }
    }

    let resp = request
        .send()
        .await
        .map_err(|e| api_error::<serde_json::Value>(&format!("请求失败: {}", e)))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| api_error::<serde_json::Value>(&format!("读取响应失败: {}", e)))?;
    if !status.is_success() {
        return Err(api_error::<serde_json::Value>(&format!(
            "润色 API 错误 ({}): {}",
            status.as_u16(),
            &text[..text.len().min(200)]
        )));
    }
    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| api_error::<serde_json::Value>(&format!("解析响应失败: {}", e)))?;
    let enhanced = parsed["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();
    // ✅ 落库: 润色结果作为作品入库, 让用户能在历史中看到
    let _ = state.storage.create_artwork(
        1,
        &req.prompt,                                // 原句
        Some(&model),                               // 用的模型存 negative_prompt
        Some("copywriting"),                        // style_id
        Some(0),                                    // seed = 0
        0,                                          // steps = 0
        0.0,                                        // cfg_scale = 0
        "text",                                     // aspect 标识文本
        &enhanced,                                  // file_path 存润色结果
        Some(enhanced.chars().take(60).collect::<String>().as_str()), // thumb_path 存前 60 字
    );
    Ok(ApiResponse::ok(json!({ "enhanced": enhanced })))
}

// ─── 妙笔生花 · 生成文案（调用户配置的生文 API）────────────────

#[derive(Deserialize, Default)]
struct ApiGenerateTextRequest {
    prompt: String,
    /// 用户配置
    #[serde(default)]
    api_url: Option<String>,
    #[serde(default)]
    api_key: Option<String>,
    #[serde(default)]
    model: Option<String>,
    /// 可选：调用方传入的系统提示词
    #[serde(default)]
    system_prompt: Option<String>,
    /// 可选：最大 tokens
    #[serde(default)]
    max_tokens: Option<u32>,
}

async fn api_generate_text_llm(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ApiGenerateTextRequest>,
) -> Result<Json<ApiResponse<serde_json::Value>>, (axum::http::StatusCode, Json<ApiResponse<serde_json::Value>>)> {
    let url = req.api_url.as_deref().map(|s| s.trim().to_string()).unwrap_or_default();
    if url.is_empty() {
        return Err(api_error("缺少 api_url · 请先在「生文 API」中配置"));
    }
    // 优先取请求中的 model,其次从后端 UserSettings 兑底读出
    let model = match req.model.as_deref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()) {
        Some(m) => m,
        None => state
            .storage
            .get_settings(1)
            .ok()
            .and_then(|s| s.text_api_model)
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "gpt-4o-mini".to_string()),
    };
    let system = req.system_prompt.unwrap_or_else(|| {
        "你是一位专业的中文文案写手，擅长根据用户需求撰写高质量的中文文案。要求：①语言生动、语感好；②根据用户指定的风格（鲁迅风、张爱玲风、商业文案等）调整语气；③结构清晰，逻辑通顺；④遵守用户给出的字数限制。".to_string()
    });
    let user = req.prompt.clone();
    let max_tokens = req.max_tokens.unwrap_or(800);

    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user }
        ],
        "temperature": 0.8,
        "max_tokens": max_tokens
    });

    let endpoint = if url.ends_with("/v1") || url.ends_with("/v1/") {
        format!("{}/chat/completions", url.trim_end_matches('/'))
    } else {
        format!("{}/v1/chat/completions", url.trim_end_matches('/'))
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| api_error::<serde_json::Value>(&format!("创建 client 失败: {}", e)))?;
    let mut request = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .json(&body);
    if let Some(key) = req.api_key.as_deref() {
        if !key.trim().is_empty() {
            request = request.header("Authorization", format!("Bearer {}", key.trim()));
        }
    }

    let resp = request
        .send()
        .await
        .map_err(|e| api_error::<serde_json::Value>(&format!("请求失败: {}", e)))?;
    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| api_error::<serde_json::Value>(&format!("读取响应失败: {}", e)))?;
    if !status.is_success() {
        return Err(api_error::<serde_json::Value>(&format!(
            "生文 API 错误 ({}): {}",
            status.as_u16(),
            &text[..text.len().min(200)]
        )));
    }
    let parsed: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| api_error::<serde_json::Value>(&format!("解析响应失败: {}", e)))?;
    let content = parsed["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();
    // ✅ 落库: 妙笔生花生成结果作为作品入库, 用户可在历史中查看/收藏/删除/再生成
    if !content.is_empty() {
        let _ = state.storage.create_artwork(
            1,
            &req.prompt,                                // 用户需求
            Some(&model),                               // 用的模型存 negative_prompt
            Some("copywriting"),                        // style_id
            Some(0),                                    // seed = 0
            0,                                          // steps = 0
            0.0,                                        // cfg_scale = 0
            "text",                                     // aspect 标识文本
            &content,                                   // file_path 存文案内容
            Some(content.chars().take(60).collect::<String>().as_str()), // thumb_path 存前 60 字
        );
    }
    Ok(ApiResponse::ok(json!({ "text": content })))
}

// ─── 工具 ─────────────────────────────────────────────────

fn get_data_dir() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        dirs_next::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("studio.baishi.desktop")
    }
    #[cfg(target_os = "windows")]
    {
        dirs_next::data_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("studio.baishi.desktop")
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        PathBuf::from("data")
    }
}
