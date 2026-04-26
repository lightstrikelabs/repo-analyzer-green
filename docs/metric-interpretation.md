# Metric Interpretation Guidance

Repo Analyzer Green uses repository metrics as evidence, not as a final verdict.
The point of the report is to help a reviewer and user understand what a
repository appears to be doing, where the evidence is strong, and where the
result is uncertain or incomplete.

## What Metrics Can Prove

Metrics can support bounded claims about the repository under inspection:

- The project uses a particular language or framework.
- The repository has or lacks build, test, lint, deployment, or release signals.
- The source tree is large, small, shallow, nested, generated, or docs-heavy.
- Certain files, manifests, or workflows exist and therefore make some
  capabilities more likely.
- A signal is absent, but only within the scope of the scan that was performed.

Metrics cannot prove the overall quality of the software by themselves.
They do not prove maintainability, security, reliability, or correctness without
context, reviewer assessment, and evidence about the project archetype.

## Theoretical Basis

The guidance here follows a few established ideas rather than inventing a single
universal score.

- ISO/IEC 25010 gives us stable product-quality dimensions such as
  maintainability, reliability, security, usability, and portability.
- McCabe-style complexity measures can indicate control-flow pressure, but only
  in relation to the language and module shape being analyzed.
- DORA-style metrics are useful when the repository has deployment and incident
  evidence, but they are not available for every project.
- SPACE reminds us that engineering performance is multi-dimensional and should
  not collapse into one activity metric.
- Goodhart's Law is the warning label: once a metric becomes the target, it
  becomes easier to optimize the number than the underlying outcome.

## Applied Basis

The applied rule is simple:

1. Collect deterministic signals.
2. Map them to quality dimensions.
3. Preserve confidence, provenance, and missing evidence.
4. Let the reviewer explain what the signal means for this project type.

That means:

- Test LOC is not a quality target. More test lines can be noisy, redundant, or
  even misleading if they are easy to inflate.
- Raw coverage is only one signal. It does not tell us whether tests are
  meaningful, brittle, focused, or representative.
- File counts, dependency counts, and workflow presence can support a claim, but
  they do not settle it.
- A docs-heavy repository, a CLI, a web app, and a library should not be judged
  by the same surface signals alone.

## Cross-Language Consistency

Consistency comes from stable dimensions, not identical thresholds.

The same report should ask roughly the same questions across languages:

- Does the project have a clear structure?
- Are there build and test entrypoints appropriate to the stack?
- Is the repository readable and maintainable for its archetype?
- Is the evidence sufficient to support a strong claim?

But the exact signals behind those questions differ:

- TypeScript repositories may expose package scripts, test frameworks, and
  frontend route structure.
- Go repositories may expose module files, command entrypoints, and package
  layout.
- Documentation-first repositories may have more Markdown and YAML than code,
  which should not be treated as a defect.

If a signal is unavailable or unsupported, the correct response is a caveat or
missing-evidence note, not a forced penalty.

## What To Avoid

- Do not optimize for the number of tests, lines of tests, or raw coverage.
- Do not treat a single static score as a universal quality measure.
- Do not compare languages by the same mechanical thresholds.
- Do not interpret missing evidence as failure unless the repo context makes the
  absence truly relevant.
- Do not let the reviewer replace evidence with ungrounded opinion.

## Good Follow-Up Questions

When the report is uncertain, ask questions that narrow the evidence gap:

- What evidence would increase confidence in this dimension?
- Which files or workflows would change this conclusion?
- Is this repository following the conventions of its archetype?
- Are there supported tests, linting, or deployment signals for this stack?
- Which caveats matter most before acting on this result?

## Practical Reading Rule

If a metric looks suspiciously neat, ask whether it is telling the truth or just
making a number easy to compare. The report should explain the difference.
