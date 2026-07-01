/// 推理引擎 — 支持用户自定义 endpoint / api_key / request_body 模板
///
/// 请求时由前端传入：
///   - endpoint: 第三方 API URL（如 https://api.openai.com/v1/images/generations）
///   - api_key: 用户配置的 API Key
///   - request_body: 用户填的 JSON 模板，含 {{prompt}} / {{n}} / {{size}} / {{seed}} / {{aspect}} 等占位符
///
/// 后端只做模板替换 + 透传 + 解析图片 URL，不关心各家 provider 的具体字段名。

use crate::types::*;
use serde_json::{json, Value};
use uuid::Uuid;
use std::time::Instant;
use std::sync::Arc;
use base64::{Engine as _, engine::general_purpose};

const DEFAULT_AGNES_ENDPOINT: &str = "https://apihub.agnes-ai.com/v1/images/generations";

/// 推理引擎 trait
pub trait InferenceEngine: Send + Sync {
    fn generate(&self, req: &GenerateRequest) -> Result<GenerateResult, String>;
}

/// 用户配置（生图请求里携带）
#[derive(Debug, Clone, Default)]
pub struct UserGenerationConfig {
    pub endpoint: Option<String>,
    pub api_key: Option<String>,
    /// JSON 字符串模板（含 {{prompt}} / {{n}} / {{size}} / {{seed}} / {{aspect}} 等占位符）
    pub request_body: Option<String>,
}

/// 通用推理引擎 — 透传到用户配置的 endpoint
pub struct GenericEngine {
    default_api_key: String,
    default_endpoint: String,
    client: reqwest::Client,
}

impl GenericEngine {
    pub fn new(api_key: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(180))
            .build()
            .expect("创建 HTTP 客户端失败");
        Self {
            default_api_key: api_key,
            default_endpoint: DEFAULT_AGNES_ENDPOINT.to_string(),
            client,
        }
    }

    /// 异步生成（HTTP 服务器使用）
    pub async fn generate_async(
        &self,
        req: &GenerateRequest,
        cfg: &UserGenerationConfig,
    ) -> Result<GenerateResult, String> {
        let start = Instant::now();
        let job_id = Uuid::new_v4().to_string();

        // 决定 endpoint + key：用户传入的优先，否则用默认
        let endpoint = cfg
            .endpoint
            .as_deref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| self.default_endpoint.clone());

        let api_key = cfg
            .api_key
            .as_deref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| self.default_api_key.clone());

        // 组装最终请求体
        let api_req = build_request_body(req, cfg)?;

        let mut request = self
            .client
            .post(&endpoint)
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&api_req);

        // Stability AI 特殊要求：Bearer 鉴权 + Accept 头
        if endpoint.contains("stability.ai") {
            request = request
                .header("Accept", "image/*")
                .header("Authorization", format!("Bearer {}", api_key));
        }

        let response = request
            .send()
            .await
            .map_err(|e| format!("API 请求失败: {}", e))?;

        let status = response.status();
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|h| h.to_str().ok())
            .unwrap_or("")
            .to_string();

        // 直接返回图片（image/*）
        if content_type.starts_with("image/") {
            let bytes = response
                .bytes()
                .await
                .map_err(|e| format!("读取图片失败: {}", e))?;
            let b64 = general_purpose::STANDARD.encode(&bytes);
            let took_ms = start.elapsed().as_millis() as u64;
            return Ok(GenerateResult {
                job_id: job_id.clone(),
                images: vec![GeneratedImage {
                    id: format!("{}-0", job_id),
                    url: None,
                    b64_json: Some(format!("data:{};base64,{}", content_type, b64)),
                    seed: req.seed.unwrap_or(0),
                }],
                seed_used: req.seed.unwrap_or(0),
                took_ms,
            });
        }

        let body = response
            .text()
            .await
            .map_err(|e| format!("读取响应失败: {}", e))?;

        if !status.is_success() {
            return Err(format!(
                "API 错误 ({}): {}",
                status.as_u16(),
                &body[..body.len().min(300)]
            ));
        }

        let parsed: Value = serde_json::from_str(&body)
            .map_err(|e| format!("解析响应失败: {} (body: {})", e, &body[..body.len().min(200)]))?;

        let took_ms = start.elapsed().as_millis() as u64;
        let images = parse_images(&parsed, &job_id, req.seed.unwrap_or(0));

        if images.is_empty() {
            return Err("响应中未找到任何图片字段（data[].url / data[].b64_json / image）".to_string());
        }

        Ok(GenerateResult {
            job_id,
            images,
            seed_used: req.seed.unwrap_or(0),
            took_ms,
        })
    }
}

