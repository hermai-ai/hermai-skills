# Hermai API — Direct HTTP Usage

Use this when the CLI isn't available or when you need more control.

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

## Example: look up a site

```bash
# Search
curl -s "https://api.hermai.ai/v1/schemas?q=airbnb"

# Get full endpoints
curl -H "Authorization: Bearer $KEY" \
     -H "X-Hermai-Intent: finding SF rentals for a weekend trip, 2 adults" \
     "https://api.hermai.ai/v1/catalog/airbnb.com"
```

Then call the endpoints from the response directly.

**If the pulled schema carries a `runtime` block**, direct HTTP calls will fail on signed endpoints (the server expects per-request headers the CLI would compute). Use `hermai action` instead — it runs the bootstrap/signer JS for you. See [runtime.md](runtime.md).

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
| `RATE_LIMITED` | Too many requests (anon: 5/hr, auth: 50/hr) |
| `NOT_FOUND` | No schema for that site — offer to contribute one via the flow in [contribute/overview.md](contribute/overview.md) |
| `DOMAIN_NOT_INDEXED` | No endpoints for that domain |
| `INTENT_REQUIRED` | Intent missing |
| `INTENT_TOO_SHORT` | Under 20 chars |
| `INTENT_TOO_FEW_WORDS` | Under 5 distinct words |
| `SESSION_REQUIRED` | Endpoint needs warm browser session — see [sessions.md](sessions.md) |

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
