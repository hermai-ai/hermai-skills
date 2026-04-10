To push your Hacker News schema to the Hermai registry, here's what to do:

## 1. Check CLI availability

```bash
which hermai || hermai --version
```

## 2. Ensure you're authenticated

If you haven't logged in yet:

```bash
hermai registry login
```

Or manually configure your API key:

```bash
mkdir -p ~/.hermai && chmod 700 ~/.hermai
echo "platform_key: hm_sk_YOUR_KEY" > ~/.hermai/config.yaml
chmod 600 ~/.hermai/config.yaml
```

You can get an API key from https://hermai.ai/dashboard (GitHub sign-in).

## 3. Validate your schema before pushing

Before pushing, make sure `/tmp/my-schema.json` includes the required fields:

- `site` — e.g. `"news.ycombinator.com"`
- `intent_category` — likely `"knowledge"` or `"developer"` for Hacker News
- `schema_format_version` — must be `"0.1"`
- `endpoints` — array with at least one endpoint using `url_template` (not `url`)

Also confirm it does **not** contain any forbidden fields: `tls_fingerprint`, `proxy_credentials`, `clearance_cookies`, `bypass_method`, `residential_proxy`, `stealth_script`, `clearance_cookie_js`.

## 4. Push the schema

**If the CLI is available:**

```bash
hermai registry push /tmp/my-schema.json
```

**If the CLI is not available, use the API directly:**

```bash
curl -X POST https://api.hermai.ai/v1/schemas \
  -H "Authorization: Bearer hm_sk_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d @/tmp/my-schema.json
```

## 5. Verify it's published

```bash
hermai registry list --query "hacker news"
```

Or via API:

```bash
curl -s "https://api.hermai.ai/v1/schemas?q=hacker+news"
```

Once pushed, other agents can pull and use the schema with:

```bash
hermai registry pull news.ycombinator.com --intent "browsing top stories and comments on Hacker News"
```