/// 同步接口
impl InferenceEngine for GenericEngine {
    fn generate(&self, req: &GenerateRequest) -> Result<GenerateResult, String> {
        let cfg = UserGenerationConfig::default();
        let rt = tokio::runtime::Runtime::new().map_err(|e| format!("创建 runtime 失败: {}", e))?;
        rt.block_on(self.generate_async(req, &cfg))
    }
}

/// 旧名兼容 — 之前使用 AgnesEngine
pub type AgnesEngine = GenericEngine;

// ─── 模板替换 ─────────────────────────────────────────────

fn build_request_body(req: &GenerateRequest, cfg: &UserGenerationConfig) -> Result<Value, String> {
    // I2I 模式检测：reference_image / reference_images 任何一个不为空
    let is_i2i = req.reference_image.is_some() || !req.reference_images.is_empty();
    let endpoint = cfg
        .endpoint
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(DEFAULT_AGNES_ENDPOINT);

    // 收集所有参考图为数组 (多图融合 / 单图 I2I 同一路径)
    let all_images: Vec<String> = {
        let mut v: Vec<String> = req.reference_images.clone();
        if let Some(s) = &req.reference_image {
            if !s.is_empty() { v.insert(0, s.clone()); }
        }
        v
    };
    let images_json = serde_json::to_string(&all_images)
        .unwrap_or_else(|_| "[]".to_string());

    // 优先用用户提供的模板
    if let Some(tpl) = cfg.request_body.as_deref() {
        let tpl = tpl.trim();
        if !tpl.is_empty() {
            // 先按字符串替换占位符，再 parse
            let mut body_str = tpl.to_string();

            // 图片维度: 高精度模式自动选该比例的最高兼容分辨率
            // steps >= 50 → 高精度 → 用 AspectRatio::high_precision_size_string()
            // steps <  50 → 标准  → 用 AspectRatio::size_string()
            let is_high_precision = req.steps >= 50;
            let size_str = if is_high_precision {
                req.aspect.high_precision_size_string()
            } else {
                req.aspect.size_string()
            };
            let (w, h) = if is_high_precision {
                req.aspect.high_precision_dimensions()
            } else {
                req.aspect.dimensions()
            };

            let placeholders: Vec<(&str, String)> = vec![
                ("{{prompt}}", req.prompt.clone()),
                ("{{negative_prompt}}", req.negative_prompt.clone().unwrap_or_default()),
                ("{{n}}", req.count.min(4).max(1).to_string()),
                ("{{count}}", req.count.min(4).max(1).to_string()),
                ("{{seed}}", req.seed.map(|s| s.to_string()).unwrap_or_else(|| "0".to_string())),
                ("{{steps}}", req.steps.to_string()),
                ("{{cfg_scale}}", req.cfg_scale.to_string()),
                ("{{aspect}}", req.aspect.to_string()),
                ("{{size}}", size_str.to_string()),
                ("{{width}}", w.to_string()),
                ("{{height}}", h.to_string()),
                ("{{high_precision}}", is_high_precision.to_string()),
            ];
            for (k, v) in placeholders {
                body_str = body_str.replace(k, &v);
            }
            // 处理 reference_image / image (单图占位符)
            let single = all_images.first().cloned().unwrap_or_default();
            body_str = body_str.replace("{{reference_image}}", &single);
            body_str = body_str.replace("{{image}}", &single);
            // 处理 {{images}} / {{reference_images}} (多图 JSON 数组占位符)
            body_str = body_str.replace("{{images}}", &images_json);
            body_str = body_str.replace("{{reference_images}}", &images_json);

            let mut body: Value = serde_json::from_str(&body_str)
                .map_err(|e| format!("解析用户请求体模板失败: {} (body: {})", e, &body_str[..body_str.len().min(200)]))?;

            // 兼容旧模板把数值占位符包在引号里，例如 "n": "{{n}}"。
            // 这类字符串会让 Agnes/OpenAI 等上游把合法请求判成 500/400。
            normalize_loose_template_types(&mut body);
            normalize_provider_specific_fields(&mut body, endpoint, is_i2i);

            // I2I 自动注入: Agnes 官方文档要求 extra_body.image: [array] + response_format
            // 兼容用户模板中可能不包含 extra_body 的场景
            apply_i2i_defaults(&mut body, &all_images);

            return Ok(body);
        }
    }

    // 用户没提供模板时，使用 Agnes 默认 schema
    // 高精度模式自动选该比例能取到的最大稳定尺寸
    let is_high_precision = req.steps >= 50;
    let size_str = if is_high_precision {
        req.aspect.high_precision_size_string()
    } else {
        req.aspect.size_string()
    };
    let mut body = json!({
        "model": "agnes-image-2.1-flash",
        "prompt": req.prompt,
        "size": size_str,
        "n": req.count.min(4).max(1),
    });
    if let Some(seed) = req.seed {
        body["seed"] = json!(seed);
    }
    if is_i2i {
        // 切换到 I2I 规范：extra_body.image 数组 + response_format
        body.as_object_mut().unwrap().remove("size");
        body["extra_body"] = json!({
            "image": all_images,
            "response_format": "url"
        });
    }
    if let Some(np) = &req.negative_prompt {
        body["negative_prompt"] = json!(np);
    }
    Ok(body)
}

