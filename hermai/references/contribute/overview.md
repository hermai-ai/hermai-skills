# Contributing a schema — start here

Read this file when the user is adding a new site to the Hermai registry (not calling an existing one). It orients you to the contribute flow and tells you which other references to load as you work.

**Hermai is the interaction layer for agents, not just a read directory.** A good schema covers what a user *does* on the site — browse, search, view, add to cart, log in, post — not just what's on the homepage. Schemas with only `product_detail` are 10% done.

## Before you run any command

Write down the **interactions a user performs on this site**. For a shop that's typically:

- Browse catalog / category listings
- Search by keyword
- View product detail
- Add to cart / view cart / update cart
- Log in / register / view account
- Checkout / place order
- Write review / view reviews

For news: list articles, view article, search articles, subscribe. For social: profile, posts, comments, follow, like. Different site type, different interactions.

Reference the [coverage checklist](coverage-checklist.md) to decide when the schema is complete.

## The discovery pipeline

Work one interaction at a time. Don't stop after the homepage.

### Phase 1 — Classify the site

```bash
hermai detect --stealth https://example.com          # platform + anti-bot
hermai wellknown example.com                         # 15 standard paths
hermai introspect https://example.com/graphql        # if GraphQL found
```

Use `script_hosts` and `preconnect_hosts` from `detect` to identify the platform. Known platforms have documented APIs — research them before hand-discovering. See [platforms.md](platforms.md) for the running list (Shopify, Shopline, WordPress, WACA, Cyberbiz, EasyStore, etc.).

### Phase 2 — Cover each read interaction

```bash
hermai probe --body --stealth https://example.com/category \
  | hermai extract                                   # 13 embedded-data patterns
hermai intercept https://example.com/search?q=toy    # dynamic / XHR-driven pages
hermai replay request.json --stealth                 # verify a captured XHR works standalone
```

`hermai extract` recognizes: `ytInitialData`, `ytInitialPlayerResponse`, `__NEXT_DATA__`, `__UNIVERSAL_DATA_FOR_REHYDRATION__`, `SIGI_STATE`, `__APOLLO_STATE__`, `__PRELOADED_STATE__`, `__remixContext`, `__NUXT__`, `__NUXT_DATA__`, `__FRONTITY_CONNECT_STATE__`, `__MODERN_ROUTER_DATA__`, `__INITIAL_STATE__`.

### Phase 3 — Capture writes (the hard part)

For authenticated write endpoints (post, save draft, add to cart, submit review), use headful intercept with cookie injection so you don't have to re-login:

```bash
hermai session import example.com --browsers chrome,firefox,brave
hermai intercept https://example.com/home \
  --headful --session example.com \
  --timeout 120s --wait 100s --raw > capture.json
# Perform the action in the visible browser. Parse capture.json for the XHR.
```

This is **the** way to discover correct body shapes. **Never guess.** The #1 failure mode for write schemas is inventing field names that look plausible but the server rejects with HTTP 422. Capture the real browser payload; paste it into `body_template` with `{{var}}` placeholders for user input.

See [actions.md](actions.md) for the full writes walkthrough.

### Phase 4 — Verify every extraction path against the live page

**This is a hard rule, not a style guideline.** Every CSS selector, jq path, regex, parse path, JSON key, or script-tag id you put in an endpoint's `description` must be live-verified to return the data you claim it returns. "Wishful selectors" — class names you *saw in a grep* or *guessed from a pattern* — are the #1 source of broken schemas.

**What "verified" means, concretely:**

1. **For CSS/DOM selectors**: run the selector against the downloaded HTML and print the matches. If you claim `.race-date` contains race dates, `grep -oE '<[^>]+class="[^"]*race-date[^"]*"[^>]*>[^<]+</' page.html` must return actual date strings. If it returns nothing or garbage, the selector is wrong — find the real one by looking at the live DOM around the data you want.
2. **For JSON parse paths**: download the response and run the path. If you claim `props.pageProps.aboveTheFoldData.title`, `jq '.props.pageProps.aboveTheFoldData.title'` (or Python equivalent) must return a non-null value. Empty/null/missing = wrong path.
3. **For regex patterns**: run the regex against the real input and confirm the capture groups produce the claimed values.
4. **For JSON-LD**: confirm `<script type="application/ld+json">` with the claimed `@type` actually exists on the page, and that the keys you name (`offers.price`, `aggregateRating.ratingValue`) are present.

**Common failure pattern to avoid:**

1. You grep the HTML for class names and see `race-date`, `race-time`, `race-day` appear somewhere.
2. You write `description: "Parse .race-date, .race-time, .race-day for each Grand Prix"`.
3. Those classes turn out to be CSS-only helpers; the actual data lives in `<h4 class="text-on-t-stat-label-major">` siblings inside `.f1-highlight-grid-item` blocks.
4. Your schema is wrong — looks plausible, doesn't work.

**Correct workflow: extract, don't guess.**

```bash
grep -c 'Bahrain' page.html                          # confirm the word is in the page
python3 -c "
import re
html = open('page.html').read()
for m in re.finditer(r'.{200}Bahrain.{500}', html):
    print(m.group(0)); break
"
# Now you see the ACTUAL wrapping element + siblings.
# THAT's what goes in description — not what you hoped the class was called.
```

If the data you want isn't reachable with any selector you can find — that's an answer too. Either the data is loaded dynamically (use `hermai intercept` to find the real XHR) or it's not actually exposed on that page.

## Writing the schema

Fields and shape: [schema-format.md](../schema-format.md). Public-card vs full-package split is a security boundary — keep extraction detail (parse paths, selectors, CSS) in private `description`, never in public `purpose` or top-level `description`. Agents reading the public card should learn *what* data is available, not *how* to grab it.

If the site requires per-request signing (X's `x-client-transaction-id`, TikTok's `X-Bogus`) or per-session computed state (X's `animation_key`, TikTok's `msToken`), the schema needs a `runtime` block with `bootstrap_js` and/or `signer_js`. See [runtime.md](../runtime.md) for the contract and sandbox reference.

## Push

```bash
hermai registry login                                # GitHub OAuth, first time
hermai registry push schema.json
```

Pushing identical content twice is idempotent (content-hashed). Validation errors → [troubleshooting.md](troubleshooting.md).

## When you're debugging a rejected push

- `FORBIDDEN_FIELD` → the schema has cookie VALUES, proxy credentials, or evasion-script fields. Move them out. Names of required cookies are fine; values are not.
- `FORBIDDEN_NAME` → remove `bypass`, `circumvent`, `cf-clearance`, `anti-bot`, `rotate-ip` from schema/endpoint names.
- `SCHEMA_RUNTIME_EMPTY` → runtime block declared but has neither bootstrap_js nor signer_js.
- `SCHEMA_RUNTIME_ALLOWED_HOSTS_MISSING` → bootstrap_js present without `allowed_hosts`.
- `PURPOSE_REQUIRED` → every endpoint needs a `purpose` string.

Full list: [troubleshooting.md](troubleshooting.md).
