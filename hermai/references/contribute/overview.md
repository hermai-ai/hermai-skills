# Contributing a schema — start here

Read this file when the user is adding a new site to the Hermai registry (not calling an existing one). It orients you to the contribute flow and tells you which other references to load as you work.

**Hermai is the interaction layer for agents, not just a read directory.** A good schema covers what a user *does* on the site — browse, search, view, add to cart, log in, post — not just what's on the homepage. Schemas with only `product_detail` are 10% done.

## Reference map — load what you need, in this order

1. [coverage-checklist.md](coverage-checklist.md) — decide up front what interactions a complete schema must cover for this site type
2. [platforms.md](platforms.md) — before hand-discovering, check whether the site runs a known platform (Shopify, Shopline, WordPress, etc.)
3. [actions.md](actions.md) — how to capture real XHRs for writes; the `body_template` / bearer-rotation story lives here
4. [../schema-format.md](../schema-format.md) — every field, required vs. optional, public-card vs. full-package split
5. [../runtime.md](../runtime.md) — only if the site requires per-request signing (`signer_js`) or per-session bootstrap state (`bootstrap_js`)
6. [troubleshooting.md](troubleshooting.md) — validator error codes and call-time failure triage

## Contents

- [Reference map — load what you need, in this order](#reference-map--load-what-you-need-in-this-order)
- [Before you run any command](#before-you-run-any-command)
- [The discovery pipeline](#the-discovery-pipeline)
- [Writing the schema](#writing-the-schema)
- [Cloud-ready checklist](#cloud-ready-checklist)
- [Push](#push)
- [When you're debugging a rejected push](#when-youre-debugging-a-rejected-push)

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

Do not write prose-only schemas. Each production endpoint needs an executable request contract and a concrete projection contract:

- Real `method`, `url_template`, stable non-secret `headers`, and all required `variables` / `query_params`.
- Captured endpoint `body_template` for non-trivial POST, GraphQL, or RPC reads; captured action `body_template` for writes.
- Concrete `response_schema` for JSON responses, or `response_schema.html_list` for HTML responses that the executor must project.
- Private `description` may include selectors, parse notes, sample params, and edge cases, but it is not a substitute for `response_schema`.

Treat response quality as part of correctness. A fetch that returns `title`, `html_raw`, or one unstructured `page_summary` is incomplete when the endpoint's purpose implies richer output. Examples:

- Credit-card detail must expose annual fee, sign-up bonus, rewards rates, APR, benefits, and key URLs when present.
- Hotel room availability must expose room names, occupancy, price, currency, taxes/fees or total price when present.
- Flight search must expose airline, flight numbers, departure/arrival times, duration, stops, price, and currency when present.
- Product detail must expose title, price, currency, availability, variants, images, and canonical URL when present.

If the source page contains the data but the schema cannot project it yet, do not call the endpoint cloud-ready. Repair the projection first or explicitly leave the endpoint unready.

If the site requires per-request signing (X's `x-client-transaction-id`, TikTok's `X-Bogus`) or per-session computed state (X's `animation_key`, TikTok's `msToken`), the schema needs a `runtime` block with `bootstrap_js` and/or `signer_js`. See [runtime.md](../runtime.md) for the contract and sandbox reference.

## Cloud-ready checklist

A pushed schema can be visible before it is verified. Cloud-ready means Hermai can fetch it in the production cloud and return useful projected JSON, without an operator manually pasting local browser state.

Before calling a schema production-ready:

- Run the endpoint against the live site and confirm HTTP success from a cloud-like environment, not just a local browser.
- Confirm the projected JSON includes the important business fields for the endpoint. Example: flight and hotel endpoints must include price/currency when the upstream response contains them.
- Confirm the request contract is exact: every `{placeholder}` in `url_template`, headers, query params, and body templates has a corresponding caller param or warm-pool token, and no required param is hidden only in prose.
- Seed a stable probe fixture for every probe-eligible endpoint. Today fixture rows live in `registry_endpoint_fixtures`, not in the schema JSON. Endpoints with no variables use `{}`; parameterized endpoints need at least one durable sample param set.
- For sites that require cookies, browser bootstrap, signed headers, or IP-bound sessions, confirm the resource policy, bootstrap recipe, and warm session/cookie pool exist. The schema's `session`/`runtime` blocks describe what is needed; they do not create warm resources by themselves.
- Rerun health verification and inspect failures. `no probe-eligible endpoints with fixtures` means fixture setup is missing, not necessarily that the site fetch is broken.
- If verification repairs projection fields, push the repaired schema as a new registry version. Do not silently mutate the original version except for explicitly allowed runtime metadata such as endpoint op-id refreshes.

The production smoke request shape is:

```bash
curl -sS -X POST https://fetch.hermai.ai/v1/fetch \
  -H 'Content-Type: application/json' \
  -d '{"site":"example.com","endpoint":"product_detail","params":{"slug":"stable-sample"}}' \
  | jq
```

Pass only the endpoint's declared params. Do not rely on local browser cookies or undeclared state unless the production resource layer is already configured to provide it.

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
