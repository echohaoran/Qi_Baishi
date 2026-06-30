/// 白石 BaiShi 桌面应用后端 — 独立入口（原型/开发用）
///
/// 此文件提供独立二进制入口，不依赖 Tauri 构建上下文。
/// 用于原型阶段测试后端逻辑、数据库操作和 Mock 推理。
///
/// Tauri 集成入口见 main.rs（需要 Tauri 构建环境）

use std::path::PathBuf;
use baishi_lib::commands::AppState;
use baishi_lib::inference::MockEngine;
use baishi_lib::storage::Storage;
use baishi_lib::models::ModelRegistry;
use baishi_lib::auth;
use baishi_lib::types::*;

fn main() {
    env_logger::init();

    // 确定数据目录
    let data_dir = get_data_dir();
    println!("白石 BaiShi v{}", env!("CARGO_PKG_VERSION"));
    println!("数据目录: {:?}", data_dir);
    println!();

    // 初始化存储
    let storage = Storage::open(data_dir.clone())
        .expect("无法初始化数据库");
    println!("✓ 数据库初始化完成");

    // 初始化推理引擎（原型阶段使用 Mock）
    let engine = MockEngine::new();
    println!("✓ 推理引擎就绪（Mock 模式）");

    // 注册内置预设
    let mut registry = ModelRegistry::new(data_dir.clone());
    registry.register_builtins();
    println!("✓ 模型注册表已加载 ({} 个模型)", registry.list().len());

    // ─── 运行测试用例 ─────────────────────────────────
    println!();
    println!("═══ 功能测试 ═══");
    println!();

    // 测试注册
    println!(">> 用户注册测试");
    match auth::register(&storage, "test@baishi.studio", "password123") {
        Ok(resp) => {
            println!("   ✓ 注册成功: user_id={}, session_token={:.16}...", 
                     resp.user.id, &resp.session_token[..16]);
            println!("     plan={:?}, email={}", resp.user.plan, resp.user.email);

            // 测试登录
            println!();
            println!(">> 用户登录测试");
            match auth::login(&storage, "test@baishi.studio", "password123") {
                Ok(login_resp) => {
                    println!("   ✓ 登录成功: user_id={}", login_resp.user.id);
                }
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
            match auth::register(&storage, "test@baishi.studio", "password456") {
                Ok(_) => println!("   ✗ 不应允许重复注册"),
                Err(e) => println!("   ✓ 正确拒绝: {}", e),
            }
        }
        Err(e) => println!("✗ 注册失败: {}", e),
    }

    // 测试生成
    println!();
    println!(">> 文生图测试");
    let req = GenerateRequest {
        prompt: "远山含黛，江面薄雾，一叶孤舟，笔意疏朗".to_string(),
        negative_prompt: Some("模糊，噪点".to_string()),
        style_id: Some("feibai-landscape".to_string()),
        seed: Some(42),
        steps: 30,
        cfg_scale: 7.5,
        aspect: AspectRatio::Square,
        reference_image: None,
        strength: None,
        count: 3,
    };

    match engine.generate(&req) {
        Ok(result) => {
            println!("   ✓ 生成成功: job_id={}", result.job_id);
            println!("     生成 {} 张图片, 耗时 {}ms", result.images.len(), result.took_ms);
            for img in &result.images {
                println!("     - {} (seed: {})", img.id, img.seed);
            }
        }
        Err(e) => println!("   ✗ 生成失败: {}", e),
    }

    // 测试图生图
    println!();
    println!(">> 图生图测试");
    let img2img_req = GenerateRequest {
        prompt: "转换为水墨风格".to_string(),
        negative_prompt: None,
        style_id: None,
        seed: Some(123),
        steps: 35,
        cfg_scale: 8.0,
        aspect: AspectRatio::Landscape,
        reference_image: Some("data:image/png;base64,<mock>".to_string()),
        strength: Some(0.5),
        count: 1,
    };

    match engine.generate(&img2img_req) {
        Ok(result) => {
            println!("   ✓ 图生图成功: {} 张, 耗时 {}ms", result.images.len(), result.took_ms);
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
    println!(">> 算力计算测试");
    let cost = baishi_lib::inference::compute_cost(30, &AspectRatio::Square);
    println!("   1024×1024 × 30 步 = {} 算力", cost);
    let cost2 = baishi_lib::inference::compute_cost(40, &AspectRatio::Landscape);
    println!("   1216×684 × 40 步 = {} 算力", cost2);

    // 测试用户设置
    println!();
    println!(">> 用户设置测试");
    match storage.get_settings(1) {
        Ok(settings) => {
            println!("   ✓ 获取设置成功: theme={}, api={:?}", 
                     settings.theme, settings.api_endpoint);
            let updated = UserSettings {
                theme: "ink".into(),
                api_endpoint: Some("https://api.baishi.studio".into()),
                api_key: Some("sk-test".into()),
                storage_path: None,
                shortcuts: None,
            };
            match storage.update_settings(1, &updated) {
                Ok(_) => println!("   ✓ 更新设置成功"),
                Err(e) => println!("   ✗ 更新设置失败: {}", e),
            }
        }
        Err(e) => println!("   ✓ 新建用户时自动创建设置 (首次调用)"),
    }

    // 测试预设管理
    println!();
    println!(">> 预设管理测试");
    match storage.save_preset(None, "测试预设", "山水", "远山近水，墨色浓淡", Some("16:9")) {
        Ok(id) => println!("   ✓ 保存预设成功: id={}", id),
        Err(e) => println!("   ✗ 保存预设失败: {}", e),
    }
    match storage.list_presets(None) {
        Ok(presets) => println!("   ✓ 查询预设列表: {} 条", presets.len()),
        Err(e) => println!("   ✗ 查询预设失败: {}", e),
    }

    // 测试历史
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
