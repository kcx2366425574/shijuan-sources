# 拾卷书源库

这是「拾卷」阅读器的独立书源仓库。书源规则与 App 代码解耦：网站改版时，只需要更新这里的 JSON，App 同步书源即可，无需重新打包发版。

> 本项目只维护“如何解析公开网页”的规则，不存储、不传播小说正文。请仅添加你有权访问的内容，并遵守目标网站的服务条款与当地法律。

## 目录结构

```
index.json                 书源清单（版本、引擎版本、书源路径）
sources/*.json             每个书源一个文件（Legado 兼容格式）
schema/book-source.schema.json
scripts/validate.mjs       本地校验脚本
.github/workflows/validate.yml
```

## App 如何接入

在「拾卷 → 书源」页点击「书源仓库 → 配置」，选择 GitHub / Gitee / 静态清单：

- GitHub：填写 `你的用户名/shijuan-sources`，分支默认 `main`。App 会优先通过 jsDelivr CDN 读取 `index.json`，失败时回退到 raw.githubusercontent.com。
- Gitee：填写 `你的用户名/shijuan-sources`。
- 静态清单：直接填写可访问的 `index.json` 地址（例如 jsDelivr 或自己的对象存储）。

也可以在 `src/config.js` 的 `sourceRepo` 中写死默认值，或构建时设置环境变量：

```bash
VITE_SOURCE_REPO=your-name/shijuan-sources
VITE_SOURCE_REPO_PROVIDER=github
VITE_SOURCE_REPO_BRANCH=main
```

App 启动后会静默检查清单版本；版本变化时拉取书源并更新本地规则。也可在书源页手动「同步」。

## 发布更新

1. 修改 `sources/*.json`。
2. 如果新增/删除书源，同步修改 `index.json` 的 `sources` 数组。
3. 递增 `index.json` 的 `version`（任意递增数字）。
4. 提交并推送。

App 在 12 小时内最多检查一次清单；需要立即生效时，在书源页手动同步。

### 版本与引擎

- `index.json.version`：书源库内容版本。App 用它判断是否需要重新拉取。
- `index.json.engine`：规则引擎版本。当前 App 支持 `1`。只有在书源需要新的规则语义时才递增；App 发现引擎版本更高时会提示用户升级 App。
- 单个书源文件里的 `version` 仅作说明，同步时以 `index.json` 为准。

## 书源格式

书源采用 Legado 兼容字段，App 会做规范化。最小示例：

```json
{
  "id": "example",
  "bookSourceName": "示例站",
  "bookSourceUrl": "https://www.example.com",
  "bookSourceGroup": "小说",
  "charset": "utf-8",
  "searchUrl": "/search?q={{key}}",
  "searchMethod": "GET",
  "ruleSearch": {
    "bookList": ".book-item",
    "name": ".title",
    "author": ".author",
    "bookUrl": ".title@href",
    "coverUrl": "img@src",
    "intro": ".intro"
  },
  "ruleBookInfo": {
    "name": "h1",
    "author": ".author",
    "intro": ".intro",
    "tocUrl": "a[href$=\"list\"]@href"
  },
  "ruleToc": {
    "chapterList": "#list dd",
    "chapterName": "a",
    "chapterUrl": "a@href"
  },
  "ruleContent": {
    "title": "h1",
    "content": "#content"
  }
}
```

字段说明：

| 字段 | 说明 |
| --- | --- |
| `id` | 稳定 ID，建议与 `index.json` 条目一致。App 同步时按 ID 更新。 |
| `charset` | 页面编码。`auto` 会自动识别；GBK 站点可写 `gbk`。 |
| `searchUrl` | 搜索地址，`{{key}}` 会按 `searchCharset` 编码。 |
| `searchMethod` / `searchBody` | POST 搜索时使用；body 同样支持 `{{key}}`。 |
| `ruleSearch.bookList` | 搜索结果条目选择器。 |
| 字段规则 | `选择器@text`、`选择器@href`、`选择器@src`，支持 `||` 备选与 `##正则##替换`。 |
| `ruleToc.chapterList` | 目录条目选择器。 |
| `ruleContent.content` | 正文容器；留空时 App 会尝试自动识别。 |
| `replaceRules` | 正文清洗正则数组。 |

支持的规则能力：

- CSS 选择器子集：标签、`.class`、`#id`、属性选择器、后代/子元素/兄弟、`:first-child`、`:nth-child()`、`:contains()`、`:not()` 等。
- JSON 书源：`bookList` 与字段可使用 `$` JSONPath（如 `$.data.books[*]`、`$.authors[0].name`）。
- 不支持 `@js:` 与 `@XPath:`。需要执行脚本的站点请改用公开 API，或在 App 引擎中新增能力（递增 `engine`）。

## 校验

```bash
node scripts/validate.mjs
```

校验内容：清单结构、ID 唯一性、书源必填字段、URL 协议、`{{key}}` 模板、JS/XPath 规则提示。

CI 会在每次推送时运行校验。

## 新增书源的建议流程

1. 在浏览器确认站点搜索、详情、目录、正文页可匿名访问。
2. 用 App 的「书源 → 智能识别」生成初版规则。
3. 在 App 的「书源体检」跑通搜索、详情、目录、正文。
4. 导出 JSON，按 `sources/` 命名放入本仓库，补上 `id` 与说明。
5. 更新 `index.json`，递增版本，运行校验并提交。

## 安全边界

App 只解释声明式规则（CSS / JSONPath / 正则），不会执行仓库里的任意 JavaScript。这样书源可以独立热更新，同时避免远程代码执行风险。
