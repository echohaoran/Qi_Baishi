#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

/// 白石 BaiShi 桌面应用 Tauri 入口
///
/// 使用 Agnes Image 2.1 Flash API 进行图像生成

use std::path::PathBuf;

use baishi_lib::commands::{AppState, self};
use baishi_lib::inference::AgnesEngine;
use baishi_lib::storage::Storage;

fn main() {
    env_logger::init();

    let data_dir = get_data_dir();
    log::info!("数据目录: {:?}", data_dir);

    // 初始化存储（SQLite）
    let storage = Storage::open(data_dir.clone())
        .expect("无法初始化数据库");

    // 读取 API Key
    let api_key = std::env::var("BAISHI_API_KEY")
        .unwrap_or_else(|_| "sk-ZpxAQINPD8XUWRkWdSzugoT2a3Q3Cj48CHTtEVJaodPgUxkF".to_string());
    log::info!("使用 Agnes API (密钥前缀: {}...)", &api_key[..12]);

    // 初始化 Agnes 引擎
    let engine = AgnesEngine::new(api_key);

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
