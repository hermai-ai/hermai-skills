# Schema Format (v0.1)

## Example

```json
{
  "site": "example.com",
  "intent_category": "commerce",
  "schema_format_version": "0.1",
  "name": "example.com",
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

## Naming rule

`name` **is the bare domain** (e.g. `threads.com`, `allrecipes.com`, `lu.ma`). Do not scope it to a sub-path like `lu.ma/events` or `eventbrite/events` — catalog browsers search and sort by name, and adding a slash-path makes the same domain appear under different identities depending on what was contributed first.

If a schema covers only part of a site, communicate the scope in `description` (user-voice) and `interactions_out_of_scope`. The name stays the domain.

Same rule for `site`: lowercase, no scheme (`https://`), no path.

## Required fields

- `site`
- `intent_category`
- `schema_format_version` — must be `"0.1"`
- Per endpoint: `name`, `method`, `url_template`

## Categories

`commerce`, `travel`, `jobs`, `social`, `media`, `reference`, `food`, `finance`, `real-estate`, `communication`, `productivity`, `knowledge`, `developer`, `sports`, `government`

## Public card vs. full package

Every pushed schema lands as two views: the **public card** that anyone can read without an API key at `GET /v1/schemas/{site}`, and the **full package** delivered behind `hermai registry pull` (API key + intent). The server does the split automatically — what you write in your schema JSON is the full package, and the card is a projection.

You can't change what's projected. But knowing the rules prevents two mistakes: putting extraction detail in fields that show on the card (competitors re-implement the site without paying), and expecting fields to show on the card that never get projected (contributor thinks validation is broken).

| Field in your schema | On the public card | In the full package |
|---------------------|--------------------|---------------------|
| `site`, `intent_category`, `schema_format_version` | Yes | Yes |
| `name`, `description`, `version` | Yes | Yes |
| `endpoints[].name`, `endpoints[].method` | Yes | Yes |
| `endpoints[].purpose` | **Yes** — user-voice card blurb | Yes |
| `endpoints[].description` | **No** — paywalled | Yes |
| `endpoints[].url_template` | **No** — paywalled | Yes |
| `endpoints[].headers` (values) | **No** — paywalled | Yes |
| `endpoints[].variables`, `query_params`, `response_schema` | **No** — paywalled | Yes |
| `endpoints[].has_auth` (derived) | **No** — learned post-pull | Yes |
| `requires_stealth: true` | Yes — surfaces as "Requires browser" badge | Yes |
| `session` block | **Projected** — see [sessions.md](sessions.md) for which fields survive | Yes |

**Rule of thumb for writing `endpoints[].description`**: assume only an API-key holder with a declared intent will ever read it. Keep parse paths, jq selectors, JSON script tag IDs, and regex out of `purpose`; they belong in `description` where they're paywalled.

## Description rules

Description fields follow the public/private split above — public copy says *what*, private copy says *how*. This is a security boundary, not a style preference: leaking the *how* onto the public card lets anyone re-implement the site without ever calling our API.

- **Top-level `description`** → public card. One or two sentences describing *what information a caller can get*, user-voice.
  - Good: *"Search public repositories, get repository details, and list of users' public repos, etc."* (github.com)
  - Good: *"Read public Threads profiles and posts. Pulls display name, bio, follower counts, plus every post in a thread with text, images, timestamps, and like counts."* (threads.com)
  - Bad: naming endpoints, URL paths, parse-path selectors, script tag IDs, or CLI commands like `hermai probe` / `hermai extract`.
  - Sanity check: re-read your draft and ask *"would this sentence still make sense to someone who has never used the CLI?"* If not, rewrite.
- **Per-endpoint `purpose`** → public card. One sentence, user-voice, names the data this endpoint returns. Same rules as the top-level description.
- **Per-endpoint `description`** → full package only. Technical how-to: parse paths, selectors, query param semantics, field lists, JSON script tag IDs, pagination and edge cases. An agent reads it only after pulling the full package.
- **`session.description`** → full package only. Bootstrap instructions for a warm browser. Agent-facing prose, not a lab notebook.

Quick test: would a competitor gain a meaningful shortcut to re-implement the site by reading this field without an API key? If yes, the content belongs under `description` (per-endpoint) or inside the session block, not on the public card.

## Verified, not wishful

Every selector, jq path, regex, or JSON key you write into `description` (or into `session.data_extraction`) must be *confirmed* to extract the data you claim — by running it against the live page before you push. "I saw this class name in the HTML" is not verification; the class may be CSS-only and carry no data. Grep for a concrete data point (a real country name, a real price, a real product id) and look at the DOM *wrapping that value* — that wrapper is your real selector.

If a selector returns zero matches on a live fetch, delete it from the description or replace it with the one that works. Callers trust the paywalled `description` to execute cleanly; shipping selectors that don't fire is a worse bug than shipping no description, because debugging "why did parsing return empty?" wastes the caller's time on a problem we could have caught at contribution.

See the "Phase 4: Verify" section in the main skill for the extraction drill.
