# Development Planning

## Purpose

Repo Analyzer Green helps users understand repository quality through evidence, reviewer judgment, confidence, caveats, and follow-up investigation.

The application should not present static heuristics as objective truth. A report card is useful only when it explains what was measured, what was inferred, how confident the system is, and what evidence would change the conclusion.

## Core Product Thesis

A quality report is not produced directly by static metrics or directly by an LLM. It is produced by a domain scoring policy that combines measured repository evidence with a structured reviewer assessment, preserving provenance and confidence for every major conclusion.

```text
Repository Source
  -> Static Evidence Collection
  -> Structured Reviewer Assessment
  -> Domain Scoring Policy
  -> Evidence-Backed Report Card
  -> Follow-Up Investigation
```

See [architecture.md](architecture.md) for stack choices, validation strategy, CI gates, and auth/database readiness.

See [red-parity.md](red-parity.md) for the feature parity map against `repo-analyzer-red` and the issue sequence for reaching parity without copying red's architecture.

## Foundational Decisions

1. Static metrics are evidence, not final judgments.
2. Reviewer assessment is structured input to the domain, not a free-form replacement for domain logic.
3. The first reviewer implementation will be an LLM agent, but the domain should allow a fake reviewer, human reviewer, or alternate automated reviewer.
4. Every report dimension needs provenance and confidence.
5. The product should explain limitations rather than hide them behind a single score.
6. Test LOC and raw coverage percentages are weak indicators and should not be treated as direct quality measures.
7. Cross-language consistency comes from stable quality dimensions, not identical thresholds.
8. Project archetype matters. A web app, CLI, library, infrastructure module, research notebook, generated SDK, and embedded project should not share the same scoring assumptions.

## External Quality Foundations

These are not scoring formulas. They are reference models for the domain language and constraints.

- ISO/IEC 25010: product quality categories such as maintainability, reliability, security, performance efficiency, usability, portability, compatibility, and functional suitability.
- McCabe/cyclomatic complexity: control-flow complexity as a maintainability and test-path pressure signal.
- DORA: delivery performance and reliability metrics where deployment and incident data are available.
- SPACE: productivity and engineering-system measurements are multi-dimensional and should not collapse into one activity metric.
- Goodhart's Law: any reported metric can be gamed if users treat it as the target instead of as an indicator.

## Domain Language

### Repository Reference

The identity and location of a repository to analyze.

Expected properties:
- Provider
- Owner
- Name
- URL
- Revision or default branch reference when available

### Repository Source

A source of repository contents. GitHub archive download is one adapter, but tests should primarily use local fixtures.

### Evidence Bundle

The deterministic facts collected from a repository. Evidence must include provenance and omissions.

Expected evidence categories:
- File inventory
- Language mix
- Project archetype signals
- Dependency manifests
- Build/test/lint scripts
- CI/release workflow files
- Documentation files
- Test files and test framework signals
- Complexity and module-shape signals where language support exists
- Security hygiene signals
- Generated/vendor/ignored files
- Collection omissions and reasons

### Evidence Item

A single measured fact with source references.

Expected properties:
- Kind
- Value
- Source file or source mechanism
- Confidence
- Notes

### Reviewer Assessment

A structured review completed from selected evidence. The reviewer may be an LLM agent, human reviewer, or fake reviewer in tests.

Expected assessment areas:
- Project archetype
- Architecture and boundaries
- Maintainability
- Verifiability and test quality
- Security posture and risk areas
- Operability and release readiness
- Documentation and onboarding
- Confidence by dimension
- Caveats and missing evidence
- Evidence references
- Recommended follow-up questions

### Scoring Policy

Domain rules that combine deterministic evidence and reviewer assessment into a report card. The policy should be explicit, testable, and versioned.

### Report Card

The user-facing assessment output.

Expected contents:
- Repository identity
- Project archetype
- Dimension assessments
- Scores or ratings where appropriate
- Confidence per dimension
- Key findings
- Caveats
- Evidence references
- Recommended next questions
- Reviewer model/version metadata when applicable

### Follow-Up Investigation

An interactive workflow for clarifying weak, uncertain, or important findings. Follow-up answers should cite evidence and state when context is missing.

Expected properties:
- Conversation belongs to a report card and repository reference
- User questions can target the whole report, one dimension, one finding, one caveat, or one evidence item
- Assistant answers distinguish evidence-backed statements, reviewer interpretation, and assumptions
- Assistant answers preserve citations to files, evidence items, and report findings when available
- Missing context is treated as a first-class answer state
- Suggested follow-up questions are generated from uncertainty, risk, and low-confidence dimensions

### Conversation

A sequence of follow-up messages about a report card.

Expected properties:
- Conversation ID
- Report card ID
- Repository reference
- Optional focused target, such as dimension, finding, caveat, or evidence item
- Messages
- Created and updated timestamps
- Visibility or owner metadata when auth exists

### Chat Message

A single user or assistant message in a conversation.

Expected properties:
- Role
- Content
- Evidence citations
- Assumption markers
- Model/provider metadata when generated by an LLM
- Created timestamp

