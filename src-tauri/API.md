# 白石 BaiShi API 文档

本文档以当前真实实现为准，覆盖两套接入方式：

- 开发联调：`baishi-dev` 提供的本地 HTTP API
- 打包桌面端：Tauri `invoke` 命令

对应源码主要位于：

- `src-tauri/src/server_http.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/types.rs`
- `src-tauri/src/inference/mod.rs`

## 1. 概览

- 当前版本：`v0.1.4`
- 开发服务基地址：`http://localhost:3456/api`
- 启动命令：`cargo run --manifest-path src-tauri/Cargo.toml --bin baishi-dev`
- 打包态：前端优先使用 Tauri `invoke`，在浏览器联调或注入缺失时回退本地 HTTP

说明：

- 当前前端真实调用入口主要在 `front/js/api-client.js`
- 文生文、文生图、图生图、多图融合均已优先迁移到 Rust `invoke` 远程命令层
- 本地引擎命令仍保留在 Tauri 命令层，主要用于兼容或后续扩展

## 2. 通用响应格式（HTTP）

当前 `baishi-dev` HTTP 服务统一返回：

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

失败时：

```json
{
  "success": false,
  "data": null,
  "error": "错误描述"
}
```

说明：

- 上游供应商错误、解析错误、参数错误等通常都会被包装为 `error` 字符串
- 当前多数业务错误在 HTTP 层仍返回 `400 Bad Request`

## 3. 本地数据目录

- macOS：`~/Library/Application Support/studio.baishi.desktop/`
- Windows：`%APPDATA%/studio.baishi.desktop/`

关键内容：

- `baishi.db`：SQLite 数据库
- `artworks/`：如有本地资源落盘时使用
- `models/`：本地模型目录（如后续扩展）

## 4. 健康检查

### `GET /api/health`

响应示例：

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "v0.1.4",
    "engine": "generic"
  },
  "error": null
}
```

## 5. 鉴权接口（HTTP）

### `POST /api/auth/register`

请求体：

```json
{
  "name": "EchoWang",
  "email": "echo@example.com",
  "password": "abc12345"
}
```

成功响应为 `AuthResponse`，结构示例：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "name": "echo@example.com",
      "email": "echo@example.com",
      "created_at": "2026-07-02T12:00:00Z"
    },
    "session_token": "uuid-token"
  },
  "error": null
}
```

### `POST /api/auth/login`

请求体：

```json
{
  "email_or_username": "echo@example.com",
  "password": "abc12345"
}
```

成功响应同样为 `AuthResponse`。

### `POST /api/auth/logout`

请求体：

```json
{
  "session_token": "token-string"
}
```

## 6. 图像生成接口（HTTP）

### `POST /api/generate/text`

文生图请求体：

```json
{
  "prompt": "雨后的江南巷口，青石板路，水墨意境",
  "negative_prompt": "低清晰度，畸形手指",
  "style_id": "text-to-image",
  "seed": 42,
  "steps": 30,
  "cfg_scale": 7.5,
  "aspect": "1:1",
  "count": 3,
  "endpoint": "https://example.com/v1/images/generations",
  "api_key": "sk-xxx",
  "request_body": "{\"model\":\"agnes-image-2.1-flash\"}"
}
```

字段说明：

- `prompt`：必填
- `negative_prompt`：可选
- `style_id`：可选
- `seed`：可选
- `steps`：可选，默认 `30`
- `cfg_scale`：可选，默认 `7.5`
- `aspect`：可选，默认 `1:1`
- `count`：可选，默认 `3`
- `endpoint` / `api_key` / `request_body`：图像供应商配置

支持的 `aspect`：

- `1:1`
- `3:4`
- `4:5`
- `16:9`
- `9:16`
- `21:9`

成功响应数据为 `GenerateResult`：

```json
{
  "job_id": "uuid",
  "images": [
    {
      "id": "uuid-0",
      "url": "https://...",
      "b64_json": null,
      "seed": 42
    }
  ],
  "seed_used": 42,
  "took_ms": 28981
}
```

