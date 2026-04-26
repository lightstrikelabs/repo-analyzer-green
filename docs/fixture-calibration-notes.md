# Fixture Calibration Notes

These fixtures are calibrated to keep repository analysis from overfitting to one language or project type.

## `minimal-node-library`

- Archetype: `node-library`
- Languages: TypeScript, Markdown
- Expected signals: package manifest, reusable source module, one unit test, small source surface
- Caveats: intentionally narrow scope, no release history, no deployment signals, no persistence or auth evidence

## `nextjs-web-app`

- Archetype: `web-app`
- Languages: TypeScript, Markdown
- Expected signals: Next.js package metadata, `src/app/` route files, browser application entrypoints
- Caveats: minimal UI surface, no production auth flow, no API routes, no database evidence

## `go-cli-tool`

- Archetype: `cli`
- Languages: Go, Markdown
- Expected signals: executable path under `bin/`, Go source files, command-line structure
- Caveats: no package manager manifest, no release automation, no integration test harness, no external dependency story

## `mkdocs-docs-site`

- Archetype: `docs-heavy`
- Languages: Markdown, YAML
- Expected signals: MkDocs configuration, documentation pages outnumbering source, docs-first repository shape
- Caveats: little to no executable code, so maintainability and testability conclusions should stay limited to documentation structure

## Calibration Intent

- The suite should span at least three languages and four archetypes.
- The registry should make the fixture mix visible to tests instead of burying it in file-system conventions.
- Report interpretation should stay cautious when a fixture lacks release, deployment, or operational evidence.
