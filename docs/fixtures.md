# Test Fixtures

Fixtures let the project test repository analysis without network calls, model calls, external services, or private data.

## Repository Fixture Rules

- Keep fixtures small enough to inspect in review.
- Name fixtures by archetype and purpose, for example `minimal-node-library`.
- Store repository fixtures under `test/fixtures/repositories/<fixture-id>`.
- Register fixtures in `test/support/fixtures.ts` before using them in tests.
- Include a short fixture `README.md` that states what the fixture represents.
- Prefer source files that pass the repo's own type and type-escape checks.
- Prefer fixture test files named `.spec.ts` so parent Vitest runs do not execute fixture suites by accident.
- Do not include secrets, tokens, real customer code, or generated dependency folders.
- Do not let fixtures require network, database, model-provider, GitHub, or deployment access.

## Current Fixtures

### `minimal-node-library`

A tiny TypeScript library with a package manifest, one source module, one unit test, and local scripts. Use it for early repository-source, inventory, manifest, test-signal, and report-card tests.

## Maintenance

When a fixture changes, update:

- `test/support/fixtures.ts`
- The fixture README
- Any tests that assert expected files or signals

If a test needs a larger or language-specific repository, add a new fixture instead of expanding an existing one beyond its stated purpose.