### `POST /api/generate/image`

图生图 / 多图融合请求体：

```json
{
  "prompt": "以水墨笔触重绘这张浮雕参考图",
  "negative_prompt": "低清晰度，结构混乱",
  "style_id": "image-to-image",
  "seed": 42,
  "steps": 50,
  "cfg_scale": 7.5,
  "aspect": "1:1",
  "reference_image": "data:image/jpeg;base64,...",
  "reference_images": ["data:image/jpeg;base64,..."],
  "strength": 0.8,
  "count": 3,
  "endpoint": "https://apihub.agnes-ai.com/v1/images/generations",
  "api_key": "sk-xxx",
  "request_body": "{\"model\":\"agnes-image-2.1-flash\"}"
}
```

说明：

- `reference_image`：单图图生图主参考图
- `reference_images`：多图融合时的参考图数组
- `strength`：当前远程链路默认回落为 `0.5`
- 图生图至少需要 `reference_image` 或 `reference_images` 之一
- 当前总参考图数据量上限约为 `6 MB`，单张主参考图上限约为 `4 MB`
- Agnes I2I 当前按官方文档收口为：
  - 顶层 `image: string[]`
  - `extra_body.response_format`

### `POST /api/generate/cancel`

当前始终返回失败：

```json
{
  "success": false,
  "data": null,
  "error": "Agnes API 不支持取消作业"
}
```

## 7. 历史作品接口（HTTP）

### `GET /api/history?page=1&filter=favorites`

响应数据：`ArtworkListResponse`

```json
{
  "items": [],
  "total": 0,
  "page": 1
}
```

说明：

- 当前默认使用 `user_id = 1`
- `filter=favorites` 时只返回收藏项

### `POST /api/history/favorite`

请求体：

```json
{
  "id": 12
}
```

返回示例：

```json
{
  "success": true,
  "data": true,
  "error": null
}
```

### `POST /api/history/delete`

请求体：

```json
{
  "id": 12
}
```

### `POST /api/history/batch-delete`

请求体：

```json
{
  "ids": [1, 2, 3]
}
```

## 8. 预设接口（HTTP）

### `GET /api/presets`

返回 `Preset[]`。

### `POST /api/presets`

请求体：

```json
{
  "name": "写实人像",
  "category": "gallery",
  "prompt": "Medium shot portrait...",
  "aspect": "16:9"
}
```

返回新建预设 ID。

## 9. 设置接口（HTTP）

### `GET /api/settings/{user_id}`

返回 `UserSettings`。

### `POST /api/settings/{user_id}`

请求体：

```json
{
  "api_key": "sk-xxx",
  "api_endpoint": "https://example.com",
  "storage_path": null,
  "theme": "ink",
  "shortcuts": "{\"storage\":{\"retentionDays\":2}}",
  "text_api_model": "gpt-4o-mini"
}
```

说明：

- `shortcuts` 当前同时承载部分设置页序列化配置
- `storage.retentionDays` 会被 `baishi-dev` 启动时读取并自动清理历史

## 10. 存储接口（HTTP）

### `GET /api/storage/info`

返回 `StorageInfo`：

```json
{
  "used": 0,
  "available": 0,
  "models_size": 0,
  "total_history_count": 0,
  "month_count": 0,
  "week_count": 0,
  "day_count": 0
}
```

说明：

- 当前缓存统计以历史记录条数为主
- 图片历史当前默认保存 URL / Base64 引用，不等价于本地图片文件占用
- `month_count` / `week_count` / `day_count` 为历史作品条数统计
- 当前设置页已将这些统计拆成“总 / 月 / 周 / 天”四张卡片展示

## 11. 文本接口（HTTP）

### `POST /api/text/enhance`

请求体：

```json
{
  "prompt": "雨后古镇，清晨薄雾",
  "api_url": "https://example.com/v1",
  "api_key": "sk-xxx",
  "model": "gpt-4o-mini"
}
```

成功时返回：

```json
{
  "enhanced": "润色后的中文图像提示词"
}
```

### `POST /api/text/generate`

请求体：

