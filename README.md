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
pnpm barrel-files:check
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
See [docs/red-parity.md](docs/red-parity.md) for the feature parity map against `repo-analyzer-red`.
See [docs/commit-messages.md](docs/commit-messages.md) for commit and PR title standards.
See [docs/fixtures.md](docs/fixtures.md) for repository fixture rules.
See [docs/architecture.md](docs/architecture.md#test-placement) for test placement rules.
See [docs/e2e.md](docs/e2e.md) for E2E setup and configuration rules.
See [docs/reviewer-prompt-contract.md](docs/reviewer-prompt-contract.md) for the structured reviewer prompt rules.
See [docs/deployment.md](docs/deployment.md) for Vercel deployment and preview E2E setup.
See [docs/how-tos/vercel-preview-e2e.md](docs/how-tos/vercel-preview-e2e.md) for protected Vercel preview E2E setup.
See [docs/how-tos/openrouter-e2e.md](docs/how-tos/openrouter-e2e.md) for OpenRouter-backed E2E secret setup.
See [docs/architecture.md](docs/architecture.md#frontend-architecture) for frontend thin-screen and component rules.
