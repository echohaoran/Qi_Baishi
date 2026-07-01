# 白石 BaiShi API 文档

本文档描述当前 `baishi-dev` 开发 HTTP 服务已实现的接口。内容以 `src-tauri/src/server_http.rs`、`src-tauri/src/auth/mod.rs`、`src-tauri/src/types.rs` 的真实实现为准。

## 1. 概览

- 当前版本：`v0.0.1_test`
- 开发服务基地址：`http://localhost:3456/api`
- 启动方式：`cargo run --bin baishi-dev`
- 接口风格：JSON over HTTP
- 生产形态：桌面端可复用同一套语义，通过 Tauri 命令或内置本地服务接入

### 1.1 通用响应格式

所有接口统一返回：

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

失败时统一返回：

```json
{
  "success": false,
  "data": null,
  "error": "错误描述"
}
```

### 1.2 HTTP 状态码约定

- `200 OK`：请求成功
- `400 Bad Request`：所有已处理失败，包括参数缺失、校验失败、数据库错误、上游模型接口错误

说明：当前服务会把上游接口的 `401 / 500 / timeout` 等异常包装进 `error` 字符串中，但 HTTP 状态码仍返回 `400`。例如：`API 错误 (500): ...`

### 1.3 通用请求约定

- `Content-Type: application/json`
- 编码：`UTF-8`
- 当前多数接口默认使用 `user_id = 1`
- 历史、设置、文本生成结果会持久化到本地 SQLite

### 1.4 本地数据目录

- macOS：`~/Library/Application Support/studio.baishi.desktop/`
- Windows：`%APPDATA%/studio.baishi.desktop/`

## 2. 健康检查

### `GET /health`

用于确认本地开发服务是否在线。