### User Account

A future identity for saved reports, repository history, private repositories, and team workflows. Initial development can run without accounts, but application services should avoid assuming anonymous local-only state is permanent.

### Workspace

A future collaboration boundary for teams, saved reports, shared repository access, and billing or usage controls. This should not be required for the first release, but identifiers and ownership should be easy to add later.

### Persistence Record

A saved representation of reports, evidence bundles, reviewer assessments, conversations, and usage events. The domain should not depend on a specific database, but application services should use repository ports where durable storage is expected later.

## Bounded Contexts

### Repository Acquisition

Responsible for obtaining repository contents from a provider or fixture.

Likely ports:
- `RepositorySource`
- `RepositoryCache`

Likely adapters:
- GitHub archive source
- Local fixture source
- Temporary filesystem cache

### Evidence Collection

Responsible for deterministic analysis of repository contents.

Likely services:
- File inventory collector
- Project archetype detector
- Manifest parser
- Documentation detector
- Test signal detector
- Security hygiene detector
- Language-aware metrics collectors

### Reviewer Assessment

Responsible for turning selected evidence into a structured assessment.

Likely ports:
- `Reviewer`
- `ReviewerPromptRenderer`
- `ReviewerResponseValidator`

Likely adapters:
- Fake reviewer
- LLM reviewer

### Report Scoring

Responsible for producing report cards from evidence, reviewer assessment, and policy.

Likely services:
- Scoring policy
- Confidence policy
- Caveat policy
- Finding prioritizer

### Follow-Up Chat

Responsible for helping users investigate report findings through evidence-backed conversation.

Likely services:
- Evidence retriever
- Snippet ranker
- Conversation target resolver
- Suggested question generator
- Conversation application service
- Chat answer composer
- Citation mapper
- Missing-context detector

Likely ports:
- `ConversationRepository`
- `ReportCardRepository`
- `EvidenceRetriever`
- `ChatReviewer`

Key behavior:
- Start a conversation from a report, dimension, finding, caveat, or evidence item
- Continue a conversation with prior context
- Retrieve relevant evidence snippets for each user question
- Answer with explicit separation between evidence, interpretation, assumptions, and missing context
- Persist conversation state through a port when durable storage is available
- Work with an in-memory or browser-local adapter before a database exists

### Identity And Access

Responsible for future authentication, authorization, and ownership boundaries.

Initial release can be anonymous, but the architecture should not make auth hard to add.

Likely future services:
- Session resolver
- Current user resolver
- Workspace membership checker
- Repository access policy
- API key ownership policy

Likely future ports:
- `IdentityProvider`
- `SessionRepository`
- `AccessPolicy`

Design constraints:
- Application services should accept an actor/context object even if it is anonymous at first
- Saved reports and conversations should be modelled with optional owner/workspace metadata
- Private repository support should require explicit access checks before repository acquisition
- User-supplied model credentials should never be persisted casually or logged

### Persistence

Responsible for durable storage of reports, evidence, reviewer assessments, conversations, and usage records.

Initial release may use local/browser state or in-memory adapters, but the application layer should be database-ready.

Likely future repositories:
- `ReportCardRepository`
- `EvidenceBundleRepository`
- `ReviewerAssessmentRepository`
- `ConversationRepository`
- `UsageEventRepository`

Design constraints:
- Domain objects should not import database clients or ORM types
- Persistence records should preserve schema versions for report cards and reviewer assessments
- Large evidence artifacts may need object storage or compressed blobs rather than normal relational rows
- Conversation messages should store citations and model metadata separately from rendered Markdown
- Repository analysis should be reproducible from saved evidence and reviewer assessment versions when possible

### Presentation

Responsible for API routes and UI. Presentation should not contain scoring or evidence rules.

## Architecture Direction

Use a layered/domain-first structure:

```text
src/
  domain/
    repository/
    evidence/
    reviewer/
    scoring/
    report/
  application/
    analyze-repository/
    answer-follow-up/
    start-conversation/
    continue-conversation/
  infrastructure/
    github/
    filesystem/
    llm/
    persistence/
    identity/
  app/
    api/
    ui/
```

The exact framework can be chosen later. The architecture should keep the domain independent of Next.js, OpenRouter, OpenAI, GitHub, and the filesystem.

Current technical direction:
- Next.js App Router, React, and TypeScript for the application shell
- Oxlint as the primary linter
- Explicit `tsc --noEmit` type checking
- Strict TypeScript with no `as any` and very rare `as unknown`
- Vitest for domain/application tests
- Playwright for the foundational E2E test
- Zod for runtime schemas at API, LLM, persistence, environment, and form boundaries
- React Hook Form with Zod resolver for non-trivial forms
- Native HTML validation plus server/API Zod parsing for trivial forms

## Future Auth And Database Readiness

The first implementation does not need full authentication or durable persistence. It does need seams that prevent painful rewrites later.

### Auth Readiness

