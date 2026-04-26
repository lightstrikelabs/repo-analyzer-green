# Repo Analyzer Green

Repo Analyzer Green helps teams understand repository quality through evidence-backed assessment.

The project treats repository quality as a combination of measurable facts, reviewer judgment, confidence, caveats, and follow-up investigation. Static analysis can collect useful evidence, but it should not pretend to be an objective verdict. Reviewer assessment, initially completed by an LLM agent, adds semantic interpretation while remaining structured, traceable, and testable.

The core report card model is:

```text
Repository Evidence
  + Structured Reviewer Assessment
  + Explicit Scoring Policy
  -> Evidence-Backed Report Card
```

## Principles

- Domain-driven architecture
- TDD red/green/refactor
- Static evidence collection before interpretation
- Structured reviewer assessments before final scoring
- Explicit confidence and limitations in every report

## Development Setup

Prerequisites:

- Node.js `24.x`, matching `.node-version`
- pnpm `10.29.3`

Install dependencies:

```bash
pnpm install
```

Run the app locally:

```bash
pnpm dev
```

Quality gates:

```bash
pnpm type-escape:check
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Commit and PR title validation:

```bash
pnpm run commit-message:check -- --message "feat(chat): model conversations"
pnpm exec lefthook install
```

Full local CI-equivalent check:

```bash
pnpm run ci
```

The scaffold intentionally contains only the application shell, architecture folders, and tooling. Repository analysis, reviewer assessment, persistence, auth, and deployment integrations are tracked as separate issues.

See [docs/development-plan.md](docs/development-plan.md) for the milestone and issue plan.
See [docs/commit-messages.md](docs/commit-messages.md) for commit and PR title standards.
