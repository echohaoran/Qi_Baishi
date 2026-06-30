/// 白石 BaiShi 桌面应用 Tauri 入口
///
/// Tauri Builder 初始化，注册所有 Command 和状态管理
/// 此文件仅在 Tauri 构建上下文中编译

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::path::PathBuf;

use baishi_lib::commands::{AppState, self};
use baishi_lib::inference::MockEngine;
use baishi_lib::storage::Storage;
use baishi_lib::models::ModelRegistry;

fn main() {
    env_logger::init();

    // 确定数据目录
    let data_dir = get_data_dir();
    log::info!("数据目录: {:?}", data_dir);

    // 初始化存储
    let storage = Storage::open(data_dir.clone())
        .expect("无法初始化数据库");

    // 初始化推理引擎（原型阶段使用 Mock）
    let engine = MockEngine::new();

    // 注册内置预设
    let mut registry = ModelRegistry::new(data_dir);
    registry.register_builtins();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState {
            storage,
            engine: Box::new(engine),
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth_register,
            commands::auth_login,
            commands::auth_logout,
            commands::generate_text_to_image,
            commands::generate_image_to_image,
            commands::cancel_job,
            commands::list_history,
            commands::toggle_favorite,
            commands::delete_artwork,
            commands::get_artwork,
            commands::list_presets,
            commands::save_preset,
            commands::get_settings,
            commands::update_settings,
            commands::get_storage_info,
        ])
        .run(tauri::generate_context!())
        .expect("启动白石 BaiShi 失败");
}

/// 获取用户数据目录
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
