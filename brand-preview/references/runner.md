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

Both packs are local contract fixtures built from saved Hermai Brand API captures and do not call the Brand API at render time. The runner copies only its bundled local logo assets to `.hermai/brand-preview/assets` and rejects a fixture that has unreadable action text, unreadable brand text, inadequate focus contrast, or an invalid fallback.

When one identity slot has no logo of its own, the runner does not always drop straight to plain text or a monogram. A standard or compact slot with no asset reuses the on dark asset on a small dark chip, and an on dark slot with no asset reuses the standard, then the compact, asset on a small light chip. Both directions only ever reuse a real captured asset already present on the same brand fixture. A monogram renders only when the brand truly has no usable asset in any slot.

## Company description binding (prefill only)

A brand fixture can carry an optional `description` (`value` plus a recorded `source`), the local stand in for the live `brand.description` field. It fills `{{HERMAI_DESCRIPTION}}` wherever the harness marks an element with `data-hermai-description`.

That attribute is valid only on a `textarea`, an `input`, or an element the operator has explicitly marked `contenteditable`, because the value is prefill material for an operator editable form field, never published, customer facing, uneditable copy such as a job board about section, a public proposal, or portal welcome text. Render warns when the binding lands on any other element. A fixture with no `description` fills the slot with a neutral placeholder instead of leaving it empty or throwing. See [harness requirements](harness.md) for the full rule and its reasons.

In the bundled pack, only `hubspot-vivid-bright` currently carries a real `description`, captured with one direct curl to `https://www.hubspot.com/`, source noted in the fixture. Every other bundled brand has no `description` yet and renders the neutral placeholder wherever a harness binds the slot.

## Bundled brands

The default pack is the first five entries below. The full pack, `--pack full`, is all twelve. Every entry is a real, well known company, captured from its live `hermai.ai` Brand API record and bundled with real logo assets. Each retains a `notes` field in the manifest wherever the fixture required an editorial choice, such as substituting a real secondary captured color for a dimension the live `application_theme` result did not itself resolve.

* HubSpot, `hubspot-vivid-bright`, a vivid bright orange accent.
* Discord, `discord-dark-theme`, a brand built around a dark themed product identity.
* Casper, `casper-near-white`, a near white declared accent that cannot serve as an action color, with the real navy captured alongside it used instead.
* The New York Times, `nytimes-long-name`, a long company name.
* Berkshirehathaway, `berkshirehathaway-no-logo`, a missing logo and no usable accent, so the theme falls back and preserves the host app's own theme.
* FedEx, `fedex-dual-tone`, a dual tone brand with a real captured orange action color and a real captured purple text accent.
* Venmo, `venmo-corporate-navy`, a corporate navy accent.
* Target, `target-brand-red`, a brand red kept clearly distinct from the status red used for danger, negative, and blocked meaning.
* Starbucks, `starbucks-brand-green`, a brand green kept clearly distinct from the status green used for success and positive meaning.
* Salesforce, `salesforce-low-contrast`, a light sky blue accent so light it needs dark, not white, on action text, with real contrast ratios close to the guard floors.
* Linear, `linear-monochrome`, a near black accent with a minimal gray tint.
* Nicovideo, `nicovideo-non-latin`, a full non latin display name (ニコニコ) with a real logo asset. The live record carries no accent color, so this fixture also exercises the fallback path.
