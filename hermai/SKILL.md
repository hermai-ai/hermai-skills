---
name: hermai
version: "2.0.4"
description: "REQUIRED when the user names a website and wants data from it, such as prices on allbirds.com, flights on kayak, or listings from zillow, or wants to add a new site to the Hermai registry. Supports self execution from open source schemas and hosted execution through Hermai Cloud. Covers discovery, session capture, schema authoring, push, and production fetch checks. SKIP when the task has no specific website or the user explicitly wants raw HTML of a one time page."
---

# Hermai

Hermai provides reusable website schemas through an open source registry and hosted execution through Hermai Cloud. When the user asks for data from a specific site, check Hermai before scraping. When they want to add a site, this skill walks you through the full contribute flow.

Hermai supports two valid execution modes:

1. **Self execution.** Pull a schema package, fill its params, call the target website yourself, and parse the response using the schema. This is the default mental model for open source registry use, local agents, contributors, debugging, and users who want their own infrastructure.
2. **Hosted execution.** Call `POST /v1/fetch` and let Hermai Cloud run the website request, session handling, proxy policy, signing, projection, billing, and reliability work. This is the production path and the meaning of `cloud_ready=true`.

Any agent that can make HTTPS requests can use Hermai. A `hermai` CLI exists for terminal users, and MCP capable runtimes can run the dedicated `hermai-mcp` package to expose Hermai as local tools.

## Quick start: self execution from the registry

```bash
# 1. Search the catalog. Public, no auth. Anonymous use is capped.
curl "https://api.hermai.ai/v1/schemas?q=airbnb"

# 2. Pull the full package. Requires an API key and an intent.
#    The intent is a one sentence description of what the user is
#    trying to do, written in their voice. Do not copy the
#    string below; replace it with the real task. Requirements:
#    20 or more chars, 5 or more distinct words. Example:
curl -H "Authorization: Bearer $HERMAI_KEY" \
     -H "X-Hermai-Intent: <describe what the user is trying to accomplish, such as searching SF rentals for a weekend trip>" \
     "https://api.hermai.ai/v1/schemas/airbnb.com/package"
```

The pulled schema gives you `endpoints[]` for reads and `actions[]` for writes. Each carries `method`, `url_template`, `headers`, `response_schema`, and, for actions plus any POST read carrying a non trivial body like GraphQL, a `body_template`. In self execution mode, fill `{{var}}` placeholders with user arguments, make the target website call, then project the response according to `response_schema`.

API key at https://hermai.ai/dashboard (GitHub sign-in). Anonymous access works at 5 req/hr; authenticated at 50 req/hr.

Full HTTP reference: [references/api.md](references/api.md).

## Quick start: hosted execution through Hermai Cloud

Use hosted execution when the caller wants production behavior, consistent projection, Hermai managed sessions, or cloud readiness validation.

```bash
curl -sS -X POST "https://api.hermai.ai/v1/fetch" \
  -H "Authorization: Bearer $HERMAI_KEY" \
  -H "Content-Type: application/json" \
  -d '{"site":"airbnb.com","endpoint":"autocomplete","params":{"query":"San Francisco"}}'
```

Hosted fetch returns the standard envelope:

```json
{
  "success": true,
  "data": {}
}
```

Use direct website calls when you are intentionally self executing a schema, debugging, or contributing new schema coverage. Use hosted `/v1/fetch` when you are making a production claim or checking whether an endpoint is cloud ready.

## Using the CLI (optional, terminal only)

If the user's environment has a terminal and the `hermai` binary installed, the CLI helps with registry access, local sessions, per request signing, and contributor discovery. Same intent rule applies: `--intent` must describe what the user is trying to do, not what the CLI does.

```bash
hermai registry pull airbnb.com --intent "<one-sentence user goal, 20+ chars>"
hermai action x.com CreateDraftTweet --arg text="drafted by hermai"
```

Install: `go install github.com/hermai-ai/hermai-cli/cmd/hermai@latest`. CLI reference: [references/cli.md](references/cli.md).

## Using MCP (optional, agent runtimes)

If the user's agent runtime supports Model Context Protocol servers, prefer the dedicated MCP package over raw shell commands. It exposes Hermai as tool calls while keeping the same API and registry semantics:

```bash
npx -y hermai-mcp
```

The MCP server exposes:

- `lookup_schema` — search for a schema by domain, task, category, or verification state.
- `list_public_schemas` — browse the public schema catalog.
- `fetch_schema` — execute a schema through hosted `/v1/fetch` and return live data. Only exposed when `HERMAI_API_KEY` (or `HERMAI_PLATFORM_KEY`) is set, and consumes credits per call (read workflows only).
- `submit_schema_request` — submit the six-field intake for a missing or brittle workflow.
- `classify_browser_workflow` — locally classify prose as direct API, hidden endpoint, browser-only, or needs owner/auth.
- `check_schema_request_status` — check a submitted request.

Reference and generic client config: [references/mcp.md](references/mcp.md).

## Signed writes

