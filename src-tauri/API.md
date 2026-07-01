# 白石 BaiShi · 后端 API 接口文档

> 本文档描述白石 BaiShi 后端提供的所有 API 接口。
> 当前版本采用 **RESTful HTTP** 风格，开发阶段通过 `http://localhost:3456/api/` 访问。
> 生产部署后可通过 Tauri IPC（`invoke()`）调用，接口语义与参数完全一致。

---

## 目录

1. [通用说明](#1-通用说明)
2. [鉴权接口](#2-鉴权接口)
3. [生成接口](#3-生成接口)
4. [历史接口](#4-历史接口)
5. [预设接口](#5-预设接口)
6. [设置接口](#6-设置接口)
7. [存储接口](#7-存储接口)
8. [共享类型](#8-共享类型)
9. [附录：curl 快速测试](#9-附录curl-快速测试)

---

## 1. 通用说明

### 1.1 基础 URL

| 环境 | 地址 |
|------|------|
| 开发 HTTP 服务器 | `http://localhost:3456/api/` |
| Tauri IPC（生产） | `invoke('command_name', args)` |

### 1.2 请求格式

- 所有请求体为 `Content-Type: application/json`
- 字符串编码：UTF-8

### 1.3 响应格式

所有接口统一返回以下格式：

```json
{
  "success": true,
  "data": { ... },        // 成功时的数据
  "error": null           // 失败时的错误描述
}
```

失败时 HTTP 状态码为 `400 Bad Request`，`success` 为 `false`，`error` 为字符串。

### 1.4 数据目录

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/studio.baishi.desktop/` |
| Windows | `%APPDATA%\studio.baishi.desktop\` |

---

## 2. 鉴权接口

### 2.1 注册

```
POST /api/auth/register
```

**请求体：**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `email` | string | 是 | 邮箱地址，不可重复注册 |
| `password` | string | 是 | 至少 8 位，需包含字母和数字 |

**响应：**

```json
{
  "success": true,
  "data": {
    "session_token": "aa3cc12eeaabf675...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "plan": "free",
      "created_at": 1712345678
    }
  }
}
```

**错误：**
- `该邮箱已注册` — 邮箱已被使用
- `密码至少需要 8 个字符`
- `密码需包含字母`
- `密码需包含数字`

---

### 2.2 登录

```
POST /api/auth/login
```

**请求体：**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应：** 同注册接口，返回 `session_token` + `user`。

**错误：**
- `邮箱或密码错误` — 邮箱不存在或密码不匹配

---

### 2.3 登出

```
POST /api/auth/logout
```

**请求体：**

```json
{
  "session_token": "aa3cc12eeaabf675..."
}
```

**响应：**

```json
{ "success": true, "data": null }
```

---

## 3. 生成接口

### 3.1 文生图（Text-to-Image）

```
POST /api/generate/text
```

调用已配置的在线 API（当前为 Agnes Image 2.1 Flash）根据文本提示词生成图像。

**请求体：**

```json
{
  "prompt": "远山含黛，江面薄雾，一叶孤舟，水墨画风格",
  "negative_prompt": "模糊，噪点",
  "style_id": "feibai-landscape",
  "seed": 42,
  "steps": 30,
  "cfg_scale": 7.5,
  "aspect": "1:1",
  "count": 3
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `prompt` | string | 是 | — | 文本提示词，建议 30-200 字 |
| `negative_prompt` | string | 否 | null | 负面提示词 |
| `style_id` | string | 否 | null | 风格预设 ID |
| `seed` | integer | 否 | null（随机） | 随机种子，相同种子可复现 |
| `steps` | integer | 否 | `30` | 迭代步数（20-50） |
| `cfg_scale` | number | 否 | `7.5` | CFG 引导强度（1-20） |
| `aspect` | string | 否 | `"1:1"` | 画面比例（见下方） |
| `count` | integer | 否 | `3` | 出图数量（1-4） |

**画面比例可选值：**

| 值 | 尺寸 | 说明 |
|----|------|------|
| `"1:1"` | 1024×1024 | 方形 |
| `"16:9"` | 1216×684 | 横屏 |
| `"9:16"` | 684×1216 | 竖屏 |
| `"4:5"` | 1024×1280 | 竖屏（偏方形） |
| `"21:9"` | 1344×576 | 超宽屏 |

**响应：**

```json
{
  "success": true,
  "data": {
    "job_id": "bd92977f-55e6-49a8-afcb-ee7ce976472b",
    "images": [
      {
        "id": "bd92977f-...-0",
        "url": "https://platform-outputs.agnes-ai.space/images/t2i/xxx.png",
        "seed": 42
      },
      {
        "id": "bd92977f-...-1",
        "url": "https://platform-outputs.agnes-ai.space/images/t2i/yyy.png",
        "seed": 43
      }
    ],
    "seed_used": 42,
    "took_ms": 28981
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `job_id` | string | 本次生成的唯一标识 |
| `images[].id` | string | 单张图片的唯一 ID |
| `images[].url` | string | **图片直接访问 URL**（有效期内可下载） |
| `images[].seed` | integer | 该张图片使用的种子 |
| `seed_used` | integer | 请求的种子（随机生成的则返回实际值） |
| `took_ms` | integer | API 调用耗时（毫秒） |

---

### 3.2 图生图（Image-to-Image）

```
POST /api/generate/image
```

基于参考图生成新画作，保留原始构图。

**请求体：**

```json
{
  "prompt": "将场景转换为水墨风格，保留原始构图",
  "reference_image": "https://example.com/input.png",
  "strength": 0.5,
  "seed": 123,
  "steps": 35,
  "cfg_scale": 8.0,
  "aspect": "1:1",
  "count": 1
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `reference_image` | string | 是 | — | 参考图 URL 或 Data URI Base64 |
| `strength` | number | 否 | `0.5` | 重绘强度（0-1），越高变化越大 |
| 其他参数 | — | 否 | — | 同文生图接口 |

**注意：**
- `reference_image` 支持公共 URL 或 `data:image/png;base64,...` 格式
- 图生图时 `aspect` 参数会被 API 自动忽略（保留原始构图比例）
- `count` 超过 1 时返回多张基于同一参考图的变体

**响应：** 格式同文生图。

---

### 3.3 取消生成

```
POST /api/generate/cancel
```

**请求体：**

```json
{
  "job_id": "bd92977f-..."
}
```

**响应：**

```json
{ "success": true, "data": null }
```

> ⚠️ 当前为占位接口。Agnes API 不支持取消已提交的生成任务。

---

## 4. 历史接口

### 4.1 获取历史列表

```
GET /api/history
```

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | integer | 否 | `1` | 页码 |
| `filter` | string | 否 | null | 筛选条件（`"favorites"` 或风格标签）|

**响应：**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "prompt": "远山含黛，江面薄雾",
        "negative_prompt": null,
        "style_id": "feibai-landscape",
        "seed": 42,
        "steps": 30,
        "cfg_scale": 7.5,
        "aspect": "1:1",
        "file_path": "/tmp/test.png",
        "thumb_path": null,
        "is_favorite": false,
        "created_at": 1712345678
      }
    ],
    "total": 1,
    "page": 1
  }
}
```

> ⚠️ 原型阶段返回空列表，SQLite 已就绪待前后端对接。

---

### 4.2 收藏/取消收藏

```
POST /api/history/favorite
```

**请求体：**

```json
{
  "artwork_id": 1
}
```

**响应：**

```json
{
  "success": true,
  "data": true
}
```

返回 `true` 表示已收藏，`false` 表示已取消收藏。

---

## 5. 预设接口

### 5.1 获取预设列表

```
GET /api/presets
```

**查询参数：**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `category` | string | 否 | null | 按分类筛选（如 `"山水"`） |

**响应：**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "user_id": null,
      "name": "水墨山水",
      "category": "山水",
      "prompt": "远山近水，墨色浓淡",
      "aspect": "16:9",
      "is_builtin": true
    }
  ]
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | integer | 预设 ID |
| `user_id` | integer / null | 创建者用户 ID（`null` 表示内置预设） |
| `name` | string | 预设名称 |
| `category` | string | 分类（如 "山水"、"花鸟"） |
| `prompt` | string | 提示词模板 |
| `aspect` | string / null | 建议的画面比例 |
| `is_builtin` | boolean | 是否为系统内置预设 |

---

### 5.2 保存预设

```
POST /api/presets
```

**请求体：**

```json
{
  "name": "我的预设",
  "category": "山水",
  "prompt": "远山近水，墨色浓淡，笔意疏朗",
  "aspect": "16:9"
}
```

**响应：**

```json
{
  "success": true,
  "data": 2
}
```

`data` 为新建预设的 ID。

---

## 6. 设置接口

### 6.1 获取设置

```
GET /api/settings/{user_id}
```

**响应：**

```json
{
  "success": true,
  "data": {
    "api_key": "sk-xxx",
    "api_endpoint": "https://apihub.agnes-ai.com/v1/images/generations",
    "storage_path": null,
    "theme": "ink",
    "shortcuts": null
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `api_key` | string / null | 已保存的 API 密钥 |
| `api_endpoint` | string / null | 自定义 API 端点 |
| `storage_path` | string / null | 自定义存储路径 |
| `theme` | string | 主题（`"ink"` 宣纸 / `"night-ink"` 夜墨） |
| `shortcuts` | string / null | 自定义快捷键（JSON 字符串） |

---

### 6.2 更新设置

```
POST /api/settings/{user_id}
```

**请求体（仅需传入要修改的字段）：**

```json
{
  "api_key": "sk-new-key",
  "api_endpoint": "https://apihub.agnes-ai.com/v1/images/generations",
  "theme": "night-ink"
}
```

**响应：**

```json
{ "success": true, "data": null }
```

---

## 7. 存储接口

### 7.1 获取存储信息

```
GET /api/storage/info
```

**响应：**

```json
{
  "success": true,
  "data": {
    "used": 0,
    "available": 0,
    "models_size": 0
  }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `used` | integer | 已使用的存储空间（字节） |
| `available` | integer | 可用空间（原型阶段返回 0） |
| `models_size` | integer | 模型占用的空间（当前不使用本地模型，返回 0） |

---

## 8. 共享类型

### 8.1 生成请求 `GenerateRequest`

```typescript
interface GenerateRequest {
  prompt: string;                // 提示词（必填）
  negative_prompt?: string;      // 负面提示词
  style_id?: string;             // 风格预设 ID
  seed?: number;                 // 随机种子
  steps: number;                 // 迭代步数 20-50
  cfg_scale: number;             // CFG 引导强度 1-20
  aspect: string;                // 比例："1:1"|"16:9"|"9:16"|"4:5"|"21:9"
  reference_image?: string;      // 图生图：图片 URL 或 data URI
  strength?: number;             // 图生图：重绘强度 0-1
  count: number;                 // 出图数量 1-4
}
```

### 8.2 生成结果 `GenerateResult`

```typescript
interface GenerateResult {
  job_id: string;                // 任务 ID
  images: GeneratedImage[];      // 生成的图片列表
  seed_used: number;             // 实际使用的种子
  took_ms: number;               // 耗时（毫秒）
}

interface GeneratedImage {
  id: string;                    // 图片 ID
  url: string;                   // 图片 URL（可直接访问）
  seed: number;                  // 该图片的种子
}
```

### 8.3 用户信息 `UserInfo`

```typescript
interface UserInfo {
  id: number;
  email: string;
  plan: "free" | "pro" | "pro_plus";
  created_at: number;            // Unix 时间戳
}
```

### 8.4 通用响应

```typescript
interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
}
```

---

## 9. 附录：curl 快速测试

以下命令可在终端直接运行，验证后端各接口是否正常。

```bash
# ─── 启动服务器 ───
cd src-tauri && cargo run --bin baishi-dev

# ─── 新开一个终端 ───

# 1. 注册
curl -s -X POST http://localhost:3456/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@baishi.studio","password":"test1234"}' | jq .

# 2. 登录
curl -s -X POST http://localhost:3456/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@baishi.studio","password":"test1234"}' | jq .

# 3. 文生图（~20-30秒）
curl -s -X POST http://localhost:3456/api/generate/text \
  -H "Content-Type: application/json" \
  -d '{"prompt":"远山含黛，江面薄雾，一叶孤舟，水墨画风格","steps":30,"aspect":"1:1","count":1}' | jq .

# 4. 图生图
curl -s -X POST http://localhost:3456/api/generate/image \
  -H "Content-Type: application/json" \
  -d '{
    "prompt":"转换为水墨风格，保留构图",
    "reference_image":"https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/PNG_transparency_demonstration_1.png/300px-PNG_transparency_demonstration_1.png",
    "count":1
  }' | jq .

# 5. 预设列表
curl -s http://localhost:3456/api/presets | jq .

# 6. 获取设置
curl -s http://localhost:3456/api/settings/1 | jq .

# 7. 更新设置
curl -s -X POST http://localhost:3456/api/settings/1 \
  -H "Content-Type: application/json" \
  -d '{"api_key":"sk-test","theme":"night-ink"}' | jq .
```

> 💡 上述命令依赖 `jq`（JSON 格式化工具），如未安装可用 `python3 -m json.tool` 替代。
---

## 10. 前端对接：Mock → HTTP API 迁移指南

> 本节面向**前端开发者（前端 Agent）**，说明如何将前端页面从当前的 Mock 推理引擎切换到真实的 HTTP API。

---

### 10.1 现状

前端目前使用 `window.BaiShiInference` 模拟推理（`front/js/inference-engine.js`），生成的是 Canvas 绘制的假图，没有真实的网络请求。

### 10.2 目标

前端所有页面改为调用后端 HTTP API（服务器地址 `http://localhost:3456`），获取真实的图片 URL。

### 10.3 需要修改的文件

| 文件 | 修改内容 |
|------|----------|
| `front/pages/text-to-image.html` | 移除 `<script src="../js/inference-engine.js">` |
| `front/pages/image-to-image.html` | 同上 |
| `front/pages/multi-image.html` | 同上 |
| `front/js/text-to-image.js` | 替换 `engine.generate()` 为 `fetch()` |
| `front/js/image-to-image.js` | 同上 |
| `front/js/multi-image.js` | 同上 |
| `front/js/auth.js` | 替换 mock 登录为 `fetch('/api/auth/...')` |
| `front/js/settings.js` | 替换为 `fetch('/api/settings/...')` |
| `front/js/history.js` | 替换为 `fetch('/api/history')` |
| `front/js/presets.js` | 替换为 `fetch('/api/presets')` |

### 10.4 API 调用对照表

#### 10.4.1 文生图（text-to-image.js）

**修改前（Mock 引擎）：**
```javascript
var engine = window.BaiShiInference;
engine.init();
engine.generate({
  prompt: '远山含黛',
  batch: 4,
  ratio: '1:1',
  styleStrength: 0.75,
  seed: -1,
  mode: 'text-to-image',
}, {
  onProgress: function (data) { /* 更新进度条 */ },
  onStepImage: function (data) { /* 显示中间步骤图 */ },
  onComplete: function (data) { /* 展示结果 */ },
  onError: function (err) { /* 错误提示 */ },
});
```

**修改后：**
```javascript
const res = await fetch('http://localhost:3456/api/generate/text', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: prompt.value.trim(),
    negative_prompt: '',
    seed: parseInt(seedInput.value) || null,
    steps: 30,
    cfg_scale: parseFloat(slider.value),
    aspect: document.querySelector('#ratio-opts .opt.active')?.dataset.v || '1:1',
    count: parseInt(document.getElementById('batch-slider').value),
  }),
});
const result = await res.json();

if (result.success) {
  // result.data.images → [{ id, url, seed }]
  // result.data.images[0].url → 图片直接访问链接
  displayGeneratedImages(result.data.images);
} else {
  toast(result.error, 'error');
}
```

> ⚠️ **注意**：HTTP API 是同步阻塞的，没有进度回调。生成完成后一次性返回所有图片 URL。建议生成期间显示 loading 动画，完成后渲染图片。

---

#### 10.4.2 图生图（image-to-image.js）

```javascript
const res = await fetch('http://localhost:3456/api/generate/image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: prompt.value.trim(),
    reference_image: uploadedImageUrl,
    strength: 0.5,
    seed: parseInt(seedInput.value) || null,
    aspect: '1:1',
    count: 4,
  }),
});
const result = await res.json();
if (result.success) { /* 展示 result.data.images */ }
```

---

#### 10.4.3 用户注册/登录（auth.js）

```javascript
// 注册
const regRes = await fetch('http://localhost:3456/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const regData = await regRes.json();
if (regData.success) {
  localStorage.setItem('session_token', regData.data.session_token);
  localStorage.setItem('user_id', regData.data.user.id);
}

// 登录
const loginRes = await fetch('http://localhost:3456/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const loginData = await loginRes.json();
if (loginData.success) {
  localStorage.setItem('session_token', loginData.data.session_token);
}
```

---

#### 10.4.4 设置读取/保存（settings.js）

```javascript
// 读取设置
const userId = localStorage.getItem('user_id') || 1;
const res = await fetch(`http://localhost:3456/api/settings/${userId}`);
const data = await res.json();
if (data.success) {
  // data.data.theme, data.data.api_key, data.data.api_endpoint
}

// 更新设置
const updateRes = await fetch(`http://localhost:3456/api/settings/${userId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: 'sk-xxx',
    api_endpoint: 'https://apihub.agnes-ai.com/v1/images/generations',
    theme: 'night-ink',
  }),
});
```

---

#### 10.4.5 预设列表（presets.js）

```javascript
const res = await fetch('http://localhost:3456/api/presets');
const data = await res.json();
if (data.success) {
  // data.data → [{ id, name, category, prompt, aspect, is_builtin }]
}
```

---

#### 10.4.6 历史（history.js）

```javascript
const res = await fetch('http://localhost:3456/api/history');
const data = await res.json();
// 原型阶段返回空列表，SQLite 已就绪待对接
```

---

### 10.5 推荐封装

建议在 `front/js/` 下新建 `api-client.js`，统一管理所有 API 调用：

```javascript
// front/js/api-client.js
const API = 'http://localhost:3456';

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  return res.json();
}

window.BaiShiAPI = {
  register: (email, password) =>
    api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) =>
    api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  textToImage: (params) =>
    api('/api/generate/text', { method: 'POST', body: JSON.stringify(params) }),
  imageToImage: (params) =>
    api('/api/generate/image', { method: 'POST', body: JSON.stringify(params) }),
  listPresets: () => api('/api/presets'),
  getSettings: (userId) => api(`/api/settings/${userId}`),
  updateSettings: (userId, data) =>
    api(`/api/settings/${userId}`, { method: 'POST', body: JSON.stringify(data) }),
  listHistory: () => api('/api/history'),
  toggleFavorite: (artworkId) =>
    api('/api/history/favorite', { method: 'POST', body: JSON.stringify({ artwork_id: artworkId }) }),
};
```

然后在每个页面 JS 中引用：
```html
<script src="../js/api-client.js"></script>
<script>
const result = await window.BaiShiAPI.textToImage({
  prompt: '远山含黛',
  aspect: '1:1',
  count: 3,
});
</script>
```

---

### 10.6 数据流变化总结

| 维度 | 修改前（Mock） | 修改后（HTTP API） |
|------|---------------|-------------------|
| 生成结果 | Canvas data URL（假图） | API 返回的真实图片 URL |
| 进度反馈 | 逐步骤回调（逐步去噪动画） | 一次性返回，需前端做 loading |
| 中间步骤图 | 实时生成 Canvas 渐变色 | 无中间步骤，API 完成后返回最终图 |
| 持久化 | 无，刷新即丢 | SQLite 存储用户/设置/历史 |
| 鉴权 | 无 | 需注册 + 登录 + 存 session_token |
| 运行方式 | 直接打开 HTML 文件 | 需先启动 `cargo run --bin baishi-dev` |

---

### 10.7 验证清单

启动后端 `cargo run --bin baishi-dev` 后，前端 Agent 完成以下验证：

- [ ] 浏览器访问 `http://localhost:3456/` 看到页面
- [ ] 注册新用户 → 返回 `session_token`
- [ ] 登录已有用户 → 返回 `session_token`
- [ ] 输入提示词点"生图" → 20-30 秒后返回真实图片 URL
- [ ] 图片 URL 可浏览器打开 → 显示水墨画
- [ ] 图生图上传参考图 → 生成成功
- [ ] 设置页读取/保存 API Key → 成功
- [ ] 预设列表 > 0 条 → 成功
