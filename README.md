# hermai-skills

**English** · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md) · [日本語](./README.ja-JP.md)

The `hermai` agent skill for the [Hermai](https://hermai.ai) registry — "Google for AI Agents". Install it in your agent and it can discover, call, and contribute to structured website APIs instead of scraping HTML.

## Install

```bash
npx skills add hermai-ai/hermai

# target a specific agent
npx skills add hermai-ai/hermai -a claude-code
```

Works with Claude Code, Codex, Cursor, OpenCode, and 40+ other agents via the [Vercel skills CLI](https://github.com/vercel-labs/skills).

> **Migrating from 1.x?** `hermai-contribute` merged into `hermai` in 2.0. If you have it installed, run `npx skills update hermai` and `npx skills remove hermai-contribute`. Both audiences (callers and contributors) are now served by the single `hermai` skill via progressive disclosure — contributor references live under `references/contribute/` and load only when needed.

## What the skill does

- **For calling**: fires when a user wants data from a website — "check prices on allbirds.com", "find flights on kayak", "get listings from zillow". Teaches the agent to look up the site in the registry, pull the schema, fill endpoint templates, and handle authenticated actions (cookies, signers, bootstrap state). Both CLI (`hermai action`, `hermai registry pull`) and direct HTTP API paths are covered.
- **For contributing**: fires when a user wants to add a site to the registry. Teaches the agent to use the [hermai-cli](https://github.com/hermai-ai/hermai-cli) discovery toolkit (`hermai detect`, `wellknown`, `probe`, `extract`, `intercept`, `introspect`, `session`) to document endpoints, capture real browser traffic for writes, compose a schema against format v0.1, and push it. Covers the intent category taxonomy, session-block rules for anti-bot sites, the runtime block (signer JS / bootstrap JS) for per-request-signed sites, and how validation errors map back to the spec.

Contributing requires `hermai-cli` installed locally:

```bash
go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest
hermai registry login
```

See [hermai-ai/hermai-cli](https://github.com/hermai-ai/hermai-cli) for the full command reference.

## Repo layout

```
hermai/                              # the skill
  SKILL.md
  references/
    cli.md                           every `hermai` CLI command + flags
    api.md                           direct HTTP API
    sessions.md                      session handling, cookie import, headful bootstrap
    schema-format.md                 v0.1 JSON spec, every field
    runtime.md                       Path 1 vs Path 2, signer.js + bootstrap.js contracts
    versioning.md                    update-nudge headers + meta.skill_update payload
    contribute/
      overview.md                    start-here for contributors
      coverage-checklist.md          interaction checklist by site type
      platforms.md                   known platforms (Shopify, Shopline, WordPress, WACA)
      actions.md                     capturing and documenting write operations
      troubleshooting.md             validator error codes + runtime-error triage

hermai-contribute/                   # deprecation shim — points new installs at hermai
  SKILL.md
```

Each skill is a directory containing a `SKILL.md` with YAML frontmatter (`name`, `version`, `description`). References under `references/` are loaded on demand via progressive disclosure — they don't bloat the agent's context until the skill directs it to read them.

> **Note on `version`:** Anthropic's skill spec defines `name` and `description` only. The `version` field here is a hermai-specific convention used by the update-nudge flow in [`hermai/references/versioning.md`](./hermai/references/versioning.md) — it's not required by the Claude Code / Agent Skills runtime.

## Links

- Registry and dashboard: https://hermai.ai
- API: https://api.hermai.ai
- CLI: https://github.com/hermai-ai/hermai-cli
- Issues: https://github.com/hermai-ai/hermai-skills/issues
