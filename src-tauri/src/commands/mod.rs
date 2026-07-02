/// Tauri Command 处理器 — IPC 入口
///
/// 遵循 server.md §4 IPC 契约
/// 前端通过 invoke() 调用

use tauri::{command, State};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

use crate::auth;
use crate::inference::{GenericEngine, InferenceEngine, UserGenerationConfig};
use crate::storage::Storage;
use crate::types::*;

/// 应用状态 — 各模块共享
pub struct AppState {
    pub storage: Storage,
    pub engine: Box<dyn InferenceEngine + Send + Sync>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
    pub release_url: String,
    pub published_at: Option<String>,
    pub body: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    html_url: String,
    published_at: Option<String>,
    body: Option<String>,
}

impl AppState {
    pub fn get_user_id_by_session(&self, token: &str) -> Result<i64, String> {
        auth::validate_session(&self.storage, token)
    }
}

// ─── 鉴权 Commands ───────────────────────────────────────

#[command]
pub fn auth_register(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<AuthResponse, String> {
    auth::register(&state.storage, &email, &email, &password)
}

#[command]
pub fn auth_login(
    state: State<'_, AppState>,
    email: String,
    password: String,
) -> Result<AuthResponse, String> {
    auth::login(&state.storage, &email, &password)
}

#[command]
pub fn auth_logout(
    state: State<'_, AppState>,
    session_token: String,
) -> Result<(), String> {
    auth::logout(&state.storage, &session_token)
}

// ─── 生成 Commands ───────────────────────────────────────

#[command]
pub fn generate_text_to_image(
    state: State<'_, AppState>,
    prompt: String,
    negative_prompt: Option<String>,
    style_id: Option<String>,
    seed: Option<u64>,
    steps: u32,
    cfg_scale: f32,
    aspect: String,
    count: u32,
) -> Result<GenerateResult, String> {
    let aspect_ratio = parse_aspect(&aspect)?;

    let req = GenerateRequest {
        prompt,
        negative_prompt,
        style_id,
        seed,
        steps,
        cfg_scale,
        aspect: aspect_ratio,
        reference_image: None,
        reference_images: Vec::new(),
        strength: None,
        count,
    };

    state.engine.generate(&req)
}

#[command]
pub fn generate_image_to_image(
    state: State<'_, AppState>,
    prompt: String,
    negative_prompt: Option<String>,
    style_id: Option<String>,
    seed: Option<u64>,
    steps: u32,
    cfg_scale: f32,
    aspect: String,
    reference_image: String,
    strength: f32,
    count: u32,
) -> Result<GenerateResult, String> {
    let aspect_ratio = parse_aspect(&aspect)?;

    let req = GenerateRequest {
        prompt,
        negative_prompt,
        style_id,
        seed,
        steps,
        cfg_scale,
        aspect: aspect_ratio,
        reference_image: Some(reference_image),
        reference_images: Vec::new(),
        strength: Some(strength),
        count,
    };

    state.engine.generate(&req)
}

#[command]
pub fn cancel_job(_job_id: String) -> Result<(), String> {
    // Agnes API 不支持取消，或用 job_id 追踪
    Err("取消作业尚未实现".into())
}

// ─── 历史 Commands ───────────────────────────────────────

#[command]
pub fn list_history(
    state: State<'_, AppState>,
    _session_token: Option<String>,
    page: i32,
    filter: Option<String>,
) -> Result<ArtworkListResponse, String> {
    state.storage
        .list_artworks(1, page, filter.as_deref())
        .map_err(|e| e.to_string())
}

#[command]
pub fn toggle_favorite(
    state: State<'_, AppState>,
    artwork_id: i64,
) -> Result<bool, String> {
    state.storage.toggle_favorite(artwork_id)
        .map_err(|e| e.to_string())
}

#[command]
pub fn delete_artwork(
    state: State<'_, AppState>,
    artwork_id: i64,
) -> Result<(), String> {
    state.storage.delete_artwork(artwork_id)
        .map_err(|e| e.to_string())
}

#[command]
pub fn get_artwork(
    state: State<'_, AppState>,
    artwork_id: i64,
) -> Result<Option<Artwork>, String> {
    state.storage.get_artwork(artwork_id)
        .map_err(|e| e.to_string())
}

// ─── 预设 Commands ───────────────────────────────────────

#[command]
pub fn list_presets(
    state: State<'_, AppState>,
    category: Option<String>,
) -> Result<Vec<Preset>, String> {
    state.storage.list_presets(category.as_deref())
        .map_err(|e| e.to_string())
}

#[command]
pub fn save_preset(
    state: State<'_, AppState>,
    name: String,
    category: String,
    prompt: String,
    aspect: Option<String>,
) -> Result<i64, String> {
    state.storage.save_preset(None, &name, &category, &prompt, aspect.as_deref())
        .map_err(|e| e.to_string())
}

// ─── 设置 Commands ───────────────────────────────────────

#[command]
pub fn get_settings(
    state: State<'_, AppState>,
    user_id: i64,
) -> Result<UserSettings, String> {
    state.storage.get_settings(user_id)
        .map_err(|e| e.to_string())
}

#[command]
pub fn update_settings(
    state: State<'_, AppState>,
    user_id: i64,
    settings: UserSettings,
) -> Result<(), String> {
    state.storage.update_settings(user_id, &settings)
        .map_err(|e| e.to_string())
}

// ─── 存储 Commands ───────────────────────────────────────

#[command]
pub fn get_storage_info(
    state: State<'_, AppState>,
) -> StorageInfo {
    state.storage.get_storage_info()
}

#[command]
pub fn cleanup_history(
    state: State<'_, AppState>,
    days: i64,
) -> Result<usize, String> {
    state.storage
        .cleanup_history_older_than_days(days)
        .map_err(|e| e.to_string())
}

#[command]
pub async fn check_app_update() -> Result<AppUpdateInfo, String> {
    let current_version = env!("CARGO_PKG_VERSION").to_string();
    let endpoint = "https://api.github.com/repos/echohaoran/Qi_Baishi/releases/latest";

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let response = client
        .get(endpoint)
        .header("Accept", "application/vnd.github+json")
        .header("User-Agent", format!("baishi-desktop/{}", current_version))
        .send()
        .await
        .map_err(|e| format!("请求 GitHub Releases 失败: {}", e))?;

    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("读取 GitHub 响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "GitHub Releases 返回异常 ({}): {}",
            status.as_u16(),
            &text[..text.len().min(300)]
        ));
    }

    let release: GithubRelease = serde_json::from_str(&text)
        .map_err(|e| format!("解析 GitHub Releases 响应失败: {}", e))?;

    let latest_version = normalize_semver_like(&release.tag_name);
    let has_update = compare_versions(&latest_version, &current_version)
        .map(|ord| ord.is_gt())
        .unwrap_or_else(|| latest_version != current_version);

    Ok(AppUpdateInfo {
        current_version,
        latest_version,
        has_update,
        release_url: release.html_url,
        published_at: release.published_at,
        body: release.body,
    })
}