- Pass an application-level actor to use cases. The first actor can be `anonymous`.
- Keep repository acquisition behind access-aware application services.
- Do not place authorization decisions inside UI components.
- Keep user-supplied credentials scoped to a request unless a later encrypted persistence design exists.
- Include owner/workspace fields as optional metadata in saved-report and conversation concepts.
- Treat private repository access as a future feature requiring explicit provider tokens and access policy checks.

### Database Readiness

- Put persistence behind repository ports from the beginning when state crosses request boundaries.
- Keep domain objects serializable without ORM-specific decorators or database client imports.
- Version persisted report cards, evidence bundles, reviewer assessments, and conversations.
- Store evidence provenance and citations in structured fields, not only rendered prose.
- Separate large raw artifacts from indexed metadata so a future database is not forced to hold everything inline.
- Design application services so local storage, in-memory storage, SQLite/Postgres, or hosted database adapters can be swapped without changing domain behavior.

## TDD Strategy

### Red

Start each vertical slice with a failing domain or application test. Prefer tests that describe product behavior instead of implementation details.

### Green

Implement the smallest domain behavior needed to pass. Use fake adapters for repository sources and reviewers until the contract is stable.

### Refactor

Move framework, filesystem, network, and model-provider details behind ports only after behavior is covered.

### Test Layers

- Domain unit tests for value objects, policies, confidence, and report composition
- Application tests with fake repository source and fake reviewer
- Contract tests for reviewer schema validation
- Fixture tests across project archetypes
- Adapter tests for GitHub archive and LLM calls, isolated from core domain tests
- UI/API tests after report shape stabilizes

## GitHub Planning Model

This section defines the tracker structure to create later. Do not create GitHub issues, labels, milestones, or projects until this plan is reviewed.

## Parallel Execution Plan

Use subagents deliberately. Parallel work should increase throughput without fragmenting architecture, duplicating changes, or creating merge conflicts.

### Default Concurrency

Recommended steady-state concurrency:
- 1 lead agent coordinating scope, integration, and final review
- Up to 2 implementation workers at the same time
- Up to 1 explorer for read-only research or codebase questions
- Up to 1 verifier only when verification can run independently of active implementation

Practical maximum: 4 active subagents plus the lead. Use that only when write scopes are clearly disjoint.

Avoid running many implementation workers before the scaffold, package manager, test harness, and architecture boundaries exist. Early concurrency should bias toward docs, contracts, and read-only exploration.

### Work That Should Stay Serial

These issues define shared structure and should generally be led by one agent at a time:
- #4 Scaffold Framework And Tooling Skeleton
- #5 Establish Tooling And CI Quality Gate
- #15 Define Runtime Schema Strategy
- #16 Implement First Vertical Domain Slice
- #17 Model Report Card Inputs And Outputs
- #25 Define Reviewer Assessment Schema
- #29 Build Analyze Repository Application Service

Reason: these issues create shared files, contracts, folder layout, package scripts, and domain primitives. Parallel edits here are likely to conflict or create inconsistent patterns.

### Good Parallel Workstreams

#### Baseline Documentation And Governance

Can run in parallel after #1 and #2 are clear:
- #9 Add PR And Issue Templates
- #10 Document Definition Of Done And Review Checklist
- #11 Add Architecture Boundary Enforcement Plan
- #12 Add Exception Register Policy
- #13 Define Foundational E2E Contract
- #14 Add Dependency Policy
- #18 Define Actor And Ownership Boundaries

Suggested concurrency: 2-3 agents. Keep each agent on separate docs/templates.

#### Tooling Guardrails

Can run in limited parallel after #4 scaffold exists:
- #6 Implement Unsafe Type Escape Guard
- #7 Implement Commit Message Enforcement
- #8 Add Agent Documentation Readiness Check

Suggested concurrency: 2 agents. Avoid overlapping hook/CI files unless ownership is explicit.

#### Evidence Engine

Can run in parallel after #20 repository source port and fixture adapter exist:
- #21 Implement File Inventory With Omission Tracking
- #22 Detect Project Archetype Signals
- #23 Parse Manifests And Workflow Signals
- #24 Define Evidence Persistence Shape

Suggested concurrency: 2 workers plus 1 explorer. Assign disjoint modules under `src/domain/evidence`, `src/infrastructure/filesystem`, and docs/schema files.

#### Reviewer Assessment

Can run in parallel after #25 schema exists:
- #26 Build Fake Reviewer Adapter
- #27 Draft LLM Reviewer Prompt Contract
- #28 Implement LLM Reviewer Adapter

Suggested concurrency: 2 workers. Keep #28 behind #25 and #27, and do not let provider SDK details leak into domain code.

#### Report Card UI/API

Can run in parallel after #29 application service exists:
- #30 Add Analyze API Route
- #31 Build Initial Report UI

Suggested concurrency: 2 workers. API and UI write scopes should stay separate.

#### Follow-Up Chat

Can run in parallel after #32 conversation/message domain types exist:
- #33 Build Suggested Follow-Up Question Generator
- #34 Build Conversation Target Resolver
- #35 Build Evidence Retrieval For Follow-Up
- #37 Build Chat Answer Contract

