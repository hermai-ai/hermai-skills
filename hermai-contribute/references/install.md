# CLI Installation

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

Verify installation:

```bash
hermai --version
hermai doctor
```
