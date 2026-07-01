/// Tauri Command 处理器 — IPC 入口
///
/// 遵循 server.md §4 IPC 契约
/// 前端通过 invoke() 调用

use tauri::{command, State};

use crate::auth;
use crate::inference::InferenceEngine;
use crate::storage::Storage;
use crate::types::*;

/// 应用状态 — 各模块共享
pub struct AppState {
    pub storage: Storage,
    pub engine: Box<dyn InferenceEngine + Send + Sync>,
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
    _state: State<'_, AppState>,
    _session_token: Option<String>,
    page: i32,
    _filter: Option<String>,
) -> Result<ArtworkListResponse, String> {
    // 原型阶段返回空列表
    Ok(ArtworkListResponse { items: vec![], total: 0, page })
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

// ─── 工具函数 ─────────────────────────────────────────────

fn parse_aspect(s: &str) -> Result<AspectRatio, String> {
    match s {
        "1:1" => Ok(AspectRatio::Square),
        "16:9" => Ok(AspectRatio::Landscape),
        "9:16" => Ok(AspectRatio::Portrait),
        "4:5" => Ok(AspectRatio::Portrait4x5),
        "21:9" => Ok(AspectRatio::Ultrawide),
        _ => Err(format!("不支持的画面比例: {}", s)),
    }
}
