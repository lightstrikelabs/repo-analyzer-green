# Fork-Day Setup

This is the long-form verification an agent (or a person) should run the first time they open this repo on a new machine. The `/preflight` skill (`.agents/skills/preflight/SKILL.md`) automates most of it; this doc explains the *why* and gives copy-pasteable commands for fixing any check that fails.

If you're an agent, the AGENTS.md `## Before Any Code` checklist asks you to run `/preflight` and paste the output. That's normally enough. Read the rest of this doc only when a check fails or you're setting things up for the first time.

## Quick run

```bash
# from a fresh clone
pnpm install
node .agents/skills/preflight/scripts/preflight.ts
```

Expect to see every row pass except possibly Vercel (skipped on machines that don't deploy this repo) and the network-dependent rows (skipped if you've set `PREFLIGHT_SKIP_NETWORK=1`).

## Each check, in detail

### 1. GitHub CLI authentication (`gh auth status`)

```bash
gh auth status
```

Why: agents in this repo use `gh` to open issues and PRs (`gh pr create`, `gh issue create`). Anything else built on it (the `/distill-issue` skill in #143) silently produces wrong results without auth.

If it fails: run `gh auth login` (browser flow). Inside CI or non-interactive shells, set a `GH_TOKEN` env var instead.

### 2. Git remote (`git remote get-url origin`)

```bash
git remote -v
```

Why: every PR opens against `origin`. A clone created without the remote (uncommon but happens) breaks `git push` and the GitHub-side automations.

If it fails: `git remote add origin git@github.com:lightstrikelabs/repo-analyzer-green.git` (or HTTPS).

### 3. Branch protection on `main`

```bash
gh api repos/lightstrikelabs/repo-analyzer-green/branches/main/protection
```

Why: AGENTS.md disallows direct pushes to `main` and requires CI green before merge. If branch protection isn't configured (or isn't readable), unintended direct pushes can happen.

If it fails: requires admin access to the repo. Configure under Settings → Branches on GitHub.

### 4. Vercel project link (`.vercel/project.json`)

```bash
ls .vercel/project.json
# or
vercel link
```

Why: the Vercel preview deploys are part of the PR feedback loop. Each PR comment pulls in the deploy URL. A clone without the link can't run preview deploys locally.

If it's `skip`: only matters if you're driving deploys from this clone. Most agents don't need it.

### 5. lefthook install

```bash
pnpm exec lefthook install
```

Why: the commit-time red-green gate (#114) and the conventional-commit check both run via lefthook hooks at `.git/hooks/pre-commit` and `.git/hooks/commit-msg`. Without `lefthook install`, those hooks don't exist and commits skip the gates entirely.

If it fails: re-run the command above. Verify with `cat .git/hooks/pre-commit` (should reference `lefthook`).

### 6. Node version

```bash
node --version
grep '"node"' package.json
```

Why: the project pins a Node major version under `engines.node` to keep TypeScript stripping, native fetch, and Next.js 16 behavior consistent.

If it fails: `nvm use` (a `.nvmrc` is on the way; until then, use the version from `package.json`).

### 7. pnpm version

```bash
pnpm --version
grep '"pnpm"' package.json
```

Why: `engines.pnpm` is pinned exactly. Lockfile resolution and the workspace install behavior change between minor pnpm versions.

If it fails: enable corepack and pin the version:

```bash
corepack enable
corepack prepare pnpm@$(node -p "require('./package.json').engines.pnpm") --activate
```

### 8. CI workflow files

```bash
ls .github/workflows
```

Why: the Quality Gate and Preview E2E workflows enforce the `pnpm check` and `pnpm test:e2e` gates on every PR. A fork without workflow files merges without a gate.

If it fails: the workflows live on `main`; rebase your fork or copy the files in.

### 9. Claude Code red-green hook (`.claude/settings.json`)

```bash
node -e 'console.log(Object.keys(JSON.parse(require("fs").readFileSync(".claude/settings.json","utf8")).hooks ?? {}))'
```

Why: the in-session PreToolUse gate (#105) lives here. Without it, agents can edit `src/**` source files without a colocated test file in the same session, defeating the TDD lever the project relies on. See `docs/agent-compat.md` for the equivalent Codex configuration in `.codex/config.toml`.

If it fails: the hook config is on `main`; rebase or copy `.claude/settings.json` and `scripts/red-green-gate.ts`.

## Cross-agent setup

If you're driving this repo from a non-Claude agent, also read `docs/agent-compat.md`. The skills layout is shared via symlinks; the hook needs to be wired separately for Codex (`.codex/config.toml`) and pi (deferred — see issue #144).

## Windows notes

The cross-agent symlinks (`.claude/skills`, `.codex/skills`, `.pi/skills`) require Developer Mode (Windows 10 1703 or later) or admin privileges. On a Windows clone without those, the symlinks resolve to broken targets. There is no first-class workaround in this repo yet; raise an issue if you need one.

## Bootstrapping notes

When you're authoring `/preflight` itself (PR #142, the one that introduced this doc), the manual checklist *is* the preflight. The `## Before Any Code` item 3 artifact in that PR is "bootstrap exempt — see PR description." Subsequent PRs use the skill output instead.
