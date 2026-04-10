# Getting Structured Product Data from Etsy

The fastest path is to use **Hermai** — it maintains a registry of discovered website API schemas so you don't have to reverse-engineer endpoints yourself.

## Step 1: Check if Etsy is already in the registry

```bash
hermai registry list --query "etsy"
```

Or via the API directly:

```bash
curl -s "https://api.hermai.ai/v1/schemas?q=etsy"
```

If a schema exists, you'll see it listed with its category (likely `commerce`) and a description of available endpoints.

## Step 2: Pull the full schema with your intent

If Etsy is indexed, pull the endpoints with a descriptive intent:

```bash
hermai registry pull etsy.com \
  --intent "fetching product listings with prices titles and shop names from Etsy search results"
```

This downloads a `etsy.com.schema.json` file containing real endpoint URLs, required parameters, headers, and response shapes — everything you need to call the API directly.

Or via curl:

```bash
curl -H "Authorization: Bearer $HERMAI_KEY" \
     -H "X-Hermai-Intent: fetching product listings with prices titles and shop names from Etsy search results" \
     "https://api.hermai.ai/v1/catalog/etsy.com"
```

The response will include endpoint definitions like search URLs with query parameters for keywords, price filters, etc., along with the response schema showing fields like `title`, `price`, `shop_name`, `listing_id`, and so on.

## Step 3: Call the endpoints directly

Once you have the schema, call the endpoints it describes. For example, if the catalog returns a search endpoint:

```bash
# Example — actual URL and params come from the schema you pulled
curl -s "https://www.etsy.com/api/v3/ajax/bespoke/member/listings?search_query=handmade+mug&limit=25" \
  -H "Accept: application/json" | jq '.results[] | {title, price, shop_name}'
```

The exact URL, method, headers, and parameter names will be in the schema output from Step 2. Use those values, not guesses.

## If Etsy is NOT in the registry yet

Discover it yourself with the CLI:

```bash
export HERMAI_API_KEY=sk-...  # Your OpenRouter or OpenAI key for LLM analysis
hermai discover "https://www.etsy.com/search?q=handmade+mug"
```

This will:
1. Probe the page for hidden API endpoints (checking `__NEXT_DATA__`, JSON-LD, XHR intercepts)
2. Build a schema with the discovered endpoints
3. Output a schema file you can use immediately

Then push it to the registry so others can reuse it:

```bash
hermai registry push schema.json
```

## Quick one-shot fetch (if you just need data now)

For a quick grab without dealing with schemas:

```bash
hermai fetch "https://www.etsy.com/search?q=handmade+mug"
```

This returns structured JSON directly — Hermai's engine automatically finds the best extraction path (probe first, then HTML extraction, then browser+LLM if needed). Good for one-off requests; use the registry workflow above for repeated programmatic access.

## Summary

| Approach | Command | Best for |
|----------|---------|----------|
| Check registry | `hermai registry list --query etsy` | See if someone already mapped Etsy |
| Pull endpoints | `hermai registry pull etsy.com --intent "..."` | Get reusable endpoint definitions |
| Quick fetch | `hermai fetch <etsy-url>` | One-shot structured data |
| Discover + push | `hermai discover <etsy-url>` | Map a new site and share it |

Start with `hermai registry list --query etsy` — if someone has already published an Etsy schema, you'll have structured product data in seconds.
