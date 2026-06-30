# Templete

白石 · BAISHI 项目模板资源目录。每个模板以**自身名称**单独成文件夹，内含视觉资源（图片 / 样例渲染）、文案内容（描述 / 提示词 / 样例）以及元数据。

## 目录结构

```
Templete/
├── _index.json          36 款模板清单
├── Gallery/             24 款图像风格预设（画廊）
│   └── <风格名>/
│       ├── info.json    完整元数据
│       ├── cover.svg    视觉封面（图片）
│       └── prompt.md    提示词说明（markdown 文字）
└── Copywriting/         12 款文生文风格预设（妙笔生花）
    └── <文风名>/
        ├── info.json
        ├── cover.svg    视觉封面（图片）
        ├── prompt.md    提示词说明（markdown 文字）
        └── sample.md    样例文案（markdown 文字）
```

## 分类

### Gallery（24 款 · 图像风格）

人物, 山水, 现代, 花鸟, 重彩 · 共 5 类

### Copywriting（12 款 · 文生文风格）

古文, 商业, 媒体, 学术, 文学 · 共 5 类

## 字段说明（info.json）

### 图像风格
| 字段 | 说明 |
|------|------|
| `id` | 唯一标识（gp01 ~ gp24） |
| `name` | 风格名 |
| `cat` | 分类（山水/花鸟/人物/重彩/现代） |
| `desc` | 一句话描述 |
| `prompt` | 完整提示词 |
| `ratio` | 推荐画面比例 |
| `strength` | 化境强度区间 |
| `gradient` | CSS 渐变（视觉定义） |
| `ink` | 暗角 rgba 颜色（视觉定义） |

### 文生文风格
| 字段 | 说明 |
|------|------|
| `id` | 唯一标识（拼音/缩写） |
| `name` | 文风名 |
| `cat` | 分类（文学/古文/商业/学术/媒体） |
| `desc` | 一句话描述 |
| `prompt` | 完整提示词 |
| `length` | 推荐字数 |
| `strength` | 风格强度区间 |
| `sample` | 样例文案 |
| `ink` | 文字主色（rgba） |
| `tags` | 标签数组 |

## 使用方式

- **设计参考**：`info.json` 提供完整元数据；`cover.svg` 可直接 `<img src="...">` 引用作为缩略图
- **资源复用**：`cover.svg` 用 `<foreignObject>` 嵌入 CSS 渐变，可直接 `fetch` 或 `<img>` 引用
- **数据加载**：可通过 `_index.json` 加载清单，再按需 `fetch('Gallery/飞白山水/info.json')` 获取单条详情
- **文案参考**：文风预设的 `sample.md` 提供完整样例，可直接读作内容或导入训练
- **新增模板**：在对应分类下新建以风格名命名的文件夹，按现有结构补充 3/4 个文件
