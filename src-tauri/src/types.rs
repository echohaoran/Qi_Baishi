/// 白石 BaiShi 后端共享类型定义

use serde::{Deserialize, Serialize};
use std::fmt;

// ─── 生成请求 ─────────────────────────────────────────────

/// 文生图 / 图生图请求
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateRequest {
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub negative_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub style_id: Option<String>,
    pub seed: Option<u64>,
    pub steps: u32,
    pub cfg_scale: f32,
    pub aspect: AspectRatio,
    /// 参考图（图生图用）：base64 或本地路径
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference_image: Option<String>,
    /// 重绘强度 0.0–1.0（图生图用）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strength: Option<f32>,
    /// 生图数量 1–5
    #[serde(default = "default_count")]
    pub count: u32,
}

fn default_count() -> u32 { 3 }

impl Default for GenerateRequest {
    fn default() -> Self {
        Self {
            prompt: String::new(),
            negative_prompt: None,
            style_id: None,
            seed: None,
            steps: 30,
            cfg_scale: 7.5,
            aspect: AspectRatio::Square,
            reference_image: None,
            strength: None,
            count: 3,
        }
    }
}

// ─── 画面比例 ─────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum AspectRatio {
    #[serde(rename = "1:1")]
    Square,
    #[serde(rename = "16:9")]
    Landscape,
    #[serde(rename = "9:16")]
    Portrait,
    #[serde(rename = "4:5")]
    Portrait4x5,
    #[serde(rename = "21:9")]
    Ultrawide,
}

impl AspectRatio {
    pub fn dimensions(&self) -> (u32, u32) {
        match self {
            AspectRatio::Square => (1024, 1024),
            AspectRatio::Landscape => (1216, 684),
            AspectRatio::Portrait => (684, 1216),
            AspectRatio::Portrait4x5 => (1024, 1280),
            AspectRatio::Ultrawide => (1344, 576),
        }
    }

    pub fn pixel_count(&self) -> u32 {
        let (w, h) = self.dimensions();
        w * h
    }
}

impl fmt::Display for AspectRatio {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AspectRatio::Square => write!(f, "1:1"),
            AspectRatio::Landscape => write!(f, "16:9"),
            AspectRatio::Portrait => write!(f, "9:16"),
            AspectRatio::Portrait4x5 => write!(f, "4:5"),
            AspectRatio::Ultrawide => write!(f, "21:9"),
        }
    }
}

// ─── 生成结果 ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateResult {
    pub job_id: String,
    pub images: Vec<GeneratedImage>,
    pub seed_used: u64,
    pub took_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedImage {
    pub id: String,
    pub file_path: String,
    pub thumb_path: Option<String>,
    pub seed: u64,
}

// ─── 生成进度 ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    pub job_id: String,
    pub step: u32,
    pub total_steps: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>, // base64 预览
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobDone {
    pub job_id: String,
    pub image_path: String,
    pub seed: u64,
    pub took_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobError {
    pub job_id: String,
    pub message: String,
}

// ─── 用户会话 ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: i64,
    pub email: String,
    pub plan: PlanTier,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub session_token: String,
    pub user: UserInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
}

// ─── 会员等级 ─────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PlanTier {
    #[serde(rename = "free")]
    Free,
    #[serde(rename = "pro")]
    Pro,
    #[serde(rename = "pro_plus")]
    ProPlus,
}

impl PlanTier {
    pub fn monthly_quota(&self) -> u32 {
        match self {
            PlanTier::Free => 500,
            PlanTier::Pro => 5_000,
            PlanTier::ProPlus => 20_000,
        }
    }

    pub fn max_steps(&self) -> u32 {
        match self {
            PlanTier::Free => 30,
            PlanTier::Pro | PlanTier::ProPlus => 50,
        }
    }
}

impl Default for PlanTier {
    fn default() -> Self { PlanTier::Free }
}

// ─── 作品记录 ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artwork {
    pub id: i64,
    pub prompt: String,
    pub negative_prompt: Option<String>,
    pub style_id: Option<String>,
    pub seed: Option<i64>,
    pub steps: i32,
    pub cfg_scale: f64,
    pub aspect: String,
    pub file_path: String,
    pub thumb_path: Option<String>,
    pub is_favorite: bool,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtworkListResponse {
    pub items: Vec<Artwork>,
    pub total: i64,
    pub page: i32,
}

// ─── 风格预设 ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Preset {
    pub id: i64,
    pub user_id: Option<i64>,
    pub name: String,
    pub category: String,
    pub prompt: String,
    pub aspect: Option<String>,
    pub is_builtin: bool,
}

// ─── 用户设置 ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSettings {
    pub api_key: Option<String>,
    pub api_endpoint: Option<String>,
    pub storage_path: Option<String>,
    pub theme: String,
    pub shortcuts: Option<String>, // JSON
}

// ─── 存储信息 ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageInfo {
    pub used: u64,
    pub available: u64,
    pub models_size: u64,
}
