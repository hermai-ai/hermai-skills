# Discovering and Documenting Actions (Writes)

Hermai's vision is the **interaction layer** for agents — not just data extraction. Actions (POST/PUT/DELETE) are first-class. A schema with only read endpoints is incomplete.

## Why this is harder than reads

Read endpoints are idempotent and stateless — point the agent at the URL, get data, done. Writes are different:

- **Authenticated**: most writes require a logged-in session (login → cookies → subsequent POSTs)
- **CSRF-protected**: the site embeds a one-time token in a GET response that the POST must echo back
- **Stateful**: cart IDs, session tokens, idempotency keys change per user
- **Multi-step**: checkout = address → shipping → payment → confirm, each depending on the previous
- **Rate-limited**: "post once per minute" isn't schema material, it's client behavior
- **Risky**: accidentally running a checkout action could place a real order. Handle with care.

## How to capture a write flow

```bash
# 1. Start the browser intercept on the action URL (or the page that triggers it)
hermai intercept --timeout 60s https://example.com/products/item-123
```

While the browser is open, perform the action in the UI:
- Add item to cart → click "Add to Cart"
- Log in → type credentials, click Submit
- Submit review → type review, click Post

The intercept captures every XHR including the POST. The output includes `replay_specs` — ready-to-replay request JSON files.

```bash
# 2. Inspect what was captured
hermai intercept --timeout 60s https://example.com/products/item-123 > capture.json

# 3. Verify the POST works standalone
hermai replay cart_add.json --stealth
```

If the replay works, the endpoint is captureable. If it fails (common), the request has state you need to handle: CSRF token, session cookie, or a preceding request.

## The CSRF token problem

Most write forms embed a token in the page that the POST must echo. Captured once, the token is used once. The schema needs to describe this dance:

```json
{
  "actions": [
    {
      "name": "submit_review",
      "method": "POST",
      "url_template": "https://example.com/products/{id}/reviews",
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

The agent runs `product_detail` first, extracts the CSRF token, then submits the form. The schema documents the dependency.

## The authenticated session problem

Writes usually require a logged-in session. The schema's `session` block (see [sessions.md](sessions.md)) already documents how to warm a browser. For writes specifically:

1. Use `hermai session bootstrap <site>` to capture cookies
2. The cookies persist in `~/.hermai/sessions/<site>/cookies.json`
3. Subsequent action calls include these cookies

If the site requires username/password login (not just a browser warm-up), the session bootstrap needs credential parameterization — this is a known gap, see the `actions` API design discussion.

## Credential placeholders

Never hardcode credentials in the schema. Captured requests will have the real password. Sanitize:

```json
// BAD — captured as-is, leaks the user's password
{"body": "{\"email\":\"real@email.com\",\"password\":\"actualpass\"}"}

// GOOD — parameterized
{"body": "{\"email\":\"{email}\",\"password\":\"{password}\"}",
 "params": [
   {"name": "email", "type": "credential", "in": "body"},
   {"name": "password", "type": "credential", "sensitive": true, "in": "body"}
 ]}
```

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

The current CLI toolkit captures writes via `intercept + replay` but doesn't yet automate credential parameterization or CSRF token refresh. For now, contributors manually sanitize captured requests before pushing. A future `hermai capture` command will do this automatically.
