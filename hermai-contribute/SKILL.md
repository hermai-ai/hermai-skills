---
name: hermai-contribute
description: "REQUIRED when the user wants to add a website to the Hermai registry, contribute a schema, reverse-engineer a site's API, or push a new endpoint set. Also REQUIRED when the user asks about Hermai schema format, intent categories, session blocks for anti-bot sites, or why a push was rejected. For calling already-registered sites, use the hermai skill instead."
---

# Hermai — Contribute schemas to the registry

Contributing a schema means reverse-engineering a site once so every future agent can call it without scraping.

> For **calling** already-registered sites, use the **hermai** skill.

## Quick start

```bash
# 1. Probe the site
hermai probe --stealth https://example.com

# 2. Extract embedded data patterns from the HTML
hermai probe --body --stealth https://example.com | hermai extract

# 3. Build a schema JSON (see format below), then push
hermai registry push schema.json
```

## CLI discovery commands

These are deterministic tools — no API key needed. Chain them like an agent would.

| Command | Purpose |
|---------|---------|
| `hermai probe <url>` | TLS-fingerprinted fetch, anti-bot detection, strategy discovery |
| `hermai probe --body <url>` | Raw HTML to stdout (pipe to extract) |
| `hermai probe --stealth <url>` | Force Chrome TLS fingerprinting |
| `hermai extract [file]` | Extract all embedded data patterns from HTML |
| `hermai extract --pattern <name>` | Extract one specific pattern |
| `hermai extract --list-patterns` | List all 13 known patterns |
| `hermai discover <url>` | Full engine discovery (needs LLM key) |

### Probe + extract pipeline

```bash
# Discover what data YouTube embeds in its HTML
hermai probe --body --stealth "https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
  | hermai extract

# Extract just the video metadata
hermai probe --body --stealth "https://www.youtube.com/watch?v=dQw4w9WgXcQ" \
  | hermai extract --pattern ytInitialData
```

The extract command recognizes 13 embedded patterns: `ytInitialData`, `ytInitialPlayerResponse`, `__NEXT_DATA__`, `__UNIVERSAL_DATA_FOR_REHYDRATION__`, `SIGI_STATE`, `__APOLLO_STATE__`, `__PRELOADED_STATE__`, `__remixContext`, `__NUXT__`, `__NUXT_DATA__`, `__FRONTITY_CONNECT_STATE__`, `__MODERN_ROUTER_DATA__`, `__INITIAL_STATE__`.

## Authentication

Pushing requires an API key:

```bash
hermai registry login
```

Keys come from https://hermai.ai/dashboard (GitHub sign-in).

## Schema format (v0.1)

```json
{
  "site": "example.com",
  "intent_category": "commerce",
  "schema_format_version": "0.1",
  "name": "example/products",
  "description": "Short tagline — what this catalog is and what data is accessible.",
  "endpoints": [
    {
      "name": "search",
      "method": "GET",
      "url_template": "https://api.example.com/products",
      "description": "Technical how-to: parse paths, selectors, query param semantics.",
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

**Required fields:** `site`, `intent_category`, `schema_format_version` (must be `"0.1"`), and per-endpoint `name`, `method`, `url_template`.

**Categories:** `commerce`, `travel`, `jobs`, `social`, `media`, `reference`, `food`, `finance`, `real-estate`, `communication`, `productivity`, `knowledge`, `developer`, `sports`, `government`

**Description rules:**
- Top-level `description` = catalog tagline. Say what the site is. No parse paths, tier counts, or script IDs.
- Per-endpoint `description` = technical how-to. Parse paths, selectors, field lists go here.
- `session.description` = bootstrap instructions for a warm browser. Agent-facing prose, not a lab notebook.

## Session block (anti-bot sites)

Sites behind Cloudflare, DataDome, or request signing (TikTok, Airbnb, Zillow) carry a `session` block:

```json
{
  "session": {
    "bootstrap_url": "https://www.tiktok.com/",
    "tls_profile": "chrome_131",
    "required_cookies": ["msToken", "odin_tt", "ttwid"],
    "endpoints_needing_session": ["user_posts", "search_general"],
    "sign_function": "window.byted_acrawler.frontierSign",
    "sign_strategy": "in_page_fetch",
    "description": "Launch Chrome, navigate to bootstrap_url, wait for cookies, use page.Eval fetch for signed endpoints."
  },
  "requires_stealth": true
}
```

### Allowed session fields

`bootstrap_url`, `tls_profile`, `required_cookies` (names only, never values), `endpoints_needing_session`, `sign_function`, `sign_strategy`, `data_extraction`, `description`.

### Forbidden fields (rejected on push)

- `proxy_credentials`, `residential_proxy` — user's own problem
- `clearance_cookies`, `clearance_cookie_js` — cookie values are secrets
- `bypass_method`, `stealth_script` — evasion belongs in client code
- `tls_fingerprint` — use named `tls_profile` instead

### Forbidden name patterns

`bypass`, `circumvent`, `cf-clearance`, `anti-bot`, `rotate-ip`

## Push workflow

```bash
# CLI
hermai registry push schema.json

# API
curl -X POST https://api.hermai.ai/v1/schemas \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d @schema.json
```

Pushing identical content twice is idempotent (content-hashed).

## Validation error codes

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | Missing/invalid API key |
| `MISSING_FIELD` | Required field missing |
| `UNKNOWN_CATEGORY` | `intent_category` not in the canonical list |
| `FORBIDDEN_FIELD` | Disallowed session field (see above) |
| `FORBIDDEN_NAME` | Name contains forbidden pattern |
| `INVALID_SCHEMA_VERSION` | Not `"0.1"` |

## CLI installation

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
