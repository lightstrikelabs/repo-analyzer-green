# Agent Development Rules

These rules apply to all agentic development work in this repository.

## Required Reading

Before making code, test, tooling, or architecture changes, read:

- [docs/architecture.md](docs/architecture.md)
- [docs/development-plan.md](docs/development-plan.md)

If a task conflicts with those documents, call out the conflict before editing. If the task changes architecture, update the architecture document in the same PR.

## 1. Scope Sessions And PRs Sanely

- Define the slice before changing code.
- Keep each session and PR focused on one coherent outcome.
- Default to one issue per PR and one PR per issue.
- If an issue must be split across multiple PRs, document the sequence in the issue before opening follow-up PRs.
- If multiple tiny issues must be bundled, document why in the PR body and keep the bundle within one coherent slice.
- Do not bundle unrelated refactors, framework churn, or opportunistic cleanup into feature work.
- If the scope needs to change, state the new scope explicitly before continuing.

## 2. Enforce A Quality Baseline

- Keep linting and type checks opinionated.
- Treat lint/type failures as blockers, not suggestions.
- Prefer explicit domain types over loose structural objects when behavior matters.
- Do not weaken lint, type, or test settings to make a change pass.
- Avoid `as any` like the plague.
- Avoid `as unknown` whenever possible. Most cases should be handled with Zod parsing, type guards, discriminated unions, or better generic boundaries.
- Any unavoidable type assertion must be narrow, local, and justified by nearby validation or platform constraints.

## 3. Protect The Core Workflow With One Foundational E2E Test

- Maintain at least one end-to-end integration test that exercises the main repository-analysis workflow.
- The test should catch total product derailments even when lower-level tests pass.
- Keep the foundational E2E test stable, deterministic, and independent of paid/network model calls.
- Use fake or fixture-backed adapters where needed.

## 4. Use PR Discipline

- Always open PRs against an upstream branch.
- Require CI green checks before merging.
- Keep CI aligned with local commands for lint, type checks, tests, and the foundational E2E path.
- Do not merge work that bypasses failing checks unless there is an explicit documented exception.
- Use Conventional Commits for all commit subjects.
- Include a high-signal commit body with a second `-m` for non-trivial changes so future `git blame` readers can understand intent and tradeoffs.

## 5. Respect Software Fundamentals

- Code quality still comes from fundamentals: clear boundaries, cohesive modules, low accidental complexity, useful tests, readable names, and simple data flow.
- Static metrics and LLM reviews are evidence, not substitutes for engineering judgment.
- Be self-aware about your skillset and uncertainty. When making a claim about architecture, language semantics, security, or testing, back it with evidence from the repo or call out the gap.
- Prefer boring, explicit designs over clever abstractions until the domain proves the need.

## Project-Specific Direction

- This project is domain-first. Keep domain logic independent of framework, filesystem, network, GitHub, and model-provider details.
- Use fake adapters for tests before wiring real infrastructure.
- Preserve provenance, confidence, caveats, and missing evidence in report behavior.
- Do not treat raw test LOC, raw coverage, or single static scores as direct proof of repository quality.