Then, after those are stable:
- #36 Build Follow-Up Chat Application Service
- #38 Build Follow-Up UI
- #39 Add Conversation Persistence Adapter

Suggested concurrency: 2-3 workers. Keep domain, application, UI, and persistence adapters explicitly separated.

#### Calibration And Hardening

Can run in parallel near the end:
- #40 Add Multi-Archetype Fixture Suite
- #41 Document Metric Interpretation Guidance
- #42 Add Operational Hardening
- #43 Document Auth And Database Integration Plan

Suggested concurrency: 2-3 agents. Calibration fixtures and docs can proceed while operational hardening is implemented.

### Recommended Execution Waves

#### Wave 1: Baseline And Scaffolding

Concurrency: 1-2 agents.

Lead:
- #1 Write ADR: Evidence-Backed Report Cards
- #2 Define Ubiquitous Language

Worker:
- #9 Add PR And Issue Templates
- #10 Document Definition Of Done And Review Checklist

Then run #4 and #5 mostly serially because they establish the working tree and CI shape.

#### Wave 2: Guardrails And First Slice

Concurrency: 2-3 agents.

Lead:
- #16 Implement First Vertical Domain Slice

Workers:
- #6 Implement Unsafe Type Escape Guard
- #7 Implement Commit Message Enforcement
- #13 Define Foundational E2E Contract

Keep #16 under lead ownership because it defines the first implementation pattern.

#### Wave 3: Evidence And Reviewer Foundations

Concurrency: 3-4 agents.

Lead:
- #20 Implement Repository Source Port And Local Fixture Adapter

Workers:
- #21 Implement File Inventory With Omission Tracking
- #25 Define Reviewer Assessment Schema
- #26 Build Fake Reviewer Adapter

Explorer:
- Research project archetype and manifest parsing cases for #22 and #23.

#### Wave 4: Report Vertical Slice

Concurrency: 2-3 agents.

Lead:
- #29 Build Analyze Repository Application Service

Workers:
- #30 Add Analyze API Route
- #31 Build Initial Report UI

Verifier:
- Run the foundational E2E and CI checks once the slice is integrated.

#### Wave 5: Follow-Up Chat

Concurrency: 3-4 agents.

Lead:
- #32 Model Conversation And Chat Message Domain Types
- #36 Build Follow-Up Chat Application Service

Workers:
- #33 Build Suggested Follow-Up Question Generator
- #35 Build Evidence Retrieval For Follow-Up
- #37 Build Chat Answer Contract
- #38 Build Follow-Up UI

Use explicit write ownership because chat touches domain, application services, API, and UI.

#### Wave 6: Calibration And Release Hardening

Concurrency: 3-4 agents.

Workers:
- #40 Add Multi-Archetype Fixture Suite
- #41 Document Metric Interpretation Guidance
- #42 Add Operational Hardening
- #43 Document Auth And Database Integration Plan

Lead focuses on integration, release readiness, and closing residual architecture gaps.

### Subagent Assignment Rules

Every subagent task should include:
- Issue number and acceptance criteria
- Owned files or modules
- Explicit non-goals
- Expected tests or docs
- Instruction not to revert unrelated edits
- Instruction to report changed files

Do not assign two workers to the same write scope. If two issues share files, serialize them or make one worker read-only.

### Integration Rules

The lead agent is responsible for:
- Keeping the PR scope coherent
- Reviewing subagent output before merge
- Running local checks
- Resolving architectural inconsistencies
- Ensuring docs reflect any changed decisions

Subagents can accelerate implementation, but the lead owns final correctness.

### Milestones

#### 1. Domain And Architecture Baseline

Goal: establish the domain language, architecture boundaries, and first executable tests.

Exit criteria:
- Architecture decision record exists for evidence plus reviewer-assessment scoring
- Ubiquitous language is documented
- Domain entities and value objects are sketched in code or tests
- Test harness is in place
- No infrastructure implementation is required to pass the first domain tests

#### 2. Deterministic Evidence Engine

Goal: collect repeatable repository evidence with provenance and omissions.

Exit criteria:
- Local fixture repository source works
- File inventory works
- Ignore/vendor/generated file rules are explicit
- Evidence bundle contains source references and omitted-file reasons
- Initial project archetype detection works
- Static signals are reported as evidence, not final quality judgment

#### 3. Structured Reviewer Assessment

Goal: introduce reviewer assessment as a validated structured input.

Exit criteria:
- Reviewer assessment schema exists
- Fake reviewer supports deterministic tests
- LLM prompt contract is documented
- LLM response validation rejects malformed or unsupported claims
- Reviewer caveats and confidence are preserved in the domain

#### 4. Report Card Vertical Slice

Goal: produce a useful report card from fixture evidence and fake reviewer assessment, then from a real public repository.

Exit criteria:
- Application service combines repository source, evidence collector, reviewer, and scoring policy
- API returns report card DTO
- UI renders dimensions, findings, confidence, caveats, and evidence references
- Follow-up questions are generated from uncertainty and risk
- Application service accepts an actor/context object, even if anonymous
- Report card shape can later be persisted without losing provenance or schema version

