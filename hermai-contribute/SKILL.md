---
name: hermai-contribute
version: "1.1.0"
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

**Phase 4: Verify every extraction path against the live page — BEFORE writing the schema.**

**This is a hard rule, not a style guideline.** Every CSS selector, jq path, regex, parse path, JSON key, or script-tag id you put in an endpoint's `description` must be live-verified to return the data you claim it returns. "Wishful selectors" — class names you *saw in a grep* or *guessed from a pattern* — are the #1 source of broken schemas.

**What "verified" means, concretely:**

1. **For CSS/DOM selectors**: run the selector against the downloaded HTML and print the matches. If you claim `.race-date` contains race dates, `grep -oE '<[^>]+class="[^"]*race-date[^"]*"[^>]*>[^<]+</` must return actual date strings. If it returns nothing or garbage, the selector is wrong — find the real one by looking at the live DOM around the data you want.
2. **For JSON parse paths**: download the response and run the path. If you claim `props.pageProps.aboveTheFoldData.title`, `jq '.props.pageProps.aboveTheFoldData.title'` (or Python equivalent) must return a non-null value. Empty/null/missing = wrong path.
3. **For regex patterns**: run the regex against the real input and confirm the capture groups produce the claimed values.
4. **For JSON-LD**: confirm `<script type="application/ld+json">` with the claimed `@type` actually exists on the page, and that the keys you name (`offers.price`, `aggregateRating.ratingValue`) are present.

**Common failure pattern to avoid:**

1. You grep the HTML for class names and see `race-date`, `race-time`, `race-day` appear somewhere.
2. You write `description: "Parse .race-date, .race-time, .race-day for each Grand Prix"`.
3. Turns out those classes are CSS-only helpers used by other parts of the page; the actual data lives in `<h4 class="text-on-t-stat-label-major">` siblings inside `.f1-highlight-grid-item` blocks.
4. Your schema is wrong — looks plausible, doesn't work.

**Correct workflow: extract, don't guess.**

```bash
# After downloading the HTML, find the real selectors that wrap the data.
# Pick one concrete data point (e.g. "Bahrain") and look at its surrounding DOM:
grep -c 'Bahrain' page.html                                   # confirm the word is in the page
python3 -c "
import re
html = open('page.html').read()
# Show 500 chars before+after the concrete value
for m in re.finditer(r'.{200}Bahrain.{500}', html):
    print(m.group(0)); break
"
# Now you see the ACTUAL wrapping element + nearby siblings.
# THAT's what goes in description — not what you hoped the class was called.
```

**Before saving the schema, run one final extraction test per endpoint:**

```bash
# For every selector / parse path / regex in description, extract and print samples.
# If a selector returns 0 matches, fix it or drop the claim. Never ship unverified.
```

If the data you want isn't reachable with any selector you can find — that's an answer too. Either the data is loaded dynamically (use `hermai intercept` to find the real XHR) or it's not actually exposed on that page.

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

## Staying up to date

On every call to `api.hermai.ai` (and on every `hermai registry push` or `pull` that reaches it), send two headers so Hermai can notify the user when a newer release ships:

```
X-Hermai-Skill-Name: hermai-contribute
X-Hermai-Skill-Version: 1.0.0
```

Read the version from this file's frontmatter — don't hardcode it. The `name` stays `hermai-contribute`.

If a newer release exists, the response JSON will carry a `meta.skill_update` object:

```json
{
  "meta": {
    "skill_update": {
      "current": "1.0.0",
      "latest": "1.2.0",
      "update_cmd": "npx skills update hermai-contribute",
      "changelog_url": "https://github.com/hermai-ai/hermai-skills/releases"
    }
  }
}
```

When you see this field, tell the user in one short sentence before carrying on with the task — e.g. *"Heads up: your hermai-contribute skill (1.0.0) is behind 1.2.0. Run `npx skills update hermai-contribute` to upgrade."* If `meta.skill_update` is absent, the user is current — no nudge needed.

## References

- [references/coverage-checklist.md](references/coverage-checklist.md) — **read first.** Interaction checklist by site type (commerce, news, social, booking). Use to decide when a schema is complete.
- [references/platforms.md](references/platforms.md) — known platforms (Shopify, Shopline, WordPress, WACA, etc.) with their URL patterns and API conventions. Look up the platform before hand-discovering.
- [references/actions.md](references/actions.md) — discovering and documenting write operations (login, add-to-cart, submit review). CSRF, credentials, idempotency.
- [references/schema-format.md](references/schema-format.md) — v0.1 JSON spec, required fields, categories, description rules
- [references/sessions.md](references/sessions.md) — session block for anti-bot sites, allowed/forbidden fields, name patterns
- [references/troubleshooting.md](references/troubleshooting.md) — validation error codes and fixes
- [references/install.md](references/install.md) — CLI binary downloads per platform
