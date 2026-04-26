# Deployment

The production target is Vercel. Pull requests should receive Vercel preview deployments, and preview URLs should run the Playwright E2E smoke suite.

## Vercel Project

Expected project connection:

- GitHub repository: `lightstrikelabs/repo-analyzer-green`
- Framework preset: Next.js
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm build`
- Development command: `pnpm dev`

The committed Vercel configuration lives in `vercel.json`.

Do not commit `.vercel/`. Vercel stores local project linkage there, including project and org identifiers. Those identifiers are not application secrets, but they are environment-specific operational metadata and should stay local.

## CLI Setup

Use the Vercel CLI from the repository root:

```bash
vercel --version
vercel whoami --no-color
vercel link --yes --project repo-analyzer-green
```

If multiple Vercel scopes are available, add `--scope <scope-name>` to `vercel link`.

Connect the Vercel project to GitHub:

```bash
vercel git connect https://github.com/lightstrikelabs/repo-analyzer-green
```

For a private repository, this may require granting the Vercel GitHub integration access to the repository in the Vercel dashboard or GitHub app settings first.

Do not paste Vercel tokens, project IDs, org IDs, deployment IDs, or pulled environment values into issues, PRs, commit messages, or docs.

## Preview E2E

`.github/workflows/preview-e2e.yml` listens for successful GitHub deployment statuses with an environment URL where `production_environment` is `false`. When Vercel reports a preview URL, the workflow runs:

```bash
PLAYWRIGHT_BASE_URL=<preview-url> pnpm test:e2e
```

`playwright.config.ts` uses `PLAYWRIGHT_BASE_URL` when present. Without it, Playwright starts the local Next.js dev server and targets `http://127.0.0.1:3000`.

Vercel preview deployments may be protected by Vercel Authentication. For automated preview E2E, enable Vercel Protection Bypass for Automation and store the generated value as the GitHub Actions secret `VERCEL_AUTOMATION_BYPASS_SECRET`.

See [How To Run Preview E2E Against Protected Vercel Deployments](how-tos/vercel-preview-e2e.md) for the setup and verification steps.

When the secret is present, Playwright sends:

```text
x-vercel-protection-bypass: <secret>
x-vercel-set-bypass-cookie: true
```

For protected preview deployments, this secret is required for Preview E2E to exercise the application instead of Vercel's deployment protection page.

References:
- [Vercel: Methods to bypass Deployment Protection](https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection)
- [Vercel: Protection Bypass for Automation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)

## Production

Production deployments should come from merges to `main` through protected PRs with green `Quality Gate` checks.

Before production has real users or private repository access, define:

- Required environment variables in Vercel
- Secret ownership and rotation policy
- Model-provider credentials and usage limits
- GitHub provider token policy for private repositories
- Database connection and migration process

No secret values should be stored in GitHub issues, pull requests, docs, or committed files.

## Branch Protection

`Quality Gate` is the required merge check for `main`.

Preview E2E is event-driven by Vercel deployment statuses. Treat preview E2E failures as release blockers once Vercel preview deployments are consistently available for pull requests.
