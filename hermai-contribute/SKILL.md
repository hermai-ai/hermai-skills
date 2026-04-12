---
name: hermai-contribute
description: "REQUIRED when the user wants to add a website to the Hermai registry, contribute a schema, reverse-engineer a site's API, or push a new endpoint set. Examples: 'add stripe.com to hermai', 'push this schema', 'discover the API for nytimes.com', 'register a new site on hermai', 'document tiktok's API', 'help me contribute to hermai', 'my schema failed validation with FORBIDDEN_FIELD'. Also REQUIRED when the user asks about Hermai schema format v0.1, intent categories, how to write a session block for an anti-bot site, or why a push was rejected. This skill teaches how to build, validate, and contribute schemas to the Hermai registry. For simply calling an already-registered site, use the hermai skill instead."
---

# Hermai — Contribute schemas to the registry

Hermai's registry is a catalog of website APIs: each entry tells an agent exactly which endpoints to call, what parameters to pass, and (for anti-bot sites) how to warm a browser session before calling. Contributing a schema means reverse-engineering a site once so every future agent can use it without scraping.

This skill covers **building and pushing** schemas. For calling already-registered sites, use the **hermai** skill.

## Deciding: CLI vs API

Check if the CLI is available:

```bash
which hermai || hermai --version
```

- **CLI available**: Use `hermai discover` and `hermai registry push` — they handle auth, canonicalization, and validation locally before pushing
- **CLI not available**: Build a schema JSON by hand and `POST /v1/schemas` with `curl`

Both paths hit the same validator. The CLI gives you a local dry-run before the network call.

## Authentication

Contribution requires an API key:

```bash
hermai registry login
# Or:
mkdir -p ~/.hermai && chmod 700 ~/.hermai
echo "platform_key: hm_sk_YOUR_KEY" > ~/.hermai/config.yaml
chmod 600 ~/.hermai/config.yaml
```

Keys come from https://hermai.ai/dashboard.

## Core Workflows

### 1. Discover a new site's API

If no schema exists, use the CLI to discover endpoints automatically:

```bash
export HERMAI_API_KEY=sk-...  # OpenRouter or OpenAI key for LLM analysis
hermai discover https://example.com
```

This probes the site, intercepts network traffic via a headless Chrome session, and emits a candidate schema. Review it, edit if needed, then push it.

For sites the automated discover can't fully map (heavy anti-bot, signed requests, shop pages that lazy-load), hand-craft the schema: use browser DevTools to watch the real XHR calls, copy URL templates and parse paths into a JSON file that conforms to the format below.

### 2. Push a schema

```bash
# CLI
hermai registry push schema.json

# API
curl -X POST https://api.hermai.ai/v1/schemas \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d @schema.json
```

The validator returns the persisted public card on success, or an error code on rejection (see Error Codes below).

Pushing the same content twice is idempotent: the content hash is over the canonicalized `full_package`, so an unchanged schema returns the existing version.

## Schema Format (v0.1)

```json
{
  "site": "example.com",
  "intent_category": "commerce",
  "schema_format_version": "0.1",
  "name": "example/products",
  "description": "Short tagline — what this catalog is and what data is accessible. Not a how-to.",
  "endpoints": [
    {
      "name": "search",
      "method": "GET",
      "url_template": "https://api.example.com/products",
      "description": "Search products by keyword. Parse path and field list belong HERE, not in the top-level description.",
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
  ],
  "actions": []
}
```

**Required fields:** `site`, `intent_category`, `schema_format_version` (must be `"0.1"`)

**Categories:** `commerce`, `travel`, `jobs`, `social`, `media`, `reference`, `food`, `finance`, `real-estate`, `communication`, `productivity`, `knowledge`, `developer`, `sports`

**Key rules:**
- Use `url_template` (not `url`) for endpoint URLs
- Top-level `description` is a **catalog tagline** — say what the site is and what data is accessible. No tier counts, parse paths, script IDs, or internal research notes.
- Per-endpoint `description` is where the technical how-to goes — parse paths, field lists, script IDs, query param semantics. An agent only reads it once it has decided to call that endpoint.
- `session.description` is bootstrap instructions for a warm browser — same rule: agent-facing, not a lab notebook

## Sites that need a browser session

Some sites (Airbnb, Transfermarkt, TikTok, Zillow, etc.) gate their APIs behind anti-bot systems or per-request signing. These are **first-class citizens** in the registry. The schema carries a `session` block documenting what the caller must run **locally** to warm a browser, capture cookies, and sign requests. Hermai is a registry of *what you need to run each endpoint*, not a magic proxy.

