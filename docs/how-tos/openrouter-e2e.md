# How To Configure OpenRouter For E2E Tests

This guide documents the GitHub Actions configuration for future E2E tests that exercise OpenRouter-backed reviewer or follow-up behavior.

The foundational E2E test should stay deterministic and fake-backed. Live-provider E2E should be added as a separate, explicitly scoped workflow or job so ordinary product checks do not depend on paid/network model calls unless that dependency is intentional.

## GitHub Actions Secret

Store the OpenRouter key as a GitHub Actions repository secret named `OPENROUTER_API_KEY`.

Do not put the key in:

- committed files
- issue comments
- PR descriptions
- commit messages
- screenshots
- copied workflow logs

Verify only that the secret exists:

```bash
gh secret list --repo lightstrikelabs/repo-analyzer-green --app actions
```

Do not verify by printing the secret value.

## Test Repository

Use a GitHub Actions repository variable named `E2E_TEST_REPOSITORY_URL` for the public repository used by live-provider E2E.

Current value:

```text
https://github.com/lightstrikelabs/repo-analyzer-green
```

Verify the variable with:

```bash
gh variable list --repo lightstrikelabs/repo-analyzer-green
```

This repository is public and safe to document. It should still be treated as a network dependency for any live GitHub acquisition or live-provider E2E job.

## Expected Workflow Use

A live-provider E2E job should read:

```yaml
OPENROUTER_API_KEY: ${{ secrets.OPENROUTER_API_KEY }}
E2E_TEST_REPOSITORY_URL: ${{ vars.E2E_TEST_REPOSITORY_URL }}
```

The test should pass the key only through environment variables or request-scoped server-side configuration. It should not expose the key to browser localStorage, rendered HTML, screenshots, traces, or client-side logs.

## Runtime Contract

OpenRouter configuration is parsed at the provider boundary in `src/infrastructure/llm/openrouter-config.ts`.

- `OPENROUTER_API_KEY` is request-scoped configuration. This slice does not store it.
- Empty or missing model input defaults to `openrouter/free`.
- Empty API key input is normalized to an unavailable provider configuration.
- Provider request metadata stays in infrastructure and currently supports `reviewer-assessment` and `follow-up-answer` usage contexts.

The OpenRouter chat provider returns typed provider failures instead of throwing provider details into the domain. Missing keys, network failures, non-2xx responses, invalid response shapes, and empty or reasoning-only responses should become user-facing caveats that say OpenRouter output is unavailable. Do not include raw provider error bodies or secret values in user-facing UI, persisted reports, traces, or PR/issue text.

## Safety Rules

- Keep the deterministic foundational E2E fake-backed.
- Put live OpenRouter E2E in its own clearly named job.
- Avoid running live-provider E2E on untrusted fork pull requests unless secrets are unavailable or the job is explicitly guarded.
- Use a low-cost/free model default where possible.
- Fail with a clear missing-secret message if a live-provider job is manually requested without `OPENROUTER_API_KEY`.
- Redact provider errors before showing them in user-facing UI or persisted artifacts.

## Rotation

If the key is rotated:

1. Update the GitHub Actions repository secret.
2. Re-run the live-provider E2E job.
3. Confirm logs do not contain the key.
4. Revoke the previous key in OpenRouter.
