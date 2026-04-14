# hermai-skills

**English** · [繁體中文](./README.zh-Hant.md) · [简体中文](./README.zh-Hans.md)

Agent skills for the [Hermai](https://hermai.ai) registry — "Google for AI Agents". Install these in your agent and it can discover, call, and contribute to structured website APIs instead of scraping HTML.

## Install

```bash
# both skills
npx skills add hermai-ai/hermai-skills

# just one
npx skills add hermai-ai/hermai-skills --skill hermai
npx skills add hermai-ai/hermai-skills --skill hermai-contribute

# target a specific agent
npx skills add hermai-ai/hermai-skills -a claude-code
```

Works with Claude Code, Codex, Cursor, OpenCode, and 40+ other agents via the [Vercel skills CLI](https://github.com/vercel-labs/skills).

## Skills

### `hermai` — use the registry

Fires when a user wants data from a website — "check prices on allbirds.com", "find flights on kayak", "get listings from zillow". Teaches the agent to look up a site, call the catalog, fill endpoint templates, and handle `SESSION_REQUIRED` responses for anti-bot sites. Both CLI (`hermai registry pull`) and API (`curl https://api.hermai.ai/v1/catalog/...`) paths are covered, so it works in environments with or without the CLI installed.

### `hermai-contribute` — add to the registry

Fires when a user wants to register a new site or push a schema. Teaches the agent to use the [hermai-cli](https://github.com/hermai-ai/hermai-cli) discovery toolkit (`hermai detect`, `wellknown`, `probe`, `extract`, `intercept`, `introspect`, `session`) to document a site's endpoints, then compose a schema against format v0.1 and push it with `hermai registry push`. Covers the intent category taxonomy, session-block rules for anti-bot sites (allowed fields, forbidden fields, forbidden name patterns), and how validation errors map back to the spec.

Requires `hermai-cli` installed locally:

```bash
go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest
hermai registry login
```

See [hermai-ai/hermai-cli](https://github.com/hermai-ai/hermai-cli) for full install and command reference.

## Repo layout

```
hermai/              # consumer skill
  SKILL.md
hermai-contribute/   # contributor skill
  SKILL.md
```

Each skill is a directory containing a single `SKILL.md` with YAML frontmatter (`name`, `description`). That's all the Vercel skills CLI needs for discovery.

## Links

- Registry and dashboard: https://hermai.ai
- API: https://api.hermai.ai
- CLI: https://github.com/hermai-ai/hermai-cli
- Issues: https://github.com/hermai-ai/hermai-skills/issues
