# vibecoding_log.md · 白石 BaiShi 开发过程日志

> 本文件记录项目的每一次设计迭代、功能变更、重大重构与决策过程。
> 格式：日期 → 上下文 → 变更 → 结果

---

## 2026-06-30 — 项目重构与画廊编辑器完善

### 上下文

项目从 Open Design 工作区完整迁移到独立仓库 `/Users/echowang/git/Qi_Baishi/`。用户要求整理前端目录结构、简化首页、增强画廊&文风编辑器功能。

### 变更清单

#### 1. 项目迁移到独立工作目录
- **内容**：将 286 个文件（169MB）全部移至 `/Users/echowang/git/Qi_Baishi/`
- **结构**：前端文件归入 `front/`，保留 `assets/`、`docs/`、`Templete/` 在原地
- **路径验证**：所有 7 个功能页面 + `index.html` 的 CSS/JS/图片/页面链接全部验证为正确相对路径
- **结果**：根目录干净，项目可在新目录完整运行

#### 2. 首页简化与签视重写
- **上下文**：首页 Landing Page 内容过多，用户要求精简
- **变更**：仅保留 **Header**（Logo + 导航）+ **Hero**（品牌标语 + 3D 扇形抽卡交互）+ **Footer**（版权）
- **移除**：设计哲学卡片、七屏轮播、架构理念、收尾 CTA 四个区块
- **交互**：顶部导航从锚点链接改为直接跳转功能页面

#### 3. Hero 轮播 → 3D 扇形抽卡
- **上下文**：用户要求参考 B 站视频"纯CSS写一个好玩的悬浮抽卡片效果"
- **迭代过程**：
  - v1: 横向滑动轮播（原始）
  - v2: 3D `rotateY()` 扇形展开（卡片粘在一起，用户不满意）
  - v3: 2D `rotate()` 扇形展开（角度小，间距不够）
  - v4: 取消扇形，向左平铺展开，最多 5 张
  - v5: 遮罩渐变左侧淡出，定位在文字下方
  - v6: 点击预览图片用 `position: fixed` + `backdrop-filter: blur(16px)` 全屏居中
- **最终方案**：
  - 堆叠态：8 张海报层叠右侧
  - 展开态：点击后 5 张从右向左平铺，右侧偏移 60px
  - 悬停：卡片抬升 -20px + scale(1.06)
  - 点击：全屏居中预览，70vh 图片尺寸，半透明模糊背景
  - 空白折叠：展开后点击空白区域自动合拢
  - 刷新动效：页面加载先展开，1s 后自动折叠
  - 键盘无障碍：tabindex + Enter/Space + Escape 关闭

#### 4. 画廊标签修复
- **上下文**：用户指出卡片标签与实际数据不一致
- **问题发现**：`presets.js` 中第 25 个预设「文艺复兴湿壁画」完全缺少 `tags` 字段
- **修复**：补充 `tags: ['湿壁画', '文艺复兴', '米开朗基罗', '宗教']`，同时确认其余 24 条 tags 均正确

#### 5. 侧边栏统一（7 文件修正）
- **上下文**：页面间侧边栏图标风格不一致，部分使用 1024×1024 fill 图标
- **范围**：`workspace.html`、`settings.html`、`text-to-image.html`、`image-to-image.html`、`copywriting.html`、`presets.html`、`history.html`
- **修复**：
  - 替换 1024×1024 fill 图标为 24×24 stroke 图标
  - 统一设置图标为圆点（circle），移除齿轮 path 残留
  - 统一「文生图」入口标签为「文生图/文」

#### 6. 图生图页面重写
- **上下文**：`image-to-image.html` 与 `text-to-image.html` 功能和结构差异大，用户要求补齐差距
- **变更**：重写 HTML + JS
  - 新增 `text-to-image.css` 引用
  - 补齐固定提示词（8 个风格转换预设 + 编辑/删除/新建）
  - 新增负面提示词折叠区、字符计数、智能润色按钮
  - 新增出图数量选择器、随机种子（含摇骰按钮）、高精度模式
  - 结果区保留对比预览 + 新增 4 卡作品网格
  - 顶栏新增「清空」和「保存为预设」按钮
  - 修复侧栏设置图标 `">` 残留

