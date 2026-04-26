# Architecture

## Architectural Thesis

Repo Analyzer Green is a domain-first application. Frameworks, model providers, GitHub access, storage, and identity are adapters around a tested domain core.

A quality report is produced by combining:

1. Deterministic repository evidence
2. Structured reviewer assessment
3. Explicit scoring and confidence policy

The application should preserve provenance, caveats, missing evidence, and confidence for every major conclusion.

## Recommended Stack

### Application Shell

- Next.js App Router for the web UI and API routes
- React for interactive report and chat surfaces
- TypeScript for all application, domain, and infrastructure code

Next.js is a good fit because the app needs a browser UI, API boundaries, server-side repository analysis, and future auth/database integration. The domain must remain independent of Next.js.

## Scaffolding Strategy

Scaffold in two passes: first the framework/tooling skeleton, then the first vertical domain slice. Do not start by cloning the red UI or wiring real GitHub/model infrastructure.

### Pass 1: Project Skeleton

Use `create-next-app` only for the framework shell, then reshape the project around this architecture.

Recommended choices:
- Next.js App Router
- TypeScript
- Tailwind
- `src/` directory
- pnpm package manager
- Oxlint as primary linting instead of inheriting an ESLint-first workflow

Add project tooling immediately:
- `oxlint`
- `prettier`
- strict TypeScript config
- `vitest`
- `@playwright/test`
- `zod`
- `react-hook-form`
- `@hookform/resolvers`
- `lefthook`

Initial structure:

```text
src/
  domain/
    shared/
    repository/
    evidence/
    reviewer/
    scoring/
    report/
    chat/
  application/
    analyze-repository/
    start-conversation/
    continue-conversation/
  infrastructure/
    filesystem/
    github/
    llm/
    persistence/
    identity/
  app/
    api/
    page.tsx
test/
  fixtures/
  support/
e2e/
docs/
scripts/
```

### Pass 2: First Vertical Slice

The first implemented behavior should be:

```text
Given a local fixture repository and a fake reviewer assessment,
produce an evidence-backed report card.
```

This slice should exercise:
- Domain types
- Zod schemas
- Fake repository source
- Fake reviewer
- Scoring policy
- Application service
- Fixture-backed tests

Avoid in the first slice:
- GitHub archive downloads
- Real LLM calls
- Auth
- Database persistence
- Full UI complexity

### Scaffolding Order

1. Initialize the Next.js app and package manager.
2. Add Oxlint, Prettier, strict TypeScript, Vitest, Playwright, Zod, and Lefthook.
3. Add CI workflow and local hook configs early.
4. Add unsafe type-escape guard script.
5. Add commit message enforcement.
6. Create domain, application, and infrastructure folders.
7. Add the first fixture repository.
8. Write a failing domain/application test for report-card composition.
9. Implement minimal domain types and fake adapters.
10. Add minimal API/page wiring only after the domain slice works.

This order keeps tooling and architecture enforceable before product behavior grows, and keeps the first behavior focused on the domain rather than framework or provider details.

### Package Manager

Use one package manager consistently. Prefer `pnpm` for stricter dependency layout and faster installs unless deployment constraints require `npm`.

### Linting

Use Oxlint as the primary linter.

Reasons:
- Fast enough to run frequently in local development and CI
- Supports JavaScript, TypeScript, JSX, TSX, React, Vitest, import, accessibility, and Next.js-related rules
- Encourages high-signal correctness checks without starting with a slow or noisy baseline

Recommended scripts:

```json
{
  "lint": "oxlint .",
  "lint:fix": "oxlint . --fix"
}
```

If a concrete rule gap appears, add ESLint narrowly rather than starting with both.

### Formatting

Use one formatter and make it automatic. Prefer Prettier initially because it is boring, well-supported, and editor-friendly. Revisit Oxfmt later only if it is stable enough for the project and supports the full file set we need.

Formatting should be separate from linting.

Recommended scripts:

```json
{
  "format": "prettier . --write",
  "format:check": "prettier . --check"
}
```

### Type Checking

