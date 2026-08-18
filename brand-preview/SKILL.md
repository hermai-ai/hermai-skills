---
name: brand-preview
description: Build a private code based preview of a local React or Next.js dashboard across Hermai's bundled customer brand test pack. Use when a developer wants to test automated customer branding, inspect dashboard components, choose safe brand surfaces, or review a white label experience without login, API credits, or source upload.
---

# Brand Preview

Build a temporary static dashboard harness from the relevant application components. Then use the bundled runner to render five local customer theme fixtures. The runner makes no Brand API request. It applies the same `application_theme` contract that the API returns and labels bundled fixtures as local test data, not live extraction results. Render each preview at its natural dashboard height in one vertical scroll. Do not use a cramped comparison grid as the default view.

## Privacy boundary

Keep the repository, preview, report, and configuration on the developer machine.

Do not read `.env`, `.git`, `node_modules`, browser profiles, or files outside the current repository. Do not retrieve live domains. Do not send source code, preview files, local paths, or customer data to Hermai.

## Workflow

1. Run the bundled `scripts/preview.mjs inspect` command from the application root.
2. Read only the likely dashboard components and styles. Use mock company and user data. Do not run the application or access its session.
3. Present the source files and an `apply`, `protect`, and `uncertain` surface map.
4. Wait for approval before writing `.hermai/`. Keep the generated folder ignored by Git.
5. Run `scripts/preview.mjs init`. Replace the generated harness with a faithful static representation of the dashboard code. Follow [harness requirements](references/harness.md). Never bind a semantic status color, such as a profit or loss, danger, or success color, to a hermai brand token. Render now warns when a binding's selector name reads as a status color, but that check is a heuristic prompt, not a guarantee. Confirm every flagged binding by hand, and do not rely on the absence of a warning to prove a binding is safe. Give each identity placement one logo variant and keep it in its own parent container; put company name text only where no wordmark renders. Render now warns when a parent container binds more than one `data-hermai-logo`, or pairs `data-hermai-company` with a standard variant logo, but treat that warning the same way, a prompt to check by hand, not a guarantee.
6. Run `scripts/preview.mjs render` as shown in [runner details](references/runner.md).
7. Run `scripts/preview.mjs serve` and open its private localhost URL. Do not open `index.html` in a code editor. Scroll through each complete dashboard before summarizing overflow, contrast, long name, missing logo, and fallback results.
8. Verify that long company names, code, API keys, and adjacent actions stay inside their cards at the narrowest preview width. Treat overflow as a harness defect before proposing application changes.
9. Treat a correction such as "leave navigation neutral" as a protected surface. Update only the temporary harness and render again.
10. Show the proposed application changes separately. Do not edit application source until the developer approves implementation.

## Mapping policy

Apply only approved semantic surfaces:

* Customer logo and company name in identity surfaces, with standard, compact, and on dark slots.
* Primary actions, selected navigation, active tabs, links, focus indicators, progress, one nonsemantic data series, and customer context cards.
* Onboarding or empty state tints and nonsemantic badges when text remains readable.

Protect errors, warnings, destructive actions, semantic status colors, user photos, integration logos, ordinary text, code, API keys, and the application canvas. Keep semantic chart colors neutral. A raw Brand API response provides selected identity slots and an application theme. Do not ask the caller to rank logos or colors. Never invent a customer accent. When `application_theme.mode` is `fallback`, preserve the host theme and label `Fallback applied`.

Never pair a real company name with a fabricated logo or guessed brand asset. A real company fixture must come from a saved Hermai Brand API response and retain its provenance. Synthetic fixtures must use fictional names and reserved `.test` domains.

Ask one focused question if the route, selector, or token mapping is uncertain. Do not replace raw colors globally. Label a no accent result as `Fallback applied`.

## Approval boundaries

Inspection is read only. Preview writes only under `.hermai/`. It does not need a local server, login, browser session, or application runtime.

Do not install a dependency, write application source code, commit, push, deploy, or share an artifact unless the developer separately asks.
