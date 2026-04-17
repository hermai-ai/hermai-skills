# Schema Format (v0.1)

The registry stores a schema as a single JSON document. Every field in this reference is either required, optional-and-projected-onto-the-public-card, or paywalled-inside-the-full-package. Get the split right and the schema does two jobs at once: it tells an unauthenticated browser "is this useful?" and it tells an authenticated CLI "here is exactly how to call the site."

## Example

```json
{
  "site": "example.com",
  "intent_category": "commerce",
  "schema_format_version": "0.1",
  "name": "example.com",
  "description": "Search the product catalog and pull individual product details, prices, and stock info.",
  "endpoints": [
    {
      "name": "search",
      "method": "GET",
      "url_template": "https://api.example.com/products",
      "purpose": "Search the catalog by keyword and get a list of matching products.",
      "description": "Technical how-to: parse paths, selectors, query param semantics, pagination. Shown only in the full package behind API key + intent.",
      "headers": {"Accept": "application/json"},
      "query_params": [
        {"key": "q", "required": true},
        {"key": "limit", "required": false}
      ],
      "response_schema": {
        "type": "array",
        "items": {
          "fields": [
            {"name": "id", "type": "string"},
            {"name": "title", "type": "string"},
            {"name": "price", "type": "number"}
          ]
        }
      }
    }
  ]
}
```

## Naming rule

`name` **is the bare domain** (e.g. `threads.com`, `allrecipes.com`, `lu.ma`). Do not scope it to a sub-path like `lu.ma/events` or `eventbrite/events` — catalog browsers search and sort by name, and adding a slash-path makes the same domain appear under different identities depending on what was contributed first.

If a schema covers only part of a site, communicate the scope in `description` (user-voice) and `interactions_out_of_scope`. The name stays the domain.

Same rule for `site`: lowercase, no scheme (`https://`), no path.

## Required fields

- `site`
- `intent_category`
- `schema_format_version` — must be `"0.1"`
- Per endpoint: `name`, `method`, `url_template`
- Per endpoint: `purpose` (a non-empty user-voice sentence). The validator will reject endpoints with no purpose once that check ships — see [contribute/troubleshooting.md](contribute/troubleshooting.md) for the transitional note.

## Categories

`commerce`, `travel`, `jobs`, `social`, `media`, `reference`, `food`, `finance`, `real-estate`, `communication`, `productivity`, `knowledge`, `developer`, `sports`, `government`

## Top-level blocks

| Block | Required? | Purpose |
|-------|-----------|---------|
| `endpoints` | Yes for read-heavy schemas | GET/POST endpoints the agent calls for data |
| `actions` | Optional | Explicit write operations (POST/PUT/DELETE) — see [contribute/actions.md](contribute/actions.md) |
| `session` | Only for anti-bot sites | Describes the warm-browser bootstrap — see [sessions.md](sessions.md) |
| `runtime` | Only for sites that sign per request | Ships sandboxed JS the CLI executes — see [runtime.md](runtime.md) |
| `requires_stealth` | Optional | Tells clients a Chrome-like TLS fingerprint is mandatory |

## The `runtime` block

A growing number of sites refuse to answer any API call unless the request carries headers derived from JavaScript the site itself loads: X (Twitter) stamps every GraphQL call with `x-client-transaction-id`, TikTok appends `X-Bogus` / `msToken` query parameters, Xiaohongshu signs with a rotating `X-s` header. Rather than bake this logic into CLI releases site-by-site, schemas now carry the JS themselves and the CLI runs it in a sandbox.

The contract is declared with a top-level `runtime` block:

```json
{
  "runtime": {
    "bootstrap_js": "function bootstrap(input) { /* ... */ return {transactionBaseKey: \"...\"}; }",
    "signer_js":    "function sign(input) { /* ... */ return {url: input.url, headers: {\"x-client-transaction-id\": \"...\"}}; }",
    "allowed_hosts": ["x.com", "abs.twimg.com"],
    "bootstrap_ttl_seconds": 3600
  }
}
```

### Fields