Use explicit TypeScript checking in CI. Do not rely only on `next build`.

Recommended script:

```json
{
  "typecheck": "tsc --noEmit"
}
```

Recommended TypeScript posture:
- `strict: true`
- `allowJs: false`
- `noUncheckedIndexedAccess: true`
- `exactOptionalPropertyTypes: true`
- `noEmit: true`
- Avoid `skipLibCheck` unless a dependency forces it
- Ban `any` in application code except for explicitly documented external-boundary escape hatches
- Avoid `unknown` assertions; parse or narrow unknown values instead

Type assertions should be rare. Prefer:
- Zod parsing for external data
- Type guards for local runtime checks
- Discriminated unions for domain state
- Generic constraints for reusable helpers
- Exhaustive switches for reviewer/report variants

Do not use `as any`. Avoid `as unknown`. If a double assertion is genuinely unavoidable, it should be isolated behind a boundary adapter with a comment explaining the upstream type gap and the validation that makes it safe.

### Testing

Use Vitest for domain and application tests.

Use Playwright for one foundational end-to-end integration test that protects the main workflow.

Test layers:
- Domain unit tests for value objects, schemas, policies, and report composition
- Application tests with fake repository source, fake reviewer, and in-memory persistence
- Contract tests for Zod schemas and LLM reviewer outputs
- Fixture tests across repo archetypes
- One foundational Playwright E2E test for the core analysis/report/chat path

Recommended scripts:

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:e2e": "playwright test"
}
```

### CI Gate

Every PR should pass:

```json
{
  "check": "pnpm lint && pnpm format:check && pnpm typecheck && pnpm test",
  "ci": "pnpm check && pnpm build && pnpm test:e2e"
}
```

The exact command prefix should match the selected package manager.

### Local Hook Enforcement

Use local hooks for fast feedback, but do not treat hooks as the source of truth. CI and branch protection are authoritative because hooks can be skipped.

Preferred hook runner: Lefthook.

Reasons:
- Fast and language-agnostic
- Simple YAML configuration
- Works well for pre-commit and pre-push gates
- Does not require making the project depend on shell-specific developer habits

Pre-commit should stay fast:
- Format or format-check staged files
- Run Oxlint on staged JavaScript/TypeScript files
- Block obvious forbidden type escapes such as `as any`, `: any`, `<any>`, and double assertions through `unknown`

Pre-push should run the stronger local gate:
- `pnpm check`
- Optionally skip Playwright locally unless the foundational E2E test remains fast enough

Forbidden type escapes should be enforced by tooling where possible and backed by a small script or grep-style check in hooks and CI. The default forbidden patterns are:
- `as any`
- `: any`
- `<any>`
- `as unknown as`

If an escape hatch is truly unavoidable, it must be isolated in a boundary adapter and documented with a specific comment marker, for example:

```ts
// type-escape: upstream library type is incorrect; value is validated by ReviewerAssessmentSchema before use
```

Any escape-hatch checker should require that marker near the assertion. Escape hatches should be rare enough to review manually.

### Branch Protection

`main` should be protected once the GitHub repository exists.

Required settings:
- Require pull requests before merging
- Require CI green checks before merging
- Require branches to be up to date before merging when practical
- Disallow direct pushes to `main`
- Keep admin bypass disabled unless the repository owner explicitly decides otherwise

CI is the merge gate. Local hooks are convenience and early feedback.

### Agent Documentation Enforcement

Agent-facing instruction files must point to the architecture and planning documents.

Required files:
- `AGENTS.md`
- `CLAUDE.md`

Required behavior:
- Agents read `docs/architecture.md` before code, test, tooling, or architecture changes
- Agents read `docs/development-plan.md` before planning or issue-tracker changes
- Architecture changes update `docs/architecture.md` in the same PR
- Planning or milestone changes update `docs/development-plan.md` in the same PR

This cannot be perfectly enforced mechanically, so CI should include a documentation-presence check and PR review should reject work that contradicts the architecture document without updating it.

### Commit Message Standards

Use Conventional Commits for all commit subjects.

Subject format:

```text
<type>(optional-scope): <summary>
```

Accepted types:
- `feat`
- `fix`
- `docs`
- `test`
- `refactor`
- `perf`
- `build`
- `ci`
- `chore`
- `revert`

Subject rules:
- Use imperative mood
- Keep the summary concise and specific
- Do not end the subject with a period
- Prefer a meaningful scope for domain areas, for example `domain`, `evidence`, `reviewer`, `chat`, `ui`, `ci`, `docs`

Non-trivial commits should include a body. Use a second `-m` when committing from the command line:

```bash
git commit -m "feat(chat): model targeted follow-up conversations" \
  -m "Add conversation targets for report dimensions, findings, caveats, and evidence items. This keeps chat context explicit before persistence and auth are introduced."
