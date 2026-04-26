# Red Parity Map

This document maps useful behavior from `repo-analyzer-red` to Green's domain-first implementation plan.

Parity does not mean copying red's architecture or scoring formulas. Green should reach comparable product capability while preserving evidence, confidence, caveats, typed boundaries, tests, and clear adapter ownership.

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

## Intentional Departures

- Static metrics are evidence, not final judgments.
- Missing evidence becomes uncertainty or caveats, not an automatic penalty.
- LLM output is structured reviewer input, not direct report truth.
- Raw test LOC, raw coverage, and single static scores are not treated as proof of quality.
- Domain code stays independent of Next.js, GitHub, filesystem, archive extraction, OpenRouter, auth, and databases.
- The foundational E2E path remains fake-backed and deterministic; live-provider E2E should be separate and explicitly scoped.

## Remaining Parity Priorities

Near-term parity work should focus on:

1. Public GitHub acquisition through #70.
2. Language/code-shape and security evidence through #71 and #72.
3. The analyze application service through #29.
4. Analyze API and initial report UI through #30 and #31.
5. Follow-up chat domain and retrieval through #32 to #38.
6. Local persistence through #74 and #39.

These issues should stay small enough for one issue per PR. If a parity issue grows beyond one coherent slice, split it and document the sequence in the issue before continuing.
