---
name: hermai
version: "2.0.0"
description: "REQUIRED when the user names a website and wants data from it — 'prices on allbirds.com', 'flights on kayak', 'listings from zillow' — or wants to add a new site to the Hermai registry. Replaces scraping with clean JSON endpoints. Covers the full contributor flow too (discovery, session capture, schema authoring, push)."
---

# Hermai — Call websites as APIs

Hermai is a registry of website-API schemas that agents can call. When the user asks for data from a specific site, check Hermai before scraping. When they want to add a site, this skill walks you through the full contribute flow.

## Quick start (consumer)

```bash
# 1. Look up the site
hermai registry list --query airbnb

# 2. Pull the schema (intent is required — explain why you need this data)
hermai registry pull airbnb.com --intent "searching SF rentals for a weekend trip"

# 3. For simple read endpoints, call the HTTP endpoints directly with curl or fetch.
#    For authenticated writes or signed requests, use `hermai action`:
hermai action x.com CreateDraftTweet --arg text="drafted by hermai"
```

Each schema has `endpoints` (reads) and `actions` (writes). Read endpoints document `method`, `url_template`, `query_params`, `headers`, `response_schema` — fill placeholders and call directly. Actions carry a `body_template` and may have a `runtime` block with signer/bootstrap JS the CLI runs for you. See [references/runtime.md](references/runtime.md) for the runtime details.

## The intent requirement

`registry pull` and the `/v1/catalog` / `/v1/schemas/{site}/package` endpoints require an intent — a natural-language sentence explaining what you need. Not optional.

- 20+ characters
- 5+ distinct words
- Pass via `--intent` on the CLI or `X-Hermai-Intent` header / `?intent=` query param on the API

Good: `"finding short-term rental listings in San Francisco for a weekend trip"`
Bad: `"get data"`

## When a site needs a browser session

Many sites (TikTok, Airbnb, Zillow, X, etc.) gate their APIs behind Cloudflare / DataDome / PerimeterX or per-request signing. The schema's `session` block tells you which cookies are required; the `runtime` block (when present) tells you the CLI needs to run bootstrap JS or per-request signer JS.

**Three-tier fallback for authenticated calls**, in order of preference:

1. **The user already has cookies.** `hermai session import <site>` reads them from an installed browser (Chrome/Firefox/Safari/Edge/Brave/...). First run triggers an OS-level keychain prompt. Zero friction after that.
2. **Browser has never visited the site.** `hermai session bootstrap <site> --headful` opens a visible Chrome window, navigates to the site, waits for required cookies to appear, saves to disk. 3-5 seconds of ceremony.
3. **Hosted bootstrap.** Phase 2, not yet available. When it ships, agents running on a VPS with no local browser will call `POST /v1/session/bootstrap` to get a cookie set from the Hermai backend.

After cookies are in `~/.hermai/sessions/<site>/cookies.json`, `hermai action` handles the rest (loads cookies, runs bootstrap JS if the schema declares one, runs signer JS per request, fires with a Chrome-TLS fingerprint, rotates `Set-Cookie` back on successful responses). See [references/sessions.md](references/sessions.md) for full detail.

## Contributing a new site

If the user is adding a site to the registry rather than calling one, start here: **[references/contribute/overview.md](references/contribute/overview.md)**.

That file is the contributor entry point — it tells you which other references to read in order (coverage checklist, platforms, actions, schema format, runtime, troubleshooting). The contribute flow in one line: `hermai detect` → enumerate interactions → `hermai intercept --headful --session` to capture real XHRs → verify selectors against the live DOM → write schema JSON with `body_template` and (if the site needs signing) a `runtime` block → `hermai registry push`.

**Hermai is the interaction layer for agents, not just a read directory.** A good contribution covers what a user *does* on the site — browse, search, view, add to cart, log in, post — not just what's on the homepage. Schemas with only `product_detail` are 10% done.

## Staying up to date

On every call to `api.hermai.ai` (and on every `hermai registry` command that reaches it), send two headers so Hermai can notify the user when a newer release ships:

```
X-Hermai-Skill-Name: hermai
X-Hermai-Skill-Version: 2.0.0
```

Read the version from this file's frontmatter — don't hardcode it. The `name` stays `hermai`.

If a newer release exists, the response JSON will carry a `meta.skill_update` object:

```json
{
  "meta": {
    "skill_update": {
      "current": "2.0.0",
      "latest": "2.1.0",
      "update_cmd": "npx skills update hermai",
      "changelog_url": "https://github.com/hermai-ai/hermai-skills/releases"
    }
  }
}
```

When you see this field, tell the user in one short sentence before carrying on with the task — e.g. *"Heads up: your hermai skill (2.0.0) is behind 2.1.0. Run `npx skills update hermai` to upgrade."* If `meta.skill_update` is absent, the user is current — no nudge needed.

## References

Load the references you need. Don't read all of them.

**Using the registry**
- [references/cli.md](references/cli.md) — every `hermai` CLI command + flags
- [references/api.md](references/api.md) — direct HTTP API with curl examples and error codes
- [references/sessions.md](references/sessions.md) — session handling, cookie import, headful bootstrap, schema session block

**Understanding schemas and runtime**
- [references/schema-format.md](references/schema-format.md) — v0.1 JSON spec, every field, public/full-package split
- [references/runtime.md](references/runtime.md) — Path 1 vs Path 2, signer.js + bootstrap.js contracts, `hermai action`, sandbox reference

**Contributing a new site**
- [references/contribute/overview.md](references/contribute/overview.md) — **read first when contributing** — orients which other docs to load
- [references/contribute/coverage-checklist.md](references/contribute/coverage-checklist.md) — interaction checklist by site type (decide when a schema is complete)
- [references/contribute/platforms.md](references/contribute/platforms.md) — known platforms (Shopify, Shopline, WordPress, etc.)
- [references/contribute/actions.md](references/contribute/actions.md) — capturing and documenting write operations
- [references/contribute/troubleshooting.md](references/contribute/troubleshooting.md) — validator error codes and runtime-error triage

Get an API key at https://hermai.ai/dashboard (GitHub sign-in). Anonymous access works at 5 req/hr.
