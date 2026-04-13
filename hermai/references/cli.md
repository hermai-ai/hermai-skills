# Hermai CLI — Installation and Commands

The CLI is a convenience wrapper around the API. Both reach the same backend.

## Install

```bash
# macOS Apple Silicon
curl -L https://github.com/hermai-ai/hermai-cli/releases/latest/download/hermai_darwin_arm64.tar.gz | tar xz
sudo mv hermai /usr/local/bin/

# macOS Intel
curl -L https://github.com/hermai-ai/hermai-cli/releases/latest/download/hermai_darwin_amd64.tar.gz | tar xz
sudo mv hermai /usr/local/bin/

# Linux amd64
curl -L https://github.com/hermai-ai/hermai-cli/releases/latest/download/hermai_linux_amd64.tar.gz | tar xz
sudo mv hermai /usr/local/bin/
```

## Authenticate

```bash
hermai registry login
```

Or write config directly:

```bash
mkdir -p ~/.hermai && chmod 700 ~/.hermai
echo "platform_key: hm_sk_YOUR_KEY" > ~/.hermai/config.yaml
chmod 600 ~/.hermai/config.yaml
```

Keys come from https://hermai.ai/dashboard.

## Consumer commands

```
hermai registry list [--category X] [--query X]    List public schemas
hermai registry pull <site> --intent "..."          Download full schema JSON
hermai registry login                               Save API key
hermai fetch <url>                                  Quick structured data fetch
hermai catalog <url>                                Show cached endpoints (no discovery)
hermai schema <url>                                 Show cached schema
hermai cache list                                   List cached schemas
hermai doctor                                       Check system readiness
hermai session bootstrap <site>                     Warm browser session for anti-bot sites
hermai session status <site>                        Show saved session
hermai session list                                 List all saved sessions
```

For `hermai registry push`, `hermai discover`, `hermai probe`, `hermai extract`, and other discovery-toolkit commands, use the **hermai-contribute** skill.

## Example flow

```bash
hermai registry list --query "airbnb"
hermai registry pull airbnb.com --intent "finding SF rentals for a weekend trip, 2 adults"
# Reads airbnb.com.schema.json — contains endpoints with url_template and params
curl "https://www.airbnb.com/api/v2/explore_tabs?q=san-francisco&limit=20"
```