fn normalize_loose_template_types(value: &mut Value) {
    const NUMERIC_KEYS: &[&str] = &[
        "n",
        "count",
        "seed",
        "steps",
        "cfg_scale",
        "guidance_scale",
        "strength",
        "width",
        "height",
        "num_inference_steps",
    ];
    const BOOL_KEYS: &[&str] = &["high_precision"];

    match value {
        Value::Object(map) => {
            for (key, child) in map.iter_mut() {
                normalize_loose_template_types(child);
                if let Value::String(raw) = child {
                    let trimmed = raw.trim();
                    if BOOL_KEYS.contains(&key.as_str()) {
                        if trimmed.eq_ignore_ascii_case("true") {
                            *child = Value::Bool(true);
                        } else if trimmed.eq_ignore_ascii_case("false") {
                            *child = Value::Bool(false);
                        }
                        continue;
                    }

                    if !NUMERIC_KEYS.contains(&key.as_str()) {
                        continue;
                    }

                    if let Ok(v) = trimmed.parse::<i64>() {
                        *child = json!(v);
                        continue;
                    }
                    if let Ok(v) = trimmed.parse::<f64>() {
                        if let Some(num) = serde_json::Number::from_f64(v) {
                            *child = Value::Number(num);
                        }
                    }
                }
            }
        }
        Value::Array(arr) => {
            for child in arr.iter_mut() {
                normalize_loose_template_types(child);
            }
        }
        _ => {}
    }
}

fn normalize_provider_specific_fields(body: &mut Value, endpoint: &str, is_i2i: bool) {
    let is_agnes = endpoint.contains("agnes-ai.com");
    if !is_agnes {
        return;
    }

    if let Some(map) = body.as_object_mut() {
        if !is_i2i {
            map.remove("response_format");
        }
    }
}

