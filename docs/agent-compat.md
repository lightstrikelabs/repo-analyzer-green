# Cross-Agent Compatibility

This repo is exercised by three coding-agent CLIs: Claude Code, OpenAI Codex CLI, and pi (Mario Zechner's `@mariozechner/pi-coding-agent`). Each agent has its own preferred config directory and hook system, but skills and shell-style hooks can be shared. This doc captures the compatibility scaffold and what each agent looks for.

## Tested versions

| Agent | Version (verified locally) | Skill format | AGENTS.md native | Hook system |
|---|---|---|---|---|
| Claude Code | 2.1.119 | Anthropic Agent Skills (`SKILL.md` + frontmatter) | yes | shell commands in `.claude/settings.json` (`hooks` block) |
| Codex CLI | 0.125.0 | Anthropic Agent Skills (`SKILL.md` + frontmatter) | yes | shell commands in `.codex/config.toml` (`[hooks.<event>]` blocks); project-local hooks require trust |
| pi | 0.70.2 (`@mariozechner/pi-coding-agent`) | Anthropic Agent Skills (`SKILL.md` + frontmatter; lenient about violations) | yes (`--no-context-files` to disable) | JS extension API (`pi.on("tool_call", ...)` returning `{ block: true, reason }`); a thin extension at `.pi/extensions/red-green-gate/` wraps the same `scripts/red-green-gate.ts` |

## Canonical skill store: `.agents/skills/`

All shareable skills live at `.agents/skills/<name>/SKILL.md`. Pi reads this path natively. The other two agents reach it via relative symlinks at the locations they expect:

```
.claude/skills  ->  ../.agents/skills
.codex/skills   ->  ../.agents/skills
.pi/skills      ->  ../.agents/skills
```

Pi also reads `.agents/skills/` directly without the symlink, so the `.pi/skills` link is redundant but kept for consistency.

A skill written once is discoverable by every agent. Don't duplicate skill content across `.claude/skills/`, `.codex/skills/`, or `.pi/skills/`; everything goes in `.agents/skills/`.

## Hooks

Hook compatibility is partial:

- **Claude Code + Codex** share the same shell-command paradigm with `PreToolUse`/`PostToolUse`/`SessionStart` matchers and a `matcher` regex. The same script (`scripts/red-green-gate.ts`) is invoked from both — only the config file differs:
  - Claude Code: `.claude/settings.json` (`"hooks": { "PreToolUse": [...] }`)
  - Codex CLI: `.codex/config.toml` (`[[hooks.PreToolUse]]` ... `[[hooks.PreToolUse.hooks]]`)
- **Pi** uses a JS extension API where extensions subscribe to events programmatically. The shim lives at `.pi/extensions/red-green-gate/`: a small TypeScript translator turns pi's `tool_call` event into the same JSON payload Claude Code and Codex send to the script via stdin, then `spawnSync`s `scripts/red-green-gate.ts` and translates its exit code back into pi's `{ block: true, reason }` return value. Same script, same ledger, same allowlist.

The hook script (`scripts/red-green-gate.ts`) reads the project root from `$CLAUDE_PROJECT_DIR` if set, otherwise falls back to `process.cwd()`. Codex spawns hooks from the project root, so the fallback works without explicit env wiring; if a future agent needs an explicit override, add it inline in the hook command.

## AGENTS.md handling

All three agents load `AGENTS.md` automatically at session start. `CLAUDE.md` is also picked up by Claude Code and is currently a one-line alias to `AGENTS.md`. There's nothing to do here beyond keeping `AGENTS.md` accurate.

## Trust gating (Codex-specific)

Codex disables project-local config, hooks, and exec policies in untrusted projects. Skills still load. To enable hooks for a clone of this repo, mark it trusted in `~/.codex/config.toml`:

```toml
[projects."/abs/path/to/this/repo"]
trust_level = "trusted"
```

Codex also surfaces an "External migration" prompt that may suggest importing detected Claude Code config; that prompt is informational, not required.

## Symlink portability

The symlinks are committed to git as relative paths (`../.agents/skills`). On macOS and Linux they Just Work. On Windows they require Developer Mode (since Windows 10 1703) or admin privileges; if a Windows user can't enable that, a `pnpm setup:windows` materialization script (copying instead of linking) is the next step — not built yet, raise an issue if you need it.

## Adding a new skill

See `docs/skills.md` (planned: project skill conventions issue). Until that lands, the short form: create `.agents/skills/<name>/SKILL.md` with valid Anthropic Agent Skills frontmatter (`name`, `description`); each agent will discover it through its respective path.

## Updating the red-green hook surface

When changing red-green behavior, update all three surfaces together (or document why they intentionally diverge):

- `scripts/red-green-gate.ts` — the shared decision logic
- `.claude/settings.json` — Claude Code's hook entry
- `.codex/config.toml` — Codex's hook entry
- `lefthook.yml` — the commit-time gate
- `.pi/extensions/red-green-gate/index.ts` and `.pi/extensions/red-green-gate/translator.ts` — pi's extension shim