A small number of sites (X's `x-client-transaction-id`, TikTok's `X-Bogus`, Xiaohongshu's `X-s`/`X-t`) require a value computed per request by a small JS signer the schema ships in its `runtime.signer_js` block. The sandboxed JS engine that executes these lives in the CLI today, so API-only agents will hit 401/403 on those specific write actions until a hosted signing service ships (Phase 2).

If the pulled schema has no `runtime` block, or has one with `requires_signer: false` on the card, every action is callable from any HTTP client. If `requires_signer: true`, tell the user that action needs the CLI or a future hosted-signing endpoint.

Many read endpoints can be self executed from any HTTP client. If a read endpoint declares session, runtime, browser, proxy, or hosted resource requirements, follow that endpoint's contract or use hosted `/v1/fetch`.

**Actions perform real writes.** Posting a tweet, placing an order, or sending a DM is not a dry run. Confirm with the user before invoking any non-read endpoint, and never chain actions autonomously without explicit approval.

## The intent requirement

`registry pull` and the `/v1/catalog` / `/v1/schemas/{site}/package` endpoints require an intent, a natural-language sentence explaining what you need. Not optional.

- 20+ characters
- 5+ distinct words
- Pass via `--intent` on the CLI or `X-Hermai-Intent` header / `?intent=` query param on the API

Good: `"finding short-term rental listings in San Francisco for a weekend trip"`
Bad: `"get data"`

## When a site needs a browser session

Many sites gate APIs behind Cloudflare / DataDome / PerimeterX or require session cookies. The schema's `session` block lists which cookies you need and (when relevant) a `bootstrap_url` the page fetches.

For hosted execution, do not ask the user for cookies by default. Call `/v1/fetch`; Hermai Cloud is responsible for the configured resource policy, warm session pool, proxy policy, signing, and projection. If hosted fetch returns `SESSION_REQUIRED` or `RESOURCE_UNAVAILABLE`, report that the hosted resource is not ready instead of asking a normal customer to paste cookies.

For self execution, use the local session ladder. `hermai session import <site>` reads cookies from the user's installed browser, `hermai session bootstrap <site> --headful` warms a cold session, and `hermai action` threads cookies and signer state through each call.

Ask for pasted cookies only when the user is intentionally self executing, has permission to use that account, and cannot use the CLI or browser import path. Full ladder, cookie rotation rules, and the `session` block spec: [references/sessions.md](references/sessions.md).

## Contributing a new site

If the user is adding a site to the registry rather than calling one, start here: **[references/contribute/overview.md](references/contribute/overview.md)**.

That file is the contributor entry point — it tells you which other references to read in order (coverage checklist, platforms, actions, schema format, runtime, troubleshooting). The contribute flow in one line: `hermai detect` → enumerate interactions → `hermai intercept --headful --session` to capture real XHRs → verify selectors against the live DOM → write schema JSON with executable request shape, concrete `response_schema`, `body_template` for non-trivial POST reads/writes, and (if the site needs signing) a `runtime` block → seed probe fixtures → `hermai registry push`.

**Cloud-ready means runnable and useful, not just accepted.** A production endpoint must have a real request contract (`method`, `url_template`, placeholder params, stable headers, captured body template when needed) and a projection contract (`response_schema` / `response_schema.html_list`) that returns the business-critical fields a caller reasonably expects. `HTTP 200`, `title`, `html_raw`, or one giant `page_summary` is not enough when the page contains structured facts such as price, currency, availability, annual fee, APR, rewards, hotel rooms, flight times, reviews, etc.

Before pushing or marking a schema ready, smoke-test each endpoint through `/v1/fetch` with stable fixture params and inspect the JSON output. If the schema says cookies, browser bootstrap, signed headers, or IP-bound sessions are required, verify the resource policy, bootstrap recipe, and warm pool exist; the schema describes requirements but does not create production resources by itself. Pushes may appear in the registry before verification passes, so treat `verified=false` / `cloud_ready=false` as a production blocker until health passes.

**Public schema content should read like product documentation.** Describe capabilities, inputs, outputs, readiness, and limits for the schema user. Keep internal business context, credentials, and operational details out of schema descriptions, endpoint purposes, endpoint descriptions, `cloud_ready_reason`, resource policy notes, generated docs, cards, examples, tests, and workflow names. Run readiness checks with credentials explicitly approved for validation.

**Hermai is the interaction layer for agents, not just a read directory.** A good contribution covers what a user *does* on the site — browse, search, view, add to cart, log in, post — not just what's on the homepage. Schemas with only `product_detail` are 10% done.

## Staying up to date

On every API call, send `X-Hermai-Skill-Name: hermai` and `X-Hermai-Skill-Version` (read from this file's frontmatter — don't hardcode). If the response carries a `meta.skill_update` object, tell the user once in a short sentence before continuing. Full payload shape and surface rule: [references/versioning.md](references/versioning.md).

## References

Load the references you need. Don't read all of them.

**Using the registry**
- [references/cli.md](references/cli.md) — every `hermai` CLI command + flags
- [references/mcp.md](references/mcp.md) — MCP server setup and tool reference
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