#### 5. Follow-Up Investigation Workflow

Goal: let users drill into reports, dimensions, findings, caveats, and evidence through evidence-backed chat.

Exit criteria:
- Conversations can start from the full report, a dimension, a finding, a caveat, or an evidence item
- Conversation messages preserve role, content, citations, assumptions, and model metadata
- Snippet retrieval is evidence-aware
- Chat answers distinguish evidence-backed statements, reviewer interpretation, assumptions, and missing context
- Suggested follow-up questions are generated from low-confidence and high-risk report areas
- Missing context is explicitly called out
- Conversation state works through a repository port with a local/in-memory adapter first
- API and UI do not assume a permanent anonymous-only storage model

#### 6. Calibration And Release Hardening

Goal: make the tool reliable across varied repositories.

Exit criteria:
- Fixture suite covers several project archetypes and languages
- Scoring policy has calibration notes
- Error handling covers invalid repos, unavailable models, malformed reviewer output, and oversized repos
- Cost/rate-limit controls are documented
- Known limitations are visible to users
- Auth and database integration points are documented before any production deployment

### Labels

#### Type Labels

- `type:architecture` - domain model, boundaries, ADRs, and module structure
- `type:domain` - entities, value objects, scoring policies, and domain services
- `type:static-analysis` - deterministic repository evidence collection
- `type:reviewer` - structured LLM or human reviewer assessment workflows
- `type:api` - server routes, application services, and contracts
- `type:ui` - report, chat, and user workflow surfaces
- `type:persistence` - repository ports, storage adapters, migrations, and saved-state design
- `type:auth` - identity, sessions, access policies, and future private repository support
- `type:test` - test harnesses, fixtures, contract tests, and domain behavior coverage
- `type:docs` - product, architecture, setup, and operational documentation

#### Priority Labels

- `priority:high` - blocks core product learning or architectural sequencing
- `priority:medium` - important but not immediately blocking
- `priority:low` - polish, refinement, or future improvement

#### Status Labels

- `status:blocked` - cannot move without an unresolved dependency or decision
- `status:needs-decision` - needs a product or architecture decision before implementation
- `status:needs-calibration` - behavior exists but thresholds or language/project interpretation need tuning

#### Workflow Labels

- `good-first-slice` - small vertical slice suitable for early implementation
- `red-green-refactor` - issue should begin with an explicit failing test
- `adapter` - infrastructure implementation behind a port
- `contract` - schema or API contract work
- `future-ready` - establishes a seam for planned auth, database, or provider changes without implementing the full feature

### Project Board

Use a single GitHub project once issues are created.

Suggested views:
- Roadmap by milestone
- Current iteration
- Blocked and needs decision
- Calibration backlog

Suggested fields:
- Status: Backlog, Ready, In Progress, Review, Done, Blocked
- Milestone
- Priority
- Area
- Target slice

## Initial Issue Backlog

### Milestone 1: Domain And Architecture Baseline

#### Write ADR: Evidence-Backed Report Cards

Labels: `type:architecture`, `type:docs`, `priority:high`, `status:needs-decision`

Acceptance criteria:
- Captures the decision to combine static evidence, reviewer assessment, and scoring policy
- States why static-only and LLM-only approaches are insufficient
- Defines provenance, confidence, and caveats as required report properties
- Lists consequences for testing and architecture

#### Define Ubiquitous Language

Labels: `type:architecture`, `type:domain`, `priority:high`

Acceptance criteria:
- Defines repository reference, evidence bundle, evidence item, reviewer assessment, scoring policy, report card, finding, caveat, and confidence
- Identifies terms intentionally avoided, such as objective quality score without context
- Links language to expected code modules

#### Create Test Harness And Fixture Strategy

Labels: `type:test`, `type:architecture`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Test runner is selected and configured
- First local fixture repository exists
- Tests can run without network or model calls
- Fixture naming and maintenance rules are documented

#### Scaffold Framework And Tooling Skeleton

Labels: `type:architecture`, `type:api`, `type:ui`, `priority:high`

Acceptance criteria:
- Next.js App Router project is initialized with TypeScript, Tailwind, `src/`, and the selected package manager
- Project structure follows the domain/application/infrastructure/app layout in `docs/architecture.md`
- Tooling dependencies are installed before feature work grows
- No real GitHub, LLM, auth, or database integration is introduced in the scaffold
- The scaffold keeps domain code independent of Next.js

#### Establish Tooling And CI Quality Gate

Labels: `type:architecture`, `type:test`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Package manager is selected and documented
- Oxlint is configured as the primary linter
- Explicit TypeScript typecheck script exists
- Lint/type rules reject unsafe `any` usage where tooling supports it
- Formatter and format-check scripts exist
- CI command runs lint, format check, typecheck, unit tests, build, and foundational E2E
- GitHub Actions workflow is planned for the CI command
- Local hook runner is selected, with Lefthook preferred
- Pre-commit hook plan covers staged formatting/linting and forbidden type-escape checks
- Pre-push hook plan covers the local `check` command
- Commit-msg hook plan enforces Conventional Commit subjects
- PR title or squash-merge title check enforces Conventional Commit format in CI
- Branch protection requirements are documented
- Tooling choices are documented in `docs/architecture.md`

