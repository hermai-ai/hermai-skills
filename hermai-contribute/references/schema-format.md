# Schema Format (v0.1)

## Example

```json
{
  "site": "example.com",
  "intent_category": "commerce",
  "schema_format_version": "0.1",
  "name": "example/products",
  "description": "Short tagline — what this catalog is and what data is accessible.",
  "endpoints": [
    {
      "name": "search",
      "method": "GET",
      "url_template": "https://api.example.com/products",
      "description": "Technical how-to: parse paths, selectors, query param semantics.",
      "headers": {"Accept": "application/json"},
      "query_params": [
        {"key": "q", "required": true},
        {"key": "limit", "required": false}
      ],
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
```

## Required fields

- `site`
- `intent_category`
- `schema_format_version` — must be `"0.1"`
- Per endpoint: `name`, `method`, `url_template`

## Categories

`commerce`, `travel`, `jobs`, `social`, `media`, `reference`, `food`, `finance`, `real-estate`, `communication`, `productivity`, `knowledge`, `developer`, `sports`, `government`

## Description rules

- **Top-level `description`** = user-voice catalog card. Describe *what information a caller can get* from this schema, in one or two sentences. The catalog page renders this verbatim — write it for a reader who has never touched the CLI.
  - Good: *"Search public repositories, get repository details, and list of users' public repos, etc."* (github.com)
  - Good: *"Read public Threads profiles and posts. Pulls display name, bio, follower counts, plus every post in a thread with text, images, timestamps, and like counts."* (threads.com)
  - Bad: naming endpoints, URL paths, parse-path selectors, script tag IDs, or CLI commands like `hermai probe` / `hermai extract`.
  - Sanity check: re-read your draft and ask *"would this sentence still make sense to someone who has never used the CLI?"* If not, rewrite.
- **Per-endpoint `description`** = technical how-to. Parse paths, selectors, query param semantics, field lists, JSON script tag IDs — all fine here. An agent reads it only after deciding to call that endpoint.
- **`session.description`** = bootstrap instructions for a warm browser. Agent-facing prose, not a lab notebook.
