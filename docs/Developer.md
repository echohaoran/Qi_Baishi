# Developer.md

这是白石项目的开发索引文档。

## 先读什么

- 前端开发：[`docs/DEVELOPER/front.md`](./DEVELOPER/front.md)
- 后端开发：[`docs/DEVELOPER/server.md`](./DEVELOPER/server.md)
- Agent 接手事实：[`docs/AGENT.md`](./AGENT.md)
- 用户向项目说明：[`README.md`](../README.md)

## 当前统一口径

- 项目版本：`v0.1.0`
- 项目形态：本地优先桌面生图原型
- 当前前端结构：多页面 HTML，不是 SPA
- 当前联调方式：`baishi-dev` HTTP 服务
- 当前打包态能力：核心请求优先走 Tauri `invoke`，开发态或注入缺失时回退本地 HTTP
- 当前数据持久化：本地 SQLite + localStorage
- 当前功能页：工作台、文生文、文生图、图生图、多图融合、灵感墙、历史作品、设置

## 文档分层

- `README.md`：项目总览、启动方式、构建发布、接口高层摘要
- `src-tauri/API.md`：唯一准确的 HTTP / Tauri 接口文档来源
- `docs/DEVELOPER/front.md`：前端页面、脚本分工与联调约定
- `docs/DEVELOPER/server.md`：后端模块结构、运行方式、数据流与实现约束
- `docs/RELEASE.md`：打包、tag、GitHub Actions、Releases 发布流程
- `docs/TROUBLESHOOTING.md`：常见故障排查

## 2026-07-02 之后新增事实

- 文生文 / 文生图 / 图生图 / 多图融合 已接入全局任务中心
- 任务状态会持久化到本地存储，并在切页后恢复 `running / success / error`
- 打包态核心能力不再依赖页面直接访问本地 HTTP，优先通过 Tauri 命令层进入 Rust
- 图生图 / 多图融合 的 I2I 请求体已按 Agnes 官方文档对齐：
  - 顶层 `image: string[]`
  - `extra_body.response_format`
- `src-tauri/API.md` 已补齐并成为唯一准确接口文档来源
- 本地 `.app` 可作为 macOS 测试基线
- 本地 DMG 脚本链路已被判定不稳定，正式发布安装包改走 GitHub Actions 官方 Tauri Action

## 协作原则

- 写文档时以代码现状为准，不沿用旧方案描述
- 改前端时优先复用共享样式、共享 toast、共享配置
- 改后端时保持 `baishi-dev` 接口契约稳定
- 如果 README 与 `docs/` 口径不一致，优先一起修正
- 若接口发生变化，优先更新 `src-tauri/API.md`，再检查 README 的高层摘要是否需要同步
