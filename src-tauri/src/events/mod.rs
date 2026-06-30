/// 事件系统 — 后端推送给前端的事件类型
///
/// 遵循 server.md §4.2 Event 清单

use serde::Serialize;

/// 后端事件枚举
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "payload")]
pub enum BackendEvent {
    #[serde(rename = "job:progress")]
    JobProgress {
        job_id: String,
        step: u32,
        total_steps: u32,
        preview: Option<String>,
    },
    #[serde(rename = "job:done")]
    JobDone {
        job_id: String,
        image_path: String,
        seed: u64,
        took_ms: u64,
    },
    #[serde(rename = "job:error")]
    JobError {
        job_id: String,
        message: String,
    },
    #[serde(rename = "system:notify")]
    SystemNotify {
        kind: String,  // "info" | "success" | "warning" | "error"
        title: String,
        body: String,
    },
}
