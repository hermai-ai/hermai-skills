# Hermai API — AI Agent Skill

Use this skill when you need to query the Hermai schema registry directly via HTTP, without the CLI. This is the right approach when you're running in an environment without the binary installed, or building an integration that calls the API programmatically.

Base URL: `https://api.hermai.ai`

## Authentication

Authenticated endpoints require an API key in the Authorization header:

```
Authorization: Bearer hm_sk_...
```

Get a key from https://hermai.ai/dashboard (sign in with GitHub).

## Public Endpoints (no auth required)

### List schemas

```bash
GET /v1/schemas
GET /v1/schemas?category=commerce
GET /v1/schemas?q=airbnb
GET /v1/schemas?verified=true
GET /v1/schemas?sort=trending
GET /v1/schemas?limit=10&offset=0
```

Returns public cards (metadata only — no URLs, headers, or body templates).

### Get schema card for a site

```bash
GET /v1/schemas/{site}
```

Returns the public card for the latest version. Use this to check if a schema exists and what it covers before pulling the full package.

### Get categories

```bash
GET /v1/categories
```

Returns the full intent taxonomy tree. Top-level categories: commerce, travel, jobs, social, media, reference, food, finance, real-estate, communication, productivity, knowledge, developer.

### Get trending

```bash
GET /v1/trending
```

Returns three lists: `this_week`, `recently_verified`, `most_fetched`.

## Authenticated Endpoints

### Get full package (auth + intent required)

```bash
GET /v1/schemas/{site}/package
  Authorization: Bearer hm_sk_...
  X-Hermai-Intent: <natural language description of your goal>
```

Returns the full schema with real URLs, headers, body templates, and response shapes. This is what you need to actually call the endpoints.

The intent must be 20+ characters with 5+ distinct words. It can also be passed as `?intent=...` query parameter.

Example:

```bash
curl -H "Authorization: Bearer hm_sk_..." \
     -H "X-Hermai-Intent: searching for rental listings in NYC for a weekend trip" \
     "https://api.hermai.ai/v1/schemas/airbnb.com/package"
```

### Get catalog for a domain (intent required)

```bash
GET /v1/catalog/{domain}
  X-Hermai-Intent: <description>
```

Returns all endpoints for a domain with real URLs, ready to call. Works without auth (rate limited to 5/hour) or with auth (50/hour).

Example:

```bash
curl -H "X-Hermai-Intent: I need a fake REST API to test CRUD operations" \
     "https://api.hermai.ai/v1/catalog/jsonplaceholder.typicode.com"
```

Response:

```json
{
  "domain": "jsonplaceholder.typicode.com",
  "session_id": "...",
  "endpoints": [
    {
      "name": "list_posts",
      "method": "GET",
      "url": "https://jsonplaceholder.typicode.com/posts",
      "description": "List all posts",
      "params": [{"name": "userId", "source": "query", "required": false}],
      "response_schema": {"type": "array", "items": {"fields": [...]}}
    }
  ]
}
```

### Push a schema (auth required)

```bash
POST /v1/schemas
  Authorization: Bearer hm_sk_...
  Content-Type: application/json

  {raw schema JSON body}
```

The body is the schema JSON directly (not wrapped in another object). Required fields:
- `site` — domain name
- `intent_category` — from the taxonomy
- `schema_format_version` — "0.1"

Response on success:

```json
{
  "success": true,
  "data": {
    "version_hash": "abc123...",
    "site": "example.com",
    "created": true,
    "public_card": {...}
  }
}
```

If the exact same schema content was already pushed, `created` will be `false` (content-addressed dedup).

### Get contributions (auth required)

```bash
GET /v1/account/contributions
  Authorization: Bearer hm_sk_...
```

Returns schemas pushed by the authenticated user.

## Intent Requirement

The catalog and package endpoints require a natural language intent describing:
- What site you're targeting
- What your goal is
- Key parameters or context

Rules:
- Minimum 20 characters
- Minimum 5 distinct words
- No maximum length

Examples of good intents:
- "searching for short-term rental listings in San Francisco for a weekend trip"
- "I need the CoinGecko API to get current Bitcoin price and market cap data"
- "looking up restaurant availability in Manhattan for a dinner reservation tonight"

Error codes if intent fails validation:
- `INTENT_REQUIRED` — no intent provided
- `INTENT_TOO_SHORT` — under 20 characters
- `INTENT_TOO_FEW_WORDS` — fewer than 5 distinct words

## Error Handling

All errors follow this shape:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

Key error codes:

| Code | HTTP | Meaning |
|------|------|---------|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `RATE_LIMITED` | 429 | Too many requests |
| `NOT_FOUND` | 404 | No schema for that site |
| `DOMAIN_NOT_INDEXED` | 404 | No endpoints for that domain |
| `INTENT_REQUIRED` | 400 | Intent missing |
| `INTENT_TOO_SHORT` | 400 | Intent under 20 chars |
| `INTENT_TOO_FEW_WORDS` | 400 | Intent under 5 distinct words |
| `MISSING_FIELD` | 400 | Schema push missing required field |
| `UNKNOWN_CATEGORY` | 400 | Invalid intent_category |
| `FORBIDDEN_NAME` | 422 | Schema name matches bypass patterns |
| `FORBIDDEN_FIELD` | 422 | Schema contains operational fields |
| `UNSUPPORTED_FORMAT` | 400 | schema_format_version not "0.1" |
| `PHASE_2_FEATURE` | 503 | Feature not available yet |

## Typical Agent Workflow

### Finding and using a website API

```python
import requests

API = "https://api.hermai.ai"
KEY = "hm_sk_..."

# 1. Check if a schema exists
r = requests.get(f"{API}/v1/schemas/airbnb.com")
if r.status_code == 404:
    print("No schema for this site yet")

# 2. Get the catalog (endpoints with real URLs)
r = requests.get(
    f"{API}/v1/catalog/airbnb.com",
    headers={
        "Authorization": f"Bearer {KEY}",
        "X-Hermai-Intent": "searching rental listings in San Francisco for weekend"
    }
)
catalog = r.json()

# 3. Call the endpoint directly
endpoint = catalog["endpoints"][0]
response = requests.request(
    method=endpoint["method"],
    url=endpoint["url"],
    headers=endpoint.get("headers", {}),
)
data = response.json()
```

### Contributing a schema

```python
schema = {
    "site": "example.com",
    "name": "example/products",
    "description": "Product listing API",
    "intent_category": "commerce",
    "schema_format_version": "0.1",
    "endpoints": [
        {
            "name": "search",
            "method": "GET",
            "url_template": "https://api.example.com/products",
            "query_params": [{"key": "q", "required": True}],
            "response_schema": {
                "type": "array",
                "items": {
                    "fields": [
                        {"name": "id", "type": "string"},
                        {"name": "title", "type": "string"},
                        {"name": "price", "type": "number"}
                    ]
                }
            }
        }
    ]
}

r = requests.post(
    f"{API}/v1/schemas",
    headers={"Authorization": f"Bearer {KEY}"},
    json=schema
)
print(r.json()["data"]["version_hash"])
```

## Rate Limits

| Tier | Catalog | Schemas (public) |
|------|---------|-----------------|
| Anonymous | 5/hour | Unlimited |
| Free (registered) | 50/hour, 500/day | Unlimited |

Rate limit headers are included in responses:
- `X-Rate-Limit-Remaining` — requests left in current window
