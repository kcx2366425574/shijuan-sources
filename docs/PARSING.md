# 书源解析策略

不同站点需要不同的解析方法。拾卷把这些方法做成**声明式策略**，由每个书源 JSON 自己选择；App 只负责解释，因此新增/修改书源通常不需要发版。

## 当前支持的策略

| 策略 | 书源字段 | 已用示例 |
| --- | --- | --- |
| 通用 HTML 规则 | `ruleSearch` / `ruleBookInfo` / `ruleToc` / `ruleContent` | 八五中文网、顶点小说网 |
| JSON API | `type: "json"` + `$` JSONPath | 古登堡计划 |
| 编码适配 | `charset: "auto" / "gbk" / "utf-8"` | 八五中文网（GBK） |
| POST 搜索 | `searchMethod: "POST"` + `searchBody` | 可按需添加 |
| 完整目录替换 | `ruleBookInfo.tocUrl` 中使用 `##正则##替换` | 全本小说网（AMP 目录） |
| 正文分页 | `ruleContent.nextContentUrl` | 笔趣阁（yoboi） |
| 单章全文 | `singleChapter: true` | 古登堡计划 |
| 分类索引搜索 | `searchMode: "crawl-index"` + `indexPagePattern` | 笔趣阁（yoboi） |
| 仅链接解析 | `direct: true` | 无（能力保留） |
| 允许跨路径翻页 | `followAnyContentPage: true` | 可选 |

## 分类索引搜索（crawl-index）

适用于**关闭了站内搜索**、但有分类/排行页的站点。示例（笔趣阁 yoboi）：

```json
{
  "searchMode": "crawl-index",
  "indexPagePattern": "/sort/{category}/{page}/",
  "indexCategories": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "indexPageLimit": 8,
  "indexBookUrlPattern": "/xiaoshuo/\\d+\\.html$",
  "ruleSearch": {
    "bookList": "a[href^=\"/xiaoshuo/\"]",
    "name": "@text",
    "bookUrl": "@href"
  }
}
```

App 首次搜索时会并发抓取 `indexPageLimit × indexCategories` 个分类页，提取书名与链接，在内存中缓存 6 小时，再按关键词过滤。`indexBookUrlPattern` 用于排除非书籍链接。分类页越多，覆盖越全、首次搜索越慢；可按站点调整。

也可以使用静态索引：`searchIndexUrl` 指向一个 `{"books":[{"name","author","url",...}]}` JSON，App 会直接下载并在本地过滤。

## 正文分页

如果一章被拆成多页，设置：

```json
"ruleContent": {
  "content": "article#article",
  "nextContentUrl": "#next_url@href"
}
```

App 会跟随 `nextContentUrl`，并用“章节页边界”判断防止误把下一章拼进来：只接受 `_2.html`、`?page=2` 这类同章节分页。若站点使用完全不同的路径，设置 `"followAnyContentPage": true`。

## 直链与无搜索站点

- `direct: true`：不参与书名搜索，只能从「链接添加」粘贴书籍页，用该书源规则解析。
- 普通书源也可以从「链接添加」使用：App 会按域名匹配书源规则。
- 如果域名没有对应书源，App 会尝试自动识别详情、目录和正文。

## 新增策略的边界

- 使用已有策略：只改本仓库 JSON + `index.json.version`，App 同步即可，无需发版。
- 需要全新规则语义（例如新的正文加密方式、新的 API 协议）：需要 App 引擎增加适配器，并递增 `index.json.engine`。App 检测到更高引擎版本会提示用户升级。
- App **不会执行仓库中的任意 JavaScript**，避免远程代码执行。书源必须是纯数据。
- 所有书源在合并前经过 `scripts/validate.mjs` 校验，GitHub Actions 会自动运行。

## 为什么目前只有 5 个书源

仓库可以放任意数量。当前只收录**联网实测通过**的源；大量站点存在登录、Cloudflare、人机验证、正文脚本加密等情况，不能用纯声明式规则稳定解析。新增源请先跑通“搜索 → 详情 → 目录 → 正文”，再提交。

## 新增书源流程

1. 确认站点可匿名访问。
2. 用 App「书源 → 智能识别」生成初版。
3. 用「书源体检」验证四个阶段。
4. 导出 JSON 放入 `sources/`，补 `id`、`description`、策略字段。
5. 更新 `index.json`，递增 `version`，运行 `node scripts/validate.mjs`。
6. 提交并推送；App 12 小时内或手动同步后生效。