#### 7. 画廊编辑器支持上传图片和自定义分类
- **变更**：`presets.html` + `presets.js`
  - 编辑模态左侧：拖放上传区（点击/拖放，支持 PNG/JPG/WebP）
  - 分类下拉末尾「+ 添加新分类…」→ 显示文本输入框，Enter/blur 确认后加入并持久化
  - 每次打开编辑器刷新所有已有分类
  - `renderPresets()` 和 `openDetail()` 适配 data URI 图片

#### 8. 文风详情模态改为可编辑
- **变更**：`presets.html` + `presets.js`
  - 右侧只读展示改为完整的可编辑表单（描述/提示词模板/字数/强度/标签）
  - 新增标签动态增删组件（回车添加、× 删除）
  - 保存 + 取消按钮

#### 9. 出图数量滑块化
- **变更**：`text-to-image.html` + `text-to-image.js`
  - 固定选项（1/4/8 张）改为拖动条，支持 1–5 张连续选择
  - 初始值设为 3 张

#### 10. Impeccable Design Polish 打磨
- **上下文**：用户调用了 `impeccable-design-polish` 技能对 `index.html` 进行全面审计
- **审计发现**：
  - 🔴 P0: 七屏轮播 CSS 完全缺失（`.screen-stack-card` 等类别未定义）
  - 🔴 P0: 展开态类名不一致（JS 用 `is-expanded`，CSS 用 `expanded`）
  - 🟡 P1: Hero 文字宽度硬编码 `width: 600px`，移动端溢出
  - 🟡 P1: 缺少键盘操作和 ARIA 属性
- **修复**：补齐 140 行 CSS，统一状态类名，新增 `hero-text` 响应式类，添加 tabindex/role/aria-label、键盘事件处理、焦点管理

#### 11. Pro 付费支持
- **上下文**：用户要求将设置页的"云端同步"改为"Pro 付费支持"
- **变更**：`settings.html` + `app-chrome.css`
  - 卡片标题改为「本地缓存与 Pro」
  - 新增 Pro 卡片：品牌标识、「白石 · Pro」标题、「解锁全部功能 · 支持开源」副标题
  - 权益清单（无限生图、云端多设备同步、高清输出等）
  - 定价 ¥29/月 + 升级按钮

---

## 项目结构（当前态）

```
/Users/echowang/git/Qi_Baishi/
├── front/
│   ├── index.html           着陆页（Header + Hero 3D扇卡 + Footer）
│   ├── pages/               8 个功能页面
│   │   ├── auth.html        登录/注册
│   │   ├── workspace.html   工作台（首页）
│   │   ├── text-to-image.html  文生图
│   │   ├── image-to-image.html 图生图
│   │   ├── presets.html     灵感墙（画廊+妙笔生花双面板）
│   │   ├── copywriting.html 妙笔生花文案生成
│   │   ├── history.html     历史作品库
│   │   └── settings.html    设置/账户（含Pro付费支持）
│   ├── css/                 6 个样式文件
│   └── js/                  7 个 JS 文件
├── assets/                  静态资源（posters/, drawings/, logo.png）
├── docs/                    文档
│   ├── AGENT.md             Agent 持久记忆
│   ├── Developer.md         工程架构
│   ├── README.md            用户手册
│   └── vibecoding_log.md    本文件（开发过程日志）
└── Templete/                模板素材库
    ├── Copywriting/         10 种文风模板
    └── Gallery/             画廊示例
```

## 待办

- [ ] 本地推理引擎模拟（替代填充渐变图）
- [ ] 多图生图屏
- [ ] Rust 推理引擎接入 candle
- [ ] Tauri 工程化
- [ ] SQLite 持久化
- [ ] macOS/Windows 打包
- [ ] 暗色主题（夜墨）
- [ ] 命令面板 ⌘K
