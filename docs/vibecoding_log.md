# Vibecoding Log

本文件不再记录逐条流水账，而是维护当前可工作的基线、最近一次文档同步和下一步关注点。

## 当前基线（2026-07-02）

### 产品与结构

- 项目名统一为“白石 BaiShi”
- 当前前端为 `landing + 8 个功能页`
- 设置页内已包含“关于”面板
- 全局页面外层已统一为圆角矩形窗体

### 已完成的关键交互

- 页面加载层只负责初始化隐藏，不再带页面切换过渡动画
- 右下角操作提示已统一到共享 toast，避免页面各自实现导致尺寸和动画失控
- 文生图结果区已改为统一卡片尺寸，点击可查看原图
- 文生图固定提示词已改为固定负面提示词
- 文生文结果区已支持“审阅视图 / 编辑视图”双模式
- 文生文、文生图、图生图、多图融合已接入全局任务中心
- 生成任务支持切页恢复，并对长时间未完成的 `running` 状态做过期兜底
- 历史作品页已支持：
  - 收藏分类
  - 图片大图预览
  - 文案全文阅读
  - 预览弹层跟随当前主题
- 设置页已支持：
  - 图像供应商官网链接
  - 关于面板中的开源说明、项目说明和更新按钮

### 后端联调基线

- `baishi-dev` 为当前主要联调入口
- 默认端口 `3456`
- 图像生成与文案生成均可通过本地 HTTP 服务联调
- 供应商旧模板的数字字段兼容问题已在后端收口
- 打包态核心链路已补齐 Tauri 命令层：
  - 文生图
  - 图生图
  - 多图融合
  - 文案生成
  - 提示词润色
- 图生图 / 多图融合 的 I2I 请求体已按 Agnes 官方文档对齐：
  - 顶层 `image`
  - `extra_body.response_format`

### 打包与发布基线

- 本地 `cargo tauri build` 已可稳定产出 `.app`
- 已确认：本地 `.app` 正常，但本地 `.dmg` 安装产物可能与 `.app` 行为不一致
- 发布安装包不再依赖本地 DMG 脚本链路
- `.github/workflows/build-installers.yml` 已切换为 GitHub Actions 官方 `tauri-apps/tauri-action` 构建
- `src-tauri/API.md` 已与当前真实 HTTP / Tauri 接口同步
- 文档职责已分层：README 管总览，`API.md` 管接口，`RELEASE.md` 管发布，`TROUBLESHOOTING.md` 管排障

## 本次文档同步

本次已重写：

- `README.md`
- `docs/AGENT.md`
- `docs/Developer.md`
- `docs/DEVELOPER/front.md`
- `docs/DEVELOPER/server.md`
- `docs/vibecoding_log.md`

重写目标：

- 移除旧的“本地模型 / 7 屏 / auth.html / 订阅体系”等过期叙述
- 对齐当前版本号 `v0.1.0`
- 对齐当前真实页面、接口和运行方式
- 建立统一文档分层，避免接口说明在多处重复维护

## 当前待关注项

- 需要用 GitHub Actions 新链路重新验证：
  - `BaiShi-arm64.dmg`
  - `BaiShi-intel.dmg`
  - Release 自动发布
- 浏览器实点验证仍应覆盖：
  - 设置页检查更新 toast
  - 历史页收藏/删除/详情弹层
  - 文生文双视图切换
  - 图生图与多图融合在 Agnes I2I 下的真实返回表现