响应示例：

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "version": "v0.0.1_test",
    "engine": "generic"
  },
  "error": null
}
```

## 3. 鉴权接口

## 3.1 注册

### `POST /auth/register`

请求体：

```json
{
  "name": "EchoWang",
  "email": "echo@example.com",
  "password": "abc12345"
}
```

字段说明：

- `name`：用户名，长度 `2-32`
- `email`：邮箱，需唯一
- `password`：至少 8 位，且必须同时包含字母和数字

成功响应：

```json
{
  "success": true,
  "data": {
    "session_token": "64-char-token",
    "user": {
      "id": 1,
      "name": "EchoWang",
      "email": "echo@example.com",
      "plan": "free",
      "created_at": 1712345678
    }
  },
  "error": null
}
```

常见错误：

- `用户名需要 2-32 个字符`
- `密码至少需要 8 个字符`
- `密码需包含字母`
- `密码需包含数字`
- `该邮箱已注册`
- `创建用户失败: ...`

## 3.2 登录

### `POST /auth/login`

请求体：

```json
{
  "email_or_username": "echo@example.com",
  "password": "abc12345"
}
```

说明：

- `email_or_username` 同时支持邮箱和用户名登录

成功响应：与注册接口一致。

常见错误：

- `用户名/邮箱或密码错误`
- `创建会话失败: ...`

## 3.3 登出

### `POST /auth/logout`

请求体：

```json
{
  "session_token": "64-char-token"
}
```

成功响应：

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

常见错误：

- `登出失败: ...`

## 4. 图像生成接口

## 4.1 文生图

### `POST /generate/text`

请求体：

```json
{
  "prompt": "雨后的江南巷口，青石板路，水墨意境",
  "negative_prompt": "低清晰度，畸形手指",
  "style_id": "ink-wash",
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
- `style_id`：可选；若存在，会作为历史记录的 `style_id/source`
- `seed`：可选，`u64`
- `steps`：可选，默认 `30`
- `cfg_scale`：可选，默认 `7.5`
- `aspect`：可选，默认 `1:1`
- `count`：可选，默认 `3`
- `endpoint` / `api_key` / `request_body`：用户在设置页保存或调用方直接透传的供应商配置

支持的 `aspect`：

- `1:1`
- `3:4`
- `4:5`
- `16:9`
- `9:16`
- `21:9`
- `4:3`：兼容旧值，服务端按 `16:9` 处理

成功响应：

```json
{
  "success": true,
  "data": {
    "job_id": "bd92977f-55e6-49a8-afcb-ee7ce976472b",
    "images": [
      {
        "id": "bd92977f-55e6-49a8-afcb-ee7ce976472b-0",
        "url": "https://example.com/result.png",
        "b64_json": null,
        "seed": 42
      }
    ],
    "seed_used": 42,
    "took_ms": 28981
  },
  "error": null
}
```

说明：

- 每张生成结果会自动写入历史作品
- 历史记录中的 `file_path` 存图片 URL 或 Base64 数据

常见错误：

- `不支持的画面比例: xxx`
- `API 请求失败: ...`
- `读取响应失败: ...`
- `API 错误 (500): ...`
- `解析响应失败: ...`

## 4.2 图生图 / 多图融合

### `POST /generate/image`

请求体：

```json
{
  "prompt": "保留原始构图，改为水墨海报风格",
  "negative_prompt": "模糊，过曝",
  "style_id": "poster",
  "seed": 123,
  "steps": 35,
  "cfg_scale": 8.0,
  "aspect": "4:5",
  "reference_image": "data:image/png;base64,...",
  "reference_images": [
    "data:image/png;base64,...",
    "data:image/png;base64,..."
  ],
  "strength": 0.55,
  "count": 2,
  "endpoint": "https://example.com/v1/images/edits",
  "api_key": "sk-xxx",
  "request_body": "{\"model\":\"agnes-image-2.1-flash\"}"
}
```

字段补充：

- `reference_image`：必填，单张参考图
- `reference_images`：可选，多图融合时透传数组
- `strength`：可选，重绘强度

成功响应结构与文生图一致，也会自动写入历史作品。

常见错误与文生图一致。

## 4.3 取消任务

### `POST /generate/cancel`

当前为占位接口，始终返回成功，不执行真实取消。

成功响应：

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

## 5. 文本接口

## 5.1 提示词润色

### `POST /text/enhance`

请求体：

```json
{
  "prompt": "山间清晨的小院",
  "api_url": "https://api.openai.com",
  "api_key": "sk-xxx",
  "model": "gpt-4o-mini",
  "style": "绘画提示词"
}
```

字段说明：

- `prompt`：必填，用户原始短句
- `api_url`：必填；为空会直接失败
- `api_key`：可选；为空时不加 `Authorization`
- `model`：可选；未传时尝试回退到用户设置里的 `text_api_model`，再回退到 `gpt-4o-mini`
- `style`：可选；当前仅参与服务端内部语义说明

成功响应：

```json
{
  "success": true,
  "data": {
    "enhanced": "雨后清晨的江南院落，青瓦白墙，薄雾氤氲..."
  },
  "error": null
}
```

说明：

- 润色结果会写入历史作品
- 该类历史记录的 `style_id` 固定为 `copywriting`
- `negative_prompt` 字段会被复用为所用模型名
- `aspect` 固定写为 `text`

常见错误：

- `缺少 api_url · 请先在「生文 API」中配置`
- `创建 client 失败: ...`
- `请求失败: ...`
- `读取响应失败: ...`
- `润色 API 错误 (401|500): ...`
- `解析响应失败: ...`

## 5.2 文案生成

### `POST /text/generate`

请求体：

```json
{
  "prompt": "写一段面向营销团队的白石产品介绍",
  "api_url": "https://api.openai.com",
  "api_key": "sk-xxx",
  "model": "gpt-4o-mini",
  "system_prompt": "你是一位专业中文文案写手",
  "max_tokens": 800
}
```

字段说明：

- `prompt`：必填
- `api_url`：必填
- `api_key`：可选
- `model`：可选，回退逻辑同上
- `system_prompt`：可选；不传时使用服务端默认文案写作系统提示词
- `max_tokens`：可选，默认 `800`

成功响应：

```json
{
  "success": true,
  "data": {
    "text": "白石是一款面向创作者与营销团队的 AI 图像工作台..."
  },
  "error": null
}
```

说明：

- 生成结果会自动写入历史作品
- 文本类型记录的 `file_path` 存正文，`thumb_path` 存前 60 字摘要

常见错误：

- `缺少 api_url · 请先在「生文 API」中配置`
- `生文 API 错误 (401|500): ...`
- 其余错误类型与 `/text/enhance` 一致

## 6. 历史作品接口

## 6.1 获取历史列表

### `GET /history`

查询参数：

- `user_id`：可选，默认 `1`
- `page`：可选，默认 `1`
- `filter`：可选；目前仅 `favorites` 有特殊行为，其余值等同不过滤

示例：

```http
GET /api/history?user_id=1&page=1&filter=favorites
```

成功响应：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 12,
        "prompt": "雨后江南",
        "negative_prompt": "低清晰度",
        "style_id": "text-to-image",
        "seed": 42,
        "steps": 30,
        "cfg_scale": 7.5,
        "aspect": "1:1",
        "file_path": "https://example.com/result.png",
        "thumb_path": null,
        "is_favorite": true,
        "created_at": 1712345678
      }
    ],
    "total": 1,
    "page": 1
  },
  "error": null
}
```

说明：

- 每页固定 50 条
- 图片记录与文本记录共用同一列表
- 文本记录通常满足：`style_id = "copywriting"`、`aspect = "text"`

## 6.2 切换收藏

### `POST /history/favorite`

请求体：

```json
{
  "artwork_id": 12
}
```

成功响应：

```json
{
  "success": true,
  "data": true,
  "error": null
}
```

说明：

- 返回值表示切换后的 `is_favorite`

常见错误：

- `缺少 artwork_id`

## 6.3 删除单条历史

### `POST /history/delete`

请求体：

```json
{
  "id": 12
}
```

成功响应：

```json
{
  "success": true,
  "data": {
    "deleted": 12
  },
  "error": null
}
```

常见错误：

- `缺少 id`

## 6.4 批量删除历史

### `POST /history/batch-delete`

请求体：

```json
{
  "ids": [12, 13, 14]
}
```

成功响应：

```json
{
  "success": true,
  "data": {
    "deleted": 3
  },
  "error": null
}
```

说明：

- 若 `ids` 为空数组，返回 `deleted: 0`

常见错误：

- `缺少 ids 数组`

## 7. 预设接口

## 7.1 获取预设列表

### `GET /presets`

当前接口直接返回全部预设，不支持 HTTP 查询参数筛选。

成功响应：

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": null,
      "name": "云山图",
      "category": "gallery",
      "prompt": "层峦叠嶂，山间云海...",
      "aspect": "4:5",
      "is_builtin": true
    }
  ],
  "error": null
}
```