/// I2I 模式补全: 确保 extra_body.image 是数组、移除顶层 response_format
/// Agnes 官方文档要求：
///   1. 图生图参数必须放在 extra_body 里 (不是顶层)
///   2. image 字段是 string[] (数组)，支持 URL 或 Data URI Base64
///   3. response_format 也在 extra_body 里 (url / b64_json)
///   4. 请勿在顶层放 response_format, 也请勿传递 tags: ["img2img"]
fn apply_i2i_defaults(body: &mut Value, images: &[String]) {
    if images.is_empty() { return; }  // 不是 I2I 模式, 不动

    // 1) 移除顶层 response_format (Agnes 文档: 请勿放在顶层)
    if let Some(map) = body.as_object_mut() {
        map.remove("response_format");
    }

    // 2) 确保 extra_body 存在
    if !body.get("extra_body").map(|v| v.is_object()).unwrap_or(false) {
        body["extra_body"] = json!({});
    }

    let extra = body.get_mut("extra_body").and_then(|v| v.as_object_mut());
    if let Some(extra) = extra {
        // 3) 注入 image 数组 (只有当 user 模板里没明确给出时, 避免覆盖用户填写)
        if !extra.contains_key("image") {
            extra.insert("image".to_string(), json!(images));
        } else if let Some(arr) = extra.get_mut("image").and_then(|v| v.as_array_mut()) {
            // 模板里给了 image 但不是数组 (e.g. 字符串) → 转成数组
            if arr.is_empty() {
                *arr = images.iter().map(|s| json!(s)).collect();
            }
        }
        // 4) 默认 response_format: "url" (模板里没指定时)
        if !extra.contains_key("response_format") {
            extra.insert("response_format".to_string(), json!("url"));
        }
    }
}

/// 从各种 provider 的响应里抽出图片
fn parse_images(parsed: &Value, job_id: &str, default_seed: u64) -> Vec<GeneratedImage> {
    let mut out = Vec::new();

    // 1) OpenAI 兼容：{ data: [{ url, b64_json }, ...] }
    if let Some(arr) = parsed.get("data").and_then(|v| v.as_array()) {
        for (i, item) in arr.iter().enumerate() {
            let url = item.get("url").and_then(|v| v.as_str()).map(String::from);
            let b64 = item.get("b64_json").and_then(|v| v.as_str()).map(String::from);
            if url.is_some() || b64.is_some() {
                out.push(GeneratedImage {
                    id: format!("{}-{}", job_id, i),
                    url,
                    b64_json: b64,
                    seed: default_seed.wrapping_add(i as u64),
                });
            }
        }
        if !out.is_empty() { return out; }
    }

    // 2) Stability AI / 一些自定义：{ image: "base64..." } 或 { artifacts: [{ base64, ... }] }
    if let Some(arr) = parsed.get("artifacts").and_then(|v| v.as_array()) {
        for (i, item) in arr.iter().enumerate() {
            if let Some(b64) = item.get("base64").and_then(|v| v.as_str()) {
                out.push(GeneratedImage {
                    id: format!("{}-{}", job_id, i),
                    url: None,
                    b64_json: Some(format!("data:image/png;base64,{}", b64)),
                    seed: default_seed.wrapping_add(i as u64),
                });
            }
        }
        if !out.is_empty() { return out; }
    }
    if let Some(b64) = parsed.get("image").and_then(|v| v.as_str()) {
        return vec![GeneratedImage {
            id: format!("{}-0", job_id),
            url: None,
            b64_json: Some(if b64.starts_with("data:") { b64.to_string() } else { format!("data:image/png;base64,{}", b64) }),
            seed: default_seed,
        }];
    }

    // 3) { images: [{ url, ... }] }
    if let Some(arr) = parsed.get("images").and_then(|v| v.as_array()) {
        for (i, item) in arr.iter().enumerate() {
            if let Some(url) = item.get("url").and_then(|v| v.as_str()) {
                out.push(GeneratedImage {
                    id: format!("{}-{}", job_id, i),
                    url: Some(url.to_string()),
                    b64_json: None,
                    seed: default_seed.wrapping_add(i as u64),
                });
            }
        }
        if !out.is_empty() { return out; }
    }

    out
}

/// 算力消耗计算
pub fn compute_cost(_steps: u32, _aspect: &AspectRatio) -> u32 {
    1
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

#[allow(dead_code)]
fn _unused_arc_check() -> Arc<()> { Arc::new(()) }