#### Implement Unsafe Type Escape Guard

Labels: `type:test`, `type:architecture`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Guard rejects `as any`, `: any`, `<any>`, and `as unknown as` by default
- Guard supports a documented `type-escape:` marker for rare boundary-adapter exceptions
- Guard runs in CI
- Guard is wired into local hooks where practical
- Existing tests or fixtures cover allowed and rejected examples

#### Implement Commit Message Enforcement

Labels: `type:architecture`, `type:test`, `priority:medium`

Acceptance criteria:
- Conventional Commit types and scopes are documented
- Commit-msg hook rejects invalid commit subjects locally
- CI or PR title check rejects invalid merge/squash titles
- Non-trivial commit body guidance is documented for high-signal `git blame`
- Examples of acceptable and unacceptable commit messages are documented

#### Add Agent Documentation Readiness Check

Labels: `type:architecture`, `type:docs`, `priority:medium`

Acceptance criteria:
- `AGENTS.md` requires reading `docs/architecture.md` before code/tooling changes
- `AGENTS.md` requires reading `docs/development-plan.md` before planning/tracker changes
- `CLAUDE.md` points to `AGENTS.md`
- CI or a lightweight check verifies required agent docs exist
- PR review guidance rejects architecture changes that do not update architecture docs

#### Add PR And Issue Templates

Labels: `type:docs`, `type:architecture`, `priority:medium`

Acceptance criteria:
- PR template includes scope, non-goals, test evidence, CI status, architecture impact, type-safety notes, risk, rollback, and dependency rationale
- Issue templates include problem statement, intended outcome, non-goals, acceptance criteria, test expectations, architecture impact, and blockers
- Templates reinforce the five development fundamentals
- Templates live under `.github/`

#### Document Definition Of Done And Review Checklist

Labels: `type:docs`, `type:architecture`, `priority:medium`

Acceptance criteria:
- Definition of Done is documented
- Review checklist is documented
- Checklist covers scope, boundaries, runtime validation, tests, docs, dependencies, and exceptions
- PR template references the Definition of Done

#### Add Architecture Boundary Enforcement Plan

Labels: `type:architecture`, `type:test`, `priority:medium`

Acceptance criteria:
- Import boundary rules are documented
- Domain is prohibited from importing framework, provider, database, or auth implementation modules
- Application layer is prohibited from importing concrete provider clients directly
- Future lightweight script or dependency-boundary test is planned after scaffold exists

#### Add Exception Register Policy

Labels: `type:architecture`, `type:docs`, `priority:medium`

Acceptance criteria:
- Exception classes are documented for type escapes, lint disables, skipped/flaky tests, architecture deviations, and dependency policy exceptions
- Each exception requires a reason and issue/owner where practical
- Policy defines when an exception should expire or be revisited

#### Define Foundational E2E Contract

Labels: `type:test`, `type:architecture`, `priority:high`

Acceptance criteria:
- Foundational E2E workflow is documented as a product contract
- E2E uses fixture-backed repository data and fake model/reviewer behavior
- E2E verifies report rendering and follow-up chat path
- E2E explicitly avoids paid model calls, external repo availability, production database, and auth

#### Add Dependency Policy

Labels: `type:architecture`, `type:docs`, `priority:medium`

Acceptance criteria:
- Package manager and Node version pinning are documented
- Lockfile policy is documented
- Runtime dependency additions require PR rationale
- Provider SDKs require stable ports before adoption
- Overlapping dependencies require an explicit decision

#### Define Runtime Schema Strategy

Labels: `type:architecture`, `type:domain`, `priority:high`, `contract`

Acceptance criteria:
- Documents where Zod schemas are required
- Distinguishes boundary schemas from domain behavior
- Establishes Zod parsing as the default alternative to JSON type assertions
- Establishes schema versioning expectations for persisted records
- Establishes form validation strategy using shared Zod schemas where practical

#### Implement First Vertical Domain Slice

Labels: `type:domain`, `type:test`, `good-first-slice`, `red-green-refactor`, `priority:high`

Acceptance criteria:
- Local fixture repository and fake reviewer assessment produce an evidence-backed report card
- Slice includes failing-first domain or application tests
- Slice exercises Zod schemas, fake repository source, fake reviewer, scoring policy, and application service
- Slice does not require GitHub downloads, real model calls, auth, database, or full UI
- Minimal API/page wiring is added only after the domain/application test passes

#### Model Report Card Inputs And Outputs

Labels: `type:domain`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Domain types exist for evidence bundle, reviewer assessment, confidence, caveat, finding, and report card
- Invalid confidence values cannot be represented or are rejected
- Report card preserves source provenance from evidence and reviewer assessment
- Report card includes a schema version suitable for future persistence
- Report card can include optional owner/workspace metadata without requiring auth in the first release