```

Commit body expectations:
- Explain why the change exists
- Mention important tradeoffs or constraints
- Mention test or migration implications when relevant
- Avoid repeating the subject

Examples:

```text
docs(architecture): define enforcement model

Add CI, hook, branch-protection, and unsafe-type-escape standards so local agent work and GitHub enforcement share the same quality gate.
```

```text
test(domain): cover low-confidence reviewer caveats

Prove that low-confidence reviewer claims reduce report confidence instead of becoming hard quality judgments. This protects the evidence-first report model.
```

Mechanical enforcement:
- Use a commit-msg hook to validate Conventional Commit subjects locally
- Use CI or a PR title check to validate merge commit/squash title
- Prefer squashing PRs with a high-signal Conventional Commit title and body
- Reject vague subjects such as `update stuff`, `fix`, `changes`, or `wip`

## Zod Strategy

Use Zod heavily, but deliberately.

### Where Zod Is Required

- API request and response contracts
- LLM reviewer assessment schemas
- Chat answer schemas
- Persisted record schemas and schema-version migrations
- Configuration and environment variable validation
- Form validation schemas
- Boundary parsing for external data from GitHub, model providers, browser storage, and future databases

Zod should be the normal way to turn untrusted data into trusted application data. Avoid casting parsed JSON directly into domain or DTO types.

### Where Zod Should Not Replace Domain Modeling

Zod schemas validate runtime shape. They should not become the only domain model when behavior matters.

Use domain value objects or domain services for:
- Scoring policy behavior
- Confidence calculations
- Caveat merging
- Evidence provenance rules
- Report composition invariants
- Permission and ownership behavior

### Schema Organization

Keep schemas close to the boundary they protect, while allowing shared primitives.

Suggested structure:

```text
src/
  domain/
    shared/
      confidence.ts
      identifiers.ts
    report/
      report-card.ts
      report-card.schema.ts
  application/
    analyze-repository/
      analyze-repository.contract.ts
  infrastructure/
    llm/
      reviewer-assessment.schema.ts
  app/
    api/
      analyze/
