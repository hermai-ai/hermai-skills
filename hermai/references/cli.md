# Hermai CLI — Complete Command Reference

The `hermai` CLI is the local half of Hermai: it talks to the hosted registry over HTTPS and runs probe/browser/HTTP logic locally. Everything site-specific lives in schema JSON — the CLI has no hardcoded per-site knowledge.

This page documents every command shipped by the binary. See [schema-format.md](schema-format.md) for the schema shape, [sessions.md](sessions.md) for session handling, [runtime.md](runtime.md) for the executable glue inside a schema, and [contribute/overview.md](contribute/overview.md) for the schema-authoring flow.

## Install

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

Verify with `hermai --version`. Run `hermai doctor` to check that the LLM endpoint, browser, and cache directory all look right.

## Authenticate

```bash
hermai registry login
```

Paste the `hm_sk_…` key from https://hermai.ai/dashboard. The key is written to `~/.hermai/config.yaml` with mode 0600. You can also write it by hand:

```bash
mkdir -p ~/.hermai && chmod 700 ~/.hermai
echo "platform_key: hm_sk_YOUR_KEY" > ~/.hermai/config.yaml
chmod 600 ~/.hermai/config.yaml
```

## Discovery commands

These run against live websites to figure out what APIs exist. None require a platform API key. Authors use them to reverse-engineer a site; consumers rarely need them unless debugging a miss.

### `hermai detect <url>`

