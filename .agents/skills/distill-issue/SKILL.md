---
name: distill-issue
description: Drafts a GitHub issue from a brief description using the project's development-slice template (Problem, Intended Outcome, Non-Goals, Acceptance Criteria, Test Expectations, Architecture Impact, Blockers Or Dependencies). Use whenever a slice is going to be worked on but no issue exists yet — before code, per AGENTS.md `## Before Any Code` item 1.
---

# distill-issue

Turns a brief description of a slice into a properly-structured GitHub issue and files it via `gh`. Returns the URL the agent can paste as the `Before Any Code` linked-issue artifact.

## When to use

- The agent is about to start non-trivial work and there is no GitHub issue yet.
- A user pastes a chat description of what they want done; the agent runs this skill to capture it as an issue before editing code.
- A reviewer asks "what issue does this PR close?" and the answer is "I haven't filed one" — file it now.

## When _not_ to use

- For one-line typo fixes, formatting tweaks, or doc-only edits where the PR title and body are sufficient.
- When the user has already linked an issue.
- When the work is exploratory and not yet a coherent slice — distill into a brief plan first, then come back here.

## How to invoke

The skill includes a renderer that produces the issue body Markdown. The agent fills in each field, renders, and creates the issue with `gh`.

```bash
cat <<'EOF' | node .agents/skills/distill-issue/scripts/render-issue-body.ts
{
  "title": "feat(ui): add PDF export of the report card",
  "labels": ["type:ui", "priority:medium", "red-green-refactor"],
  "problem": "<one short paragraph>",
  "intendedOutcome": "<what should be true when this is done>",
  "nonGoals": ["<bulleted non-goal>", "..."],
  "acceptanceCriteria": ["<task-list item>", "..."],
  "testExpectations": "<what tests will be added or updated>",
  "architectureImpact": "<which boundaries / docs are touched>",
  "blockers": "None."
}
EOF
```

The renderer prints the issue body to stdout. The agent then files the issue:

```bash
gh issue create \
  --repo lightstrikelabs/repo-analyzer-green \
  --title "<title>" \
  --label "<comma-separated-labels>" \
  --milestone "<milestone-name-if-any>" \
  --body "$(cat <body-from-renderer>)"
```

`gh issue create` returns the URL on stdout. Paste that URL into chat as the AGENTS.md `Before Any Code` item-1 artifact.

## Field guidance

| Field                | What to write                                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `title`              | Conventional Commits style: `<type>(<scope>): <imperative summary>`. Same shape as the eventual PR title.                        |
| `labels`             | At least a `type:*` and a `priority:*` label. Add `red-green-refactor` if the slice has behavior that needs failing tests first. |
| `problem`            | One short paragraph. What is broken or missing today, framed as user-facing impact when possible.                                |
| `intendedOutcome`    | What is true when the slice is done. Concrete, observable.                                                                       |
| `nonGoals`           | Bulleted list of things the agent might be tempted to bundle in but should not.                                                  |
| `acceptanceCriteria` | Task-list items the reviewer will check off. Each should be testable.                                                            |
| `testExpectations`   | What tests are added/updated. Reference file paths when known.                                                                   |
| `architectureImpact` | Which directories, ports, or schemas this touches. Cross-link to `docs/architecture.md` if relevant.                             |
| `blockers`           | Other issues or decisions this depends on. `None.` is fine.                                                                      |

## Output

The renderer emits the body of the issue. It does not invoke `gh` itself — the agent runs `gh issue create` after seeing the body, so the human can review the draft before it lands on GitHub.

## See also

- [AGENTS.md `## Before Any Code`](../../../AGENTS.md) — the checklist that consumes this skill's output (`linked issue` artifact).
- [.github/ISSUE_TEMPLATE/development-slice.md](../../../.github/ISSUE_TEMPLATE/development-slice.md) — the human-facing template this skill mirrors.
- [docs/skills.md](../../../docs/skills.md) — skill authoring conventions (frontmatter, naming).
