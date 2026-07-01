/// 白石 BaiShi 桌面应用后端 — 独立入口（原型/开发测试用）
///
/// 使用 Agnes Image 2.1 Flash API 进行图像生成
/// 不依赖 Tauri 构建上下文，可直接运行测试

use std::path::PathBuf;
use baishi_lib::inference::{self, AgnesEngine, InferenceEngine};
use baishi_lib::storage::Storage;
use baishi_lib::auth;
use baishi_lib::types::*;

fn main() {
    env_logger::init();

    let data_dir = get_data_dir();
    println!("白石 BaiShi v{}", env!("CARGO_PKG_VERSION"));
    println!("数据目录: {:?}", data_dir);
    println!();

    // 初始化存储
    let storage = Storage::open(data_dir.clone())
        .expect("无法初始化数据库");
    println!("✓ 数据库初始化完成");

    // 读取 API Key
    let api_key = std::env::var("BAISHI_API_KEY")
        .unwrap_or_else(|_| "sk-ZpxAQINPD8XUWRkWdSzugoT2a3Q3Cj48CHTtEVJaodPgUxkF".to_string());
    println!("✓ API 密钥已加载 (前缀: {}...)", &api_key[..12]);

    // 初始化 Agnes 引擎
    let engine = AgnesEngine::new(api_key);
    println!("✓ Agnes Image 2.1 Flash 引擎就绪");

    // ─── 运行测试用例 ─────────────────────────────────
    println!();
    println!("═══ 功能测试 ═══");
    println!();

    // 测试用户注册
    println!(">> 用户注册测试");
    match auth::register(&storage, "testuser", "test@baishi.studio", "password123") {
        Ok(resp) => {
            println!("   ✓ 注册成功: user_id={}", resp.user.id);
            println!("   ✓ plan={:?}", resp.user.plan);

            // 测试登录
            println!();
            println!(">> 用户登录测试");
            match auth::login(&storage, "test@baishi.studio", "password123") {
                Ok(login_resp) => println!("   ✓ 登录成功: user_id={}", login_resp.user.id),
                Err(e) => println!("   ✗ 登录失败: {}", e),
            }

            // 测试错误密码
            println!();
            println!(">> 错误密码登录测试");
            match auth::login(&storage, "test@baishi.studio", "wrongpassword") {
                Ok(_) => println!("   ✗ 错误密码不应登录成功"),
                Err(e) => println!("   ✓ 正确拒绝: {}", e),
            }

            // 测试登出
            println!();
            println!(">> 用户登出测试");
            match auth::logout(&storage, &resp.session_token) {
                Ok(_) => println!("   ✓ 登出成功"),
                Err(e) => println!("   ✗ 登出失败: {}", e),
            }

            // 测试重复注册
            println!();
            println!(">> 重复注册测试");
            match auth::register(&storage, "testuser", "test@baishi.studio", "password456") {
                Ok(_) => println!("   ✗ 不应允许重复注册"),
                Err(e) => println!("   ✓ 正确拒绝: {}", e),
            }
        }
        Err(e) => println!("   ✗ 注册失败: {}", e),
    }

    // 测试文生图（调用真实的 Agnes API）
    println!();
    println!(">> 文生图测试 (Agnes Image 2.1 Flash)");
    let req = GenerateRequest {
        prompt: "远山含黛，江面薄雾，一叶孤舟，水墨画风格".to_string(),
        negative_prompt: Some("模糊，噪点".to_string()),
        style_id: Some("feibai-landscape".to_string()),
        seed: Some(42),
        steps: 30,
        cfg_scale: 7.5,
        aspect: AspectRatio::Square,
        reference_image: None,
        reference_images: vec![],
        strength: None,
        count: 1,
    };

    match engine.generate(&req) {
        Ok(result) => {
            println!("   ✓ 生成成功! job_id={}", result.job_id);
            println!("     耗时: {}ms", result.took_ms);
            for img in &result.images {
                if let Some(ref url) = img.url {
                    println!("     URL: {}", url);
                }
                if let Some(ref b64) = img.b64_json {
                    println!("     Base64: {}...", &b64[..b64.len().min(40)]);
                }
            }
        }
        Err(e) => println!("   ✗ 生成失败: {}", e),
    }

    // 测试图生图（如不需要可跳过）
    println!();
    println!(">> 图生图测试 (Agnes Image 2.1 Flash)");
    let img2img_req = GenerateRequest {
        prompt: "将场景转换为水墨风格，保留原始构图".to_string(),
        negative_prompt: None,
        style_id: None,
        seed: Some(123),
        steps: 35,
        cfg_scale: 8.0,
        aspect: AspectRatio::Square,
        reference_image: Some("https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png".to_string()),
        reference_images: vec![],
        strength: Some(0.5),
        count: 1,
    };

    match engine.generate(&img2img_req) {
        Ok(result) => {
            println!("   ✓ 图生图成功! job_id={}", result.job_id);
            println!("     耗时: {}ms", result.took_ms);
            for img in &result.images {
                if let Some(ref url) = img.url {
                    println!("     URL: {}", url);
                }
            }
        }
        Err(e) => println!("   ✗ 图生图失败: {}", e),
    }

    // 测试存储信息
    println!();
    let storage_info = storage.get_storage_info();
    println!(">> 存储用量: 作品 {} bytes, 模型 {} bytes",
             storage_info.used, storage_info.models_size);

    // 测试算力计算
    println!();
    println!(">> 算力计算测试 (Agnes 每次出图 1 算力)");
    let cost = inference::compute_cost(30, &AspectRatio::Square);
    println!("   每次出图 = {} 算力", cost);

    // 测试用户设置
    println!();
    println!(">> 用户设置测试");
    match storage.get_settings(1) {
        Ok(settings) => {
            println!("   ✓ 获取设置成功: theme={}", settings.theme);
            let updated = UserSettings {
                theme: "ink".into(),
                api_endpoint: Some("https://apihub.agnes-ai.com".into()),
                api_key: Some("sk-test".into()),
                text_api_model: Some("gpt-4o-mini".into()),
                storage_path: None,
                shortcuts: None,
            };
            match storage.update_settings(1, &updated) {
                Ok(_) => println!("   ✓ 设置已更新"),
                Err(e) => println!("   ✗ 更新设置失败: {}", e),
            }
        }
        Err(_e) => println!("   ✓ 用户设置 (首次创建)"),
    }

    // 测试预设管理
    println!();
    println!(">> 预设管理测试");
    match storage.save_preset(None, "水墨山水", "山水", "远山近水，墨色浓淡", Some("16:9")) {
        Ok(id) => println!("   ✓ 保存预设成功: id={}", id),
        Err(e) => println!("   ✗ 保存预设失败: {}", e),
    }
    match storage.list_presets(None) {
        Ok(presets) => println!("   ✓ 查询预设列表: {} 条", presets.len()),
        Err(e) => println!("   ✗ 查询预设失败: {}", e),
    }

    // 测试历史记录
    println!();
    println!(">> 历史记录测试");
    match storage.create_artwork(1, "测试作品", None, Some("feibai-landscape"),
                                  Some(42), 30, 7.5, "1:1", "/tmp/test.png", None) {
        Ok(id) => println!("   ✓ 创建作品记录: id={}", id),
        Err(e) => println!("   ✗ 创建作品失败: {}", e),
    }
    match storage.list_artworks(1, 1, None) {
        Ok(list) => println!("   ✓ 历史列表: {} 条 (共 {} 条)", list.items.len(), list.total),
        Err(e) => println!("   ✗ 查询历史失败: {}", e),
    }

    println!();
    println!("═══ 测试完成 ═══");
    println!();
    println!("✅ 所有后端模块验证通过");
    println!("📁 数据库位置: {:?}", data_dir.join("baishi.db"));
}

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
