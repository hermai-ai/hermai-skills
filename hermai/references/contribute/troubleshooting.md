# Troubleshooting

Two classes of error show up when working on a schema: **push-side validator errors** (the API rejected a push because the schema itself is malformed or policy-violating) and **call-time runtime errors** (the schema pushed, but `hermai action` or `hermai fetch` can't successfully talk to the site). They need different diagnostic moves.

## Push-side validator errors

When `hermai registry push` fails, the API returns a code. Each is a specific sentinel — no string parsing required.

| Code | Meaning | Fix |
|------|---------|-----|
| `UNAUTHORIZED` | Missing or invalid API key | Run `hermai registry login`, or check `~/.hermai/config.yaml` |
| `MISSING_FIELD` | Required top-level or per-endpoint field is missing | Check `site`, `intent_category`, `schema_format_version`, or per-endpoint `name`/`method`/`url_template` |
| `UNKNOWN_CATEGORY` | `intent_category` isn't in the taxonomy | See [schema-format.md](../schema-format.md) for the canonical list |
| `FORBIDDEN_FIELD` | A disallowed key is present anywhere in the document | See [../sessions.md](../sessions.md) — usually cookie values instead of names, or raw proxy credentials |
| `FORBIDDEN_NAME` | Schema or endpoint name hits the anti-evasion pattern | See [../sessions.md](../sessions.md) — remove words like `bypass`, `circumvent`, `cf-clearance` |
| `INVALID_SCHEMA_VERSION` | `schema_format_version` is not `"0.1"` | Set it to exactly `"0.1"` |
| `PURPOSE_REQUIRED` | An endpoint has no `purpose` string (public-card blurb) | Add a one-sentence, user-voice `purpose` to each endpoint. If your pushed schema pre-dates this check, the validator will surface it on the next push |

### Runtime block errors

These fire when the schema carries a `runtime` block but the block itself is malformed. See [../runtime.md](../runtime.md) for the full contract.

| Code | Meaning | Fix |
|------|---------|-----|
| `SCHEMA_RUNTIME_INVALID` | `runtime` is present but the wrong shape (not an object, or `allowed_hosts[i]` is not a non-empty string) | Check the JSON shape; `runtime` must be an object with string values |
| `SCHEMA_RUNTIME_EMPTY` | Both `bootstrap_js` and `signer_js` are empty or missing | Delete the block. An empty runtime block signals "signing required" to agents that then stall. If you genuinely need neither, omit the block |
| `SCHEMA_RUNTIME_ALLOWED_HOSTS_MISSING` | `bootstrap_js` is present, but `allowed_hosts` is empty or missing | Add `allowed_hosts` listing the hosts bootstrap's `hermai.fetch` may reach. The list is exact-match on hostname. Example: `["x.com", "abs.twimg.com"]` |
| `SCHEMA_RUNTIME_SOURCE_TOO_LARGE` | A JS source exceeds 1 MiB | Minify before pushing, or switch from a captured path-2 blob to a hand-ported path-1 signer. 1 MiB is the hard limit per JS source (not combined) |
| `SCHEMA_RUNTIME_TTL_INVALID` | `bootstrap_ttl_seconds` is not a non-negative integer | Use a positive integer, or omit it (the CLI default is 3600) |

## Call-time runtime errors

These happen when the schema is accepted by the registry but the CLI can't successfully call the site. The errors are not validator codes; they surface on stderr or as HTTP status codes from `hermai action` / `hermai fetch`.

### HTTP 401 everywhere

Bearer rotated. Sites like X embed a long-lived bearer in the main JS bundle, and the bundle gets a new hash every few months. Recapture:

```bash
curl -s https://x.com | grep -oE 'main\.[a-f0-9]+a\.js' | head -1
# then
curl -s https://abs.twimg.com/responsive-web/client-web/main.<hash>.js | grep -oE 'AAAAAAAAAAAAAAAAAAAAA[A-Za-z0-9%]{40,}' | head -1
```

Paste the new bearer into the schema and push a new version.

### HTTP 401 only on writes

Signer drift. Reads work, writes 401. The algorithm in `signer_js` has fallen behind what the site expects — usually because the site rotated the operation hash or added a new field to the transaction-id calculation. Revisit the community reference you ported from (if path 1) or swap to path 2 (ship the captured signer blob verbatim). [../runtime.md](../runtime.md) has the path-1 vs path-2 guidance.

### HTTP 422 on a GraphQL body

Body shape wrong. The server is parsing JSON successfully but rejecting the shape — a missing field, a renamed field, or a type mismatch. Re-capture via `hermai intercept --headful --session <site>` and diff the captured body against your `body_template`. See [actions.md](actions.md) for the verbatim-capture flow.

### HTTP 404 on the operation URL

Operation hash rotated. GraphQL endpoints like X's `https://x.com/i/api/graphql/{op_hash}/CreateTweet` carry an opaque hash that changes when the server-side resolver version bumps. Open the live site in a headful browser, watch the XHR in devtools, grab the new hash, update `url_template`. This rotates faster than bearers — expect to do it a few times per year per site.

### HTTP 403

Three different causes, diagnose in order:

1. **Session locked** — the site flagged your session and wants the user to re-verify (CAPTCHA, SMS code, email challenge). There's no CLI fix; have the user complete the challenge in their browser, then bootstrap a fresh session.
2. **Guest cookies overwrote the real session**. Some sites return `Set-Cookie` headers with guest tokens on 4xx responses; old CLI versions applied these overwrites and corrupted the logged-in session. Current CLI versions skip cookie rotation on 4xx, so new sessions are safe — but session files created with older CLI versions may still be contaminated. `rm -rf ~/.hermai/sessions/<site>` and re-import a fresh session.
3. **Cloudflare / DataDome block** — the bootstrap flow in the session block isn't producing the right clearance cookies. See [../sessions.md](../sessions.md).

### HTTP 429

Rate limit. Add jitter between calls. Writes are usually more aggressively limited than reads; for social sites especially, "one action per minute" is a reasonable default even when the site doesn't document a rate limit.

### `ErrSignerTimeout` (CLI log)

The signer took longer than 100 ms. Almost always an infinite loop in `signer_js` — unguarded `while` loops or recursion with no termination. Run the signer in isolation with `hermai action <site> <op> --dry-run` and check the stack if the error repeats.

### `ErrHostNotAllowed` (CLI log)

`bootstrap_js` tried to `hermai.fetch` a hostname that isn't in `runtime.allowed_hosts`. Two fixes:

- If the host is legitimate (the bootstrap needs to pull a JS bundle or call a login endpoint), add it to `allowed_hosts`.
- If the host looks wrong (an ad tracker, an unrelated CDN), the bootstrap is doing something it shouldn't — tighten the JS instead of widening the allowlist.

`allowed_hosts` is exact-match on hostname, case-insensitive. `abs.twimg.com` does NOT match `twimg.com`; list each subdomain separately.

### `ErrPrivateAddressBlocked` (CLI log)

`bootstrap_js` tried to fetch an RFC1918 address (10/8, 172.16/12, 192.168/16), loopback, link-local, or a cloud metadata service (169.254.169.254). The SSRF guard is unconditional — you can't bypass it by adding the host to `allowed_hosts`. This is almost always a schema bug: a leftover dev URL, a hardcoded `localhost`, or a bootstrap that tried to introspect the CLI's network. Fix the JS.

## Common fix patterns

### `FORBIDDEN_FIELD`

Most rejections are evasion-code-in-schema: a `bypass_method`, `clearance_cookie_js`, or `tls_fingerprint` key somewhere in the document. The registry's policy is that schemas carry public documentation of what a local client runs, never the operational secrets or evasion recipes themselves. Move these out of the schema and into client code. See [../sessions.md](../sessions.md) for the allowed/forbidden split.

### `SCHEMA_RUNTIME_*`

Almost always either "forgot to declare `allowed_hosts`" or "shipped an empty placeholder runtime block." Don't ship an empty `runtime: {}` — delete it. Don't ship `bootstrap_js` without `allowed_hosts` — the validator rejects it because a bootstrap that can't fetch has no reason to exist.

### Minimal valid runtime blocks, for copy-paste

Signer only (most common — no cached state needed):

```json
{
  "runtime": {
    "signer_js": "function sign(input) { return { url: input.url, headers: { 'x-my-header': 'computed-value' } }; }"
  }
}
```

Bootstrap only (unusual — implies bootstrap output is consumed as cookies/headers directly):

```json
{
  "runtime": {
    "bootstrap_js": "function bootstrap(input) { return { sessionKey: 'computed-value' }; }",
    "allowed_hosts": ["example.com"],
    "bootstrap_ttl_seconds": 3600
  }
}
```

Both (X-style: signer reads state the bootstrap produced):

```json
{
  "runtime": {
    "bootstrap_js": "function bootstrap(input) { /* fetch main.js, extract keys */ return { transactionBaseKey: 'k', animationKeys: 'a' }; }",
    "signer_js":    "function sign(input) { /* combine state + path */ return { url: input.url, headers: { 'x-client-transaction-id': 't' } }; }",
    "allowed_hosts": ["x.com", "abs.twimg.com"],
    "bootstrap_ttl_seconds": 3600
  }
}
```

Full runtime contract — input shape, return shape, sandbox primitives, path-1 vs path-2 guidance — lives in [../runtime.md](../runtime.md). For testing a schema end-to-end before pushing, see [../cli.md](../cli.md) for `hermai action --dry-run`.
