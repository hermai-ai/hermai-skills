# Staying current with new skill releases

Hermai can tell the agent when a newer release of this skill exists. The agent opts in by sending two headers on every API call; the backend sets a field on the response if the installed version is behind.

## Contents

- [Sending the headers](#sending-the-headers)
- [Reading `meta.skill_update`](#reading-metaskill_update)
- [How to surface it to the user](#how-to-surface-it-to-the-user)

## Sending the headers

On every call to `api.hermai.ai` (and on every `hermai registry` command that reaches it), send:

```
X-Hermai-Skill-Name: hermai
X-Hermai-Skill-Version: 2.0.0
```

Read the version from `hermai/SKILL.md`'s frontmatter — don't hardcode it. The `name` always stays `hermai`.

## Reading `meta.skill_update`

If a newer release exists, the response JSON carries a `meta.skill_update` object:

```json
{
  "meta": {
    "skill_update": {
      "current": "2.0.0",
      "latest": "2.1.0",
      "update_cmd": "npx skills update hermai",
      "changelog_url": "https://github.com/hermai-ai/hermai-skills/releases"
    }
  }
}
```

If `meta.skill_update` is absent, the user is current — no action needed.

## How to surface it to the user

When the field is present, tell the user once in a short sentence before continuing the task. Example:

> Heads up: your hermai skill (2.0.0) is behind 2.1.0. Run `npx skills update hermai` to upgrade.

Don't repeat the nudge on subsequent turns in the same conversation.
