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

## Writing descriptions (public vs. private split)

**Read this every time before drafting a schema — this is the #1 pattern contributors get wrong, and it has a security angle.**

The catalog publishes a **public card** (what the schema offers) and a **full package** (how to execute, paywalled behind an API key + intent). The split exists so the extraction recipe — parse paths, selectors, JSON script tag IDs, endpoint internals — stays behind the auth gate. If someone can read the recipe on the public card, they can re-implement the site themselves without ever calling our API, which defeats the point.

### Top-level `description` — public, user-voice

One or two sentences describing **what information the caller can get**, in the voice of a user deciding whether to use the schema.

Good:

> "Search public repositories, get repository details, and list of users' public repos, etc."
> — github.com

> "Read public Threads profiles and posts. Pulls a profile's display name, bio, follower and thread counts, plus every post in a thread with their text, images, timestamps, and like counts."
> — threads.com

Bad:

> ~~"A single GET to /@{user}/post/{id} returns the full thread chain inside <script type=\"application/json\" data-sjs> blocks..."~~

> ~~"Use `hermai probe --stealth` then pipe to `hermai extract` to get the embedded __NEXT_DATA__ payload..."~~

Sanity check: *"would this sentence still make sense to someone who has never used the CLI?"* If not, rewrite.

### Per-endpoint fields — `purpose` vs. `description`

Every endpoint carries two separate fields:

- **`purpose`** — public, shown on the catalog card. One sentence, user-voice, names the data this endpoint returns. No URL paths, no jq, no CLI commands.
- **`description`** — private, only in the full package (requires API key + intent). The full technical how-to: URL template notes, parse paths, selectors, regex, JSON script tag IDs, field names, pagination semantics, edge cases. Write it for an agent that just pulled the schema and needs to execute.

Example:

```json
{
  "name": "post_detail",
  "method": "GET",
  "url_template": "https://www.threads.com/@{username}/post/{post_id}",
  "purpose": "Get a post's full thread chain and every user reply, with text, images, timestamps, and like counts.",
  "description": "Select every <script type=\"application/json\" data-sjs>…</script> in the HTML, JSON.parse each body, and recursively walk every object looking for the key `thread_items`. Each `thread_items[n].post` is a full post object with: `code` (shortcode = URL slug), `caption.text` (body markdown), `user.username`, `user.pk`, `like_count`, `taken_at`, `carousel_media[]`, `canonical_url`, `reply_facepile_users`. Filter by `user.username == {username}` to drop the 3–5 unrelated 'also on Threads' rail posts."
}
```

Rule of thumb: if a line mentions a specific JSON key, script tag id, regex, or jq path — it goes in `description`. If it says what you can learn or do — it goes in `purpose`.

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
