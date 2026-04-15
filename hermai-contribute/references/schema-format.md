# Schema Format (v0.1)

## Example

```json
{
  "site": "example.com",
  "intent_category": "commerce",
  "schema_format_version": "0.1",
  "name": "example/products",
  "description": "Search the product catalog and pull individual product details, prices, and stock info.",
  "endpoints": [
    {
      "name": "search",
      "method": "GET",
      "url_template": "https://api.example.com/products",
      "purpose": "Search the catalog by keyword and get a list of matching products.",
      "description": "Technical how-to: parse paths, selectors, query param semantics, pagination. Shown only in the full package behind API key + intent.",
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

The registry splits every schema into a **public card** (what the schema offers) and a **full package** (how to execute, auth + intent gated). Description fields follow the same split — public copy says *what*, private copy says *how*. This is a security boundary, not a style preference: leaking the *how* onto the public card lets anyone re-implement the site without ever calling our API.

- **Top-level `description`** → public card. One or two sentences describing *what information a caller can get*, user-voice.
  - Good: *"Search public repositories, get repository details, and list of users' public repos, etc."* (github.com)
  - Good: *"Read public Threads profiles and posts. Pulls display name, bio, follower counts, plus every post in a thread with text, images, timestamps, and like counts."* (threads.com)
  - Bad: naming endpoints, URL paths, parse-path selectors, script tag IDs, or CLI commands like `hermai probe` / `hermai extract`.
  - Sanity check: re-read your draft and ask *"would this sentence still make sense to someone who has never used the CLI?"* If not, rewrite.
- **Per-endpoint `purpose`** → public card. One sentence, user-voice, names the data this endpoint returns. Same rules as the top-level description.
- **Per-endpoint `description`** → full package only. Technical how-to: parse paths, selectors, query param semantics, field lists, JSON script tag IDs, pagination and edge cases. An agent reads it only after pulling the full package.
- **`session.description`** → full package only. Bootstrap instructions for a warm browser. Agent-facing prose, not a lab notebook.

Quick test: would a competitor gain a meaningful shortcut to re-implement the site by reading this field without an API key? If yes, the content belongs under `description` (per-endpoint) or inside the session block, not on the public card.
