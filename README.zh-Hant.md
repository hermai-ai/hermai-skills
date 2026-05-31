# hermai-skills

[English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja-JP.md)

`hermai` agent skill 用來教 agent 使用 [Hermai](https://hermai.ai)。Hermai 提供開源的網站 schema registry,也透過 Hermai Cloud 提供託管執行。

當 agent 需要從網站取得資料、自行執行公開 schema、呼叫託管的 `/v1/fetch`,或貢獻新的 schema 覆蓋時,使用這個 skill。

## 安裝

```bash
npx skills add hermai-ai/hermai-skills --skill hermai

# 指定目標 agent
npx skills add hermai-ai/hermai-skills --skill hermai -a claude-code
```

透過 [Vercel skills CLI](https://github.com/vercel-labs/skills) 支援 Claude Code、Codex、Cursor、OpenCode 以及其他 40 種以上的 agent。

兩類使用者(呼叫者與貢獻者)都由單一的 `hermai` skill 透過 progressive disclosure 服務 — 貢獻者用的 references 放在 `references/contribute/` 下,只有需要時才載入。

## Skill 做什麼

- **呼叫網站**:當使用者想從網站取得資料時觸發,例如「查詢 allbirds.com 的價格」、「在 kayak 找航班」、「抓取 zillow 的物件清單」。教 agent 在 registry 中查詢網站、拉取 schema、在適合時自行執行,或在需要生產執行時呼叫託管的 `/v1/fetch`。同時涵蓋 CLI(`hermai action`、`hermai registry pull`)、MCP(`npx -y hermai-mcp`)與直接 HTTP API 路徑。
- **貢獻網站**:當使用者想將網站加入 registry 時觸發。教 agent 使用 [hermai-cli](https://github.com/hermai-ai/hermai-cli) 的探索工具組(`hermai detect`、`wellknown`、`probe`、`extract`、`intercept`、`introspect`、`session`)記錄端點、以 headful 擷取真實瀏覽器流量用於寫入操作、按 format v0.1 撰寫 schema 並推送。涵蓋 intent 分類、anti-bot 網站的 session block 規則、每次請求需簽章網站所需的 runtime block(signer JS / bootstrap JS),以及驗證錯誤如何對應到規格。
- **Cloud ready**:教 agent 只有在託管 `/v1/fetch` 回傳有用資料時才把 `cloud_ready=true` 當作成立,而不是只看 registry 接受、直接網站 HTTP 200 或原始 HTML。
- **公開 schema 文案**:教 agent 為 schema 使用者撰寫中立的產品文件,並把內部業務背景、憑證和營運細節留在公開 schema 表面之外。

貢獻 schema 需要先在本機安裝 `hermai-cli`:

```bash
go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest
hermai registry login
```

完整安裝與指令參考請見 [hermai-ai/hermai-cli](https://github.com/hermai-ai/hermai-cli)。

## Repo 結構

```
hermai/                              # skill 本體
  SKILL.md
  references/
    cli.md                           每個 `hermai` CLI 指令與 flags
    api.md                           直接 HTTP API
    sessions.md                      session 處理、cookie import、headful bootstrap
    schema-format.md                 v0.1 JSON spec,每個欄位
    runtime.md                       Path 1 vs Path 2、signer.js + bootstrap.js 契約
    versioning.md                    update-nudge headers + meta.skill_update payload
    contribute/
      overview.md                    貢獻者起點
      coverage-checklist.md          按網站類型的互動清單
      platforms.md                   已知平台(Shopify、Shopline、WordPress、WACA)
      actions.md                     擷取與記錄寫入操作
      troubleshooting.md             驗證錯誤代碼 + runtime 錯誤排查
```

Skill 是一個資料夾,內含一份帶有 YAML frontmatter(`name`、`version`、`description`)的 `SKILL.md`。`references/` 下的檔案透過 progressive disclosure 按需載入 — 在 skill 明確引導之前,不會佔用 agent 的 context。

> **關於 `version` 欄位:** Anthropic 的 skill 規格只定義 `name` 與 `description`。這裡的 `version` 欄位是 hermai 專用的慣例,用於 [`hermai/references/versioning.md`](./hermai/references/versioning.md) 中的更新提示流程 — 並不是 Claude Code / Agent Skills runtime 所要求的。

## 連結

- Registry 與 dashboard:https://hermai.ai
- API:https://api.hermai.ai
- CLI:https://github.com/hermai-ai/hermai-cli
- 問題回報:https://github.com/hermai-ai/hermai-skills/issues
