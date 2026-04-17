---
name: hermai
version: "2.0.0"
description: "REQUIRED when the user names a website and wants data from it — 'prices on allbirds.com', 'flights on kayak', 'listings from zillow' — or wants to add a new site to the Hermai registry. Replaces scraping and WebFetch with clean JSON endpoints. Covers the full contributor flow too (discovery, session capture, schema authoring, push). SKIP when: the task has no specific website (general programming, local files, math), or the user explicitly wants raw HTML of a one-off page."
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

Anonymous access works at 5 req/hr. For 50 req/hr and authenticated endpoints, grab an API key at https://hermai.ai/dashboard (GitHub sign-in).

Each schema has `endpoints` (reads) and `actions` (writes). Read endpoints document `method`, `url_template`, `query_params`, `headers`, `response_schema` — fill placeholders and call directly. Actions carry a `body_template` and may have a `runtime` block with signer/bootstrap JS the CLI runs for you. See [references/runtime.md](references/runtime.md) for the runtime details.

**Actions perform real writes.** Posting a tweet, placing an order, or sending a DM via `hermai action` is not a dry run. Confirm with the user before invoking any non-read endpoint, and never chain actions autonomously without explicit approval.

## The intent requirement

`registry pull` and the `/v1/catalog` / `/v1/schemas/{site}/package` endpoints require an intent — a natural-language sentence explaining what you need. Not optional.

- 20+ characters
- 5+ distinct words
- Pass via `--intent` on the CLI or `X-Hermai-Intent` header / `?intent=` query param on the API

Good: `"finding short-term rental listings in San Francisco for a weekend trip"`
Bad: `"get data"`

## When a site needs a browser session

If the schema has a `session` block (Cloudflare / DataDome / PerimeterX / signed sites), warm cookies in this order: `hermai session import <site>` (reads from the user's installed browser — default choice) → `hermai session bootstrap <site> --headful` (opens Chrome, navigates, captures) → hosted bootstrap (Phase 2, not yet available). `hermai action` then handles cookie loading, signer/bootstrap JS, and rotation automatically.

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
