# Hermai API

Use this when the CLI is not available, when you want to self execute schemas from the open source registry, or when you want hosted execution through Hermai Cloud.

Base URL: `https://api.hermai.ai`

## Execution modes

Hermai has two HTTP usage patterns:

1. **Self execution.** Search the registry, pull a full schema package, fill the params in `url_template`, `headers`, and `body_template`, then call the target website directly. This is useful for local agents, contributors, debugging, and users running their own infrastructure.
2. **Hosted execution.** Call `POST /v1/fetch` with `{site, endpoint, params}`. Hermai Cloud runs the website request and returns projected JSON. Use this for production behavior, cloud readiness checks, managed sessions, managed proxy policy, signing, billing, and reliability.

`cloud_ready=true` means the endpoint has passed hosted execution through `/v1/fetch`. A schema can be valid and useful for self execution before it is cloud ready.

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
| POST | `/v1/fetch` | Hosted execution for a registered site endpoint. |

## Example: self execute a schema

```bash
# Search
curl -s "https://api.hermai.ai/v1/schemas?q=airbnb"

# Get full endpoints
curl -H "Authorization: Bearer $KEY" \
     -H "X-Hermai-Intent: finding SF rentals for a weekend trip, 2 adults" \
     "https://api.hermai.ai/v1/catalog/airbnb.com"
```

Then call the website endpoints from the response directly. Fill all declared params and use `response_schema` to project the response.

**If the pulled schema carries a `runtime` block**, direct HTTP calls will fail on signed endpoints because the server expects per request headers the CLI would compute. Use `hermai action` instead. It runs the bootstrap/signer JS for you. See [runtime.md](runtime.md).

## Example: hosted execution

```bash
curl -sS -X POST "https://api.hermai.ai/v1/fetch" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"site":"airbnb.com","endpoint":"autocomplete","params":{"query":"San Francisco"}}'
```

Hosted fetch response envelope:

```json
{
  "success": true,
  "data": {}
}
```

If hosted fetch returns `SESSION_REQUIRED`, `RESOURCE_UNAVAILABLE`, `FETCH_FAILED`, or `FETCH_REJECTED`, do not mark the endpoint cloud ready. Fix the schema, fixture, resource policy, or warm resource first.

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
| `NOT_FOUND` | No schema for that site. Offer to contribute one via the flow in [contribute/overview.md](contribute/overview.md) |
| `DOMAIN_NOT_INDEXED` | No endpoints for that domain |
| `INTENT_REQUIRED` | Intent missing |
| `INTENT_TOO_SHORT` | Under 20 chars |
| `INTENT_TOO_FEW_WORDS` | Under 5 distinct words |
| `SESSION_REQUIRED` | Endpoint needs warm browser session. See [sessions.md](sessions.md) |
| `RESOURCE_UNAVAILABLE` | Hosted resource such as warm session or proxy pool is not ready |
| `FETCH_FAILED` | Hosted fetch reached the upstream path but did not return usable data |
| `FETCH_REJECTED` | The site or registry rejected the fetch before usable data was returned |

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
