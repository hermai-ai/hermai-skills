# hermai-skills

[English](./README.md) · [繁體中文](./README.zh-Hant.md) · **简体中文** · [日本語](./README.ja-JP.md)

[Hermai](https://hermai.ai) registry 的 `hermai` agent skill — "AI Agent 的 Google"。在你的 agent 中安装后,它就能发现、调用并贡献结构化的网站 API,而不再需要解析 HTML。

## 安装

```bash
npx skills add hermai-ai/hermai

# 指定目标 agent
npx skills add hermai-ai/hermai -a claude-code
```

通过 [Vercel skills CLI](https://github.com/vercel-labs/skills) 支持 Claude Code、Codex、Cursor、OpenCode 以及其他 40 种以上的 agent。

> **从 1.x 升级?** `hermai-contribute` 在 2.0 合并进了 `hermai`。如果你已经安装了它,请运行 `npx skills update hermai` 与 `npx skills remove hermai-contribute`。现在两类用户(调用者与贡献者)都由单一的 `hermai` skill 通过 progressive disclosure 服务 — 贡献者用的 references 放在 `references/contribute/` 下,仅在需要时才加载。

## Skill 做什么

- **调用网站**:当用户想从网站获取数据时触发 — 像"查询 allbirds.com 的价格"、"在 kayak 找航班"、"抓取 zillow 的房源清单"。教 agent 在 registry 中查询网站、拉取 schema、填入端点参数模板,并处理需鉴权的 actions(cookies、signer、bootstrap state)。同时覆盖 CLI(`hermai action`、`hermai registry pull`)与直接 HTTP API 两条路径。
- **贡献网站**:当用户想把网站加入 registry 时触发。教 agent 使用 [hermai-cli](https://github.com/hermai-ai/hermai-cli) 的发现工具组(`hermai detect`、`wellknown`、`probe`、`extract`、`intercept`、`introspect`、`session`)记录端点、通过 headful 捕获真实浏览器流量用于写入操作、按 format v0.1 编写 schema 并推送。覆盖 intent 分类、anti-bot 网站的 session block 规则、每次请求需签名网站所需的 runtime block(signer JS / bootstrap JS),以及校验错误如何映射到规范。

贡献 schema 需要先在本地安装 `hermai-cli`:

```bash
go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest
hermai registry login
```

完整安装与命令参考见 [hermai-ai/hermai-cli](https://github.com/hermai-ai/hermai-cli)。

## Repo 结构

```
hermai/                              # skill 本体
  SKILL.md
  references/
    cli.md                           每个 `hermai` CLI 命令与 flags
    api.md                           直接 HTTP API
    sessions.md                      session 处理、cookie import、headful bootstrap
    schema-format.md                 v0.1 JSON spec,每个字段
    runtime.md                       Path 1 vs Path 2、signer.js + bootstrap.js 契约
    versioning.md                    update-nudge headers + meta.skill_update payload
    contribute/
      overview.md                    贡献者起点
      coverage-checklist.md          按网站类型的交互清单
      platforms.md                   已知平台(Shopify、Shopline、WordPress、WACA)
      actions.md                     捕获与记录写入操作
      troubleshooting.md             校验错误代码 + runtime 错误排查

hermai-contribute/                   # 弃用 shim — 将新安装导向 hermai
  SKILL.md
```

每个 skill 都是一个目录,内含一份带有 YAML frontmatter(`name`、`version`、`description`)的 `SKILL.md`。`references/` 下的文件通过 progressive disclosure 按需加载 — 在 skill 明确引导之前,不会占用 agent 的 context。

> **关于 `version` 字段:** Anthropic 的 skill 规格只定义 `name` 与 `description`。这里的 `version` 字段是 hermai 专用的约定,用于 [`hermai/references/versioning.md`](./hermai/references/versioning.md) 中的更新提示流程 — 并不是 Claude Code / Agent Skills runtime 所要求的。

## 链接

- Registry 与 dashboard:https://hermai.ai
- API:https://api.hermai.ai
- CLI:https://github.com/hermai-ai/hermai-cli
- 问题反馈:https://github.com/hermai-ai/hermai-skills/issues
