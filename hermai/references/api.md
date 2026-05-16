# Hermai API — HTTP Reference

The complete HTTP surface. Every consumer flow lives here — catalog discovery, schema reads, and hosted execution via `POST /v1/fetch`. The CLI in [cli.md](cli.md) wraps this same API for terminal users.

Base URL: `https://api.hermai.ai`

## Authentication

Most endpoints work anonymously at 5 req/hour. For 50 req/hour and authenticated-only endpoints:

```
Authorization: Bearer hm_sk_...
```

Keys come from https://hermai.ai/dashboard.

## Endpoints

### Public (no auth required)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/schemas` | List schemas (`?q=`, `?category=`, `?verified=true`, `?sort=`) |
| GET | `/v1/schemas/{site}` | Public card for a site (metadata + session block, no full URLs) |
| GET | `/v1/categories` | Full intent taxonomy |
| GET | `/v1/trending` | Trending schema lists |
| GET | `/v1/health` | Health check |

### Auth required (or anon at 5 req/hr)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/v1/catalog/{domain}` | Endpoints with real URLs. Requires intent. |
| GET | `/v1/schemas/{site}/package` | Full schema package. Requires intent. |

### Hosted execution (auth required, charged against plan)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/v1/fetch` | Execute a schema endpoint via the Hermai gateway. Body: `{site, endpoint, params}`. 1 credit per call. Handles proxies, warm cookies, anti-bot retries, signed headers, and response projection. |

## Example: discover endpoints for a site

```bash
# Search the catalog
curl -s "https://api.hermai.ai/v1/schemas?q=airbnb"

# Pull a site's endpoints (requires intent)
curl -H "Authorization: Bearer $KEY" \
     -H "X-Hermai-Intent: finding SF rentals for a weekend trip, 2 adults" \
     "https://api.hermai.ai/v1/catalog/airbnb.com"
```

The response gives you each endpoint's `name`, declared `params`, and `response_schema`. Use the `name` in the next call.

## Example: execute a call

```bash
curl -X POST "https://api.hermai.ai/v1/fetch" \
     -H "Authorization: Bearer $KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "site": "x.com",
       "endpoint": "user_profile",
       "params": { "variables": { "screen_name": "sama" } }
     }'
```

Response shape:

```json
{
  "success": true,
  "data": { ... projected JSON ... },
  "meta": {
    "site": "x.com",
    "endpoint": "user_profile",
    "resolved_url": "https://api.x.com/graphql/.../UserByScreenName?variables=…&features=…",
    "method": "GET",
    "source": "gateway",
    "latency_ms": 4312,
    "credits_used": 1,
    "credits_remaining": 1039,
    "cached": false
  }
}
```

### Request body for `POST /v1/fetch`

| Field | Required | Notes |
|---|---|---|
| `site` | yes | Site key matching the registry (e.g. `x.com`, `booking.com`) |
| `endpoint` | yes | Endpoint name from the catalog (`GET /v1/catalog/{domain}`) |
| `params` | depends | The endpoint's declared params. Object/array values get JSON-encoded automatically — pass GraphQL `variables` as a typed object: `{"variables": {"screen_name": "sama"}}`, not a pre-stringified JSON blob. Static boilerplate (x.com's `features`, etc.) lives in the schema as defaults — don't supply it. |

The gateway picks the execution path per endpoint — direct HTTPS, warm-cookie replay, residential proxy, warm-Chrome pool, Web Unlocker. You don't choose; the schema's runtime metadata does.

### Pricing

Each successful `/v1/fetch` charges 1 credit. Plans:

- **Free** — 3,000 standard requests + 50 premium calls + 20 req/min
- **Starter ($29/mo)** — 15,000 standard + 1,500 premium + 60 req/min
- **Pro ($99/mo)** — 60,000 standard + 10,000 premium + 100 req/min
- **Enterprise** — custom (`mailto:sales@hermai.ai`)

Premium calls cover anti-bot-heavy domains (LinkedIn, Meta, Zillow, Amazon, Booking, …). All other sites count against the standard pool.

## Passing intent

Three ways (pick one):

1. Header: `X-Hermai-Intent: "..."`
2. Query param: `?intent=...`
3. CLI flag: `--intent "..."`

Requirements: 20+ characters, 5+ distinct words. See SKILL.md for examples.

## Error codes

| Code | Meaning |
|------|---------|
| `UNAUTHORIZED` | Missing/invalid API key |
| `RATE_LIMITED` | Too many requests — per-workspace tier rate limit on `/v1/fetch`; per-IP 5/hr on anon catalog reads |
| `INSUFFICIENT_CREDITS` | Plan's monthly credit pool exhausted on `/v1/fetch` |
| `NOT_FOUND` | No schema for that site — offer to contribute one via the flow in [contribute/overview.md](contribute/overview.md) |
| `MISSING_SITE` / `MISSING_ENDPOINT` | `/v1/fetch` body is missing one of the required fields |
| `FETCH_REJECTED` | Upstream returned 4xx that the gateway is passing through (e.g. invalid params, expired credentials) |
| `FETCH_FAILED` | Internal gateway error talking to the executor; retry |
| `DOMAIN_NOT_INDEXED` | No endpoints for that domain |
| `INTENT_REQUIRED` | Intent missing on a catalog/schema read |
| `INTENT_TOO_SHORT` | Under 20 chars |
| `INTENT_TOO_FEW_WORDS` | Under 5 distinct words |
| `SESSION_REQUIRED` | Returned only on the older direct-upstream path; the gateway handles sessions for you, so this should not appear on `/v1/fetch` responses |

Response envelope for all endpoints:

```json
{
  "success": true,
  "data": { ... }
}
```

On error:

```json
{
  "success": false,
  "error": { "code": "NOT_FOUND", "message": "..." }
}
```
