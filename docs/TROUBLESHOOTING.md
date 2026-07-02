# 常见问题排查

本文档只记录当前项目真实发生过、且后续高概率还会再遇到的问题。

## 1. 打包后提示“未检测到 Tauri invoke”

典型报错：

- `网络错误：Load failed（未检测到 Tauri invoke，当前运行环境可能不是打包态，或注入失败）`

当前已知判断顺序：

1. 先确认是不是打包态应用，而不是浏览器直接打开静态文件
2. 若直接构建得到的 `.app` 正常，而 DMG 安装后的应用异常，优先怀疑 DMG 产物链路
3. 当前推荐直接使用 GitHub Actions 官方构建的 DMG，而不是本地手工封装 DMG

相关代码入口：

- `front/js/api-client.js`

## 2. 浏览器访问 `http://localhost:3456/` 返回 404

先确认启动命令是否正确：

```bash
cargo run --manifest-path src-tauri/Cargo.toml --bin baishi-dev
```

若返回 404，通常排查：

- 是否真的启动的是 `baishi-dev`，而不是 `baishi-server`
- 本地端口是否被改成了别的值，例如 `BAISHI_PORT=3458`
- 当前页面路径是否正确，例如：
  - `http://localhost:3456/`
  - `http://localhost:3456/pages/workspace.html`

## 3. 设置页测试图像 API 时报 `Load failed`

典型现象：

- 保存设置可以成功
- 点击“测试连接”时报 `Load failed` 或超时

当前优先排查：

- 是否运行在打包态但注入失败
- `endpoint` 是否可访问
- `api_key` 是否正确
- `body_json` 是否是合法 JSON
- 网络链路是否被本地环境阻断

当前图像 API 测试命令：

- Tauri：`test_image_api_connection`
- HTTP：`POST /api/health` 只能测本地服务活性，不能代替上游接口连通性测试

## 4. 图生图 / 多图融合报参考图错误

当前真实约束：

- 至少提供一张参考图
- 总参考图数据量约不能超过 `6 MB`
- 单张主参考图约不能超过 `4 MB`

若前端看起来“已经压缩”，仍可能因为 Data URL 总长度超限而失败。

## 4.1 图生图 / 多图融合偶发无法上传图片

典型现象：

- 点击上传没有反应
- 同一张图有时选不中
- 多切换几次页面后又恢复正常

当前已确认的高概率原因：

- 页面曾经使用运行时临时创建的 `<input type="file">` 触发系统选图
- 在桌面 WebView / Tauri 安装版里，这种动态 input 可能偶发不稳定
- 同一文件重复选择时，若 input 的 `value` 未清空，`change` 事件也可能不触发

当前修复策略：

- 图生图与多图融合页面都改成使用“持久存在的隐藏 file input”
- 每次选择前后都主动清空 `value`
- 页面 `pageshow` 时也会重置 input 状态

相关文件：

- `front/pages/image-to-image.html`
- `front/pages/multi-image.html`
- `front/js/image-to-image.js`
- `front/js/multi-image.js`

## 5. 存储页显示的不是本地图片体积

当前设置页“本地缓存管理”展示的是历史记录统计，而不是下载到磁盘的真实图片文件体积。

当前口径：

- 图片缓存：图片类历史作品条数
- 文本缓存：文案类历史作品条数
- 总 / 月 / 周 / 天：按时间范围统计的历史条数

原因：

- 当前生成结果主要以 URL / Base64 引用存入数据库
- 不默认把每张图片落为本地文件

## 6. 如何清理本地历史与缓存

当前数据目录：

- macOS：`~/Library/Application Support/studio.baishi.desktop/`
- Windows：`%APPDATA%/studio.baishi.desktop/`

主要内容：

- `baishi.db`

当前应用内能力：

- 设置页可以按缓存周期清理非收藏历史作品
- `baishi-dev` 启动时会自动按缓存周期执行一次清理

若要彻底清理历史状态，应关注这个应用数据目录，而不是仓库目录。

## 7. GitHub Actions 构建完成，但 Release 中没有安装包

先确认：

- 触发的是不是 `v*` tag
- `build-installers` 的 `release` job 是否成功
- workflow 文件是否已经推送到 GitHub

当前链路是：

1. 先生成 artifacts
2. 再由 `release` job 上传到 GitHub Releases
3. 应用内“检查更新”依赖 GitHub Releases 最新版本接口；若返回失败，优先确认对应 tag 的 Release 是否已经创建完成

所以“有 artifacts”不等于“一定已经进 Release”。

## 8. GitHub artifact 页面无法直接下载

当前真实经验：

- GitHub 网页端 artifact 下载有时会跳转失败或打不开
- CLI 下载通常更稳，但需要先正确配置 GitHub remote 和 `gh auth login`

若仓库 `origin` 的 fetch 不是 GitHub，`gh run download` 可能无法识别当前仓库。

推荐确保：

- `origin` 的 fetch 指向 GitHub 仓库
- 已执行 `gh auth login`

## 8.1 安装版点击外链没有打开默认浏览器

典型现象：

- 设置页“获取API”点击后没有反应
- 关于页“发布页”入口点击后没有拉起系统默认浏览器

当前已确认原因：

- 安装版里单纯依赖 `<a target="_blank">` 或 `window.open(...)` 不够稳定

当前修复策略：

- 设置页不再强依赖直接拉起默认浏览器
- “获取API”和“关于”中的仓库发布页都改为显示原始链接，点击后复制到剪贴板，由用户自行粘贴到浏览器打开
- 这样可以绕开部分安装版环境下外链打开不稳定的问题

相关文件：

- `front/js/settings.js`
- `front/pages/settings.html`

## 9. 哪些文档该看哪里

- 项目总览、启动方式、构建发布：`README.md`
- 真实接口、请求体、返回结构、默认值：`src-tauri/API.md`
- 前端页面与脚本：`docs/DEVELOPER/front.md`
- 后端模块结构：`docs/DEVELOPER/server.md`
- 发布链路：`docs/RELEASE.md`
- 常见故障排查：`docs/TROUBLESHOOTING.md`