Reports anti-bot systems (Cloudflare, DataDome, PerimeterX, Akamai, AWS WAF, Imperva, TikTok's `byted_acrawler`), platform signals (`script_hosts`, `preconnect_hosts`, `meta_generator`, `x-powered-by`), and blocking indicators (`status:403/429/503`, small body).

Flags: `--stealth`, `--proxy <url>`, `--timeout <dur>` (default `10s`), `-k/--insecure`, `--format json|compact`.

```bash
hermai detect https://www.booking.com
hermai detect --stealth https://www.tiktok.com
```

### `hermai wellknown <domain>`

Probes standard paths in parallel (5 at a time): `/robots.txt`, `/sitemap.xml`, `/feed`, `/atom.xml`, `/.well-known/openid-configuration`, `/graphql`, `/api/graphql`, `/oembed`, `/wp-json/wp/v2/posts?per_page=1`, `/api`, `/api/v1`, `/.json`. Returns status, content-type, size per path. A 400/405 on `/graphql` often still means it exists; the agent decides.

Flags: `--stealth`, `--proxy`, `--timeout` (default `15s`), `-k`, `--format`.

```bash
hermai wellknown example.com
hermai wellknown --stealth youtube.com
```

### `hermai probe <url>`

TLS-fingerprinted fetch with anti-bot detection and inline discovery of direct JSON endpoints. Returns response metadata, candidate schemas, and the best-scoring one. Auto-retries with Chrome TLS + stealth headers on a block and sets `stealth_required: true` so future fetches skip the first attempt.

Flags:
- `--body` — stream raw HTML to stdout (use for `| hermai extract`)
- `--stealth` — force Chrome TLS fingerprinting on the first attempt
- `--proxy <url>` — `http://` or `socks5://`
- `--save <file>` — write HTML body alongside the JSON probe result
- `--format json|compact`
- `--timeout <dur>` — default `10s`
- `-k/--insecure` — skip TLS verification

```bash
hermai probe https://www.youtube.com/watch?v=dQw4w9WgXcQ
hermai probe --body https://example.com | hermai extract
hermai probe --stealth https://www.amazon.com/dp/B0CX23V2ZK
hermai probe --save page.html https://example.com
```

### `hermai extract [file]`

Scans HTML (from a file or stdin) for embedded data: `__NEXT_DATA__`, JSON-LD, `ytInitialData`, TikTok hydration, Open Graph, meta, forms. Deterministic, no network. `__NEXT_DATA__` is preferred over JSON-LD when both are present.

Flags:
- `--pattern <name>` — extract only a specific pattern (e.g. `ytInitialData`)
- `--list-patterns` — print every known pattern name and exit
- `--url <base>` — base URL for resolving relative links in the output
- `--format json|compact`

```bash
hermai extract page.html
curl -s https://example.com | hermai extract
hermai extract --pattern ytInitialData page.html
hermai extract --list-patterns
```

### `hermai introspect <url>`

Sends a GraphQL introspection query (`POST` JSON) and returns query/mutation types, user types, and field counts. `--full` adds built-in `__` types plus argument/description metadata.

Flags: `--stealth`, `--proxy`, `--timeout` (default `10s`), `-k`, `--full`, `--format`.

```bash
hermai introspect https://api.example.com/graphql
hermai introspect --full https://countries.trevorblades.com/graphql
```

### `hermai intercept <url>`

Launches a browser, navigates, captures every XHR/fetch request. Returns a filtered HAR (analytics noise removed) plus `replay_specs` ready to pipe to `hermai replay`. Primary tool for authenticated write-endpoint discovery: pair `--headful --session <site>` so the visible window opens already-logged-in and you can click "save draft" / "add to cart" while capture runs.

Flags:
- `--browser-path <path>` — override configured Chrome/Chromium binary
- `--timeout <dur>` — capture window (default `15s`)
- `--wait <dur>` — extra wait after page load (default from config)
- `--cookie name=value` — repeatable; injected before navigation
- `--raw` — include full HAR entries without filtering
- `--format json|compact`
- `--headful` — launch a visible window so you can drive interactions
- `--session <site>` — inject cookies from `~/.hermai/sessions/<site>/cookies.json` so the browser opens already-logged-in

```bash
hermai intercept https://www.booking.com/hotel/us/example.html
hermai intercept --wait 10s https://www.tiktok.com/@user
hermai intercept --cookie "session=abc123" https://example.com
# Primary flow for authenticated writes — no relogin needed:
hermai intercept --headful --session x.com https://x.com/compose/post
```

### `hermai replay <request.json>`

Reads a JSON request spec (`{method, url, headers, body}`) and fires it with optional Chrome TLS fingerprinting. The `replay_specs` from `hermai intercept` are ready to pipe in. If a captured call works standalone, it's a schema candidate.

Flags: `--stealth`, `--proxy`, `--timeout` (default `10s`), `-k`, `--body` (raw response body only), `--format`. The file argument may be `-` to read from stdin.

```bash
hermai replay request.json
hermai replay --stealth request.json
echo '{"method":"GET","url":"https://api.example.com/data"}' | hermai replay -
```

### `hermai discover <url>`

Runs the full engine — probe, browser capture, LLM analysis — against one URL. Expensive (10-60 s). Writes the discovered schema to cache; the JSON catalog can be pushed with `hermai registry push`.

Flags: `--no-cache`, `--proxy`, `--browser-path`, `--cache-ttl` (e.g. `7d`, `30d`), `--model <name>`, `--timeout`, `--no-browser` (probe + LLM only), `-k`, `-v/--verbose`, `--format`.

```bash
hermai discover https://amazon.com/dp/B09V3KXJPB
hermai discover https://news.ycombinator.com
```

## Sessions

Cookie bootstrap for anti-bot sites. All three write the same shape to `~/.hermai/sessions/<site>/cookies.json`. See [sessions.md](sessions.md) for the full fallback ladder.

### `hermai session bootstrap <site>`

Pulls the schema's `session` block, launches stealth Chrome, navigates to `bootstrap_url`, waits up to `--timeout` for every cookie in `required_cookies`, and writes the jar.

Flags: `--browser-path <path>`, `--headful`, `--timeout <dur>` (default `45s`).

### `hermai session import <site>`

Reads cookies for `<site>` from installed browsers (Chrome, Firefox, Safari, Edge, Brave, Chromium, Opera, Vivaldi) and writes the same shape as `bootstrap`. First run triggers an OS keychain prompt; only cookies scoped to `<site>` are read. Recommended first move — if the user is already logged in, no relogin is needed.

Flags: `--browsers <list>` (comma-separated), `--timeout <dur>` (default `30s`), `--dry-run` (print cookie names, don't save values).

### `hermai session status <site>`

Shows the saved session: site, domain, timestamp, cookie count, and which required cookies (per the original schema) are still present.

### `hermai session list`

Table of every session on disk with cookie counts and required-cookie status.

## Action dispatch

### `hermai action <site> <action>`

Schema-driven call to an authenticated endpoint. Loads the schema, resolves session state via `runtime.bootstrap_js` when needed, runs `runtime.signer_js` for per-request headers (`x-client-transaction-id`, TikTok's `X-Bogus`), fires a Chrome-TLS-fingerprinted HTTP request, and rotates `Set-Cookie` values back into the session file. The CLI has no per-site knowledge — it all lives in the schema.

Flags:
- `--arg key=value` — repeatable; fills placeholders. Value may contain `=`; only the first one splits.
- `--schema <file>` — local schema JSON; overrides the cache lookup.
- `--timeout <dur>` — deadline for session resolve + sign + HTTP (default `60s`).
- `--dry-run` — print the signed request (cookies / auth headers redacted) without hitting the network.

Schema path resolution: (1) `--schema <file>` if passed, else (2) `~/.hermai/schemas/<site>.json` from the registry cache, else error with both paths listed.

```bash
hermai action x.com CreateDraftTweet --arg text="drafted by hermai"
hermai action x.com CreateTweet --arg text="hi" --dry-run
hermai action x.com GetProfile --schema ./schemas/x.com.json
```

See [runtime.md](runtime.md) for what `bootstrap_js` / `signer_js` can do, and [contribute/actions.md](contribute/actions.md) for authoring new actions.

## Registry

### `hermai registry login`

Interactive paste of an `hm_sk_…` key; writes to `~/.hermai/config.yaml`.

### `hermai registry list`

Lists public schemas in the registry. Free-text search and category filter are both server-side.

Flags: `--category <name>`, `-q/--query <text>`, `--sort trending|recently_verified|recent`.

```bash
hermai registry list --query airbnb
hermai registry list --category flights --sort trending
```

### `hermai registry pull <site>`

Downloads a schema package to `./<site>.schema.json` (or `-o` path). `--intent` is required: natural-language explanation of why the schema is being requested. Sent via `X-Hermai-Intent` header (not query string) to avoid access-log leakage.

Flags: `--intent "..."` (required), `--version <hash>`, `-o/--out <path>`.

```bash
hermai registry pull airbnb.com \
  --intent "planning a Tokyo family trip May 1-5, 3 adults 2 kids, ~\$200/night"
```

### `hermai registry push <schema-file>`

Uploads a schema. Returns the version hash; re-pushing identical content is a no-op. Rejected schemas cite validation errors — see [sessions.md](sessions.md) and [contribute/platforms.md](contribute/platforms.md).

## Local cache and introspection

### `hermai catalog <url>`

Instant. Shows cached endpoints/actions without running the engine or network. Hints at `hermai registry pull` or `hermai discover` if nothing is cached. Flag: `--format`.

### `hermai schema <url>`

Prints the full cached schema JSON. Use it to eyeball what drives `action` / `fetch`.

### `hermai cache list`

Lists domains in the local schema cache with counts.

### `hermai cache clear [domain]`

Clears one domain or the whole cache. Path-traversal protected.

### `hermai init`

Interactive setup: writes `~/.hermai/config.yaml` with LLM base URL, API key, model, optional proxy. Only needed for the LLM-backed commands (`fetch`, `discover`).

### `hermai doctor`

Sanity checks: config file, config validation, API key, LLM endpoint, model, cache directory writable, browser binary or CDP endpoint. Prints `[OK]`/`[WARN]`/`[FAIL]` per check.

### `hermai fetch <url> [question]` (legacy)

"Fetch once, query many" mode, predates the registry. Runs discovery and returns JSON; with a second argument, runs an LLM "ask" against the fetched data. Kept for backward compatibility — new callers should prefer `hermai action` or `hermai probe` + `hermai extract`.

Flags: `--raw`, `-p/--pipe`, `-q/--query <jq>`, `--proxy`, `--browser-path`, `--cache-ttl`, `--model`, `--classify-model`, `--timeout`, `--no-browser`, `--no-cache`, `-k`, `-v`, `--format`, `--cookie name=value` (repeatable).

Exit codes: `0` success, `1` general error, `2` auth required (re-run with `--cookie` or `hermai session bootstrap`), `3` LLM analysis failed.

## Phase-2 commands (gated)

Compiled in but hidden unless `HERMAI_PHASE2=1` is set.

### `hermai execute <url> <action>`

Calls a catalog action via the action runner. Auto-stealth if the cached schema has `requires_stealth: true`; LLM-backed fallback discovery if the action isn't cached yet. Superseded by `hermai action` for schema-driven dispatch; retained for the older catalog flow.

Flags: `--proxy`, `--browser-path`, `--model`, `--timeout`, `--no-browser`, `-k`, `--stealth`, `-v`, `--format`, `--param key=value` (repeatable).

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | general error |
| 2 | auth required — try `--cookie` or `hermai session bootstrap` |
| 3 | LLM analysis failed |

## Cross-references

- [sessions.md](sessions.md) — bootstrap ladder, cookie rotation, the `session` block
- [runtime.md](runtime.md) — `bootstrap_js` / `signer_js` semantics
- [schema-format.md](schema-format.md) — schema JSON shape for authors
- [api.md](api.md) — the HTTP API behind `hermai registry`
- [contribute/overview.md](contribute/overview.md) — schema-authoring flow end to end
- [contribute/platforms.md](contribute/platforms.md) — per-platform conventions and forbidden patterns
- [contribute/actions.md](contribute/actions.md) — writing new actions for `hermai action`
- [contribute/troubleshooting.md](contribute/troubleshooting.md) — common push rejections and runtime errors
