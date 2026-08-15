# Application theme contract

Use Hermai's `application_theme` when a live Brand API result is available.

* Use `identity.standard` for the normal dashboard identity area. When the only verified asset is an icon or favicon, show the returned company name beside it.
* Use `identity.compact` for compact navigation and small controls. A verified favicon can fill this slot.
* Use `identity.on_dark` only on a dark surface.
* If an identity slot has no asset, use its `fallback` and show the company name when requested.
* Use `colors.action`, `on_action`, `text_accent`, `tint`, `on_tint`, `border`, `focus`, and `data_primary` as returned.
* In `mode=observed`, use only these tokens. Do not select another raw color.
* In `mode=fallback`, `colors` is null and `fallback.strategy` is `preserve_host_theme`. Keep the host theme and show `Fallback applied`.

Do not select a different raw logo or color. Do not substitute the favicon when an identity slot is already returned. Hermai considers the favicon only when stronger observed logo evidence is unavailable. Keep API keys, code, semantic status, user photos, integration marks, and the application canvas neutral.

Do not create or redraw a logo for a real company. Use real company assets only from a saved Hermai Brand API response. Keep synthetic fixture identities fictional.
