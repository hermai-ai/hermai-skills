# Runner details

Run these commands from the application root. Resolve `<skill directory>` to the installed `brand-preview` skill folder.

```bash
node "<skill directory>/scripts/preview.mjs" inspect
```

After the developer approves the source files and surface map, initialize a reviewable configuration and static harness:

```bash
node "<skill directory>/scripts/preview.mjs" init
```

The default configuration uses five brands. Add `--pack full` only when the developer requests the full ten brand audit.

Update `.hermai/brand-preview.json` with the dashboard route and the short list of source files that informed the preview. Replace `.hermai/brand-preview-harness.html` with a static representation of those components. Follow [harness requirements](harness.md).

Render the local preview:

```bash
node "<skill directory>/scripts/preview.mjs" render
```

The gallery is written to `.hermai/brand-preview/index.html`. The report is at `.hermai/brand-preview/report.json`. The default gallery is a single vertical scroll of full height dashboards. It is deliberately not a side by side comparison view, because the developer must be able to review each complete dashboard.

The runner also writes `.hermai/brand-preview/integration-plan.md`. This file records the proposed brand surfaces and the source files reviewed.

Serve the gallery on the developer machine:

```bash
node "<skill directory>/scripts/preview.mjs" serve
```

Open the returned `http://127.0.0.1:4177/` URL. Do not open `index.html` in a code editor. The server binds only to `127.0.0.1`, serves only the generated preview folder, and makes no external request.

The default test pack covers bright and dark accents, a near white source color, a long company name, and a labeled missing logo fallback. Both packs are local contract fixtures and do not call the Brand API. The runner copies only its bundled local logo assets to `.hermai/brand-preview/assets` and rejects a fixture that has unreadable action text, unreadable brand text, inadequate focus contrast, or an invalid fallback.
