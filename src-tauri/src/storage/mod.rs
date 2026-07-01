/// 数据持久化模块 — SQLite + 文件系统
///
/// 遵循 server.md §5 数据持久化方案

use rusqlite::{Connection, params, Result as SqlResult};
use std::path::PathBuf;
use std::sync::Mutex;
use chrono::{Utc, Datelike, NaiveDate};

use crate::types::*;

pub struct Storage {
    conn: Mutex<Connection>,
    data_dir: PathBuf,
}

impl Storage {
    /// 打开（或创建）数据库，运行迁移
    pub fn open(data_dir: PathBuf) -> SqlResult<Self> {
        std::fs::create_dir_all(&data_dir).map_err(|e| {
            rusqlite::Error::InvalidPath(data_dir.join(e.to_string()))
        }).ok();

        let db_path = data_dir.join("baishi.db");
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let storage = Self {
            conn: Mutex::new(conn),
            data_dir,
        };
        storage.migrate()?;
        storage.ensure_default_user()?;
        Ok(storage)
    }

    /// 数据库迁移
    fn migrate(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL DEFAULT '',
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                plan TEXT NOT NULL DEFAULT 'free'
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS artworks (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id),
                prompt TEXT NOT NULL,
                negative_prompt TEXT,
                style_id TEXT,
                seed INTEGER,
                steps INTEGER NOT NULL DEFAULT 30,
                cfg_scale REAL NOT NULL DEFAULT 7.5,
                aspect TEXT NOT NULL DEFAULT '1:1',
                file_path TEXT NOT NULL,
                thumb_path TEXT,
                is_favorite INTEGER DEFAULT 0,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS presets (
                id INTEGER PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                prompt TEXT NOT NULL,
                aspect TEXT,
                is_builtin INTEGER DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS settings (
                user_id INTEGER PRIMARY KEY REFERENCES users(id),
                api_key TEXT,
                api_endpoint TEXT,
                storage_path TEXT,
                theme TEXT DEFAULT 'ink',
                shortcuts TEXT
            );
        ")?;

        // 幂等迁移:为 settings 表追加 text_api_model 列(仅当不存在时)
        let has_text_api_model: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM pragma_table_info('settings') WHERE name='text_api_model'",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if has_text_api_model == 0 {
            // 使用单独 execute 以避免 execute_batch 整批失败
            let _ = conn.execute("ALTER TABLE settings ADD COLUMN text_api_model TEXT", []);
        }

        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS generation_log (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                job_id TEXT NOT NULL,
                cost INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
        ")?;

        Ok(())
    }

    /// 开发模式默认用户 · 单用户场景下避免 FK 约束失败
    /// 必须在 migrate() 返回后调用（不能在里面调，否则 Mutex 重入死锁）
    pub fn ensure_default_user(&self) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM users WHERE id = 1)",
                [],
                |row| row.get(0),
            )
            .unwrap_or(false);
        if !exists {
            let now = Utc::now().timestamp();
            // dev 用户 · password_hash 字段占位（dev 模式不验证密码）
            conn.execute(
                "INSERT INTO users (id, name, email, password_hash, created_at, plan) VALUES (1, 'dev', 'dev@baishi.local', 'dev-no-auth', ?1, 'free')",
                params![now],
            )?;
        }
        Ok(())
    }

    // ─── 用户 CRUD ─────────────────────────────────────

    pub fn create_user(&self, name: &str, email: &str, password_hash: &str) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp();
        conn.execute(
            "INSERT INTO users (name, email, password_hash, created_at, plan) VALUES (?1, ?2, ?3, ?4, 'free')",
            params![name, email, password_hash, now],
        )?;
        let user_id = conn.last_insert_rowid();

        // 为用户创建默认设置
        conn.execute(
            "INSERT OR IGNORE INTO settings (user_id) VALUES (?1)",
            params![user_id],
        )?;
        Ok(user_id)
    }

    pub fn get_user_by_email(&self, email: &str) -> SqlResult<Option<(i64, String, String, String, i64, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, email, password_hash, created_at, plan FROM users WHERE email = ?1"
        )?;
        let mut rows = stmt.query(params![email])?;
        match rows.next()? {
            Some(row) => Ok(Some((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))),
            None => Ok(None),
        }
    }

    /// 按用户名查找用户
    pub fn get_user_by_name(&self, name: &str) -> SqlResult<Option<(i64, String, String, String, i64, String)>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, email, password_hash, created_at, plan FROM users WHERE name = ?1"
        )?;
        let mut rows = stmt.query(params![name])?;
        match rows.next()? {
            Some(row) => Ok(Some((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))),
            None => Ok(None),
        }
    }

    pub fn get_user_by_id(&self, user_id: i64) -> SqlResult<Option<UserInfo>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, name, email, created_at, plan FROM users WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![user_id])?;
        match rows.next()? {
            Some(row) => Ok(Some(UserInfo {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                created_at: row.get(3)?,
                plan: match row.get::<_, String>(4)?.as_str() {
                    "pro" => PlanTier::Pro,
                    "pro_plus" => PlanTier::ProPlus,
                    _ => PlanTier::Free,
                },
            })),
            None => Ok(None),
        }
    }

    // ─── 会话 ───────────────────────────────────────────

    pub fn create_session(&self, user_id: i64, token: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp();
        let expires = now + 7 * 24 * 3600; // 7 天
        conn.execute(
            "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)",
            params![token, user_id, now, expires],
        )?;
        Ok(())
    }

    pub fn get_user_id_by_session(&self, token: &str) -> SqlResult<Option<i64>> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp();
        let mut stmt = conn.prepare(
            "SELECT user_id FROM sessions WHERE token = ?1 AND expires_at > ?2"
        )?;
        let mut rows = stmt.query(params![token, now])?;
        match rows.next()? {
            Some(row) => Ok(Some(row.get(0)?)),
            None => Ok(None),
        }
    }

    pub fn delete_session(&self, token: &str) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM sessions WHERE token = ?1", params![token])?;
        Ok(())
    }

    // ─── 作品 CRUD ──────────────────────────────────────

    pub fn create_artwork(&self, user_id: i64, prompt: &str, negative_prompt: Option<&str>,
                          style_id: Option<&str>, seed: Option<i64>, steps: i32,
                          cfg_scale: f64, aspect: &str, file_path: &str,
                          thumb_path: Option<&str>) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp();
        conn.execute(
            "INSERT INTO artworks (user_id, prompt, negative_prompt, style_id, seed, steps, cfg_scale, aspect, file_path, thumb_path, is_favorite, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11)",
            params![user_id, prompt, negative_prompt, style_id, seed, steps, cfg_scale, aspect, file_path, thumb_path, now],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn list_artworks(&self, user_id: i64, page: i32, filter: Option<&str>) -> SqlResult<ArtworkListResponse> {
        let conn = self.conn.lock().unwrap();
        let per_page = 50;
        let offset = ((page - 1).max(0) * per_page) as i64;

        let where_clause = match filter {
            Some("favorites") => "WHERE user_id = ?1 AND is_favorite = 1",
            Some(_) => "WHERE user_id = ?1",
            None => "WHERE user_id = ?1",
        };

        let count_sql = format!("SELECT COUNT(*) FROM artworks {}", where_clause);
        let total: i64 = conn.query_row(
            &count_sql, params![user_id], |row| row.get(0)
        )?;

        let query_sql = format!(
            "SELECT id, prompt, negative_prompt, style_id, seed, steps, cfg_scale, aspect, file_path, thumb_path, is_favorite, created_at
             FROM artworks {} ORDER BY created_at DESC LIMIT ?2 OFFSET ?3",
            where_clause
        );

        let mut stmt = conn.prepare(&query_sql)?;
        let rows = stmt.query_map(params![user_id, per_page, offset], |row| {
            Ok(Artwork {
                id: row.get(0)?,
                prompt: row.get(1)?,
                negative_prompt: row.get(2)?,
                style_id: row.get(3)?,
                seed: row.get(4)?,
                steps: row.get(5)?,
                cfg_scale: row.get(6)?,
                aspect: row.get(7)?,
                file_path: row.get(8)?,
                thumb_path: row.get(9)?,
                is_favorite: row.get::<_, i32>(10)? != 0,
                created_at: row.get(11)?,
            })
        })?;

        let items: Vec<Artwork> = rows.filter_map(|r| r.ok()).collect();
        Ok(ArtworkListResponse { items, total, page })
    }

    pub fn toggle_favorite(&self, artwork_id: i64) -> SqlResult<bool> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE artworks SET is_favorite = CASE WHEN is_favorite = 0 THEN 1 ELSE 0 END WHERE id = ?1",
            params![artwork_id],
        )?;
        let new_val: i32 = conn.query_row(
            "SELECT is_favorite FROM artworks WHERE id = ?1",
            params![artwork_id], |row| row.get(0)
        )?;
        Ok(new_val != 0)
    }

    pub fn delete_artwork(&self, artwork_id: i64) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM artworks WHERE id = ?1", params![artwork_id])?;
        Ok(())
    }

    /// 批量删除: 用单条 SQL 的 IN (...) 子句, O(1) 事务开销
    /// 空 ids 数组安全返回 Ok
    pub fn delete_artworks_batch(&self, ids: &[i64]) -> SqlResult<usize> {
        if ids.is_empty() {
            return Ok(0);
        }
        let conn = self.conn.lock().unwrap();
        // 动态拼 "?,?,?,?" 占位符, 避免 SQL 注入
        let placeholders = std::iter::repeat("?")
            .take(ids.len())
            .collect::<Vec<_>>()
            .join(",");
        let sql = format!("DELETE FROM artworks WHERE id IN ({})", placeholders);
        let mut params_vec: Vec<&dyn rusqlite::ToSql> = Vec::with_capacity(ids.len());
        for id in ids {
            params_vec.push(id);
        }
        let n = conn.execute(&sql, params_vec.as_slice())?;
        Ok(n)
    }

    pub fn get_artwork(&self, artwork_id: i64) -> SqlResult<Option<Artwork>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, prompt, negative_prompt, style_id, seed, steps, cfg_scale, aspect, file_path, thumb_path, is_favorite, created_at
             FROM artworks WHERE id = ?1"
        )?;
        let mut rows = stmt.query(params![artwork_id])?;
        match rows.next()? {
            Some(row) => Ok(Some(Artwork {
                id: row.get(0)?,
                prompt: row.get(1)?,
                negative_prompt: row.get(2)?,
                style_id: row.get(3)?,
                seed: row.get(4)?,
                steps: row.get(5)?,
                cfg_scale: row.get(6)?,
                aspect: row.get(7)?,
                file_path: row.get(8)?,
                thumb_path: row.get(9)?,
                is_favorite: row.get::<_, i32>(10)? != 0,
                created_at: row.get(11)?,
            })),
            None => Ok(None),
        }
    }

    // ─── 预设 CRUD ──────────────────────────────────────

    pub fn list_presets(&self, category: Option<&str>) -> SqlResult<Vec<Preset>> {
        let conn = self.conn.lock().unwrap();
        let items: Vec<Preset> = match category {
            Some(cat) => {
                let mut stmt = conn.prepare(
                    "SELECT id, user_id, name, category, prompt, aspect, is_builtin FROM presets WHERE category = ?1 ORDER BY id"
                )?;
                let rows = stmt.query_map(rusqlite::params![cat], |row| {
                    Ok(Preset {
                        id: row.get(0)?,
                        user_id: row.get(1)?,
                        name: row.get(2)?,
                        category: row.get(3)?,
                        prompt: row.get(4)?,
                        aspect: row.get(5)?,
                        is_builtin: row.get::<_, i32>(6)? != 0,
                    })
                })?;
                rows.filter_map(|r| r.ok()).collect()
            },
            None => {
                let mut stmt = conn.prepare(
                    "SELECT id, user_id, name, category, prompt, aspect, is_builtin FROM presets ORDER BY id"
                )?;
                let rows = stmt.query_map([], |row| {
                    Ok(Preset {
                        id: row.get(0)?,
                        user_id: row.get(1)?,
                        name: row.get(2)?,
                        category: row.get(3)?,
                        prompt: row.get(4)?,
                        aspect: row.get(5)?,
                        is_builtin: row.get::<_, i32>(6)? != 0,
                    })
                })?;
                rows.filter_map(|r| r.ok()).collect()
            }
        };
        Ok(items)
    }

    pub fn save_preset(&self, user_id: Option<i64>, name: &str, category: &str,
                       prompt: &str, aspect: Option<&str>) -> SqlResult<i64> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO presets (user_id, name, category, prompt, aspect, is_builtin) VALUES (?1, ?2, ?3, ?4, ?5, 0)",
            params![user_id, name, category, prompt, aspect],
        )?;
        Ok(conn.last_insert_rowid())
    }

    // ─── 设置 CRUD ──────────────────────────────────────

    pub fn get_settings(&self, user_id: i64) -> SqlResult<UserSettings> {
        let conn = self.conn.lock().unwrap();
        let result = conn.query_row(
            "SELECT api_key, api_endpoint, storage_path, theme, shortcuts, text_api_model FROM settings WHERE user_id = ?1",
            params![user_id],
            |row| {
                Ok(UserSettings {
                    api_key: row.get(0)?,
                    api_endpoint: row.get(1)?,
                    storage_path: row.get(2)?,
                    theme: row.get(3)?,
                    shortcuts: row.get(4)?,
                    text_api_model: row.get(5)?,
                })
            }
        );
        match result {
            Ok(s) => Ok(s),
            Err(rusqlite::Error::QueryReturnedNoRows) => {
                // 创建默认设置
                conn.execute("INSERT INTO settings (user_id) VALUES (?1)", params![user_id])?;
                Ok(UserSettings {
                    api_key: None,
                    api_endpoint: None,
                    storage_path: None,
                    theme: "ink".into(),
                    shortcuts: None,
                    text_api_model: None,
                })
            }
            Err(e) => Err(e),
        }
    }

    pub fn update_settings(&self, user_id: i64, settings: &UserSettings) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE settings SET api_key = ?1, api_endpoint = ?2, storage_path = ?3, theme = ?4, shortcuts = ?5, text_api_model = ?6 WHERE user_id = ?7",
            params![settings.api_key, settings.api_endpoint, settings.storage_path, settings.theme, settings.shortcuts, settings.text_api_model, user_id],
        )?;
        Ok(())
    }

    // ─── 算力日志 ───────────────────────────────────────

    pub fn log_generation(&self, user_id: i64, job_id: &str, cost: i32) -> SqlResult<()> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now().timestamp();
        conn.execute(
            "INSERT INTO generation_log (user_id, job_id, cost, created_at) VALUES (?1, ?2, ?3, ?4)",
            params![user_id, job_id, cost, now],
        )?;
        Ok(())
    }

    pub fn get_monthly_usage(&self, user_id: i64) -> SqlResult<u32> {
        let conn = self.conn.lock().unwrap();
        let now = Utc::now();
        let month_start = NaiveDate::from_ymd_opt(now.year(), now.month(), 1)
            .map(|d| d.and_hms_opt(0, 0, 0).unwrap())
            .expect("Invalid date");
        let start_ts = month_start.and_utc().timestamp();

        let total: i32 = conn.query_row(
            "SELECT COALESCE(SUM(cost), 0) FROM generation_log WHERE user_id = ?1 AND created_at >= ?2",
            params![user_id, start_ts],
            |row| row.get(0),
        )?;
        Ok(total as u32)
    }

    // ─── 密码重置 ─────────────────────────────────────


    // ─── 存储用量 ───────────────────────────────────────

    pub fn get_storage_info(&self) -> StorageInfo {
        let used = dir_size(&self.data_dir.join("artworks"));
        let models_size = dir_size(&self.data_dir.join("models"));
        let available = 0; // 平台相关，原型阶段返回 0
        StorageInfo { used, available, models_size }
    }

    /// 获取用户数据目录
    pub fn data_dir(&self) -> &PathBuf {
        &self.data_dir
    }

    /// 获取作品保存路径
    pub fn artworks_dir(&self) -> PathBuf {
        let path = self.data_dir.join("artworks");
        std::fs::create_dir_all(&path).ok();
        path
    }
}

/// 计算目录大小
fn dir_size(path: &std::path::Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                total += std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                total += dir_size(&path);
            }
        }
    }
    total
}
