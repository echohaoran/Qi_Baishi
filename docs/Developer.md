# Developer.md · 白石 BaiShi

> 水墨生图桌面应用白石 BaiShi 的开发说明。
> 项目位置：`/Users/echowang/git/Qi_Baishi/`
> 读者：参与开发的工程师 / Agent。

---

本文档已拆分为以下两部分，请根据职责分别阅读：

- **📱 前端开发** 👉 **[docs/DEVELOPER/front.md](./DEVELOPER/front.md)**  
  HTML 结构、CSS 设计系统（宣纸底 + 朱砂红 + 墨阶）、JavaScript 交互、IPC 调用

- **🦀 后端开发** 👉 **[docs/DEVELOPER/server.md](./DEVELOPER/server.md)**  
  Rust 模块结构、在线 API 引擎（Agnes / 自定义）、SQLite 持久化、安全隐私

---

## 关键定位（两文共享）

- **白石 BaiShi** — 面向自媒体 / 营销 / 平面设计师的水墨画风格桌面生图应用
- **纯本地部署**：应用、数据库、作品全部在本地
- **可自定义生图 API**：不内置模型，通过用户配置的在线 API 完成生图
- 7 个核心界面：工作台、文生图、图生图、灵感墙、历史作品、设置/账户、登录/注册
- 视觉语言：宣纸底 + 浓墨/淡墨/灰墨 + 朱砂红印章 + 笔触元素

## 相关文档

- 用户视角：[README.md](../README.md)
- Agent 视角：[AGENT.md](./AGENT.md)
- 开发日志：[vibecoding_log.md](./vibecoding_log.md)