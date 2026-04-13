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

# 3. Build a schema JSON (see references/schema-format.md), then push
hermai registry push schema.json
```

## CLI discovery commands

These are deterministic tools — no API key needed. Chain them like an agent would.

| Command | Purpose |
|---------|---------|
| `hermai probe <url>` | TLS-fingerprinted fetch, anti-bot detection, strategy discovery |
| `hermai probe --body <url>` | Raw HTML to stdout (pipe to extract) |
| `hermai extract [file]` | Extract all embedded data patterns from HTML |
| `hermai extract --pattern <name>` | Extract one specific pattern |
| `hermai wellknown <domain>` | Probe 15 standard paths (robots, sitemap, RSS, GraphQL, oEmbed, WP API) |
| `hermai introspect <url>` | GraphQL schema discovery via introspection query |
| `hermai detect <url>` | Identify anti-bot systems + platform/CMS |
| `hermai intercept <url>` | Launch browser, capture XHR/API calls, output replay specs |
| `hermai replay <req.json>` | Replay a captured request with TLS fingerprinting |
| `hermai discover <url>` | Full engine discovery (needs LLM key) |

### Discovery pipeline

Chain commands to reverse-engineer a site. Each outputs JSON the next can consume.

```bash
# 1. What does the site use? (anti-bot, platform, CMS)
hermai detect --stealth https://example.com

# 2. What standard paths exist? (sitemap, RSS, GraphQL, WP API)
hermai wellknown example.com

# 3. If GraphQL found — introspect the schema
hermai introspect https://example.com/graphql

# 4. Probe the page and extract embedded data patterns
hermai probe --body --stealth https://example.com | hermai extract

# 5. Extract just one pattern (e.g., YouTube video data)
hermai probe --body --stealth "https://youtube.com/watch?v=..." \
  | hermai extract --pattern ytInitialData

# 6. For SPAs — capture XHR calls via browser
hermai intercept https://example.com

# 7. Verify a captured API call works standalone
hermai replay request.json --stealth
```

The extract command recognizes 13 embedded patterns: `ytInitialData`, `ytInitialPlayerResponse`, `__NEXT_DATA__`, `__UNIVERSAL_DATA_FOR_REHYDRATION__`, `SIGI_STATE`, `__APOLLO_STATE__`, `__PRELOADED_STATE__`, `__remixContext`, `__NUXT__`, `__NUXT_DATA__`, `__FRONTITY_CONNECT_STATE__`, `__MODERN_ROUTER_DATA__`, `__INITIAL_STATE__`.

## Authentication

Pushing requires an API key:

```bash
hermai registry login
```

Keys come from https://hermai.ai/dashboard (GitHub sign-in).

## Push

```bash
# CLI
hermai registry push schema.json

# API
curl -X POST https://api.hermai.ai/v1/schemas \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d @schema.json
```

Pushing identical content twice is idempotent (content-hashed). If the push is rejected, see [references/troubleshooting.md](references/troubleshooting.md) for error codes.

## References

- [references/schema-format.md](references/schema-format.md) — v0.1 JSON spec, required fields, categories, description rules
- [references/sessions.md](references/sessions.md) — session block for anti-bot sites, allowed/forbidden fields, name patterns
- [references/troubleshooting.md](references/troubleshooting.md) — validation error codes and fixes
- [references/install.md](references/install.md) — CLI binary downloads per platform
