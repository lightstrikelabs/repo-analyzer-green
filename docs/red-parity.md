# Red Parity Map

This document maps useful behavior from `repo-analyzer-red` to Green's domain-first implementation plan.

Parity does not mean copying red's architecture or scoring formulas. Green should reach comparable product capability and product-surface quality while preserving evidence, confidence, caveats, typed boundaries, tests, and clear adapter ownership.

## Current Red Capabilities

`repo-analyzer-red` currently provides:

- Public GitHub repository analysis from archive download.
- Deterministic static report generation when no OpenRouter key is provided.
- Optional OpenRouter report enrichment when a key and model are provided.
- Follow-up questions through a section-focused chat surface.
- Repository snippet retrieval for follow-up context.
- Browser localStorage persistence for repo URL, OpenRouter key, selected model, latest report, and per-repo chat threads.
- Report dashboard UI with overview score, big numbers, language mix, reviewer notes, section panels, metrics, and lightweight charts.
- Loading phases that explain the analysis workflow.

## UI/UX Baseline

The deployed red app at `https://repo-analyzer-red.vercel.app/` was reviewed on April 26, 2026. Its product surface is the baseline for the Red UI/UX Parity milestone.

Red's first-screen workflow:

- Compact top header with `Repository Quality` and `Report Card`.
- GitHub repository URL input.
- OpenRouter API key password input.
- Primary `Analyze` action.
- `Advanced` disclosure with OpenRouter model input and default-model action.
- Empty state that says no report is loaded and asks for a repository URL.

Red's report workflow:

- Overview panel with repository owner/name, analyzed timestamp, summary, strongest area, score ring, and grade.
- Big-number tiles for overall score, source files, code lines, and test ratio.
- Language mix panel with horizontal bars and stable colors.
- Reviewer notes panel.
- Five section panels: Maintainability, Testing, Security, Architecture, and Documentation.
- Each section panel shows a score ring, sparkline, summary, metrics, Signals, Next Checks, and an inline ask box.
- Loading phases explain cloning, mapping files, maintainability scoring, tests/release checks, security/docs review, reviewer notes, and optional OpenRouter enrichment.

Red's chat workflow:

- Inline section questions start section-scoped conversations.
- Chat opens in a right-side slide-out.
- Desktop slide-out includes a conversation list and active thread.
- Mobile slide-out includes a conversation selector when multiple threads exist.
- Closing chat leaves a floating `Chats` return menu with thread count and recent threads.
- Messages support Markdown and expose model thinking when the model returns `<think>` blocks.

## Capability Parity Versus Product-Surface Parity

Green's first backlog reached most underlying capabilities, but capability parity is not sufficient. A domain-correct report can still fail the product goal if the UI reads like internal evidence tooling instead of the red report-card workflow.

Capability parity means the system can perform the same kind of work:

- acquire repository contents;
- collect deterministic evidence;
- produce a report;
- accept reviewer input;
- answer follow-up questions;
- persist local report and conversation state.

Product-surface parity means a user can exercise those capabilities through the same practical workflow:

- paste a GitHub URL and analyze;
- read a compact report card without understanding Green's internals;
- scan scores, metrics, signals, and next checks;
- ask follow-up questions from the relevant section;
- return to chat threads without losing context.

Future parity PRs should cite which checklist items they satisfy.

The executable parity harness lives in `e2e/red-ui-parity.spec.ts`. It is opt-in until the milestone 7 implementation issues satisfy the red product surface:

```bash
pnpm test:e2e:red-parity
```

The normal CI E2E command keeps running the stable foundational workflow. UI parity PRs should run the red-parity harness locally and call out whether the remaining failures are expected for later milestone issues.

## UI/UX Parity Checklist

### Analysis Shell

- [ ] Replace provider/name/revision-first UI with a red-style repository URL workflow.
- [ ] Keep the primary action as `Analyze`.
- [ ] Keep OpenRouter key entry available without making it required for deterministic analysis.
- [ ] Keep model selection under `Advanced`.
- [ ] Persist repository URL and selected model locally.
- [ ] Do not persist API keys by default.
- [ ] Preserve the latest report and per-report conversations in browser storage.
- [ ] Keep loading phases visible and specific to the analysis workflow.
- [ ] Render clear empty and error states.

### Report Dashboard

- [ ] Add a red-compatible dashboard view model over Green's report and evidence data.
- [ ] Render overview score ring, grade, repository label, analyzed timestamp, summary, and strongest area.
- [ ] Render big-number tiles comparable to red.
- [ ] Render language mix with stable color bars.
- [ ] Render reviewer notes without making raw evidence IDs the primary reading path.
- [ ] Render Maintainability, Testing, Security, Architecture, and Documentation sections.
- [ ] Map Green's `verifiability` dimension to Testing.
- [ ] Map Green's `architecture-boundaries` dimension to Architecture.
- [ ] Preserve caveats, confidence, and evidence for details, chat, and PDF output.
- [ ] Keep PDF export as a retained Green-only addition.

### Section Panels

- [ ] Each section shows score, grade or rating, sparkline, summary, metrics, Signals, and Next Checks.
- [ ] Each section includes an inline question textarea and `Open Chat` action.
- [ ] Missing or low-confidence dimensions render as caveated states, not silent omissions.
- [ ] Long metric labels, repository names, and model names fit on mobile and desktop.

