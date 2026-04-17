---
name: hermai
version: "2.0.0"
description: "REQUIRED when the user names a website and wants data from it — 'prices on allbirds.com', 'flights on kayak', 'listings from zillow' — or wants to add a new site to the Hermai registry. Replaces scraping and WebFetch with clean JSON endpoints. Covers the full contributor flow too (discovery, session capture, schema authoring, push). SKIP when: the task has no specific website (general programming, local files, math), or the user explicitly wants raw HTML of a one-off page."
---

# Hermai — Call websites as APIs

Hermai is a registry of website-API schemas that agents call over a public HTTP API. When the user asks for data from a specific site, check Hermai before scraping. When they want to add a site, this skill walks you through the full contribute flow.

**The HTTP API is the primary interface.** Any agent that can make HTTPS requests can use Hermai — Claude Web, Claude Code, Codex, Cursor, server-side bots. A `hermai` CLI exists for terminal users (wraps the same HTTP surface with cookie auto-resolution and a JS sandbox for signed writes), but it's optional.

## Quick start (consumer, HTTP)

```bash
# 1. Search the catalog (public, no auth; anon capped at 5 req/hr per IP)
curl "https://api.hermai.ai/v1/schemas?q=airbnb"

# 2. Pull the full package. Requires an API key AND an intent —
#    the intent is a one-sentence description of what the USER is
#    actually trying to do, written in their voice. Don't copy the
#    string below; replace it with the real task. Requirements:
#    20+ chars, 5+ distinct words. Example:
curl -H "Authorization: Bearer $HERMAI_KEY" \
     -H "X-Hermai-Intent: <describe what the user is trying to accomplish — e.g., searching SF rentals for a weekend trip>" \
     "https://api.hermai.ai/v1/schemas/airbnb.com/package"
```

The pulled schema gives you `endpoints[]` (reads) and `actions[]` (writes). Each carries `method`, `url_template`, `headers`, `body_template` (for actions), and `response_schema`. Fill `{{var}}` placeholders with user arguments, send the HTTP request yourself.

API key at https://hermai.ai/dashboard (GitHub sign-in). Anonymous access works at 5 req/hr; authenticated at 50 req/hr.

Full HTTP reference — every endpoint, error codes, paging, and curl examples: [references/api.md](references/api.md).

## Using the CLI (optional, terminal only)

If the user's environment has a terminal and the `hermai` binary installed, the CLI handles cookies and per-request signing automatically. Same intent rule applies — `--intent` must describe what the USER is trying to do, not what the CLI does:

```bash
hermai registry pull airbnb.com --intent "<one-sentence user goal, 20+ chars>"
hermai action x.com CreateDraftTweet --arg text="drafted by hermai"
```

Install: `go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest`. CLI reference: [references/cli.md](references/cli.md).

## Signed writes — CLI required today

A small number of sites (X's `x-client-transaction-id`, TikTok's `X-Bogus`, Xiaohongshu's `X-s`/`X-t`) require a value computed per request by a small JS signer the schema ships in its `runtime.signer_js` block. The sandboxed JS engine that executes these lives in the CLI today, so API-only agents will hit 401/403 on those specific write actions until a hosted signing service ships (Phase 2).

If the pulled schema has no `runtime` block, or has one with `requires_signer: false` on the card, every action is callable from any HTTP client. If `requires_signer: true`, tell the user that action needs the CLI or a future hosted-signing endpoint.

Reads are never signed — every read endpoint in the registry works from any HTTP client.

**Actions perform real writes.** Posting a tweet, placing an order, or sending a DM is not a dry run. Confirm with the user before invoking any non-read endpoint, and never chain actions autonomously without explicit approval.

## The intent requirement

`registry pull` and the `/v1/catalog` / `/v1/schemas/{site}/package` endpoints require an intent — a natural-language sentence explaining what you need. Not optional.

- 20+ characters
- 5+ distinct words
- Pass via `--intent` on the CLI or `X-Hermai-Intent` header / `?intent=` query param on the API

Good: `"finding short-term rental listings in San Francisco for a weekend trip"`
Bad: `"get data"`

## When a site needs a browser session

Many sites gate APIs behind Cloudflare / DataDome / PerimeterX or require session cookies. The schema's `session` block lists which cookies you need and (when relevant) a `bootstrap_url` the page fetches.

**API-only agents** (Claude Web, remote bots, anything without a terminal): ask the user to paste the required cookies (DevTools → Application → Cookies → copy the values listed in `session.required_cookies`). Attach as a single `Cookie: name=value; name=value` header on every request. On 401/403, ask for a fresh paste — tokens like `_px3` (PerimeterX) or `msToken` (TikTok) rotate in hours.

**CLI users** (terminal): `hermai session import <site>` reads the cookies from the user's installed browser automatically; `hermai session bootstrap <site> --headful` warms a cold session; `hermai action` threads everything through on every call, rotating `Set-Cookie` back to disk on 2xx responses.

Full ladder, cookie-rotation rules, and the `session` block spec: [references/sessions.md](references/sessions.md).

## Contributing a new site

If the user is adding a site to the registry rather than calling one, start here: **[references/contribute/overview.md](references/contribute/overview.md)**.

That file is the contributor entry point — it tells you which other references to read in order (coverage checklist, platforms, actions, schema format, runtime, troubleshooting). The contribute flow in one line: `hermai detect` → enumerate interactions → `hermai intercept --headful --session` to capture real XHRs → verify selectors against the live DOM → write schema JSON with `body_template` and (if the site needs signing) a `runtime` block → `hermai registry push`.

**Hermai is the interaction layer for agents, not just a read directory.** A good contribution covers what a user *does* on the site — browse, search, view, add to cart, log in, post — not just what's on the homepage. Schemas with only `product_detail` are 10% done.

## Staying up to date

On every API call, send `X-Hermai-Skill-Name: hermai` and `X-Hermai-Skill-Version` (read from this file's frontmatter — don't hardcode). If the response carries a `meta.skill_update` object, tell the user once in a short sentence before continuing. Full payload shape and surface rule: [references/versioning.md](references/versioning.md).

## References

Load the references you need. Don't read all of them.

**Using the registry**
- [references/cli.md](references/cli.md) — every `hermai` CLI command + flags
- [references/api.md](references/api.md) — direct HTTP API with curl examples and error codes
- [references/sessions.md](references/sessions.md) — session handling, cookie import, headful bootstrap, schema session block

**Understanding schemas and runtime**
- [references/schema-format.md](references/schema-format.md) — v0.1 JSON spec, every field, public/full-package split
- [references/runtime.md](references/runtime.md) — Path 1 vs Path 2, signer.js + bootstrap.js contracts, `hermai action`, sandbox reference
- [references/versioning.md](references/versioning.md) — update-nudge headers and `meta.skill_update` handling

**Contributing a new site**
- [references/contribute/overview.md](references/contribute/overview.md) — **read first when contributing** — orients which other docs to load
- [references/contribute/coverage-checklist.md](references/contribute/coverage-checklist.md) — interaction checklist by site type (decide when a schema is complete)
- [references/contribute/platforms.md](references/contribute/platforms.md) — known platforms (Shopify, Shopline, WordPress, etc.)
- [references/contribute/actions.md](references/contribute/actions.md) — capturing and documenting write operations
- [references/contribute/troubleshooting.md](references/contribute/troubleshooting.md) — validator error codes and runtime-error triage