## 7.2 保存预设

### `POST /presets`

请求体：

```json
{
  "name": "山水海报",
  "category": "gallery",
  "prompt": "高山、云海、宣纸肌理",
  "aspect": "4:5"
}
```

说明：

- `name` / `category` / `prompt` 必填
- `aspect` 可选

成功响应：

```json
{
  "success": true,
  "data": 25,
  "error": null
}
```

说明：

- `data` 为新建预设的 `id`

常见错误：

- `缺少 name`
- `缺少 category`
- `缺少 prompt`

## 8. 设置与存储接口

## 8.1 获取用户设置

### `GET /settings/{user_id}`

示例：

```http
GET /api/settings/1
```

成功响应：

```json
{
  "success": true,
  "data": {
    "api_key": "sk-xxx",
    "api_endpoint": "https://api.example.com",
    "text_api_model": "gpt-4o-mini",
    "storage_path": "/Users/echo/Downloads",
    "theme": "ink",
    "shortcuts": "{\"generate\":\"Cmd+Enter\"}"
  },
  "error": null
}
```

说明：

- 若用户设置不存在，服务端会先创建一份默认设置再返回
- 默认 `theme` 为 `ink`

## 8.2 更新用户设置

### `POST /settings/{user_id}`

请求体：

```json
{
  "api_key": "sk-new",
  "api_endpoint": "https://api.example.com",
  "text_api_model": "gpt-4o-mini",
  "storage_path": "/Users/echo/Downloads",
  "theme": "dark",
  "shortcuts": "{\"generate\":\"Cmd+Enter\"}"
}
```

说明：

- 所有字段均为可选
- 服务端会先读取现有设置，再按传入字段覆盖；未传字段保留原值

成功响应：

```json
{
  "success": true,
  "data": null,
  "error": null
}
```

## 8.3 获取存储信息

### `GET /storage/info`

成功响应：

```json
{
  "success": true,
  "data": {
    "used": 1048576,
    "available": 0,
    "models_size": 0
  },
  "error": null
}
```

说明：

- `used`：`artworks` 目录已使用空间
- `models_size`：`models` 目录占用
- `available`：当前开发阶段固定返回 `0`

## 9. 数据模型速查

## 9.1 `Artwork`

```json
{
  "id": 1,
  "prompt": "用户输入",
  "negative_prompt": "负面提示词或文本模型名",
  "style_id": "text-to-image | image-to-image | copywriting | 其它来源标识",
  "seed": 42,
  "steps": 30,
  "cfg_scale": 7.5,
  "aspect": "1:1 | 4:5 | 16:9 | text",
  "file_path": "图片 URL / Base64 / 文本正文",
  "thumb_path": "可选摘要",
  "is_favorite": false,
  "created_at": 1712345678
}
```

## 9.2 `Preset`

```json
{
  "id": 1,
  "user_id": null,
  "name": "预设名",
  "category": "gallery",
  "prompt": "提示词正文",
  "aspect": "4:5",
  "is_builtin": true
}
```

## 9.3 `UserSettings`

```json
{
  "api_key": "可选",
  "api_endpoint": "可选",
  "text_api_model": "可选",
  "storage_path": "可选",
  "theme": "ink",
  "shortcuts": "可选 JSON 字符串"
}
```

## 10. curl 调试示例

## 10.1 健康检查

```bash
curl http://localhost:3456/api/health
```

## 10.2 注册

```bash
curl -X POST http://localhost:3456/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "name":"EchoWang",
    "email":"echo@example.com",
    "password":"abc12345"
  }'
```

## 10.3 文生图

```bash
curl -X POST http://localhost:3456/api/generate/text \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt":"雨后的江南巷口，青石板路，水墨意境",
    "negative_prompt":"低清晰度，畸形手指",
    "aspect":"1:1",
    "count":1
  }'
```

## 10.4 文案生成

```bash
curl -X POST http://localhost:3456/api/text/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "prompt":"写一段白石产品介绍",
    "api_url":"https://api.openai.com",
    "api_key":"sk-xxx",
    "model":"gpt-4o-mini"
  }'
```

## 10.5 获取收藏历史

```bash
curl 'http://localhost:3456/api/history?user_id=1&page=1&filter=favorites'
```