### Chat Slide-Out

- [ ] Replace the embedded follow-up panel with a right-side slide-out.
- [ ] Start conversations from section ask boxes.
- [ ] Show desktop conversation list and active thread.
- [ ] Show mobile conversation selector when needed.
- [ ] Keep composer, loading, error, and insufficient-context states.
- [ ] Preserve citations, assumptions, caveats, and model metadata structurally.
- [ ] Render reviewer answers with Markdown where appropriate.
- [ ] Closing chat leaves a floating `Chats` return menu with thread count.
- [ ] Restore conversations from browser storage.

### Responsive And Visual Polish

- [ ] Match red's compact report-card layout and warm neutral palette closely enough that the product surface feels equivalent.
- [ ] Keep cards and controls at 8px border radius or less.
- [ ] Avoid nested-card composition and decorative gradients.
- [ ] Use icons for repository URL, API key, analyze/loading, advanced disclosure, section categories, chat, send, and close controls.
- [ ] Verify desktop and mobile viewports with Playwright.
- [ ] Preserve print/PDF behavior.

## Red UI/UX Parity Milestone

Milestone `7. Red UI/UX Parity` tracks the follow-up work:

| Issue | Scope |
| --- | --- |
| #115 | Add the opt-in red UI/UX parity workflow harness. |
| #116 | Support red-style GitHub URL analysis with reviewer config. |
| #117 | Replace provider form with red-style analysis shell. |
| #118 | Build red-compatible report dashboard view model. |
| #119 | Render red-style report overview and section panels. |
| #120 | Add follow-up route for evidence-backed chat answers. |
| #121 | Replace embedded follow-up panel with red-style slide-out threads. |
| #122 | Match red visual design and responsive polish. |
| #123 | Keep this UI/UX parity checklist current. |

Recommended sequence:

1. Land #123 and #115 first so the parity target is documented and executable.
2. Land #116 and #117 so the first-screen workflow matches red.
3. Land #118 before #119 so UI rendering depends on a tested view model.
4. Land #120 before #121 so chat UI calls a real route.
5. Land #122 last, after structure and behavior are stable.

## Intentional Green Departures

- Static metrics are evidence, not final judgments.
- Missing evidence becomes uncertainty or caveats, not an automatic penalty.
- LLM output is structured reviewer input, not direct report truth.
- Raw test LOC, raw coverage, and single static scores are not treated as proof of repository quality.
- Domain code stays independent of Next.js, GitHub, filesystem, archive extraction, OpenRouter, auth, and databases.
- The foundational E2E path remains fake-backed and deterministic; live-provider E2E should be separate and explicitly scoped.
- PDF export can stay as a net-new Green feature.
- API keys should not be persisted by default. Red stores the OpenRouter key in localStorage, which improves convenience but creates a long-lived browser secret readable by any script that runs on the origin after an XSS bug and by browser extensions with site access. Green should keep API keys in component memory by default. A later explicit opt-in device storage or account-backed encrypted credential feature needs its own threat model and issue.

## Capability Map

| Red capability | Green issue | Green direction |
| --- | --- | --- |
| Public GitHub archive download | #70 | Infrastructure adapter behind `RepositorySource`; no GitHub/fetch/archive logic in domain. |
| File inventory and omissions | #21 | Complete baseline collector with size, extension, classification, ignored/generated/vendor/binary/oversized omissions. |
| Manifest, dependency, script, and workflow signals | #23 | Domain evidence parser for manifests and GitHub workflow files. |
| Project archetype detection | #22 | Domain evidence detector with multiple candidates, confidence, and evidence references. |
| Language mix and code-shape metrics | #71 | Domain evidence collector; metrics are signals, not proof of quality. |
| Security hygiene signals | #72 | Domain evidence collector for lockfiles, env examples, dependency counts, and caveated secret-risk hints. |
| Deterministic scoring/report generation | #19, #29 | Scoring policy plus application service combining evidence, reviewer assessment, and caveats. |
| Fake/no-network reviewer path | #26 | Deterministic reviewer adapter for tests and fallback paths. |
| OpenRouter report enrichment | #27, #28, #75 | Provider contract and adapter outside the domain with structured response validation. |
| Analyze API route | #30 | Thin API route over application service and Zod contracts. |
| Report dashboard UI | #31, #73 | Thin screen with reusable tested report components. |
| Suggested follow-up prompts | #33 | Domain service generated from uncertainty, risk, and low-confidence dimensions. |
| Follow-up conversation targeting | #32, #34, #36 | Domain/app services for report, dimension, finding, caveat, and evidence-item targets. |
| Snippet retrieval for follow-up | #35 | Evidence-aware retrieval with citations and missing-context states. |
| Chat answer contract/provider behavior | #37, #28 | Structured answer contract plus provider adapter; no free-form provider output in domain. |
| Follow-up UI slideout/conversation threads | #38 | Modular chat components over conversation application services. |
| Browser local persistence | #39, #74 | Single browser-local session envelope for repository form state, latest report, and per-report chat threads, with future database migration path. |
| Auth/database readiness | #18, #43 | Actor/context, owner/workspace metadata, repository ports, and future access policy. |
| Preview/live-provider E2E setup | #45, #66, #78 | Vercel preview E2E plus documented OpenRouter secret/test-repo setup. |
