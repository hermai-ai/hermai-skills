# Discovering and Documenting Actions (Writes)

Hermai's vision is the **interaction layer** for agents — not just data extraction. Actions (POST/PUT/DELETE) are first-class. A schema with only read endpoints is incomplete.

## Contents

- [Why this is harder than reads](#why-this-is-harder-than-reads)
- [The production path: capture the body, don't guess it](#the-production-path-capture-the-body-dont-guess-it)
- [When the write needs per-request signing](#when-the-write-needs-per-request-signing)
- [The CSRF token problem](#the-csrf-token-problem)
- [The authenticated session problem](#the-authenticated-session-problem)
- [Credential placeholders](#credential-placeholders)
- [Idempotency](#idempotency)
- [Testing a write schema](#testing-a-write-schema)
- [Bearer rotation](#bearer-rotation)
- [What's out of scope](#whats-out-of-scope)
- [Known gap](#known-gap)

## Why this is harder than reads

Read endpoints are idempotent and stateless — point the agent at the URL, get data, done. Writes are different:

- **Authenticated**: most writes require a logged-in session (login → cookies → subsequent POSTs)
- **CSRF-protected**: the site embeds a one-time token in a GET response that the POST must echo back
- **Stateful**: cart IDs, session tokens, idempotency keys change per user
- **Multi-step**: checkout = address → shipping → payment → confirm, each depending on the previous
- **Rate-limited**: "post once per minute" isn't schema material, it's client behavior
- **Signed**: a growing share of modern sites (X, TikTok, Xiaohongshu) gate every write behind a JavaScript-derived header or query parameter
- **Risky**: accidentally running a checkout action could place a real order. Handle with care.

## The production path: capture the body, don't guess it

The fastest way to get a write endpoint wrong is to infer the body shape from the UI. The fastest way to get it right is to capture the real request and paste the JSON into `body_template`.

```bash
# 1. Open a headful browser with your logged-in session attached.
hermai intercept --headful --session x.com https://x.com/compose/post

# 2. Perform the action in the UI (type a tweet, click Post/Draft).

# 3. Intercept dumps every XHR with the full request body.
```

The captured JSON is the body the server expects. Take it **verbatim** and paste it into the action's `body_template`, replacing user-varying values with `{{var}}` placeholders. The CLI JSON-escapes substituted values, so user input can't break out of the surrounding string.

### Example: X CreateDraftTweet

What the browser sends when you click "Save as draft":

```json
{
  "variables": {
    "post_tweet_request": {
      "status": "first draft",
      "draft": true
    }
  },
  "queryId": "aQmR9dqXy8hQm7kYb3pYyw"
}
```

What the schema should carry:

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

Three things to notice:

1. The user-supplied field is named **`status`**, not `tweet_text` or `content` or anything an HTTP API designer would have chosen. That's the whole reason you capture rather than guess — the lesson of X's CreateDraftTweet is that one field name, missed, means 422 errors the whole way down. Read [schema-format.md](../schema-format.md) on `body_template` if you need the verbatim spec.
2. The constant fields (`draft: true`, `variables.post_tweet_request` wrapper) stay in the template as literal JSON. Don't try to flatten them — the server rejects unfamiliar shapes.
3. When `body_template` is absent, the runner falls back to JSON-marshaling every `Param` with `in="body"` into a flat object. That's fine for the handful of REST APIs that accept flat bodies; it's wrong for every GraphQL endpoint. Prefer `body_template` for anything you captured.

### How `{{var}}` substitution escapes

Given `text = hello "world"` and the template above, the rendered body is:

```json
{"variables":{"post_tweet_request":{"status":"hello \"world\"","draft":true}},"queryId":"aQmR9dqXy8hQm7kYb3pYyw"}
```

Quotes, backslashes, control characters, and Unicode outside ASCII are all JSON-escaped before substitution. Write templates as if `{{text}}` were a placeholder inside a double-quoted JSON string (because that's where it usually lives) — the CLI makes that safe even when the user's input contains quotes or newlines.

## When the write needs per-request signing

X (Twitter) stamps `x-client-transaction-id`. TikTok appends `X-Bogus` and `msToken`. Xiaohongshu adds `X-s`, `X-t`, and `X-mns`. Each of these is computed by site-loaded JavaScript and changes per request — which means no amount of captured body matters if the headers on the way out are stale.

Schemas for these sites need a top-level `runtime` block carrying the `signer_js` (and often a `bootstrap_js` that caches keys the signer reads). The JS runs in the CLI's goja sandbox; `allowed_hosts` pins which hostnames bootstrap may fetch. Full contract, path-1 vs path-2 tradeoffs, and signer/bootstrap I/O shape live in [runtime.md](../runtime.md).

The rule of thumb: if you captured a request body and the replay gets 401 while an identical request from the live browser succeeds, the difference is in the headers, and you probably need `signer_js`. Don't try to inline the signing logic into `body_template` — it rotates too fast and the body doesn't carry enough context for the algorithm anyway.

## The CSRF token problem

Most write forms embed a token in the page that the POST must echo. Captured once, the token is used once. The schema needs to describe this dance:

```json
{
  "actions": [
    {
      "name": "submit_review",
      "method": "POST",
      "url_template": "https://example.com/products/{{id}}/reviews",
      "description": "Submit a review. Requires CSRF token from product page.",
      "params": [
        {"name": "id", "in": "path"},
        {"name": "rating", "in": "form", "type": "number"},
        {"name": "text", "in": "form", "type": "string"},
        {"name": "_token", "in": "form", "type": "csrf_token",
         "source": {"from_endpoint": "product_detail", "selector": "meta[name=csrf-token]", "attribute": "content"}}
      ]
    }
  ]
}
```

The agent runs `product_detail` first, extracts the CSRF token, then submits the form. The schema documents the dependency. This pattern coexists with `body_template` cleanly — the template declares the body shape, the `params` source declares how to populate the placeholder.

## The authenticated session problem

Writes usually require a logged-in session. The schema's `session` block (see [sessions.md](../sessions.md)) already documents how to warm a browser. For writes specifically:

1. Use `hermai session bootstrap <site>` to capture cookies
2. The cookies persist in `~/.hermai/sessions/<site>/cookies.json`
3. Subsequent action calls include these cookies

If the site requires username/password login (not just a browser warm-up), the session bootstrap needs credential parameterization — this is a known gap, see below.

## Credential placeholders

Never hardcode credentials in the schema. Captured requests will have the real password. Sanitize:

```json
// BAD — captured as-is, leaks the user's password
{"body": "{\"email\":\"real@email.com\",\"password\":\"actualpass\"}"}

// GOOD — parameterized
{"body_template": "{\"email\":\"{{email}}\",\"password\":\"{{password}}\"}",
 "params": [
   {"name": "email", "type": "credential", "in": "body"},
   {"name": "password", "type": "credential", "sensitive": true, "in": "body"}
 ]}
```

The same rule applies when you paste a captured body: search it for real email addresses, phone numbers, API tokens, and names before pushing. The validator rejects raw `proxy_credentials`, `clearance_cookies`, and a small set of other fields, but it does NOT catch a leaked password buried inside `body_template`. That's on you.

## Idempotency

Some write actions (payment, order placement) should not be replayed. Mark them:

```json
{
  "name": "place_order",
  "method": "POST",
  "idempotent": false,
  "warning": "Places a real order. Requires explicit user confirmation before calling."
}
```

The caller is responsible for the UX ("are you sure you want to buy this?"), but the schema surfaces the risk.

## Testing a write schema

The CLI has two modes that matter for writes:

```bash
# Dry-run: render the fully-signed request and print it, but don't fire.
hermai action x.com create_draft_tweet --arg text="hello from hermai" --dry-run

# Live: fire the request and print the response.
hermai action x.com create_draft_tweet --arg text="hello from hermai"
```

Use `--dry-run` first on every change. It runs the signer, performs `{{var}}` substitution, and shows the exact bytes that would hit the wire. Visually diff the captured browser request against the dry-run output before you fire live.

Pick a **safe action** for live testing. On X, `CreateDraftTweet` saves to your drafts folder (which you can delete) and is much safer than `CreateTweet`, which posts publicly and shows in followers' timelines within seconds. On commerce sites, `add_to_cart` is safer than `place_order`. On social sites, a private account or a draft mode beats posting.

### Common failure modes and what they mean

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| HTTP 401 | Bearer token missing, wrong, or rotated | Recapture the bearer (see below) |
| HTTP 401 only on writes, reads work | Per-request signer drift — the signer is outputting a header the server no longer accepts | Re-capture via `hermai intercept --headful --session <site>` and diff against your `signer_js` output |
| HTTP 422 | Body shape wrong — missing or extra field | Re-capture the body, paste verbatim into `body_template`, replace only the user-varying fields with `{{var}}` |
| HTTP 404 | Operation hash (GraphQL op id, API version tag) rotated | Pull a fresh `main.<hash>.js` from the site and extract the new operation hash; see the bearer-rotation command pattern below for the same approach |
| HTTP 403 | Session locked, user must re-verify in the browser, or session cookies got overwritten | `rm -rf ~/.hermai/sessions/<site>` and re-bootstrap |
| HTTP 429 | Rate limited | Back off; writes almost always have stricter limits than reads |

More symptoms, plus non-HTTP failures (signer timeouts, host-allowlist violations), live in [troubleshooting.md](troubleshooting.md).

## Bearer rotation

Hardcoded bearers **do rotate**. X's web bearer `AAAAAAAAAAAA...` is embedded in the site's main JS bundle, and that bundle gets a new hash every few months. When writes start returning 401 everywhere and the signer output is otherwise identical to a fresh browser capture, the bearer has rotated.

Here's the exact re-capture sequence:

```bash
# 1. Find the current main.js hash from the live HTML.
curl -s https://x.com | grep -oE 'main\.[a-f0-9]+a\.js' | head -1

# 2. Fetch that bundle and extract the bearer.
curl -s https://abs.twimg.com/responsive-web/client-web/main.<hash>.js | grep -oE 'AAAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%]{40,}' | head -1
```

Paste the resulting bearer into the schema's `headers.Authorization` (or wherever your schema stores it). Same pattern works for any site that embeds a long-lived bearer in a JS bundle — find the bundle reference in the HTML, grep the bundle for the bearer shape.

Bearer rotation is one of the two failure modes you'll hit repeatedly over the lifetime of a schema. The other is operation hash rotation (GraphQL `queryId` / `x-client-transaction-id`-style opaque strings). Both re-capture identically: find the bundle, grep the bundle.

## What's out of scope

Don't document:

- OAuth flows that require browser redirects (session block instead)
- 2FA / SMS challenges (human intervention needed)
- CAPTCHA-gated actions (same)
- Payment card entry (PCI scope — payment processor integrates differently)

List these in the schema description so callers know what the schema covers:

```json
{
  "description": "SCC Toys shop. Covers catalog, product detail, cart. Checkout is out of scope (requires payment card entry)."
}
```

## Known gap

Credential parameterization and CSRF token refresh still require hand-editing of captured bodies. Sanitize every captured request before you paste it into `body_template`. A future `hermai capture` command will automate the sanitization pass.

What IS covered now:

- `hermai action <site> <action> --arg key=value --dry-run` prints the fully-signed, body-substituted request without firing. Use this on every edit to confirm the template and signer are behaving.
- `hermai action ... ` (without `--dry-run`) fires the request and shows the response — use this for end-to-end smoke tests against a safe action.
- `hermai intercept --headful --session <site>` captures live XHR bodies, including ones that need a logged-in session.

See [../cli.md](../cli.md) for the full command reference.
