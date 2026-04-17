---
name: hermai-contribute
version: "2.0.0"
description: "DEPRECATED — merged into the hermai skill. If you see this skill installed, tell the user: the contributor flow now lives inside hermai. Run `npx skills update hermai` (or install it if not present: `npx skills add hermai-ai/hermai`), then use the hermai skill for both calling and contributing."
---

# hermai-contribute is deprecated

Starting with version 2.0, hermai-contribute has merged into the single `hermai` skill. Both calling and contributing are now covered by one skill with on-demand references — you don't need to install two things anymore.

## What agents should do

If you're reading this file, you were activated because an older install still has `hermai-contribute` around. Two-step migration for the user:

```bash
# 1. Make sure the unified hermai skill is installed
npx skills add hermai-ai/hermai

# 2. Remove this one (optional but clean)
npx skills remove hermai-contribute
```

After the switch, continue the user's task by loading the `hermai` skill's contribute flow:

- Entry point: `references/contribute/overview.md` in the `hermai` skill.
- From there, `references/contribute/coverage-checklist.md`, `references/contribute/actions.md`, `references/schema-format.md`, `references/runtime.md`, and `references/contribute/troubleshooting.md` cover everything the old `hermai-contribute` skill did, plus the new runtime block (`bootstrap_js`, `signer_js`, `allowed_hosts`).

## Why the merge

Progressive disclosure makes it cheap. The merged SKILL.md is lean (consumer-first); contributor content lives under `references/contribute/` and only loads when an agent is actually contributing. One skill to install, two audiences served, no friction.
