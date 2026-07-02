# 发布说明

本文档描述白石当前推荐的构建、打包和发布链路。

## 1. 当前结论

- 本地 `cargo tauri build` 产出的 `.app` 可作为 macOS 联调与验收基线
- 本地自封装 DMG 链路曾出现“`.app` 正常、DMG 安装后注入异常”的问题，当前不再作为正式发布方案
- 正式安装包统一走 GitHub Actions 官方 Tauri Action 链路

## 2. 当前发布产物

工作流文件：`.github/workflows/build-installers.yml`

当前目标产物：

- `BaiShi-arm64.dmg`
- `BaiShi-intel.dmg`
- `BaiShi-x86_64-setup.exe`
- `BaiShi-x86_64.deb`
- `BaiShi-x86_64.rpm`

## 3. 推荐发布流程

### 3.1 本地验收

在正式打 tag 前，先本地验证：

```bash
cargo check --manifest-path src-tauri/Cargo.toml --bin baishi-dev
cargo tauri build
```

重点验证：

- 本地 `.app` 能正常打开
- 文生文、文生图、图生图、多图融合可正常联通
- 设置页中的图像 API、生文 API、存储统计可正常工作
- 打包态不会出现“未检测到 Tauri invoke”

### 3.2 推送代码

确保当前分支代码已经推送到 GitHub。

### 3.3 打版本标签

使用语义化 tag，例如：

```bash
git tag v0.1.0
git push origin v0.1.0
```

说明：

- 当前 GitHub Releases 自动发布链路依赖 `v*` tag
- 若 tag 名包含 `beta`、`alpha`、`rc`，Release 会被标记为预发布

### 3.4 等待 GitHub Actions 构建

工作流名：`build-installers`

构建完成后：

- 各平台安装包会先作为 Actions artifacts 生成
- `release` job 会将产物自动发布到 GitHub Releases

## 4. GitHub Actions 链路说明

当前工作流已经切换为官方：

- `tauri-apps/tauri-action@v0`

发布环节使用：

- `softprops/action-gh-release@v2`

当前设计原则：

- macOS 产物分别在 Apple Silicon / Intel runner 上单独构建
- Windows 输出 NSIS 安装包
- Linux 输出 `deb` 和 `rpm`
- 最后统一汇总到 GitHub Release

## 5. 已知限制

### 5.1 本地 DMG 不作为正式基线

已经确认过的现象：

- 直接构建得到的 `.app` 正常
- 把 `.app` 复制到 `/Applications` 后仍正常
- 仅本地某些 DMG 安装产物会出现注入异常，表现为页面提示未检测到 Tauri `invoke`

因此当前结论是：

- 本地 `.app` 用于功能验收
- 正式 DMG 使用 GitHub Actions 官方产物

### 5.2 Release 成功的前提

以下条件任一不满足，都可能导致“有 tag 但没有 Release”或“只有 artifacts 没有 Release”：

- 触发的是 `v*` tag，而不是普通分支 push
- `release` job 成功执行
- workflow 文件已提交并推送到 GitHub，而不是只在本地存在

## 6. 产物验收建议

### macOS

- 优先先测 `BaiShi-arm64.dmg`
- 安装后重点验证：
  - 应用能启动
  - 不出现“未检测到 Tauri invoke”
  - 网络请求可正常发送
  - 设置页测试连接可正常工作

### Windows

- 验证安装包可正常安装和卸载
- 验证工作目录与本地数据库初始化是否正常

### Linux

- 验证 `deb` / `rpm` 能正常安装
- 验证应用能读写数据目录并正常联网

## 7. 发布后建议

每次正式发布后，建议在 `docs/vibecoding_log.md` 记录：

- 使用的 tag
- 对应 GitHub Actions run
- 实际验证过的平台
- 是否发现新的打包差异
