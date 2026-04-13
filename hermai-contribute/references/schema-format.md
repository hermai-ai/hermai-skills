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

- **Top-level `description`** = catalog tagline. Say what the site is and what data is accessible. No parse paths, tier counts, or script IDs.
- **Per-endpoint `description`** = technical how-to. Parse paths, selectors, query param semantics, field lists go here. An agent reads it only after deciding to call that endpoint.
- **`session.description`** = bootstrap instructions for a warm browser. Agent-facing prose, not a lab notebook.
