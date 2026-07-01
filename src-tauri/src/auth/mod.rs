/// 鉴权模块 — Argon2id 密码哈希与会话管理
///
/// 支持用户名注册、用户名/邮箱登录

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand::Rng;

use crate::types::*;
use crate::storage::Storage;

/// 注册新用户（支持用户名）
pub fn register(storage: &Storage, name: &str, email: &str, password: &str) -> Result<AuthResponse, String> {
    // 用户名校验
    if name.len() < 2 || name.len() > 32 {
        return Err("用户名需要 2-32 个字符".into());
    }

    // 密码强度校验
    if password.len() < 8 {
        return Err("密码至少需要 8 个字符".into());
    }
    if !password.chars().any(|c| c.is_ascii_alphabetic()) {
        return Err("密码需包含字母".into());
    }
    if !password.chars().any(|c| c.is_ascii_digit()) {
        return Err("密码需包含数字".into());
    }

    // 检查邮箱是否已注册
    if let Some(_) = storage.get_user_by_email(email).map_err(|e| e.to_string())? {
        return Err("该邮箱已注册".into());
    }

    // Argon2id 哈希
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| format!("密码哈希失败: {}", e))?
        .to_string();

    let user_id = storage
        .create_user(name, email, &hash)
        .map_err(|e| format!("创建用户失败: {}", e))?;

    // 生成 session token
    let token = generate_session_token();
    storage
        .create_session(user_id, &token)
        .map_err(|e| format!("创建会话失败: {}", e))?;

    let user = storage
        .get_user_by_id(user_id)
        .map_err(|e| format!("获取用户失败: {}", e))?
        .ok_or_else(|| "用户创建后未找到".to_string())?;

    Ok(AuthResponse {
        session_token: token,
        user,
    })
}

/// 登录（支持用户名或邮箱）
pub fn login(storage: &Storage, email_or_username: &str, password: &str) -> Result<AuthResponse, String> {
    // 先按用户名查，再按邮箱查
    // 先按用户名查，找不到再按邮箱查
    let result = match storage.get_user_by_name(email_or_username) {
        Ok(Some(user)) => Ok(Some(user)),
        _ => storage.get_user_by_email(email_or_username),
    };

    let (user_id, _name, stored_email, hash, created_at, plan_str) = result
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "用户名/邮箱或密码错误".to_string())?;

    // 验证密码
    let parsed_hash = PasswordHash::new(&hash).map_err(|e| format!("哈希解析失败: {}", e))?;
    let argon2 = Argon2::default();
    argon2
        .verify_password(password.as_bytes(), &parsed_hash)
        .map_err(|_| "用户名/邮箱或密码错误".to_string())?;

    // 生成 session token
    let token = generate_session_token();
    storage
        .create_session(user_id, &token)
        .map_err(|e| format!("创建会话失败: {}", e))?;

    let plan = match plan_str.as_str() {
        "pro" => PlanTier::Pro,
        "pro_plus" => PlanTier::ProPlus,
        _ => PlanTier::Free,
    };

    Ok(AuthResponse {
        session_token: token,
        user: UserInfo {
            id: user_id,
            name: _name,
            email: stored_email,
            plan,
            created_at,
        },
    })
}

/// 登出
pub fn logout(storage: &Storage, token: &str) -> Result<(), String> {
    storage
        .delete_session(token)
        .map_err(|e| format!("登出失败: {}", e))
}

/// 验证 session 并返回 user_id
pub fn validate_session(storage: &Storage, token: &str) -> Result<i64, String> {
    storage
        .get_user_id_by_session(token)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "会话已过期或无效".to_string())
}

/// 生成 256 位随机 session token（hex 编码 64 字符）
fn generate_session_token() -> String {
    let mut bytes = [0u8; 32];
    rand::thread_rng().fill(&mut bytes);
    hex::encode(bytes)
}