# Authoring Skills

Skills are self-contained capability packages that a coding agent loads on demand. This repo follows the [Anthropic Agent Skills standard](https://agentskills.io/specification): each skill is a directory whose entry point is a `SKILL.md` file with YAML frontmatter and a Markdown body.

For where skills live and how each agent discovers them, see [docs/agent-compat.md](agent-compat.md).

## Location

All project-level skills live at:

```
.agents/skills/<name>/SKILL.md
```

Pi reads `.agents/skills/` natively. Claude Code and Codex CLI reach the same directory through relative symlinks (`.claude/skills`, `.codex/skills`). Don't put skill content under `.claude/skills/`, `.codex/skills/`, or `.pi/skills/` directly — those are symlinks; everything goes in `.agents/skills/`.

A skill's directory may contain helper files alongside `SKILL.md`:

```
.agents/skills/example/
├── SKILL.md          # required: frontmatter + instructions
├── scripts/          # helper scripts the agent may invoke
├── references/       # detailed docs loaded on demand
└── assets/           # images, fixtures, templates
```

Use relative paths from `SKILL.md` to reference helper files.

## SKILL.md format

```markdown
---
name: my-skill
description: One sentence on what this skill does and when to use it. Be specific.
---

# my-skill

## When to use

...

## Setup

...

## Usage

...
```

## Frontmatter

| Field | Required | Description |
|---|---|---|
| `name` | yes | 1–64 characters, lowercase letters, digits, hyphens. No leading or trailing hyphen, no consecutive hyphens. **Must match the parent directory name.** |
| `description` | yes | Up to 1024 characters. Describes what the skill does *and when to use it*. The model decides whether to load the skill from this string, so be specific. |
| `license` | no | License name or reference to a bundled file. |
| `compatibility` | no | Up to 500 characters. Environment requirements (e.g., `requires Node 24+`). |
| `metadata` | no | Arbitrary key/value mapping. |
| `allowed-tools` | no | Space-delimited list of pre-approved tools (experimental, agent-dependent). |
| `disable-model-invocation` | no | If `true`, hides the skill from the system prompt; users must invoke it explicitly via `/skill:<name>`. |

### Naming rules (validated by every agent that follows the spec)

- Must be lowercase letters, digits, and hyphens only.
- Must not start or end with a hyphen.
- Must not contain consecutive hyphens.
- Must be 1–64 characters.
- Must match the parent directory name exactly.

### Description guidance

The description is what the model sees in the system prompt. Bad descriptions cause the model to either skip a skill that would have helped or load one that shouldn't have applied.

Good: `Web search and content extraction via the Brave Search API. Use when looking up documentation, current facts, or any web content.`

Bad: `Helps with searches.`

## Validation

Pi (the lenient implementation) warns about violations but still loads the skill. Codex is stricter. Anthropic's `skill-creator` runs the same validations:

- Name does not match parent directory.
- Name exceeds 64 characters or contains invalid characters.
- Name starts or ends with a hyphen, or has consecutive hyphens.
- Description exceeds 1024 characters.
- Description is missing entirely (this one is a hard load failure across all agents).

## Discovery across agents

| Agent | Discovery path |
|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` (project) and `~/.claude/skills/` (global) |
| Codex CLI | `.codex/skills/<name>/SKILL.md` (project, trust-gated) and `~/.codex/skills/` (global) |
| pi | `.agents/skills/<name>/SKILL.md` (walks up to git root) and `~/.agents/skills/` and `~/.pi/agent/skills/` (global) |

Because of the symlinks established by [docs/agent-compat.md](agent-compat.md), a single skill at `.agents/skills/<name>/SKILL.md` is visible to all three.

## Authoring workflow

Use Anthropic's `skill-creator` skill to scaffold a new skill. From any agent that has it installed, invoke `/skill:skill-creator` and follow its prompts. The output should be placed at `.agents/skills/<name>/`.

If you're authoring by hand:

1. Pick a name following the rules above.
2. Create `.agents/skills/<name>/SKILL.md` with valid frontmatter.
3. Add helper scripts under `scripts/`, references under `references/`, etc.
4. Write a focused, behavior-driven test in `test/tooling/<name>.test.ts` if the skill drives a script with branching logic. Pure prompt skills don't need tests; scripts do.
5. Verify the skill loads by starting a fresh agent session in the repo and confirming the skill name appears in the available-skills list.

## Review checklist for a new skill

Before merging a skill PR, the reviewer should check:

- [ ] Name matches parent directory and conforms to naming rules.
- [ ] Description is specific enough that the model knows when to use it.
- [ ] `SKILL.md` body documents *when to use* the skill near the top, not just *how*.
- [ ] Helper scripts are under the skill directory, not in `scripts/` at the repo root.
- [ ] If the skill runs shell commands or scripts, those scripts have tooling tests under `test/tooling/`.
- [ ] No secrets, tokens, or environment-specific paths checked in.
- [ ] The skill is invocable from at least Claude Code (since this repo's red-green hook runs there); ideally verified in Codex and pi too if available.
- [ ] If the skill replaces or supersedes existing tooling, the superseded code is removed in the same PR.

## References

- [Agent Skills specification](https://agentskills.io/specification)
- [Anthropic Skills repository](https://github.com/anthropics/skills) — document processing, web development, and the `skill-creator` skill.
- [Pi Skills repository](https://github.com/badlogic/pi-skills) — web search, browser automation, transcription.
- [docs/agent-compat.md](agent-compat.md) — how the three agents see this directory.
