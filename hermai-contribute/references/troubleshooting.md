# Validation Error Codes

When a push is rejected, the API returns one of these codes.

| Code | Meaning | Fix |
|------|---------|-----|
| `UNAUTHORIZED` | Missing/invalid API key | Run `hermai registry login` or check `~/.hermai/config.yaml` |
| `MISSING_FIELD` | Required field missing | Check `site`, `intent_category`, `schema_format_version`, or per-endpoint `name`/`method`/`url_template` |
| `UNKNOWN_CATEGORY` | `intent_category` not in canonical list | See [schema-format.md](schema-format.md) for valid categories |
| `FORBIDDEN_FIELD` | Disallowed session field | See [sessions.md](sessions.md) — usually means cookie values instead of names, or raw proxy credentials |
| `FORBIDDEN_NAME` | Schema/endpoint name contains forbidden pattern | See [sessions.md](sessions.md) — remove words like `bypass`, `circumvent`, `cf-clearance` |
| `INVALID_SCHEMA_VERSION` | `schema_format_version` is not `"0.1"` | Set it to exactly `"0.1"` |

## Common fix pattern

Most `FORBIDDEN_FIELD` rejections happen because the schema encodes evasion logic that belongs in client code. Move `clearance_cookies`, `bypass_method`, or `tls_fingerprint` out of the schema. Keep only public documentation of what a local browser does — cookie names, bootstrap URL, sign function reference, TLS profile name.
