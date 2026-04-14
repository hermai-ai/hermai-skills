# hermai-skills

[English](./README.md) · **繁體中文** · [简体中文](./README.zh-Hans.md)

[Hermai](https://hermai.ai) registry 的 agent skills — 「AI Agent 的 Google」。在你的 agent 中安裝後,它就能發現、呼叫並貢獻結構化的網站 API,而不再需要剖析 HTML。

## 安裝

```bash
# 兩個 skill 一起裝
npx skills add hermai-ai/hermai-skills

# 只裝其中一個
npx skills add hermai-ai/hermai-skills --skill hermai
npx skills add hermai-ai/hermai-skills --skill hermai-contribute

# 指定目標 agent
npx skills add hermai-ai/hermai-skills -a claude-code
```

透過 [Vercel skills CLI](https://github.com/vercel-labs/skills) 支援 Claude Code、Codex、Cursor、OpenCode 以及其他 40 種以上的 agent。

## Skills

### `hermai` — 使用 registry

當使用者想從網站取得資料時觸發 — 像是「查詢 allbirds.com 的價格」、「在 kayak 找航班」、「抓取 zillow 的物件清單」。教 agent 查詢網站、呼叫 catalog、填入端點參數模板,並在 anti-bot 網站上正確處理 `SESSION_REQUIRED` 回應。同時涵蓋 CLI(`hermai registry pull`)與 API(`curl https://api.hermai.ai/v1/catalog/...`)兩條路徑,因此在有或沒有 CLI 的環境中都能運作。

### `hermai-contribute` — 貢獻到 registry

當使用者想註冊新網站或推送 schema 時觸發。教 agent 如何使用 [hermai-cli](https://github.com/hermai-ai/hermai-cli) 的探索工具組(`hermai detect`、`wellknown`、`probe`、`extract`、`intercept`、`introspect`、`session`)記錄網站端點,然後依照 format v0.1 撰寫 schema 並透過 `hermai registry push` 送出。涵蓋 intent 分類、anti-bot 網站的 session block 規則(允許欄位、禁用欄位、禁用命名模式),以及驗證錯誤如何對應到規格。

需先在本機安裝 `hermai-cli`:

```bash
go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest
hermai registry login
```

完整安裝與指令參考請見 [hermai-ai/hermai-cli](https://github.com/hermai-ai/hermai-cli)。

## Repo 結構

```
hermai/              # 使用者 skill
  SKILL.md
hermai-contribute/   # 貢獻者 skill
  SKILL.md
```

每個 skill 都是一個資料夾,內含一份帶有 YAML frontmatter(`name`、`description`)的 `SKILL.md`。Vercel skills CLI 只需要這些即可識別。

## 連結

- Registry 與 dashboard:https://hermai.ai
- API:https://api.hermai.ai
- CLI:https://github.com/hermai-ai/hermai-cli
- 問題回報:https://github.com/hermai-ai/hermai-skills/issues
