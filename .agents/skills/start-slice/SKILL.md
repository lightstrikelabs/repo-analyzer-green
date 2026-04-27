---
name: start-slice
description: Bootstraps a fresh slice on top of main once an issue exists. Refreshes main, creates a `worktrees/<issue#>-<slug>` worktree, runs `pnpm install`, and runs `/preflight` so the AGENTS.md `## Before Any Code` artifacts (branch, preflight) drop into chat without manual ceremony. Use right after `/distill-issue` returns an issue URL, or right after picking up an existing issue to begin work.
---

# start-slice

Walks the agent through the three boilerplate steps at the start of every slice — refresh main, branch into a worktree, run preflight — so item 2 (branch) and item 3 (preflight output) of the AGENTS.md `## Before Any Code` checklist produce themselves.

## When to use

- Right after `/distill-issue` returns an issue URL.
- When picking up an existing issue (e.g., grabbing a `priority:high` from the Workshop Refinement milestone).
- Whenever the agent is about to write code but has not yet branched off main.

## When _not_ to use

- When you're already in a feature branch and just need to update a PR — `git pull --rebase` is the right tool then.
- For hotfixes that branch from a release tag instead of `main`.
- For exploratory spikes that won't ship; just `git checkout -b` somewhere and don't worry about worktrees.

## How to invoke

The skill ships a script that plans and executes the steps. Always start with `--dry-run` so the agent can paste the plan into chat for the user to sanity-check before anything runs.

```bash
node .agents/skills/start-slice/scripts/start-slice.ts \
  --issue 143 \
  --slug workflow-skills \
  --dry-run
```

The script refuses to proceed if:

- The current branch is anything other than `main`.
- The working tree has uncommitted changes.
- The slug is not lowercase-hyphenated (per the same naming rules as skill names).
- The issue number is not a positive integer.

When the dry-run output looks right, re-run without `--dry-run`:

```bash
node .agents/skills/start-slice/scripts/start-slice.ts \
  --issue 143 \
  --slug workflow-skills
```

The script then:

1. `git fetch origin main`
2. `git worktree add ../worktrees/<issue#>-<slug> -b <issue#>-<slug> origin/main`
3. `pnpm install --frozen-lockfile` inside the new worktree
4. `PREFLIGHT_SKIP_NETWORK=1 node .agents/skills/preflight/scripts/preflight.ts`

After it exits, the agent is in (or should `cd` into) the new worktree and writes the failing test first, per AGENTS.md.

## What "slug" should be

The slug is the human-readable name appended to the issue number. Use lowercase letters, digits, and hyphens, no leading or trailing hyphen, no consecutive hyphens. Match the eventual PR's noun, e.g.:

- Issue 143 → `--slug workflow-skills`
- Issue 142 → `--slug preflight-skill`
- Issue 139 → `--slug cross-agent-compat`

Branches end up named `<issue#>-<slug>`, e.g., `143-workflow-skills`. Worktrees end up at `worktrees/<issue#>-<slug>` relative to the repo root.

## Why a worktree, not a branch in-place

- Multiple slices can be in flight simultaneously without `git checkout` thrashing.
- The Claude Code session that originally landed in `demo/` does not need to switch directories — the new worktree gets its own checkout.
- Stacked PRs can branch from a sibling worktree without disturbing the main checkout.

The trade-off: each worktree gets its own `node_modules/`, so `pnpm install` runs fresh. That's a few seconds; deemed acceptable.

## See also

- [AGENTS.md `## Before Any Code`](../../../AGENTS.md) — items 2 and 3 of the checklist.
- [`distill-issue`](../distill-issue/SKILL.md) — usually the previous step; produces the issue URL that becomes `--issue`.
- [`preflight`](../preflight/SKILL.md) — invoked at the end of this skill.
- [docs/skills.md](../../../docs/skills.md) — skill authoring conventions.
