# Reviewer Prompt Contract

The reviewer prompt contract turns deterministic repository evidence into a structured reviewer assessment. It is provider-neutral and lives in the reviewer domain so OpenRouter, future model providers, human review tools, and fake reviewers can share the same expectations.

## Contract Rules

- Return only JSON matching `reviewer-assessment.v1`.
- Use only supplied repository evidence, evidence references, and evidence summary.
- Do not make unsupported claims.
- Treat missing evidence as uncertainty, not as an automatic quality defect.
- Treat static metrics as evidence, not direct quality judgments.
- Treat security hygiene signals as indicators requiring review, not confirmed vulnerabilities.
- Include caveats for low confidence, bounded scans, unsupported ecosystems, unavailable evidence, and provider limitations.
- Include follow-up questions tied to uncertainty or risk.

## Required Dimensions

The reviewer must assess:

- `architecture-boundaries`
- `maintainability`
- `verifiability`
- `security`
- `operability`
- `documentation`

Each dimension should include confidence, evidence references where evidence exists, strengths, risks, and missing evidence.

## Implementation

The renderer is [reviewer-prompt.ts](/Users/wunderpro/lightstrike/lightstrike/ai-slop-prevention-q2-2026/green/src/domain/reviewer/reviewer-prompt.ts). Provider adapters should pass its messages to the model without weakening the structured-output or evidence-grounding rules.
