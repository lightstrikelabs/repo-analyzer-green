# E2E Testing

Repo Analyzer Green keeps the foundational E2E path deterministic and fake-backed. Live-provider E2E can be added separately when a feature explicitly needs to exercise Vercel previews, GitHub repository acquisition, or OpenRouter-backed reviewer behavior.

## Local Foundational E2E

Run the local Playwright suite with:

```bash
pnpm test:e2e
```

When `PLAYWRIGHT_BASE_URL` is unset, Playwright starts the local Next.js dev server and targets `http://127.0.0.1:3000`.

The foundational E2E test must avoid paid model calls, external repository availability, production databases, and authentication. Use fixtures and fake adapters for the core repository-analysis workflow.

Current foundational coverage:

- `e2e/app-shell.spec.ts` verifies the repository-analysis UI flow with a mocked `/api/analyze` response, report rendering, local report persistence, and reload behavior.
- `e2e/app-shell.spec.ts` verifies follow-up chat UI wiring with mocked `/api/follow-up`, including API key entry, model persistence, opening a targeted thread, rendering evidence-backed answer content, closing the slideout, and restoring recent thread state after reload.
- `e2e/red-ui-parity.spec.ts` is opt-in visual parity coverage for the deployed red and green top sections. It does not exercise model behavior.

The foundational Playwright suite does not call OpenRouter. Live model behavior is covered by opt-in contract tests so normal CI remains deterministic.

## Preview E2E

Vercel preview E2E runs against pull request preview deployments when Vercel reports a successful deployment URL.

The workflow sets:

```bash
PLAYWRIGHT_BASE_URL=<preview-url>
```

For protected Vercel preview deployments, configure the GitHub Actions repository secret:

```text
VERCEL_AUTOMATION_BYPASS_SECRET
```

Do not store or print the secret value in files, issues, PRs, commit messages, screenshots, or logs. See [How To Run Preview E2E Against Protected Vercel Deployments](how-tos/vercel-preview-e2e.md) for setup and rotation steps.

## Live-Provider Contracts

Live-provider checks should be separate from the required deterministic path. Use them only for explicitly scoped checks that need real provider behavior.

OpenRouter-backed live checks should read:

```text
OPENROUTER_API_KEY
E2E_TEST_REPOSITORY_URL
```

`OPENROUTER_API_KEY` must be a GitHub Actions repository secret. `E2E_TEST_REPOSITORY_URL` should be a GitHub Actions repository variable pointing to a public test repository.

The test should pass provider credentials only through server-side environment variables or request-scoped configuration. Do not expose provider keys to browser localStorage, rendered HTML, screenshots, traces, or client-side logs.

Current live-provider coverage:

- `test/infrastructure/llm/openrouter-live-contract.test.ts` verifies that configured OpenRouter models can return parseable JSON content.
- `test/app/follow-up-live-contract.test.ts` verifies that `/api/follow-up` can return a validated follow-up answer through the route boundary.

See [How To Configure OpenRouter For E2E Tests](how-tos/openrouter-e2e.md) for the full setup.

## CI Expectations

`pnpm run ci` runs the foundational E2E suite after linting, formatting checks, type checking, unit tests, and build.

Preview and live-provider checks should fail with clear missing-configuration messages when intentionally invoked without required secrets or variables. They should not silently fall back to behavior that gives false confidence.
