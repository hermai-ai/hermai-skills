# Static harness requirements

Create `.hermai/brand-preview-harness.html` from the approved dashboard components and styles.

## Fidelity

* Match the visible layout, spacing, typography, navigation, cards, tables, and primary actions.
* Use mock company, user, usage, and status data.
* Keep the dashboard structure familiar. Change only approved customer identity surfaces.
* Put `{{HERMAI_COMPANY_NAME}}` inside the element with `data-hermai-company`.
* Put `{{HERMAI_LOGO_STANDARD}}`, `{{HERMAI_LOGO_COMPACT}}`, and `{{HERMAI_LOGO_ON_DARK}}` inside appropriate elements with `data-hermai-logo`.
* Give each identity placement one logo variant in its own parent container. Put company name text only where no wordmark renders; a standard variant logo already carries the wordmark, so do not also bind `data-hermai-company` beside it. Render warns when a parent container binds more than one `data-hermai-logo`, or pairs `data-hermai-company` with a standard variant logo, but treat that warning as a prompt to check by hand, not as the only safeguard.
* Give every `.hermai-logo-image` an explicit `max-width` and `max-height` (either one shared rule for the class, or a rule per `.hermai-logo-standard` / `.hermai-logo-compact` / `.hermai-logo-on_dark` slot you use). Bundled logo assets are not uniformly pre-sized; an on-dark icon mark can ship at a native size of several hundred pixels, and constraining only the parent container's height does not constrain the image inside it. Render warns when a used logo slot has no sizing rule at all, but treat that warning as a prompt to check the rendered preview at the narrowest width by hand, not as the only safeguard.
* Use `--hermai-brand`, `--hermai-on-brand`, `--hermai-text-accent`, `--hermai-tint`, `--hermai-border`, `--hermai-focus`, and `--hermai-data-primary` for approved brand surfaces.
* Keep semantic status colors, code, API keys, user photos, integration marks, and the application canvas independent from these variables. This includes a profit or loss, danger, or success color. Render warns when a selector name reads as a status color and is still bound to a token, but treat that warning as a prompt to check by hand, not as the only safeguard.

## Company description (prefill only, not published copy)

`brand.description` (hermai-api PR #766, unmerged) is verbatim, self authored text pulled from the company's own homepage, capped at roughly 500 characters, with a recorded source for each field. Treat it strictly as prefill material for a form field the operator can still edit. Do not bind it into anything the operator cannot change before a customer sees it.

* Put `{{HERMAI_DESCRIPTION}}` only inside an element that carries `data-hermai-description`, and only on a `textarea`, an `input`, or an element you have explicitly marked `contenteditable`. These are the three cases where the value stays open for the operator to review and change.
* Never bind `data-hermai-description` to a published, customer facing, uneditable surface. Concrete examples: a job board about section, a public proposal, portal welcome copy, an email template, or any other place a customer reads the text as final and the operator has no edit step in front of it.
* When a fixture carries no `description`, the slot fills with a neutral placeholder that says the field is optional and awaiting operator input. Do not treat empty as an error.
* Render warns when `data-hermai-description` lands on any other element type. Treat that warning the same way as the other guards in this file, a prompt to check the placement by hand, not the only safeguard.

Reasons to hold this line, so the rule reads as a decision and not a preference:

* Wrong entity risk. A domain can change hands, for example through an acquisition, and structured data on the page can point at a company that no longer owns the domain. A description bound straight to a public surface can then describe the wrong company.
* SEO tone mismatch. The text was written for that company's own homepage in that company's own search and marketing voice. Republished on a different site, that voice reads odd or off brand.
* Liability of transferring self authored claims. Publishing another company's own words on a surface the operator controls hands the operator a claim they did not write and cannot fully stand behind if it turns out wrong or outdated.
* Length, language, and direction risk. The value can run up to 500 characters, in the company's own language, and in that language's own writing direction. An uneditable layout built for a short internal label is not built to hold that safely; an editable field is.

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