#### Define Actor And Ownership Boundaries

Labels: `type:architecture`, `type:auth`, `future-ready`, `priority:medium`

Acceptance criteria:
- Defines anonymous actor, authenticated user, and workspace as future concepts
- Application services accept an actor/context object without requiring login
- Documents where private repository access checks will belong
- Documents credential handling rules for user-supplied model or repository tokens

#### Test Scoring Policy With Fake Inputs

Labels: `type:domain`, `type:test`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Scoring policy can combine fake evidence and fake reviewer assessment
- Low-confidence reviewer claims reduce confidence or add caveats
- Missing evidence is represented as uncertainty, not as a penalty by default
- Tests document at least one maintainability and one verifiability scenario

### Milestone 2: Deterministic Evidence Engine

#### Implement Repository Source Port And Local Fixture Adapter

Labels: `type:static-analysis`, `adapter`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Application code can request repository contents through a port
- Local fixture adapter satisfies the port
- Domain tests remain independent of filesystem details

#### Implement File Inventory With Omission Tracking

Labels: `type:static-analysis`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Inventory includes relative path, size, extension, and classification signals
- Ignored files are recorded with reasons
- Oversized and binary files are omitted with reasons
- Generated/vendor rules are explicit and test-covered

#### Detect Project Archetype Signals

Labels: `type:static-analysis`, `type:domain`, `priority:medium`

Acceptance criteria:
- Detects initial archetypes such as web app, library, CLI, infrastructure module, docs-heavy repo, generated SDK, and unknown
- Supports multiple possible archetypes with confidence
- Does not force a single archetype when evidence is ambiguous

#### Parse Manifests And Workflow Signals

Labels: `type:static-analysis`, `priority:medium`

Acceptance criteria:
- Reads package/dependency/build/test signals from common manifests
- Records CI/release workflow files as evidence
- Handles unsupported ecosystems without failure

#### Define Evidence Persistence Shape

Labels: `type:persistence`, `type:static-analysis`, `future-ready`, `priority:medium`

Acceptance criteria:
- Evidence bundle has a serializable shape independent of ORM/database details
- Evidence items preserve provenance and omission reasons in structured fields
- Large raw artifacts are separated from report metadata in the design
- Schema versioning is included for future persisted evidence

### Milestone 3: Structured Reviewer Assessment

#### Define Reviewer Assessment Schema

Labels: `type:reviewer`, `contract`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Schema covers dimensions, confidence, caveats, evidence references, and follow-up questions
- Validation rejects missing confidence and unsupported dimensions
- Schema can represent uncertainty and insufficient evidence

#### Build Fake Reviewer Adapter

Labels: `type:reviewer`, `adapter`, `type:test`, `priority:high`

Acceptance criteria:
- Tests can inject deterministic reviewer assessments
- Fake reviewer can simulate malformed responses and low-confidence claims
- Application tests do not need network calls

#### Draft LLM Reviewer Prompt Contract

Labels: `type:reviewer`, `type:docs`, `contract`, `priority:high`

Acceptance criteria:
- Prompt requires structured output only
- Prompt forbids unsupported claims
- Prompt requires caveats and missing evidence
- Prompt asks for follow-up questions tied to uncertainty or risk

#### Implement LLM Reviewer Adapter

Labels: `type:reviewer`, `adapter`, `priority:medium`

Acceptance criteria:
- Adapter is behind the reviewer port
- Model/provider details are outside the domain
- Malformed model output produces recoverable errors
- Cost and token controls are configurable

### Milestone 4: Report Card Vertical Slice

#### Build Analyze Repository Application Service

Labels: `type:api`, `type:domain`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Service orchestrates repository source, evidence collector, reviewer, and scoring policy
- Works with local fixture and fake reviewer
- Returns report card without framework dependencies

#### Add Analyze API Route

Labels: `type:api`, `adapter`, `priority:medium`

Acceptance criteria:
- Validates request body
- Maps domain errors to appropriate HTTP responses
- Does not contain scoring logic

#### Build Initial Report UI

Labels: `type:ui`, `priority:medium`

Acceptance criteria:
- Shows dimensions, findings, confidence, caveats, and evidence references
- Does not over-emphasize a single score
- Makes missing evidence visible

### Milestone 5: Follow-Up Investigation Workflow

#### Model Conversation And Chat Message Domain Types

Labels: `type:domain`, `type:api`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Conversation belongs to a report card and repository reference
- Conversation can optionally target a dimension, finding, caveat, or evidence item
- Chat messages preserve role, content, citations, assumptions, and model metadata
- Conversation model includes created/updated timestamps and future owner/workspace metadata

#### Build Suggested Follow-Up Question Generator

Labels: `type:domain`, `type:reviewer`, `priority:high`, `red-green-refactor`

Acceptance criteria:
- Generates suggested questions from low-confidence dimensions, caveats, and high-risk findings
- Questions reference the report area they are intended to investigate
- Does not generate questions for unsupported or missing report sections
- Tests cover at least one low-confidence and one high-risk scenario

#### Build Conversation Target Resolver

