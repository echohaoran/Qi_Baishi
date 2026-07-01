# Developer.md

这是白石项目的开发索引文档。

## 先读什么

- 前端开发：[`docs/DEVELOPER/front.md`](./DEVELOPER/front.md)
- 后端开发：[`docs/DEVELOPER/server.md`](./DEVELOPER/server.md)
- Agent 接手事实：[`docs/AGENT.md`](./AGENT.md)
- 用户向项目说明：[`README.md`](../README.md)

## 当前统一口径

- 项目版本：`v0.0.1_test`
- 项目形态：本地优先桌面生图原型
- 当前前端结构：多页面 HTML，不是 SPA
- 当前联调方式：`baishi-dev` HTTP 服务
- 当前数据持久化：本地 SQLite + localStorage
- 当前功能页：工作台、文生文、文生图、图生图、多图融合、灵感墙、历史作品、设置

## 协作原则

- 写文档时以代码现状为准，不沿用旧方案描述
- 改前端时优先复用共享样式、共享 toast、共享配置
- 改后端时保持 `baishi-dev` 接口契约稳定
- 如果 README 与 `docs/` 口径不一致，优先一起修正