| Field | Type | When you need it |
|-------|------|------------------|
| `bootstrap_js` | string | Runs once per session-TTL, produces state (keys, tokens) the signer reads. Use when the site derives signing material from a loaded JS bundle, not from the request itself. |
| `signer_js` | string | Runs before every outgoing request. Returns `{url, headers}` — `url` may be the original URL with extra query params appended, `headers` are merged onto the request. Use when each request needs a fresh signature. |
| `allowed_hosts` | string[] | Hostnames the sandbox is allowed to `fetch` during bootstrap. Exact match, case-insensitive. **Required whenever `bootstrap_js` is present** — an empty list blocks every outbound call and the validator rejects it. |
| `bootstrap_ttl_seconds` | integer ≥ 0 | How long bootstrap output stays valid. `0` or absent means use the CLI default (3600 = 1h). Sites with aggressive key rotation (TikTok's msToken ≈ 10 min) should lower this. |

### Which combinations are legal

- `signer_js` only — most common. Pure per-request signer, no fetched state needed. No `allowed_hosts` required.
- `bootstrap_js` + `signer_js` — signer reads state the bootstrap produced (X works this way: bootstrap grabs `transactionBaseKey` and `animationKeys` from the main JS bundle, signer combines them with the path to produce `x-client-transaction-id`).
- `bootstrap_js` only — legal but unusual. Implies the bootstrap output is consumed as a cookie jar or header set that the CLI injects directly.
- Neither — the validator rejects it (`SCHEMA_RUNTIME_EMPTY`). Delete the block instead of shipping an empty one; an empty block signals "signing required" to agents that then block on a signer that does nothing.

### Size limit

Each JS source is capped at **1 MiB**. A hand-ported X signer is ~10 KB; a full bootstrap with cubic-bezier math is ~25 KB; a captured webmssdk.js blob (path 2, as-is from the browser) can reach ~500 KB minified. The 1 MiB limit gives headroom for path-2 schemas while blocking megabyte-scale payloads that would bloat `/v1/catalog`. Minify or switch to path 1 (hand port) if you blow the cap — see [runtime.md](runtime.md).

### Why the JS source is paywalled

The public card projects **capability hints** about the runtime so an agent can decide whether pulling the schema commits it to running a signer. What gets projected:

- `runtime.requires_signer` (bool)
- `runtime.requires_bootstrap` (bool)
- `runtime.allowed_hosts` (string[])
- `runtime.bootstrap_ttl_seconds` (integer)

What stays in the full package only, behind the API-key + intent paywall:

- `runtime.bootstrap_js`
- `runtime.signer_js`

This is a deliberate security boundary. Signer source is the piece a competitor would most want — ship it on a public endpoint and anyone can rebuild the site's client without ever paying for an API key. Keep it paywalled, publish only the shape (`requires_signer: true, allowed_hosts: [...]`) so callers can make informed decisions.

## Actions and `body_template`

Write endpoints (POST/PUT/DELETE for "do a thing", not just "fetch") live under the top-level `actions` array. Each action carries the same `name`, `method`, `url_template`, `params` shape as an endpoint, plus one new field worth calling out here:

```json
{
  "actions": [
    {
      "name": "create_draft_tweet",
      "method": "POST",
      "url_template": "https://x.com/i/api/graphql/{{op_hash}}/CreateDraftTweet",
      "body_template": "{\"variables\":{\"post_tweet_request\":{\"status\":\"{{text}}\",\"draft\":true}},\"queryId\":\"{{op_hash}}\"}",
      "params": [
        {"name": "text", "in": "body", "type": "string", "required": true},
        {"name": "op_hash", "in": "path", "type": "string", "required": true}
      ]
    }
  ]
}
```

### What `body_template` does

The string is used **verbatim** as the request body after `{{var}}` substitution. Substituted values are JSON-escaped, so user input like `hello "world"` safely renders as `hello \"world\"` inside the surrounding JSON string. The runner never re-serializes the template — if the browser sent `{"variables":{"post_tweet_request":{"status":"..."}}}` then that's the byte sequence going out.

When `body_template` is absent, the runner falls back to JSON-marshaling every `Param` with `"in": "body"` into a flat object. That's fine for trivial APIs but wrong for almost every real-world GraphQL or RPC endpoint, where the server cares about nested structure and extra fields. **Capture the real body, paste it into `body_template`, replace user-varying values with `{{var}}` placeholders.** Don't hand-write the shape. See [contribute/actions.md](contribute/actions.md) for the full capture flow.

### Why `body_template` matters for the public/private split

`body_template` is a paywalled field — it lives in the full package only, never on the public card. The template is a direct map of the site's internal API contract, and that's exactly what the paywall is there to protect.

## Public card vs. full package

Every pushed schema lands as two views: the **public card** that anyone can read without an API key at `GET /v1/schemas/{site}`, and the **full package** delivered behind `hermai registry pull` (API key + intent). The server does the split automatically — what you write in your schema JSON is the full package, and the card is a projection.

You can't change what's projected. But knowing the rules prevents two mistakes: putting extraction detail in fields that show on the card (competitors re-implement the site without paying), and expecting fields to show on the card that never get projected (contributor thinks validation is broken).

| Field in your schema | On the public card | In the full package |
|---------------------|--------------------|---------------------|
| `site`, `intent_category`, `schema_format_version` | Yes | Yes |
| `name`, `description`, `version` | Yes | Yes |
| `endpoints[].name`, `endpoints[].method` | Yes | Yes |
| `endpoints[].purpose` | **Yes** — user-voice card blurb | Yes |
| `endpoints[].description` | **No** — paywalled | Yes |
| `endpoints[].url_template` | **No** — paywalled | Yes |
| `endpoints[].headers` (values) | **No** — paywalled | Yes |
| `endpoints[].variables`, `query_params`, `response_schema` | **No** — paywalled | Yes |
| `endpoints[].has_auth` (derived) | **No** — learned post-pull | Yes |
| `actions[].body_template` | **No** — paywalled | Yes |
| `requires_stealth: true` | Yes — surfaces as "Requires browser" badge | Yes |
| `session` block | **Projected** — see [sessions.md](sessions.md) for which fields survive | Yes |
| `runtime.requires_signer` (derived from `signer_js`) | **Yes** — capability hint | Yes |
| `runtime.requires_bootstrap` (derived from `bootstrap_js`) | **Yes** — capability hint | Yes |
| `runtime.allowed_hosts` | **Yes** — transparency about which hosts the sandbox can reach | Yes |
| `runtime.bootstrap_ttl_seconds` | **Yes** — operational hint | Yes |
| `runtime.bootstrap_js` | **No** — paywalled source | Yes |
| `runtime.signer_js` | **No** — paywalled source | Yes |

**Rule of thumb for writing `endpoints[].description`**: assume only an API-key holder with a declared intent will ever read it. Keep parse paths, jq selectors, JSON script tag IDs, and regex out of `purpose`; they belong in `description` where they're paywalled.

## Description rules

Description fields follow the public/private split above — public copy says *what*, private copy says *how*. This is a security boundary, not a style preference: leaking the *how* onto the public card lets anyone re-implement the site without ever calling our API.

- **Top-level `description`** → public card. One or two sentences describing *what information a caller can get*, user-voice.
  - Good: *"Search public repositories, get repository details, and list of users' public repos, etc."* (github.com)
  - Good: *"Read public Threads profiles and posts. Pulls display name, bio, follower counts, plus every post in a thread with text, images, timestamps, and like counts."* (threads.com)
  - Bad: naming endpoints, URL paths, parse-path selectors, script tag IDs, or CLI commands like `hermai probe` / `hermai extract`.
  - Sanity check: re-read your draft and ask *"would this sentence still make sense to someone who has never used the CLI?"* If not, rewrite.
- **Per-endpoint `purpose`** → public card. One sentence, user-voice, names the data this endpoint returns. Same rules as the top-level description.
- **Per-endpoint `description`** → full package only. Technical how-to: parse paths, selectors, query param semantics, field lists, JSON script tag IDs, pagination and edge cases. An agent reads it only after pulling the full package.
- **`session.description`** → full package only. Bootstrap instructions for a warm browser. Agent-facing prose, not a lab notebook.
- **`runtime.*_js`** → full package only. Sandboxed source, reviewable by anyone who pulls the package, invisible to anonymous browsers. Comment the JS like you would a normal source file; the comments ship with the source.

Quick test: would a competitor gain a meaningful shortcut to re-implement the site by reading this field without an API key? If yes, the content belongs under `description` (per-endpoint), inside the session block, or inside the runtime JS sources — not on the public card.

## Verified, not wishful

Every selector, jq path, regex, or JSON key you write into `description` (or into `session.data_extraction`) must be *confirmed* to extract the data you claim — by running it against the live page before you push. "I saw this class name in the HTML" is not verification; the class may be CSS-only and carry no data. Grep for a concrete data point (a real country name, a real price, a real product id) and look at the DOM *wrapping that value* — that wrapper is your real selector.

If a selector returns zero matches on a live fetch, delete it from the description or replace it with the one that works. Callers trust the paywalled `description` to execute cleanly; shipping selectors that don't fire is a worse bug than shipping no description, because debugging "why did parsing return empty?" wastes the caller's time on a problem we could have caught at contribution.

Same rule for `runtime` JS. A signer that produces headers the site rejects is worse than no signer at all — the caller now blames the framework rather than the schema. Test with `hermai action <site> <op> --dry-run` against a live session before pushing; see [cli.md](cli.md) and [contribute/actions.md](contribute/actions.md).

See the "Phase 4: Verify" section in the main skill for the extraction drill.
