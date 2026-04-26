# ADR 0001: Evidence-Backed Report Cards

## Status

Accepted

## Context

Repo Analyzer Green exists to help users understand repository quality without pretending that a single metric, test count, coverage percentage, or model-generated opinion is objective truth.

The product must support useful judgment while preserving the evidence and uncertainty behind that judgment. Repository quality depends on measured facts, project context, reviewer interpretation, and explicit policy choices. Those inputs need to remain distinguishable so reports can be tested, explained, challenged, and improved.

## Decision

Quality reports will be produced as evidence-backed report cards that combine:

1. Deterministic repository evidence collected from the repository.
2. Structured reviewer assessment over selected evidence.
3. Explicit scoring and confidence policy owned by the domain.

The scoring policy, not the static collector or reviewer alone, produces the final report card. It must combine evidence and reviewer assessment into dimension-level findings, ratings or scores where appropriate, confidence, caveats, and recommended follow-up questions.

Every major report conclusion must preserve:

- Provenance: the source evidence, files, mechanisms, reviewer metadata, and policy version that support the conclusion.
- Confidence: the system's stated confidence in the conclusion, including lower confidence when evidence is missing, ambiguous, contradictory, or based mostly on interpretation.
- Caveats: limitations, missing evidence, assumptions, project-archetype constraints, and situations where the conclusion should not be over-read.

Static metrics are evidence, not final judgments. Reviewer assessments are structured inputs, not replacements for domain policy.

## Rejected Alternatives

### Static-Only Reports

A static-only approach would score repositories directly from deterministic signals such as file inventory, manifests, scripts, test files, coverage, complexity, documentation, or workflow configuration.

This is insufficient because static signals are context-sensitive. Test LOC, raw coverage, dependency count, CI presence, or complexity signals can support a conclusion but do not prove quality on their own. They can be absent for valid reasons, present but ineffective, distorted by generated code, or interpreted differently across project archetypes. Static-only reports would encourage false precision and metric gaming.

### Reviewer-Only Reports

A reviewer-only approach would ask an LLM, human, or other reviewer to produce the report directly.

This is insufficient because reviewer judgment can be inconsistent, under-cited, hard to test, and hard to reproduce. A reviewer can infer useful context, but the product must not let free-form interpretation become untraceable domain behavior. Reviewer output must be validated, structured, tied back to evidence, and constrained by explicit scoring and confidence policy.

## Consequences

### Architecture

- The domain model must keep evidence collection, reviewer assessment, scoring, confidence, caveats, and report composition as separate concepts.
- Framework, filesystem, network, GitHub, model-provider, persistence, and UI code must stay outside the domain core.
- Reviewer implementations must sit behind a port so tests can use fake reviewers and production can later use LLM, human, or alternate automated reviewers.
- Report cards, evidence bundles, reviewer assessments, and scoring policy should be versioned when persisted or serialized.
- Report presentation must distinguish evidence-backed statements, reviewer interpretation, scoring-policy decisions, assumptions, and missing context.
- Follow-up investigation should preserve citations to evidence, findings, caveats, and report dimensions when answering user questions.

### Testing

- Domain tests must cover scoring and confidence behavior without real model calls.
- Application tests should compose fixture-backed repository evidence with fake reviewer assessment.
- Contract tests must validate structured reviewer assessment shape before it reaches scoring.
- Fixture tests should cover multiple repository archetypes so policy assumptions do not silently overfit one project type.
- The foundational E2E test must verify that the main repository-analysis workflow produces a report card with evidence references, confidence, and caveat information.
- Tests should assert that missing or weak evidence lowers confidence or produces caveats instead of becoming an unsupported hard judgment.

### Product Behavior

- Reports should explain why a conclusion was reached and what evidence would change it.
- Scores or ratings should be treated as summaries of policy-backed judgment, not standalone proof.
- Low-confidence dimensions should remain useful by showing missing evidence and recommended follow-up questions.
- Raw static metrics, raw coverage, raw test LOC, and a single model answer must not be presented as direct proof of repository quality.