```

Use `z.infer` for DTOs and boundary payloads. Prefer explicit domain types/classes/functions for core behavior.

## Form Validation

Use the same Zod schema family for client-side form validation and server/API validation. Client-side validation improves ergonomics; server-side validation remains authoritative.

Recommended default:
- React Hook Form for form state
- `@hookform/resolvers/zod` for Zod integration
- Zod schemas shared with the route/action contract where practical

Why:
- Lightweight and common for React forms
- Good ergonomics for field-level errors and pending state
- Works well for normal forms such as repository URL, model configuration, and follow-up chat inputs

Use native HTML validation for trivial fields where it is sufficient, but still parse on the server/API with Zod.

Use custom controlled state instead of a form library for simple chat draft input if the chat input stays minimal. Introduce React Hook Form when the chat or settings forms need reusable validation, async validation, or more complex error handling.

Consider TanStack Form later if forms become complex workflows with deep field state, multi-step editing, or heavy type-driven form composition. It is more capable, but likely more than the first release needs.

## Auth And Persistence Readiness

The first release can be anonymous and local/in-memory. Still, use ports so auth and persistence can be added without rewriting the domain.

Required seams:
- Use cases accept an actor/context object
- Saved report and conversation concepts include optional owner/workspace metadata
- Persistence goes through repository ports
- Domain objects do not import database clients, ORM types, or auth provider types
- User-supplied credentials are request-scoped unless encrypted persistence is explicitly designed

Likely future persistence:
- Relational database for users, workspaces, reports, conversations, and metadata
- Object/blob storage for large evidence artifacts or raw repository snapshots

Likely future auth:
- Individual accounts first
- Workspace/team ownership second
- Private repository access only after provider-token access policies are designed

## Dependency Bias

Default to fewer dependencies. Add a package when it meaningfully improves correctness, speed, accessibility, or development feedback.

Good initial dependency candidates:
- `zod`
- `vitest`
- `@playwright/test`
- `oxlint`
- `prettier`
- `react-hook-form`
- `@hookform/resolvers`

Avoid adding database/auth/model SDKs until the corresponding port and contract are stable.

## Repository Operating Standards

These standards exist to keep the five development fundamentals visible in day-to-day work.

### Definition Of Done

A change is done only when:
- The scope is one coherent slice with explicit non-goals
- Lint, format check, typecheck, tests, build, and required E2E checks pass
- Relevant documentation is updated
- New or changed behavior has appropriate tests
- Runtime data is parsed or narrowed instead of cast
- No unsafe type escapes are introduced without a documented exception
- Domain/application/infrastructure boundaries remain intact
- The PR title follows Conventional Commits
- CI is green before merge

### PR Template Requirements

The repository should include a pull request template that asks for:
- Scope
- Non-goals
- Test evidence
- CI status
- Architecture or documentation impact
- Type-safety notes
- Risk and rollback notes
- Dependency additions and rationale

Default PR mapping:
- One issue per PR
- One PR per issue
- Split a large issue into multiple PRs only after documenting the sequence in the issue
- Bundle multiple issues only when they are tiny, tightly related, and explicitly called out in the PR body

### Issue Template Requirements

Issue templates should ask for:
- Problem statement
- Intended outcome
- Non-goals
- Acceptance criteria
- Test expectations
- Architecture impact
- Dependencies or blockers

### Review Checklist

Code review should check:
- Is this one coherent slice?
- Are domain boundaries intact?
- Is external/runtime data parsed, not cast?
- Are tests meaningful for the behavior?
- Is the foundational E2E still valid?
- Are docs updated when architecture or behavior changed?
- Are new dependencies justified?
- Are exceptions documented?

### Architecture Boundary Enforcement

Architecture boundaries should eventually be mechanically checked.

Initial rules:
- `src/domain` must not import `src/app`, `src/infrastructure`, Next.js, GitHub SDKs, model SDKs, database clients, or auth provider types
- `src/application` may depend on domain and declared ports, but not concrete provider clients
- `src/infrastructure` implements ports and may depend on external providers
- `src/app` wires UI, API routes, and application services together

Start with documentation and review. Add a lightweight import-boundary script or dependency-boundary test once the scaffold exists.

### Exception Registers

Exceptions should be visible and rare.

Track these classes of exceptions:
- Type escapes
- Lint disables
- Skipped or flaky tests
- Architecture boundary deviations
- Dependency policy exceptions

Each exception should include:
- Reason
- Owner or issue link when applicable
- Expiration or follow-up condition when practical

### Foundational E2E Contract

The foundational E2E test is a product contract, not a disposable smoke test.

It should verify that a user can:
- Analyze a fixture-backed repository
- See an evidence-backed report card
- See confidence/caveat information
- Ask or select a follow-up question
- Receive an evidence-aware answer without real model calls

It must not depend on:
- Paid model calls
- External repository availability
- A production database
- User authentication

Changes to this test should explain why the core workflow changed.

### Dependency Policy

Dependency additions should be deliberate.

Rules:
- Pin and document the package manager
- Commit the lockfile
- Pin the Node version through a repo-level version file or package metadata
- Add provider SDKs only after the corresponding port exists
- Explain new runtime dependencies in the PR body
- Prefer dev dependencies for tooling and test-only packages
- Avoid adding overlapping packages that solve the same problem without an explicit decision
