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

See [docs/development-plan.md](docs/development-plan.md) for the milestone and issue plan.
