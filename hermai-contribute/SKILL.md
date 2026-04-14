---
name: hermai-contribute
description: "REQUIRED when the user wants to add a website to the Hermai registry, contribute a schema, reverse-engineer a site's API, or push a new endpoint set. Also REQUIRED when the user asks about Hermai schema format, intent categories, session blocks for anti-bot sites, or why a push was rejected. For calling already-registered sites, use the hermai skill instead."
---

# Hermai — Contribute schemas to the registry

Contributing a schema means reverse-engineering a site once so every future agent can call it without scraping.

> For **calling** already-registered sites, use the **hermai** skill.

## Before you run any command

**Hermai is the interaction layer for agents, not just a read directory.** A good schema covers what a user *does* on the site — browse, search, view, add to cart, log in, post — not just what's on the homepage.

Before running any discovery command, write down the **interactions a user performs on this site**. For a shop that's typically:

- Browse catalog / category listings
- Search by keyword
- View product detail
- Add to cart / view cart / update cart
- Log in / register / view account
- Checkout / place order
- Write review / view reviews

For news: list articles, view article, search articles, subscribe. For social: profile, posts, comments, follow, like. Different site type, different interactions.

**A schema with only `product_detail` is 10% done.** See [references/coverage-checklist.md](references/coverage-checklist.md) before declaring a schema complete.

## Quick start

```bash
# 1. Probe the site to see what platform it uses
hermai probe --stealth https://example.com

# 2. Extract data from each interaction URL (product, category, search, etc.)
hermai probe --body --stealth https://example.com/path | hermai extract

# 3. Use intercept to capture XHR calls for dynamic pages (search, cart, filters)
hermai intercept https://example.com/search?q=test

# 4. Build a schema JSON with ALL interactions covered, then push
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

Work one interaction at a time. Don't stop after the homepage — that's the trap that produces 2-endpoint schemas.

**Phase 1: Classify the site.**

```bash
# What platform is it? (WordPress? Shopline? custom?)
hermai detect --stealth https://example.com

# What standard paths exist?
hermai wellknown example.com

# If GraphQL found — introspect it (gets reads AND writes)
hermai introspect https://example.com/graphql
```

Use `script_hosts` and `preconnect_hosts` from detect to identify the platform. Known platforms (Shopify, Shopline, WordPress, Cyberbiz, WACA, EasyStore, etc.) have documented APIs — research them before hand-discovering. See [references/platforms.md](references/platforms.md) for a running list.

**Phase 2: Cover each interaction.**

For each user interaction you listed above, discover its endpoint:

```bash
# Static listing pages (category, article index)
hermai probe --body --stealth https://example.com/categories/toys \
  | hermai extract

# Detail pages (product, article, profile)
hermai probe --body --stealth https://example.com/products/item-123 \
  | hermai extract

# Dynamic pages (search, filters, cart) — intercept the real XHR
hermai intercept https://example.com/search?q=gundam

# Verify a captured XHR works standalone
hermai replay request.json --stealth
```

Intercept is the tool for anything that updates dynamically — search-as-you-type, filter sidebars, cart updates, infinite scroll. The HTML alone won't reveal the API endpoint; you need to watch the network.

**Phase 3: Write interactions the site supports.**

Read-only schemas are 50% of the value. Capture writes too — login, add-to-cart, submit review. This is where `intercept` shines: perform the action in the browser and capture the POST request. See [references/actions.md](references/actions.md) for how to document write operations.

The `extract` command recognizes 13 embedded patterns: `ytInitialData`, `ytInitialPlayerResponse`, `__NEXT_DATA__`, `__UNIVERSAL_DATA_FOR_REHYDRATION__`, `SIGI_STATE`, `__APOLLO_STATE__`, `__PRELOADED_STATE__`, `__remixContext`, `__NUXT__`, `__NUXT_DATA__`, `__FRONTITY_CONNECT_STATE__`, `__MODERN_ROUTER_DATA__`, `__INITIAL_STATE__`.

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

- [references/coverage-checklist.md](references/coverage-checklist.md) — **read first.** Interaction checklist by site type (commerce, news, social, booking). Use to decide when a schema is complete.
- [references/platforms.md](references/platforms.md) — known platforms (Shopify, Shopline, WordPress, WACA, etc.) with their URL patterns and API conventions. Look up the platform before hand-discovering.
- [references/actions.md](references/actions.md) — discovering and documenting write operations (login, add-to-cart, submit review). CSRF, credentials, idempotency.
- [references/schema-format.md](references/schema-format.md) — v0.1 JSON spec, required fields, categories, description rules
- [references/sessions.md](references/sessions.md) — session block for anti-bot sites, allowed/forbidden fields, name patterns
- [references/troubleshooting.md](references/troubleshooting.md) — validation error codes and fixes
- [references/install.md](references/install.md) — CLI binary downloads per platform
