# hermai-skills

[English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文**

[Hermai](https://hermai.ai) registry 的 agent skills — "AI Agent 的 Google"。在你的 agent 中安装后,它就能发现、调用并贡献结构化的网站 API,而不再需要解析 HTML。

## 安装

```bash
# 两个 skill 一起装
npx skills add hermai-ai/hermai-skills

# 只装其中一个
npx skills add hermai-ai/hermai-skills --skill hermai
npx skills add hermai-ai/hermai-skills --skill hermai-contribute

# 指定目标 agent
npx skills add hermai-ai/hermai-skills -a claude-code
```

通过 [Vercel skills CLI](https://github.com/vercel-labs/skills) 支持 Claude Code、Codex、Cursor、OpenCode 以及其他 40 种以上的 agent。

## Skills

### `hermai` — 使用 registry

当用户想从网站获取数据时触发 — 像"查询 allbirds.com 的价格"、"在 kayak 找航班"、"抓取 zillow 的房源清单"。教 agent 查询网站、调用 catalog、填入端点参数模板,并在 anti-bot 网站上正确处理 `SESSION_REQUIRED` 响应。同时覆盖 CLI(`hermai registry pull`)与 API(`curl https://api.hermai.ai/v1/catalog/...`)两条路径,因此在有或没有 CLI 的环境中都能运行。

### `hermai-contribute` — 贡献到 registry

当用户想注册新网站或推送 schema 时触发。教 agent 如何使用 [hermai-cli](https://github.com/hermai-ai/hermai-cli) 的发现工具组(`hermai detect`、`wellknown`、`probe`、`extract`、`intercept`、`introspect`、`session`)记录网站端点,然后按照 format v0.1 编写 schema 并通过 `hermai registry push` 发布。覆盖 intent 分类、anti-bot 网站的 session block 规则(允许字段、禁用字段、禁用命名模式),以及校验错误如何映射到规范。

需要先在本地安装 `hermai-cli`:

```bash
go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest
hermai registry login
```

完整安装与命令参考见 [hermai-ai/hermai-cli](https://github.com/hermai-ai/hermai-cli)。

## Repo 结构

```
hermai/              # 用户 skill
  SKILL.md
hermai-contribute/   # 贡献者 skill
  SKILL.md
```

每个 skill 都是一个目录,内含一份带有 YAML frontmatter(`name`、`description`)的 `SKILL.md`。Vercel skills CLI 只需要这些就能识别。

## 链接

- Registry 与 dashboard:https://hermai.ai
- API:https://api.hermai.ai
- CLI:https://github.com/hermai-ai/hermai-cli
- 问题反馈:https://github.com/hermai-ai/hermai-skills/issues