Labels: `type:api`, `type:domain`, `priority:medium`, `red-green-refactor`

Acceptance criteria:
- Resolves whether a question targets the full report, dimension, finding, caveat, or evidence item
- Rejects invalid target identifiers
- Preserves target context for evidence retrieval and answer composition

#### Build Evidence Retrieval For Follow-Up

Labels: `type:static-analysis`, `type:reviewer`, `priority:medium`

Acceptance criteria:
- Retrieves snippets connected to report findings and user questions
- Ranks snippets with section and evidence context
- Preserves source references
- Can retrieve from saved evidence metadata or fresh repository content through a port

#### Build Follow-Up Chat Application Service

Labels: `type:api`, `type:reviewer`, `type:persistence`, `priority:medium`

Acceptance criteria:
- Supports starting a new conversation from a report target
- Supports continuing an existing conversation
- Answers include evidence-backed statements and uncertainty
- Missing evidence is explicitly identified
- Conversation context does not override evidence constraints
- Conversation state is stored through a `ConversationRepository` port
- Works with a fake chat reviewer and in-memory conversation repository in tests

#### Build Chat Answer Contract

Labels: `type:reviewer`, `contract`, `priority:medium`

Acceptance criteria:
- Answer schema separates summary, evidence-backed claims, assumptions, caveats, citations, and suggested next questions
- Validation rejects uncited file-specific claims when evidence is required
- Contract supports explicit "insufficient context" responses
- Contract includes model/provider metadata outside the domain core

#### Build Follow-Up UI

Labels: `type:ui`, `priority:medium`

Acceptance criteria:
- User can ask from the full report, dimension, finding, caveat, or evidence item
- UI shows suggested follow-up questions near relevant report areas
- UI displays answer, cited evidence, and caveats
- Local conversation state is preserved where appropriate
- UI distinguishes evidence-backed answer sections from assumptions or missing context

#### Add Conversation Persistence Adapter

Labels: `type:persistence`, `adapter`, `future-ready`, `priority:low`

Acceptance criteria:
- Provides a local or in-memory adapter for initial development
- Uses the same repository port expected by future database-backed persistence
- Stores citations and model metadata structurally
- Does not leak persistence details into domain objects

### Milestone 6: Calibration And Release Hardening

#### Add Multi-Archetype Fixture Suite

Labels: `type:test`, `type:static-analysis`, `status:needs-calibration`, `priority:high`

Acceptance criteria:
- Fixtures cover at least three languages and four project archetypes
- Calibration notes explain expected evidence and report behavior
- Tests protect against language/project-type bias where possible

#### Document Metric Interpretation Guidance

Labels: `type:docs`, `priority:high`

Acceptance criteria:
- Explains what metrics can and cannot prove
- Warns against optimizing for reported numbers
- Explains confidence, caveats, and missing evidence
- Gives examples of appropriate follow-up questions

#### Add Operational Hardening

Labels: `type:api`, `type:reviewer`, `priority:medium`

Acceptance criteria:
- Handles invalid repos, network failures, model failures, and oversized repos
- Adds rate/cost controls for reviewer calls
- Captures enough diagnostic information to debug failures

#### Document Auth And Database Integration Plan

Labels: `type:architecture`, `type:auth`, `type:persistence`, `type:docs`, `future-ready`, `priority:medium`

Acceptance criteria:
- Documents likely auth provider candidates and selection criteria without committing to one vendor
- Documents likely persistence candidates and the expected stored entities
- Defines ownership rules for saved reports, conversations, repository access, and workspace membership
- Defines token/secret handling constraints, including request scoping and no-plain-text persistence
- Lists migration concerns for moving from local/in-memory/browser-local state to durable database-backed state
- Describes how schema versions, citations, provenance, and metadata survive storage migration

## Open Product Questions

1. Should the primary visual output be dimension ratings, a single overall grade, or both with the grade visually de-emphasized?
2. Which model provider should be the first-class reviewer adapter?
3. Should user-supplied API keys be supported in the initial version, or should the app use server-side configuration only?
4. How many project archetypes should be supported before the first release?
5. Should repository history be analyzed in the first release, or should the first release be snapshot-only?
6. Should chat be available only after a report exists, or should it also guide users through interpretation before analysis?
7. Should follow-up chat be scoped to one report by default, or should users be able to compare multiple reports in a conversation?
8. Should conversations be saved by default when auth/database exists, or should saving be explicit?
9. Which auth model is expected first: individual accounts, organization/workspace accounts, or both?
10. Which persistence model is expected first: relational database, document database, object storage plus relational metadata, or local-only MVP?
11. Should private repository support be in the first authenticated release, or should auth initially cover saved public-repo reports only?
12. What is the retention policy for repository evidence, reviewer assessments, conversations, and user-supplied credentials?

## Creation Order After Plan Review

1. Create the GitHub repository.
2. Push this planning baseline.
3. Create labels.
4. Create milestones.
5. Create the project board.
6. Create issues from the initial backlog.
7. Assign issues to milestones, labels, and project fields.
