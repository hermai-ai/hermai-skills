# Static harness requirements

Create `.hermai/brand-preview-harness.html` from the approved dashboard components and styles.

## Fidelity

* Match the visible layout, spacing, typography, navigation, cards, tables, and primary actions.
* Use mock company, user, usage, and status data.
* Keep the dashboard structure familiar. Change only approved customer identity surfaces.
* Put `{{HERMAI_COMPANY_NAME}}` inside the element with `data-hermai-company`.
* Put `{{HERMAI_LOGO_STANDARD}}`, `{{HERMAI_LOGO_COMPACT}}`, and `{{HERMAI_LOGO_ON_DARK}}` inside appropriate elements with `data-hermai-logo`.
* Use `--hermai-brand`, `--hermai-on-brand`, `--hermai-text-accent`, `--hermai-tint`, `--hermai-border`, `--hermai-focus`, and `--hermai-data-primary` for approved brand surfaces.
* Keep semantic status colors, code, API keys, user photos, integration marks, and the application canvas independent from these variables. This includes a profit or loss, danger, or success color. Render warns when a selector name reads as a status color and is still bound to a token, but treat that warning as a prompt to check by hand, not as the only safeguard.

## Safety

* Write one self contained HTML file under `.hermai/`.
* Keep `.hermai/` ignored by Git so the preview cannot enter a commit by accident.
* Do not import application modules or packages.
* Do not include scripts, forms, frames, remote URLs, network requests, or real customer data.
* Do not copy secrets, tokens, cookies, browser state, analytics identifiers, or environment values.
* Do not change application source while building the preview.

## Review

Tell the developer which source files informed the harness. Call out any part that uses an approximation because runtime data or authentication changes its layout.

Test long code, API key, company name, and button rows at the narrowest preview width. Give flexible content `min-width: 0`, truncate protected values inside their own container, and keep actions fixed size. No action may cross a card boundary.
