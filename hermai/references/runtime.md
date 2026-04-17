# Runtime: per-request signing and session bootstrap

Some sites will not return authenticated JSON unless the request carries a value their own JavaScript computed: X requires `x-client-transaction-id` derived from a per-page animation key, TikTok signs every XHR with `X-Bogus` and `_signature`, Xiaohongshu adds `X-s`/`X-t`. These values depend on the method, path, body, and per-session constants lifted from the site's bundle. A schema that only ships static headers cannot call those endpoints.

The `runtime` block moves that work client-side in a way the CLI can execute without a browser. JavaScript lives inside the schema. The CLI runs it in a goja sandbox. Adding a new anti-bot site is a schema push, not a CLI release.

See [schema-format.md](schema-format.md) for the surrounding fields, [sessions.md](sessions.md) for cookie storage, and [cli.md](cli.md) for the full command reference.

## Contents

- [1. What "runtime" means in a schema](#1-what-runtime-means-in-a-schema)
- [2. Path 1 vs Path 2](#2-path-1-vs-path-2)
- [3. The signer contract](#3-the-signer-contract)
- [4. The bootstrap contract](#4-the-bootstrap-contract)
- [5. The `hermai.*` sandbox](#5-the-hermai-sandbox)
- [6. `allowed_hosts`](#6-allowed_hosts)
- [7. The `hermai action` command](#7-the-hermai-action-command)
- [8. Triage](#8-triage)
- [9. What the runtime does NOT cover](#9-what-the-runtime-does-not-cover)
- [10. Canonical example: x.com](#10-canonical-example-xcom)

## 1. What "runtime" means in a schema

`runtime` is an optional top-level block on a schema:

```json
{
  "domain": "x.com",
  "actions": [ ... ],
  "runtime": {
    "bootstrap_js": "function bootstrap(input) { ... }",
    "signer_js":    "function sign(input) { ... }",
    "allowed_hosts": ["x.com", "abs.twimg.com"],
    "bootstrap_ttl_seconds": 3600
  }
}
```

All four fields are optional. A schema with just read endpoints against a cookie-authenticated site does not need `runtime` at all — the CLI attaches cookies and fires the request. Add `runtime` only when:

- The endpoint requires a per-request computed header or query parameter (`x-client-transaction-id`, `X-Bogus`, `X-s`). That's `signer_js`.
- The signer depends on per-session constants baked into the page (X's verification key, TikTok's `msToken`-adjacent values). That's `bootstrap_js` plus `allowed_hosts`.

If `runtime` is absent, the runner skips bootstrap and signing. If present with only `signer_js`, the runner calls `sign(input)` with an empty `state`.

## 2. Path 1 vs Path 2

Every site that requires per-request signing falls into one of two buckets. The choice determines how much maintenance the schema costs.

**Path 1 — reverse-engineer and port.** Find a clean community reimplementation of the algorithm (or reverse-engineer it yourself), rewrite in pure JavaScript, ship the 2-5 KB function in `signer_js`. Readable. Breaks only when the site changes the *algorithm* itself — quarterly at worst.

**Path 2 — capture and run.** Grab the site's own obfuscated signer from its bundle (typically a `webmssdk.js`-style chunk) and ship it verbatim in `signer_js`. No reverse engineering required, but the blob is 20 KB - 500 KB, variable names shift on every bundle deploy, and obfuscation rotates — so the schema breaks whenever the site ships. Not auditable.

| Axis                         | Path 1 (port)                       | Path 2 (capture)                    |
| ---------------------------- | ----------------------------------- | ----------------------------------- |
| Size                         | 2 - 5 KB                            | 20 KB - 500 KB                      |
| Break frequency              | Quarterly, on algorithm change      | Every bundle deploy                 |
| Auditable                    | Yes                                 | No                                  |
| Requires community reference | Yes                                 | No                                  |
| Works for                    | X (XClientTransaction), some TikTok | TikTok webmssdk VM, Xiaohongshu X-s |

Default to Path 1 for popular sites where a reference exists. Path 2 is the escape hatch for sites whose signer is a VM interpreter or otherwise opaque — you get correctness now at the cost of durability.

## 3. The signer contract

`signer_js` must define a global function named `sign` with this shape:

```js
function sign(input) {
  // input: { method, url, headers, body, cookies, state, now_ms }
  // returns: { url: string, headers: object }
}
```

### Input

- `method` — uppercase HTTP method.
- `url` — fully-rendered request URL including query string.
- `headers` — headers the CLI has already set from the action, as `{name: value}`. Multi-valued headers are joined with `, `.
- `body` — request body as a string, after `{{var}}` substitution. Empty string for bodyless requests.
- `cookies` — cookies scoped to the action's host, as `{name: value}`. No cross-domain leakage, no attributes.
- `state` — the flat `{key: value}` map the last bootstrap produced. Empty object when the schema has no `bootstrap_js`.
- `now_ms` — current wall-clock time in milliseconds. Injected rather than read via `Date.now()` so captured test vectors replay deterministically. Always use `input.now_ms`.

### Output

- `url` — the possibly-augmented request URL. Set this when the signer adds query parameters (TikTok's `X-Bogus`/`_signature`, Xiaohongshu's `X-s`/`X-t`). Empty string (or omitted) keeps the URL unchanged.
- `headers` — merge-onto-request map. Collisions with schema-supplied headers are overridden. `{}` or omitted means the signer adds nothing.

Returning `null`/`undefined`/object without either field is legal and means "no changes." A non-object (or non-object `headers`) raises `ErrSignerRuntime`.

The signer must be pure. No network, no filesystem, no timers. If you need per-session data, put it in `state` via bootstrap.

## 4. The bootstrap contract

`bootstrap_js` must define a global function named `bootstrap`:

```js
function bootstrap(input) {
  // input: reserved for future use, currently {}
  // returns: { key_b64: "...", animation_key: "...", ... }
}
```

`input` is reserved for future use; today it is always `{}`. The bootstrap runs on cold cache and produces a flat `{string: string}` state map; every key becomes a field on `input.state` for subsequent signer calls. Non-string values are coerced to strings by the host (a `Number` becomes its decimal form; a plain object becomes `[object Object]` — serialize before returning).

The return value must be a plain object. Primitives, arrays, and `null`/`undefined` raise `ErrSignerRuntime` so schema authors catch wrong-shape returns at bootstrap time rather than during the next signing call.

### TTL and caching

Bootstrap output is written to `~/.hermai/sessions/<site>/state.json` with a `saved_at` timestamp and TTL. On subsequent calls, if the file is younger than `bootstrap_ttl_seconds` (default 3600) the cached state is reused. Otherwise bootstrap re-runs automatically.

Sites with aggressive key rotation (TikTok's ~10 minute `msToken` window) should set a short TTL. X is comfortable with an hour.

### 401/403 auto-invalidation

When the action endpoint returns 401 or 403 AND the schema has `bootstrap_js`, the runner deletes `state.json`. The next call re-bootstraps. Rationale: we cannot tell from the response alone whether the cookies went stale or the bootstrap-derived state did, so we pick the self-correcting option. Cookies are not touched by this path — the user's browser session is the source of truth for those.

## 5. The `hermai.*` sandbox

Both `sign()` and `bootstrap()` execute in goja with a single injected global, `hermai`. There is no `document`, `window`, `navigator`, `crypto`, `TextEncoder`/`TextDecoder`, `atob`/`btoa`, `require`, `import`, `process`, or `setTimeout`/`setInterval`. Calls to any of those throw a reference error.

### Available in both signer and bootstrap

| Call                              | Returns                               | Notes                                                                      |
| --------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `hermai.sha256(str)`              | lowercase hex string                  | Hashes the UTF-8 bytes of `str`.                                           |
| `hermai.sha1(str)`                | lowercase hex string                  | Same.                                                                      |
| `hermai.hmacSha256(key, msg)`     | lowercase hex string                  | HMAC-SHA256 of `msg` under `key`, both as UTF-8 bytes.                     |
| `hermai.base64Encode(str)`        | standard base64, padded               | `+/` alphabet, `=` padding.                                                |
| `hermai.base64EncodeURL(str)`     | URL-safe base64, unpadded             | `-_` alphabet, no trailing `=`.                                            |
| `hermai.base64Decode(str)`        | string                                | Tries all four combinations of alphabet and padding. Throws on none match. |
| `hermai.hex(str)`                 | lowercase hex of `str`'s UTF-8 bytes  |                                                                            |
| `hermai.hexDecode(str)`           | string                                | Throws on odd-length or non-hex input.                                     |
| `hermai.randomHex(n)`             | hex string of `n` cryptorandom bytes  | `n` must be in `[1, 1024]`.                                                |

### Bootstrap only

- `hermai.fetch(url, opts)` — synchronous HTTP fetch from the VM's perspective (goja blocks while Go performs the I/O). Returns `{status, url, headers, body}` where `url` is the final URL after redirects, `headers` is `{lowercase_name: comma_joined_values}`, and `body` is a string. `opts` is optional: `{method, headers, body, follow_redirects}`, all optional. Policy:
  - Host must match one of `allowed_hosts`. Exact hostname, case-insensitive.
  - Only `http` and `https` schemes.
  - Redirects re-check the allowlist at the final URL; off-allowlist redirects fail before the body returns.
  - Private address space is always blocked regardless of allowlist: loopback (`127.0.0.0/8`, `::1`), RFC1918, link-local (`169.254/16` including cloud metadata at `169.254.169.254`), CGNAT (`100.64/10`), multicast, IPv6 ULA (`fc00::/7`). Re-resolved at policy-check time to defeat DNS rebinding.
  - Response bodies capped at 10 MB; larger raises `ErrResponseTooLarge`.
  - No cookies attached by default. Pass headers explicitly for authenticated bootstrap.

- `hermai.selectAll(html, cssSelector)` — parse `html` and return an array of element objects:

  ```js
  {
    tag: "meta",
    attrs: { name: "twitter-site-verification", content: "abc123" },
    text: "direct-child text only",
    textContent: "recursive descendant text",
    children: [ /* element-typed children only, no text nodes */ ]
  }
  ```

  `text` concatenates direct text-node children — useful for `<meta content="...">` where attrs are the real payload. `textContent` matches DOM semantics and walks every descendant text node (including `<script>` and `<style>`). `children` holds only element nodes.

### Deadlines

Signer runs under a 100 ms budget by default; bootstrap under 30 s. Both enforced via goja's `Interrupt` at bytecode boundaries — infinite loops raise `ErrSignerTimeout` instead of hanging. Production signers complete in under 5 ms; a bootstrap that fetches and parses the homepage is typically 200 ms - 2 s.

## 6. `allowed_hosts`

Required whenever `bootstrap_js` calls `hermai.fetch`. Missing or empty allowlist + a `fetch`-using bootstrap → every fetch fails with `ErrHostNotAllowed`.

- Exact hostname match, case-insensitive.
- No wildcards: subdomains must be listed explicitly (`x.com` does not cover `abs.twimg.com`).
- Checked on the requested URL AND the final URL after redirects.

Registry validation rejects a push that ships `bootstrap_js` with an empty `allowed_hosts`. See [contribute/actions.md](contribute/actions.md) for the push-time rules.

## 7. The `hermai action` command

```
hermai action <site> <action_name> [--arg key=value ...] [--schema file] [--dry-run] [--timeout 60s]
```

The runner does these steps, in order:

1. **Load the schema.** `--schema <file>` wins; otherwise `~/.hermai/schemas/<site>.json`. Neither present → error suggesting `hermai registry pull <site>`.
2. **Resolve cookies.** Reads `~/.hermai/sessions/<site>/cookies.json`. If missing, falls back to the user's installed browsers via kooky. First-run triggers the OS keychain prompt (Keychain / DPAPI / libsecret). Browser-sourced cookies are written to `cookies.json` for the subsequent fast path.
3. **Resolve state.** If `bootstrap_js` is present, read `state.json`. If missing or past TTL, compile and run `bootstrap_js` via the sandbox and persist the result.
4. **Build the request.** Render `url_template`, headers, and `body_template` with `{{var}}` substitution from `--arg` values. Body-template values are JSON-escaped so user input can't break out of surrounding strings.
5. **Run the signer.** If `signer_js` is present, compile (cached process-wide) and call `sign(input)` with the fully-built request, cookies, state, and `now_ms`. Merge returned headers onto the request (collisions override). Swap the URL if the signer returned a non-empty one.
6. **Fire the request** through the Chrome-TLS-fingerprinted HTTP client (tls-client, Chrome 146 profile by default).
7. **Rotate cookies** from `Set-Cookie` back to `cookies.json` — **only on 2xx/3xx responses**. On 4xx/5xx the runner does NOT save: X and other anti-bot sites deliberately return guest `Set-Cookie` on 401; saving those would overwrite the user's real `auth_token` and brick the session.
8. **Invalidate state** on 401/403 when `bootstrap_js` is present: delete `state.json` so the next call re-bootstraps. Cookies are not invalidated.

`--dry-run` skips step 6 and prints the fully-signed request instead, with cookies and `Authorization` redacted. Fastest way to iterate on a schema: edit the JSON, re-run with `--dry-run`, compare to a captured XHR in devtools.

## 8. Triage

| Symptom                                     | Likely cause                                                     | Fix                                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP 401 on every action                   | Static bearer rotated                                             | Re-capture from the site's main bundle. For X: `curl https://x.com | grep -oE 'main\.[a-f0-9]+' | head -1`, then grep that JS for the `AAAA…` bearer pattern. Update `headers.Authorization`. |
| HTTP 401 on writes, reads work             | Signer algorithm drift                                            | Diff your `signer_js` against the community reference (for X, `iSarabjitDhiman/XClientTransaction`). If the reference updated, port the change. If it hasn't, the site shipped new — fall back to Path 2. |
| HTTP 422 on a GraphQL endpoint             | Body shape drift                                                  | Re-capture with `hermai intercept --headful --session <site>` and update `body_template`. |
| HTTP 404 on a known-good endpoint          | Operation hash rotated (common for X GraphQL)                     | Open the site in a real browser, trigger the action, copy the new query ID from the XHR URL into the schema. |
| HTTP 429                                   | Rate limit                                                        | Back off. Add jitter between calls. |
| HTTP 403                                   | Session lock OR action-specific block                             | User re-verifies in their real browser. If the action still 403s after verification, the cookies are blessed for browsing but not for this endpoint — capture a fresh XHR and compare headers. |
| `ErrSignerTimeout`                         | Signer hit the 100 ms budget                                      | Real infinite loop, or algorithm got heavier than 100 ms (rare). Profile locally. |
| `ErrHostNotAllowed`                        | Bootstrap tried to fetch a host not in `allowed_hosts`            | Add the host. No wildcards. |
| `ErrPrivateAddressBlocked`                 | Bootstrap target resolves to RFC1918 / loopback / cloud metadata  | Intentional — the sandbox refuses to probe internal networks. |
| Signer works in `--dry-run`, fails in prod | Headers the HTTP client adds after signing (`Accept-Encoding`, `Content-Length`, `Host`) | Signers that hash across all headers must exclude those or assume tls-client's defaults. |

## 9. What the runtime does NOT cover

The goja sandbox is deliberately narrower than a real browser. Several classes of anti-bot defenses cannot be handled by `runtime`:

- **Canvas / WebGL / audio fingerprinting.** PerimeterX / HUMAN probe WebGL renderer strings, canvas rendering nuances, audio stack timing. Stubbing those convincingly from a JS sandbox is not tractable. Use `hermai session bootstrap --headful` to drive local Chrome for the initial cookie grant, then fall back to the normal runtime flow. Hosted headful bootstrap is scoped for Phase 2 and not yet available.
- **Turnstile / hCaptcha / reCAPTCHA.** Interactive by design. The user solves the challenge in their own browser once, then `hermai session import <site>` pulls fresh cookies.
- **Login with 2FA.** Schemas are not the place for passwords or TOTP. The user's browser session is the source of truth; the runtime only proxies it.

If you find yourself trying to emulate `navigator.userAgent` in bootstrap JS to pass a fingerprint check, stop — that's the browser's job.

## 10. Canonical example: x.com

x.com ships a Path-1 signer (ported from `iSarabjitDhiman/XClientTransaction`) and a Path-1 bootstrap (pure-JS port of the SVG-path + cubic-bezier `animation_key` math). Both run in the goja sandbox.

- `signer_js` reads the verification key and animation key from `input.state`, computes `x-client-transaction-id` from method + path + current-minute timestamp + body-dependent hash, and returns it as a header.
- `bootstrap_js` fetches `https://x.com`, extracts the verification `<meta>` from the home HTML, derives the on-demand chunk name, fetches that chunk, parses SVG path data, runs the cubic-bezier math, and returns `{key_b64, animation_key}`. Allowlist: `["x.com", "abs.twimg.com"]`. TTL: 3600 s.

To read the runtime in situ: `hermai registry pull x.com` and open `~/.hermai/schemas/x.com.json`.
