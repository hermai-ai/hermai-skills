# Session Block (anti-bot sites)

Sites behind Cloudflare, DataDome, or request signing (TikTok, Airbnb, Zillow) carry a `session` block describing what a local client must do: warm a browser, capture named cookies, and replay requests from a Chrome-TLS HTTP client.

## Which flag does what

Two separate top-level signals show different badges on the public card. Pick the one that matches the site.

| What you want | Field in your schema | Badge on the public card |
|---------------|---------------------|--------------------------|
| Site needs a Chrome-like TLS fingerprint but no cookies/bootstrap | `requires_stealth: true` | **Requires browser** |
| Site needs a warm browser session — bootstrap URL, cookies, or signed requests | `session` block with at least one of `bootstrap_url`, `required_cookies`, or non-`"none"` `tls_profile` | **Requires browser bootstrap** |

These are independent. A site can set `requires_stealth: true` without a session block (TLS fingerprint only), carry a session block without `requires_stealth` (cookie bootstrap but HTTP-only), or both.

> **Bootstrap badge gating.** The server runs `isMeaningfulSession()` before projecting the session or flipping the bootstrap flag. A block that only contains notes, a description, or `tls_profile: "none"` is treated as documentation-only and **does not** trip the badge. If you want the badge, ship at least one real bootstrap signal: a `bootstrap_url`, a non-empty `required_cookies` array, or a meaningful `tls_profile` (e.g. `"chrome_131"`).

## Example

```json
{
  "session": {
    "bootstrap_url": "https://www.tiktok.com/",
    "tls_profile": "chrome_131",
    "required_cookies": ["msToken", "odin_tt", "ttwid"],
    "endpoints_needing_session": ["user_posts", "search_general"],
    "sign_function": "window.byted_acrawler.frontierSign",
    "sign_strategy": "in_page_fetch",
    "description": "Launch Chrome, navigate to bootstrap_url, wait for cookies, use page.Eval fetch for signed endpoints."
  },
  "requires_stealth": true
}
```

## Allowed session fields

All are public documentation of what a local client runs:

- `bootstrap_url` — warm-up URL the client navigates to
- `tls_profile` — named Chrome-TLS fingerprint (e.g. `chrome_131`)
- `required_cookies` — list of cookie **names** (never values)
- `endpoints_needing_session` — which endpoints need the warm session
- `sign_function` / `sign_strategy` — where/how the browser signs requests
- `data_extraction` — for HTML-extract endpoints: selector + parse path
- `description` — prose bootstrap instructions

## Forbidden fields (rejected on push)

These would store user-specific secrets or evasion recipes:

- `proxy_credentials`, `residential_proxy` — each user's own problem
- `clearance_cookies`, `clearance_cookie_js` — cookie **values** are secrets (names are fine)
- `bypass_method`, `stealth_script` — evasion recipes belong in client code
- `tls_fingerprint` — raw fingerprint bytes; use the named `tls_profile` instead

## Forbidden name patterns

Schema or endpoint names containing any of these are rejected:

`bypass`, `circumvent`, `cf-clearance`, `anti-bot`, `rotate-ip`

If you need these words, the schema is probably documenting evasion rather than legitimate browser flow. Rework the schema to describe what a real user's browser does.