#[command]
pub async fn test_image_api_connection(
    _state: State<'_, AppState>,
    req: RemoteConnectionTestRequest,
) -> Result<ConnectionTestResult, String> {
    let endpoint = req.endpoint.trim();
    if endpoint.is_empty() {
        return Err("缺少 endpoint".to_string());
    }

    let parsed: Value = serde_json::from_str(&req.body_json)
        .map_err(|e| format!("请求体 JSON 非法: {}", e))?;

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut request = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .json(&parsed);

    if let Some(api_key) = req.api_key.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    let start = Instant::now();
    let response = request
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = response.status().as_u16();
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .to_string();

    Ok(ConnectionTestResult {
        status,
        content_type,
        took_ms: start.elapsed().as_millis() as u64,
    })
}

#[command]
pub async fn generate_text_to_image_remote(
    state: State<'_, AppState>,
    req: RemoteImageRequest,
) -> Result<GenerateResult, String> {
    generate_remote_image(state, req, false).await
}

#[command]
pub async fn generate_image_to_image_remote(
    state: State<'_, AppState>,
    req: RemoteImageRequest,
) -> Result<GenerateResult, String> {
    generate_remote_image(state, req, true).await
}

#[command]
pub async fn enhance_text_remote(
    state: State<'_, AppState>,
    req: RemoteTextRequest,
) -> Result<PromptEnhanceResult, String> {
    let api_url = req
        .api_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "缺少 api_url · 请先在「生文 API」中配置".to_string())?;

    let model = resolve_text_model(&state, req.model.as_deref())?;
    let endpoint = build_chat_completions_endpoint(api_url);
    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": "你是一位精通视觉艺术的提示词工程师。用户会给你一句中文短语或粗略描述，请改写为一段富有画面感的中文提示词，要求：①保留原意但增加具体视觉细节（光线、构图、色彩、笔触、氛围）；②使用适合 AI 图像生成的描述性语言；③直接返回润色后的提示词，不要解释、不要加引号、不要 markdown 标记。" },
            { "role": "user", "content": req.prompt }
        ],
        "temperature": 0.7
    });

    let parsed = send_json_request(&endpoint, req.api_key.as_deref(), &body, 60).await?;
    let enhanced = parsed["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    if enhanced.is_empty() {
        return Err("润色响应为空".to_string());
    }

    let preview = enhanced.chars().take(60).collect::<String>();
    let _ = state.storage.create_artwork(
        1,
        &req.prompt,
        Some(&model),
        Some("copywriting"),
        Some(0),
        0,
        0.0,
        "text",
        &enhanced,
        Some(preview.as_str()),
    );

    Ok(PromptEnhanceResult { enhanced })
}

