/// 白石 BaiShi 后端共享类型定义（Agnes Image API）

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
    /// 参考图（图生图用）：公共 URL 或 Data URI Base64
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reference_image: Option<String>,
    /// 多张参考图（多图融合用）：公共 URL 或 Data URI Base64 数组
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub reference_images: Vec<String>,
    /// 重绘强度 0.0–1.0（图生图用，当前由 Agnes 自动处理）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub strength: Option<f32>,
    /// 生图数量 1–4
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
            reference_images: Vec::new(),
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
    #[serde(rename = "3:4")]
    Portrait3x4,
    #[serde(rename = "4:5")]
    Portrait4x5,
    #[serde(rename = "16:9")]
    Landscape,
    #[serde(rename = "9:16")]
    Portrait,
    #[serde(rename = "21:9")]
    Ultrawide,
}

impl AspectRatio {
    /// 根据画面比例自动选最高兼容分辨率
    /// high_precision = true 时返回该比例能取到的最大稳定尺寸（各家 provider 都接受）
    /// high_precision = false 时返回 SDXL 默认尺寸（Agnes 2.1 Flash 推荐值）
    ///
    /// 设计原则：
    ///   1. SDXL 训练分辨率 = 1024×1024，所以 1:1 取 1024 最稳
    ///   2. 非正方比例（3:4 / 4:5 / 16:9 / 9:16 / 21:9）也按总像素 ≈ 1024² 缩放，保证模型
    ///      不会因为分辨率过高而出现重复结构 / 解剖崩坏
    ///   3. 高精度模式 = 1.5× 长边（≈ 2.25× 像素），覆盖 SDXL up-scale 与 FLUX.1-dev 的
    ///      高分辨率生成区间
    ///   4. Agnes 2.1 Flash / OpenAI / Stability / SiliconFlow 都接受这些尺寸
    pub fn size_string(&self) -> &str {
        self.size_string_with(false)
    }
    pub fn high_precision_size_string(&self) -> &str {
        self.size_string_with(true)
    }
    fn size_string_with(&self, hp: bool) -> &'static str {
        match (self, hp) {
            // 1:1 — 正方形
            (AspectRatio::Square, false) => "1024x1024",
            (AspectRatio::Square, true)  => "1536x1536",
            // 3:4 — 竖版偏宽
            (AspectRatio::Portrait3x4, false) => "1152x1536",
            (AspectRatio::Portrait3x4, true)  => "1536x2048",
            // 4:5 — 经典社交媒体竖版
            (AspectRatio::Portrait4x5, false) => "1024x1280",
            (AspectRatio::Portrait4x5, true)  => "1280x1600",
            // 16:9 — 横幅
            (AspectRatio::Landscape, false) => "1216x684",
            (AspectRatio::Landscape, true)  => "1920x1080",
            // 9:16 — 移动端竖屏
            (AspectRatio::Portrait, false) => "684x1216",
            (AspectRatio::Portrait, true)  => "1080x1920",
            // 21:9 — 超宽电影
            (AspectRatio::Ultrawide, false) => "1344x576",
            (AspectRatio::Ultrawide, true)  => "2048x864",
        }
    }

    pub fn pixel_count(&self) -> u32 {
        let (w, h) = self.dimensions();
        w * h
    }

    pub fn dimensions(&self) -> (u32, u32) {
        let s = self.size_string();
        let mut it = s.split('x');
        let w: u32 = it.next().unwrap().parse().unwrap();
        let h: u32 = it.next().unwrap().parse().unwrap();
        (w, h)
    }

    /// 高精度尺寸 (用于显示提示)
    pub fn high_precision_dimensions(&self) -> (u32, u32) {
        let s = self.high_precision_size_string();
        let mut it = s.split('x');
        let w: u32 = it.next().unwrap().parse().unwrap();
        let h: u32 = it.next().unwrap().parse().unwrap();
        (w, h)
    }
}

impl fmt::Display for AspectRatio {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AspectRatio::Square => write!(f, "1:1"),
            AspectRatio::Portrait3x4 => write!(f, "3:4"),
            AspectRatio::Portrait4x5 => write!(f, "4:5"),
            AspectRatio::Landscape => write!(f, "16:9"),
            AspectRatio::Portrait => write!(f, "9:16"),
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
    pub url: Option<String>,
    pub b64_json: Option<String>,
    pub seed: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RemoteImageRequest {
    pub prompt: String,
    #[serde(default)]
    pub negative_prompt: Option<String>,
    #[serde(default)]
    pub style_id: Option<String>,
    #[serde(default)]
    pub seed: Option<u64>,
    #[serde(default)]
    pub steps: Option<u32>,
    #[serde(default)]
    pub cfg_scale: Option<f32>,
    #[serde(default)]
    pub aspect: Option<String>,
    #[serde(default)]
    pub reference_image: Option<String>,
    #[serde(default)]
    pub reference_images: Option<Vec<String>>,
    #[serde(default)]
    pub strength: Option<f32>,
    #[serde(default)]
    pub count: Option<u32>,
    #[serde(default)]
    pub endpoint: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub request_body: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RemoteTextRequest {
    pub prompt: String,
    #[serde(default)]
    pub api_url: Option<String>,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PromptEnhanceResult {
    pub enhanced: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TextGenerateResult {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionTestResult {
    pub status: u16,
    pub content_type: String,
    pub took_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RemoteConnectionTestRequest {
    pub endpoint: String,
    #[serde(default)]
    pub api_key: Option<String>,
    pub body_json: String,
}

// ─── 生成进度（预留事件） ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgress {
    pub job_id: String,
    pub step: u32,
    pub total_steps: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<String>,
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
    pub name: String,
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

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UserSettings {
    pub api_key: Option<String>,
    pub api_endpoint: Option<String>,
    pub text_api_model: Option<String>,
    pub storage_path: Option<String>,
    pub theme: String,
    pub shortcuts: Option<String>,
}

// ─── 存储信息 ─────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageInfo {
    pub used: u64,
    pub available: u64,
    pub models_size: u64,
    pub total_history_count: u64,
    pub month_count: u64,
    pub week_count: u64,
    pub day_count: u64,
}
