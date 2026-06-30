/// 推理引擎核心 — trait 定义与调度
///
/// 遵循 server.md §3 推理引擎规范

use std::sync::atomic::{AtomicU64, Ordering};
use rand::Rng;
use image::RgbImage;
use uuid::Uuid;
use chrono::Utc;

use crate::types::*;

/// 推理引擎 trait
pub trait InferenceEngine: Send + Sync {
    /// 加载模型
    fn load(&mut self, spec: &ModelSpec) -> Result<(), String>;
    /// 执行生成
    fn generate(&self, req: &GenerateRequest) -> Result<GenerateResult, String>;
    /// 是否已加载
    fn is_loaded(&self) -> bool;
}

/// 模型规格
#[derive(Debug, Clone)]
pub struct ModelSpec {
    pub name: String,
    pub path: std::path::PathBuf,
    pub sha256: Option<String>,
}

impl Default for ModelSpec {
    fn default() -> Self {
        Self {
            name: "SDXL-BaiShi-v2".into(),
            path: std::path::PathBuf::from("models/sdxl-baishi-v2"),
            sha256: None,
        }
    }
}

/// 采样器类型
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum SchedulerType {
    DDIM,
    DPMPlusPlus,
    Euler,
}

impl Default for SchedulerType {
    fn default() -> Self { SchedulerType::Euler }
}

/// Mock 推理引擎（原型阶段使用）
///
/// 在真实推理引擎接入前，返回模拟的渐变图
pub struct MockEngine {
    loaded: bool,
    counter: AtomicU64,
}

impl MockEngine {
    pub fn new() -> Self {
        Self {
            loaded: false,
            counter: AtomicU64::new(0),
        }
    }
}

impl InferenceEngine for MockEngine {
    fn load(&mut self, _spec: &ModelSpec) -> Result<(), String> {
        self.loaded = true;
        Ok(())
    }

    fn generate(&self, req: &GenerateRequest) -> Result<GenerateResult, String> {
        let seed = req.seed.unwrap_or_else(|| rand::thread_rng().gen::<u64>());
        let start = std::time::Instant::now();

        // 模拟生成延迟（原型阶段）
        std::thread::sleep(std::time::Duration::from_millis(800));

        let took_ms = start.elapsed().as_millis() as u64;
        let job_id = Uuid::new_v4().to_string();
        let mut images = Vec::new();

        let (w, h) = req.aspect.dimensions();
        let count = req.count.min(5).max(1);

        for i in 0..count {
            let img_seed = seed.wrapping_add(i as u64);
            // 创建模拟渐变图
            let mut img = RgbImage::new(w, h);
            for x in 0..w {
                for y in 0..h {
                    let r = ((x as f32 / w as f32) * 200.0 + (img_seed & 0xFF) as f32 * 0.1) as u8;
                    let g = ((y as f32 / h as f32) * 180.0 + ((img_seed >> 8) & 0xFF) as f32 * 0.1) as u8;
                    let b = (128 + ((img_seed >> 16) & 0x7F) as u8).min(200);
                    img.put_pixel(x, y, image::Rgb([r, g, b]));
                }
            }

            let img_id = Uuid::new_v4().to_string();
            let file_name = format!("{}.png", img_id);

            // 保存到临时路径（实际应保存到用户数据目录）
            let temp_dir = std::env::temp_dir().join("baishi_generations");
            std::fs::create_dir_all(&temp_dir).ok();
            let file_path = temp_dir.join(&file_name);
            img.save(&file_path).map_err(|e| format!("保存图片失败: {}", e))?;

            images.push(GeneratedImage {
                id: img_id,
                file_path: file_path.to_string_lossy().to_string(),
                thumb_path: None,
                seed: img_seed,
            });
        }

        Ok(GenerateResult {
            job_id,
            images,
            seed_used: seed,
            took_ms,
        })
    }

    fn is_loaded(&self) -> bool {
        self.loaded
    }
}

/// 算力消耗计算
/// cost = steps × width × height / 1000
pub fn compute_cost(steps: u32, aspect: &AspectRatio) -> u32 {
    let pixels = aspect.pixel_count();
    (steps * pixels) / 1000
}

/// 检查用户是否有足够算力
pub fn check_quota(quota: u32, used: u32, cost: u32) -> Result<(), String> {
    if used + cost > quota {
        return Err(format!(
            "算力不足。本月已用 {} / {}，需要 {}",
            used, quota, cost
        ));
    }
    Ok(())
}