```json
{
  "prompt": "为一款水墨生成工具写品牌故事",
  "system_prompt": "你是一位专业的中文文案写手...",
  "api_url": "https://example.com/v1",
  "api_key": "sk-xxx",
  "model": "gpt-4o-mini",
  "max_tokens": 800
}
```

成功时返回：

```json
{
  "text": "生成完成的中文文案"
}
```

## 12. Tauri 命令层（打包态）

当前桌面端已注册命令：

- `auth_register`
- `auth_login`
- `auth_logout`
- `generate_text_to_image`
- `generate_image_to_image`
- `cancel_job`
- `list_history`
- `toggle_favorite`
- `delete_artwork`
- `get_artwork`
- `list_presets`
- `save_preset`
- `get_settings`
- `update_settings`
- `get_storage_info`
- `cleanup_history`
- `test_image_api_connection`
- `generate_text_to_image_remote`
- `generate_image_to_image_remote`
- `enhance_text_remote`
- `generate_text_remote`

说明：

- 打包态真实业务优先走以下远程命令：
  - `test_image_api_connection`
  - `generate_text_to_image_remote`
  - `generate_image_to_image_remote`
  - `enhance_text_remote`
  - `generate_text_remote`
- 本地命令 `generate_text_to_image` / `generate_image_to_image` 当前仍在命令表中，但不是页面主链路
- `cancel_job` 当前固定返回未实现错误
- 无 Tauri 注入时，前端会自动回退到本地 HTTP API

### 12.1 远程图像生成命令

#### `generate_text_to_image_remote(req)`

参数类型：`RemoteImageRequest`

关键默认值：

- `steps` 默认 `30`
- `cfg_scale` 默认 `7.5`
- `aspect` 默认 `1:1`
- `count` 默认 `3`，并被限制在 `1..=4`

返回：`GenerateResult`

#### `generate_image_to_image_remote(req)`

参数类型同样为 `RemoteImageRequest`。

额外约束：

- 至少要有一张参考图
- `strength` 缺失时默认回落为 `0.5`
- 参考图过大时会直接返回错误，而不是继续向上游发送请求

返回：`GenerateResult`

### 12.2 远程文本命令

#### `enhance_text_remote(req)`

参数类型：`RemoteTextRequest`

约束：

- `api_url` 不能为空
- `model` 若未显式传入，会回退读取用户设置中的 `text_api_model`
- 成功后会自动写入一条 `copywriting` 类型历史记录

返回：

```json
{
  "enhanced": "润色后的提示词"
}
```

#### `generate_text_remote(req)`

参数类型：`RemoteTextRequest`

约束：

- `api_url` 不能为空
- `max_tokens` 默认 `800`
- `system_prompt` 缺失时会使用内置中文文案助手提示词
- 成功后同样会落一条 `copywriting` 类型历史记录

返回：

```json
{
  "text": "生成完成的文案"
}
```

### 12.3 连接测试命令

#### `test_image_api_connection(req)`

参数类型：`RemoteConnectionTestRequest`

```json
{
  "endpoint": "https://apihub.agnes-ai.com/v1/images/generations",
  "api_key": "sk-xxx",
  "body_json": "{\"model\":\"agnes-image-2.1-flash\"}"
}
```

返回：

```json
{
  "status": 200,
  "content_type": "application/json",
  "took_ms": 812
}
```

## 13. 当前实现注意事项

- `baishi-dev` 启动时会按当前设置中的缓存周期自动清理超过周期的非收藏历史作品
- 文生文 / 文生图 / 图生图 / 多图融合 已接入前端任务中心，任务状态会在本地持久化并于切页后恢复
- 若页面报“未检测到 Tauri invoke”，优先排查打包产物与安装包链路，而不是接口本身
- 本地 `.app` 已验证可作为 macOS 测试基线；DMG 发布安装包建议走 GitHub Actions 官方 Tauri Action 产物链路
- `list_history` / `get_settings` / `update_settings` / `create_artwork` 等当前默认按单用户桌面模型工作，用户 ID 仍主要固定为 `1`