#[command]
pub async fn generate_text_remote(
    state: State<'_, AppState>,
    req: RemoteTextRequest,
) -> Result<TextGenerateResult, String> {
    let api_url = req
        .api_url
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "缺少 api_url · 请先在「生文 API」中配置".to_string())?;

    let model = resolve_text_model(&state, req.model.as_deref())?;
    let endpoint = build_chat_completions_endpoint(api_url);
    let system_prompt = req.system_prompt.unwrap_or_else(|| "你是一位专业的中文文案写手，擅长根据用户需求撰写高质量的中文文案。要求：①语言生动、语感好；②根据用户指定的风格（鲁迅风、张爱玲风、商业文案等）调整语气；③结构清晰，逻辑通顺；④遵守用户给出的字数限制。".to_string());
    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system_prompt },
            { "role": "user", "content": req.prompt }
        ],
        "temperature": 0.8,
        "max_tokens": req.max_tokens.unwrap_or(800)
    });

    let parsed = send_json_request(&endpoint, req.api_key.as_deref(), &body, 90).await?;
    let text = parsed["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or("")
        .trim()
        .to_string();

    if text.is_empty() {
        return Err("生文响应为空".to_string());
    }

    let preview = text.chars().take(60).collect::<String>();
    let _ = state.storage.create_artwork(
        1,
        &req.prompt,
        Some(&model),
        Some("copywriting"),
        Some(0),
        0,
        0.0,
        "text",
        &text,
        Some(preview.as_str()),
    );

    Ok(TextGenerateResult { text })
}

// ─── 工具函数 ─────────────────────────────────────────────

