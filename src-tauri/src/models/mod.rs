/// 模型注册与下载管理
///
/// 遵循 server.md §3.2 模型规范

use std::path::PathBuf;

use crate::inference::ModelSpec;

/// 模型注册表
pub struct ModelRegistry {
    models: Vec<ModelSpec>,
    data_dir: PathBuf,
}

impl ModelRegistry {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            models: Vec::new(),
            data_dir,
        }
    }

    /// 注册内置模型
    pub fn register_builtins(&mut self) {
        self.models.push(ModelSpec {
            name: "SDXL-BaiShi-v2".into(),
            path: self.data_dir.join("models/sdxl-baishi-v2"),
            sha256: None, // TODO: 添加真实 SHA256
        });
    }

    /// 获取所有已注册模型
    pub fn list(&self) -> &[ModelSpec] {
        &self.models
    }

    /// 按名称查找模型
    pub fn find_by_name(&self, name: &str) -> Option<&ModelSpec> {
        self.models.iter().find(|m| m.name == name)
    }

    /// 检测模型是否存在
    pub fn is_model_present(&self, spec: &ModelSpec) -> bool {
        // 检查模型目录是否存在且包含关键文件
        let model_file = spec.path.join("model.safetensors");
        model_file.exists()
    }

    /// 模型是否已被加载（文件存在即视为就绪）
    pub fn is_ready(&self) -> bool {
        self.models.iter().all(|m| self.is_model_present(m))
    }
}

/// 模型下载器
pub struct ModelDownloader {
    data_dir: PathBuf,
}

impl ModelDownloader {
    pub fn new(data_dir: PathBuf) -> Self {
        Self { data_dir }
    }

    /// 检查是否需要下载
    pub fn needs_download(&self, spec: &ModelSpec) -> bool {
        !spec.path.join("model.safetensors").exists()
    }

    /// 下载模型（占位实现，真实实现需接入 CDN）
    pub fn download(&self, _spec: &ModelSpec) -> Result<(), String> {
        // TODO: 实现真实的模型下载流程
        // 1. 创建目标目录
        // 2. 从 CDN 拉取分片文件
        // 3. 校验 SHA256
        // 4. 解包/组合
        Err("模型下载尚未实现，请手动将 SDXL-BaiShi-v2 模型文件放置到 models/ 目录".into())
    }
}
