# Hermai MCP server

Use MCP when the agent runtime supports local tool servers and the user wants Hermai available as callable tools rather than shell commands.

The MCP server ships as a dedicated npm package:

```bash
npx -y @hermai-ai/mcp
```

Anonymous read-only lookup and public schema request intake work without a key. Set `HERMAI_API_KEY` or `HERMAI_PLATFORM_KEY` in the MCP client environment when the runtime needs authenticated Hermai APIs.

## Generic MCP client config

Use this shape in any MCP-capable client. Exact config file paths vary by runtime.

```json
{
  "mcpServers": {
    "hermai": {
      "command": "npx",
      "args": ["-y", "@hermai-ai/mcp"],
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

Use MCP when available. Fall back to direct HTTP API if the runtime cannot run local MCP servers. Fall back to the CLI when the user has a terminal workflow or needs cookie/session/signed-write handling.
