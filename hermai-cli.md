# Hermai CLI — AI Agent Skill

Use this skill when the user asks you to discover website APIs, fetch structured data from websites, look up schemas for a site, or push/pull schemas from the Hermai registry.

## What Hermai Does

Hermai is a community-driven schema registry for AI agents. Contributors discover website API endpoints and publish schemas describing how to call them. Agents query the registry to get structured endpoint definitions (URL, method, headers, parameters, response shape) and call those endpoints directly.

## Installation

```bash
# macOS (Apple Silicon)
curl -L https://github.com/hermai-ai/hermai-cli/releases/latest/download/hermai_darwin_arm64.tar.gz | tar xz
sudo mv hermai /usr/local/bin/

# macOS (Intel)
curl -L https://github.com/hermai-ai/hermai-cli/releases/latest/download/hermai_darwin_amd64.tar.gz | tar xz
sudo mv hermai /usr/local/bin/

# Linux (amd64)
curl -L https://github.com/hermai-ai/hermai-cli/releases/latest/download/hermai_linux_amd64.tar.gz | tar xz
sudo mv hermai /usr/local/bin/

# Verify
hermai --version
```

## Authentication

```bash
# Interactive login — opens dashboard URL, prompts for API key paste
hermai registry login

# Or write config directly
mkdir -p ~/.hermai && chmod 700 ~/.hermai
cat > ~/.hermai/config.yaml << EOF
platform_key: hm_sk_YOUR_KEY_HERE
EOF
chmod 600 ~/.hermai/config.yaml
```

Get an API key from https://hermai.ai/dashboard (sign in with GitHub).

## Commands

### Look up what schemas exist

```bash
# List all public schemas
hermai registry list

# Filter by category
hermai registry list --category commerce
hermai registry list --category travel
hermai registry list --category developer

# Search by keyword
hermai registry list --query "airbnb"
```

Output format: `site    category    hash_prefix`

### Download a schema (requires auth + intent)

```bash
hermai registry pull <site> --intent "<describe your goal>"
```

The intent must be a natural language sentence (20+ chars, 5+ distinct words) explaining what you need. Examples:

```bash
hermai registry pull httpbin.org --intent "I need the httpbin echo endpoint to test my HTTP client"
hermai registry pull airbnb.com --intent "searching for short-term rental listings in San Francisco for a weekend trip"
```

This downloads `<site>.schema.json` containing the full package: URLs, methods, headers, parameters, and response shapes.

### Push a schema (requires auth)

```bash
hermai registry push schema.json
```

The schema JSON must include:
- `site` (required) — the domain, e.g. "example.com"
- `intent_category` (required) — one of: commerce, travel, jobs, social, media, reference, food, finance, real-estate, communication, productivity, knowledge, developer
- `schema_format_version` (required) — must be "0.1"
- `endpoints` (array) — the API endpoints

Example minimal schema:

```json
{
  "site": "example.com",
  "name": "example/api",
  "description": "Example REST API",
  "intent_category": "developer",
  "schema_format_version": "0.1",
  "endpoints": [
    {
      "name": "list_items",
      "description": "List all items",
      "method": "GET",
      "url_template": "https://api.example.com/v1/items",
      "query_params": [
        {"key": "page", "required": false},
        {"key": "limit", "required": false}
      ],
      "response_schema": {
        "type": "array",
        "items": {
          "fields": [
            {"name": "id", "type": "integer"},
            {"name": "name", "type": "string"},
            {"name": "price", "type": "number"}
          ]
        }
      }
    }
  ]
}
```

### Discover endpoints (local, no registry)

```bash
# Full engine discovery — probes the site, extracts endpoints
hermai discover <url>

# Quick fetch — get structured data from a specific URL
hermai fetch <url>
```

Discovery requires an LLM API key for analysis:
```bash
export HERMAI_API_KEY=sk-... # OpenRouter or OpenAI key
hermai discover https://example.com
```

### Other commands

```bash
hermai doctor          # Check system readiness
hermai cache list      # Show cached schemas
hermai schema <url>    # Show cached schema for a URL
hermai init            # Create config file interactively
```

## Schema JSON Format (v0.1)

Key fields in the endpoint object:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Endpoint identifier |
| `method` | string | HTTP method (GET, POST, etc.) |
| `url_template` | string | Full URL, may contain `{variables}` |
| `description` | string | What this endpoint does |
| `headers` | object | Required headers (key: value) |
| `variables` | array | Path variables: `{name, source, pattern}` |
| `query_params` | array | Query parameters: `{key, required, value}` |
| `body` | object | Body template: `{content_type, template}` |
| `response_schema` | object | Response shape: `{type, fields: [{name, type}]}` |

Key fields in the action object (write operations):

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Action identifier (e.g. "add_to_cart") |
| `method` | string | HTTP method |
| `url_template` | string | Full URL |
| `kind` | string | "api_call" |
| `params` | array | Parameters: `{name, in, type, required, default}` |
| `headers` | object | Required headers |

## Validation Rules

Schemas are rejected if they:
- Are missing `site` or `intent_category`
- Use an `intent_category` not in the taxonomy
- Use `schema_format_version` other than "0.1"
- Have a name matching bypass/circumvent patterns
- Contain forbidden fields: `tls_fingerprint`, `proxy_credentials`, `clearance_cookies`, `bypass_method`, `residential_proxy`, `stealth_script`, `clearance_cookie_js`

## Typical Agent Workflow

1. **Check if a schema exists**: `hermai registry list --query "site-name"`
2. **Pull the schema**: `hermai registry pull site.com --intent "your goal"`
3. **Read the schema JSON**: Parse the endpoints from the downloaded file
4. **Call the endpoints directly**: Use the URL, method, headers, and parameters from the schema
5. **If no schema exists**: Run `hermai discover <url>` to create one, then `hermai registry push` to share it

## Config File Reference

`~/.hermai/config.yaml`:

```yaml
# Registry auth
platform_key: hm_sk_...

# LLM for discovery (optional — only needed for hermai discover)
api_key: sk-...          # or set HERMAI_API_KEY env var
model: gpt-4o-mini       # or set HERMAI_MODEL
base_url: https://openrouter.ai/api/v1  # or set HERMAI_BASE_URL

# Cache
cache_dir: ~/.hermai/schemas
cache_ttl: 720h          # 30 days default

# Platform
platform_url: https://api.hermai.ai  # default, override for self-hosted
```

## Rate Limits

- Anonymous: 5 requests/hour (by IP)
- Registered (free): 50 requests/hour, 500/day
- Schema pushes: no limit (content-addressed dedup prevents spam)
