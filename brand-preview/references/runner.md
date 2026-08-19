# Runner details

Run these commands from the application root. Resolve `<skill directory>` to the installed `brand-preview` skill folder.

```bash
node "<skill directory>/scripts/preview.mjs" inspect
```

After the developer approves the source files and surface map, initialize a reviewable configuration and static harness:

```bash
node "<skill directory>/scripts/preview.mjs" init
```

The default configuration uses five brands. Add `--pack full` only when the developer requests the full twelve brand audit.

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

Both packs are local contract fixtures and do not call the Brand API. The runner copies only its bundled local logo assets to `.hermai/brand-preview/assets` and rejects a fixture that has unreadable action text, unreadable brand text, inadequate focus contrast, or an invalid fallback.

## Bundled brands

The default pack is the first five entries below. The full pack, `--pack full`, is all twelve.

* Emberfox, `emberfox-bright`, a bright orange accent.
* Relaydesk, `relaydesk-dark`, a dark accent.
* Brightbird, `brightbird-near-white`, a near white raw accent that the theme rejects as an action color.
* Longform Technology Cooperative, `longform-cooperative`, a long company name.
* No Logo Labs, `no-logo-labs-fallback`, a missing logo and no usable accent, so the theme falls back and preserves the host app's own theme.
* Plumshade, `plumshade-dual-tone`, a dual tone brand with a violet action color and a pink text accent.
* Northgale, `northgale-corporate-dark`, a low saturation corporate dark navy accent.
* Cardinalpost, `cardinalpost-brand-red`, a brand red kept clearly distinct from the status red used for danger, negative, and blocked meaning.
* Fernway, `fernway-brand-green`, a brand green kept clearly distinct from the status green used for success and positive meaning.
* Solastro, `solastro-low-contrast`, a warm yellow accent so light it needs dark, not white, on action text.
* Onyxline, `onyxline-monochrome`, a near black accent with a minimal gray tint.
* Midoriya ミドリ屋, `midoriya-non-latin`, a full non latin display name. The bundled wordmark asset renders the mark in latin characters only; the full non latin name still renders wherever the harness places the company name text.
