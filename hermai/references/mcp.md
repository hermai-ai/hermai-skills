# Hermai MCP server

Use MCP when the agent runtime supports local tool servers and the user wants Hermai available as callable tools rather than shell commands.

The MCP server is a local interface over Hermai registry, request intake, and hosted fetch workflows. Use it to discover schemas, inspect coverage, submit missing workflow requests, and (when an API key is set) execute schemas through hosted `/v1/fetch` via the `fetch_schema` tool. Without a key, the server stays a free read-only discovery and intake surface; set `HERMAI_API_KEY` to unlock execution.

The MCP server ships as a dedicated npm package:

```bash
npx -y hermai-mcp
```

Anonymous read-only lookup and public schema request intake work without a key. Set `HERMAI_API_KEY` or `HERMAI_PLATFORM_KEY` in the MCP client environment when the runtime needs authenticated Hermai APIs; this also unlocks the `fetch_schema` execution tool. Set `HERMAI_FETCH_TIMEOUT_MS` to override the default 120s fetch timeout.

## Generic MCP client config

Use this shape in any MCP-capable client. Exact config file paths vary by runtime.

```json
{
  "mcpServers": {
    "hermai": {
      "command": "npx",
      "args": ["-y", "hermai-mcp"],
      "env": {
        "HERMAI_API_KEY": "hm_sk_..."
      }
    }
  }
}
```

The environment variable is optional for public lookup and schema request intake.

## Tools

### `lookup_schema`

Search for a schema by domain, task, category, or verification state.

Inputs:

- `domain` — exact domain such as `allbirds.com`.
- `task` — natural-language workflow.
- `category` — optional category filter.
- `verified` — optional boolean.

Use this before scraping a website.

### `list_public_schemas`

Browse the public schema catalog.

Inputs:

- `q` — free-text search.
- `category` — optional category filter.
- `verified` — optional boolean.
- `sort` — for example `trending`, `recently_verified`, or `recent`.
- `limit` — 1 to 50.

### `fetch_schema`

Execute a registered schema through hosted `/v1/fetch` and return live data. This tool is only registered when `HERMAI_API_KEY` (or `HERMAI_PLATFORM_KEY`) is set, and it consumes Hermai credits per call. Resolve the exact `site` and `endpoint` with `lookup_schema` first.

Inputs:

- `site` — registered host, for example `wegmans.com`.
- `endpoint` — endpoint name from the schema, for example `product_search`. Case-sensitive.
- `params` — optional endpoint parameters as key/value pairs.

On success the result carries the upstream `data` plus a meta summary (`credits_used`, `credits_remaining`, `latency_ms`, `cached`). On failure it surfaces the API `code` and `message`. Use it for read workflows only; write and owner-approved workflows go through the CLI signed-write path.

### `submit_schema_request`

Submit a missing-schema or brittle-workflow request.

Required six-field intake:

- `domain`
- `task`
- `read_or_write` — `read` or `write`
- `auth_shape` — for example `public`, `anonymous`, `login required`, `OAuth`, or `owner-approved`
- `output_shape`
- `failure_mode`

Optional fields:

- `source_url`
- `requester_agent`
- `requester_contact`
- `idempotency_key`

Never include cookies, API keys, bearer tokens, private session data, or personal credentials in a schema request.

### `classify_browser_workflow`

Classify prose as one of:

- `direct_api`
- `hidden_endpoint`
- `browser_only`
- `needs_owner`
- `needs_more_fields`

This is local and read-only. Use it to decide whether to look up a schema, submit a request, or ask for more intake fields.

### `check_schema_request_status`

Check the status of a previous schema request.

Inputs:

- `request_id`

## Decision rule

Use MCP for schema lookup and request intake, and for production read execution via `fetch_schema` when an API key is set (it calls the same hosted `/v1/fetch`). Use the registry package for self execution when the user wants open source schema execution on their own infrastructure. Call hosted `/v1/fetch` directly when the runtime cannot run MCP. Fall back to the CLI when the user has a terminal workflow or needs local cookie, session, or signed write handling.