async fn generate_remote_image(
    state: State<'_, AppState>,
    req: RemoteImageRequest,
    expect_reference: bool,
) -> Result<GenerateResult, String> {
    let aspect = req.aspect.as_deref().unwrap_or("1:1");
    let aspect_ratio = parse_aspect(aspect)?;
    let single_reference = req
        .reference_image
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());
    let references = req
        .reference_images
        .unwrap_or_default()
        .into_iter()
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect::<Vec<_>>();

    let total_reference_bytes: usize = single_reference
        .as_ref()
        .map(|s| s.len())
        .into_iter()
        .chain(references.iter().map(|s| s.len()))
        .sum();

    if total_reference_bytes > 6 * 1024 * 1024 {
        return Err("参考图数据过大，请减少图片数量或压缩后重试".to_string());
    }

    if expect_reference {
        if let Some(single) = single_reference.as_ref() {
            if single.len() > 4 * 1024 * 1024 {
                return Err("参考图过大，请压缩到更小尺寸后重试".to_string());
            }
        }
    }

    if expect_reference && single_reference.is_none() && references.is_empty() {
        return Err("图生图至少需要一张参考图".to_string());
    }

    let generate_request = GenerateRequest {
        prompt: req.prompt.clone(),
        negative_prompt: req.negative_prompt.clone(),
        style_id: req.style_id.clone(),
        seed: req.seed,
        steps: req.steps.unwrap_or(30),
        cfg_scale: req.cfg_scale.unwrap_or(7.5),
        aspect: aspect_ratio,
        reference_image: single_reference,
        reference_images: references,
        strength: req.strength.or(Some(0.5)),
        count: req.count.unwrap_or(3).clamp(1, 4),
    };

    let config = UserGenerationConfig {
        endpoint: req.endpoint.clone(),
        api_key: req.api_key.clone(),
        request_body: req.request_body.clone(),
    };

    let engine = GenericEngine::new(String::new());
    let result = engine.generate_async(&generate_request, &config).await?;

    for image in &result.images {
        let image_ref = image
            .url
            .clone()
            .or_else(|| image.b64_json.clone())
            .unwrap_or_default();
        let thumb_ref = image.url.as_deref().or(image.b64_json.as_deref());
        let _ = state.storage.create_artwork(
            1,
            &generate_request.prompt,
            generate_request.negative_prompt.as_deref(),
            generate_request.style_id.as_deref(),
            Some(image.seed as i64),
            generate_request.steps as i32,
            generate_request.cfg_scale as f64,
            &generate_request.aspect.to_string(),
            &image_ref,
            thumb_ref,
        );
    }

    Ok(result)
}

fn resolve_text_model(state: &AppState, model: Option<&str>) -> Result<String, String> {
    if let Some(selected) = model.map(str::trim).filter(|s| !s.is_empty()) {
        return Ok(selected.to_string());
    }
    state
        .storage
        .get_settings(1)
        .map_err(|e| e.to_string())
        .ok()
        .and_then(|s| s.text_api_model)
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .ok_or_else(|| "未选择模型 · 请先在「设置 → 生文 API」中选择模型并保存".to_string())
}

fn build_chat_completions_endpoint(api_url: &str) -> String {
    if api_url.ends_with("/v1") || api_url.ends_with("/v1/") {
        format!("{}/chat/completions", api_url.trim_end_matches('/'))
    } else {
        format!("{}/v1/chat/completions", api_url.trim_end_matches('/'))
    }
}

async fn send_json_request(
    endpoint: &str,
    api_key: Option<&str>,
    body: &Value,
    timeout_secs: u64,
) -> Result<Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;

    let mut request = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .json(body);

    if let Some(api_key) = api_key.map(str::trim).filter(|s| !s.is_empty()) {
        request = request.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;
    let status = response.status();
    let text = response
        .text()
        .await
        .map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!(
            "API 错误 ({}): {}",
            status.as_u16(),
            &text[..text.len().min(300)]
        ));
    }

    serde_json::from_str(&text)
        .map_err(|e| format!("解析响应失败: {}", e))
}

fn parse_aspect(s: &str) -> Result<AspectRatio, String> {
    match s {
        "1:1" => Ok(AspectRatio::Square),
        "3:4" => Ok(AspectRatio::Portrait3x4),
        "16:9" => Ok(AspectRatio::Landscape),
        "9:16" => Ok(AspectRatio::Portrait),
        "4:5" => Ok(AspectRatio::Portrait4x5),
        "21:9" => Ok(AspectRatio::Ultrawide),
        _ => Err(format!("不支持的画面比例: {}", s)),
    }
}

fn normalize_semver_like(raw: &str) -> String {
    raw.trim().trim_start_matches('v').to_string()
}

fn compare_versions(a: &str, b: &str) -> Option<std::cmp::Ordering> {
    let parse = |value: &str| -> Option<Vec<u64>> {
        value
            .split('.')
            .map(|part| part.parse::<u64>().ok())
            .collect::<Option<Vec<_>>>()
    };

    let mut left = parse(a)?;
    let mut right = parse(b)?;
    let max_len = left.len().max(right.len());
    left.resize(max_len, 0);
    right.resize(max_len, 0);
    Some(left.cmp(&right))
}