```json
{
  "site": "tiktok.com",
  "intent_category": "social",
  "schema_format_version": "0.1",
  "endpoints": [ /* ... */ ],
  "session": {
    "bootstrap_url": "https://www.tiktok.com/",
    "tls_profile": "chrome_131",
    "required_cookies": ["msToken", "odin_tt", "ttwid"],
    "endpoints_needing_session": ["user_posts", "search_general", "..."],
    "sign_function": "window.byted_acrawler.frontierSign",
    "sign_strategy": "in_page_fetch",
    "description": "Step-by-step: (1) launch Chrome via rod/Playwright, (2) navigate to bootstrap_url, (3) wait ~15s for webmssdk.js to populate cookies, (4) call page.Eval('fetch(url).text()') for each /api/* endpoint so TikTok's own signer handles X-Bogus/msToken injection."
  },
  "requires_stealth": true
}
```

### Allowed session fields

All are public documentation of what a local client needs:

- `session.bootstrap_url` — warm-up URL the client navigates to
- `session.tls_profile` — Chrome-TLS fingerprint name (e.g. `chrome_131`)
- `session.required_cookies` — list of cookie **names** (never values)
- `session.endpoints_needing_session` — which endpoints in this schema need the warm session; endpoints NOT listed work with plain HTTPS
- `session.sign_function` / `session.sign_strategy` — where/how the browser signs requests
- `session.data_extraction` — for HTML-extract endpoints: selector + parse path per endpoint
- `session.description` — prose bootstrap instructions
- `requires_stealth: true` — top-level hint that this schema needs a real-browser path

### Forbidden fields (rejected on push)

These would store **user-specific secrets** or evasion recipes:

- `proxy_credentials`, `residential_proxy` — third-party proxy logins are each user's problem
- `clearance_cookies`, `clearance_cookie_js` — cookie **values** (names are fine; values would be a user's session token)
- `bypass_method`, `stealth_script` — opaque evasion recipes belong in client code, not schemas
- `tls_fingerprint` — raw fingerprint bytes; use the named `tls_profile` instead

### Forbidden name patterns

Schemas or endpoints whose names contain any of these are rejected:

`bypass`, `circumvent`, `cf-clearance`, `anti-bot`, `rotate-ip`

These imply the schema is the evasion tool, not a catalog of what the client runs. If you're documenting how a user's browser legitimately reaches the site, you don't need these words.

## API Endpoint Reference

Base URL: `https://api.hermai.ai`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/schemas` | Push a schema (auth required) |
| GET | `/v1/account/contributions` | Your pushed schemas (auth required) |
| GET | `/v1/categories` | Full intent taxonomy (public) |

## Validation Error Codes

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | Missing/invalid API key |
| `MISSING_FIELD` | Push missing a required field (`site`, `intent_category`, `schema_format_version`, or per-endpoint `name`/`method`/`url_template`) |
| `UNKNOWN_CATEGORY` | `intent_category` not in the canonical list |
| `FORBIDDEN_FIELD` | Schema contains a disallowed session field (see Forbidden fields above) |
| `FORBIDDEN_NAME` | Schema or endpoint name contains a forbidden pattern (`bypass`, `circumvent`, etc.) |
| `INVALID_SCHEMA_VERSION` | `schema_format_version` is not `"0.1"` |

When you hit `FORBIDDEN_FIELD` or `FORBIDDEN_NAME`, re-read the Forbidden sections above — the fix is almost always to move evasion logic out of the schema and into local client code, or to swap a cookie-value field for a cookie-name-only `required_cookies` entry.

## CLI Installation

```bash
# macOS Apple Silicon
curl -L https://github.com/hermai-ai/hermai-cli/releases/latest/download/hermai_darwin_arm64.tar.gz | tar xz
sudo mv hermai /usr/local/bin/

# macOS Intel
curl -L https://github.com/hermai-ai/hermai-cli/releases/latest/download/hermai_darwin_amd64.tar.gz | tar xz
sudo mv hermai /usr/local/bin/

# Linux amd64
curl -L https://github.com/hermai-ai/hermai-cli/releases/latest/download/hermai_linux_amd64.tar.gz | tar xz
sudo mv hermai /usr/local/bin/
```

## Contributor CLI Command Reference

```
hermai discover <url>                              Full engine discovery (needs LLM key)
hermai registry push <file.json>                   Upload schema
hermai init                                        Create config interactively
hermai doctor                                      Check system readiness
```

For listing, pulling, fetching, and calling schemas, use the **hermai** skill.
