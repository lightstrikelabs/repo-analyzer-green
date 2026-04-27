import { existsSync, readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

export type CheckStatus = "pass" | "fail" | "skip";

export type CheckResult = {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail?: string;
  readonly remediation?: string;
};

export type RunChecksOptions = {
  readonly projectDir: string;
  readonly currentNodeVersion?: string;
  readonly currentPnpmVersion?: string;
  readonly skipNetworkChecks?: boolean;
};

type CheckRunner = (options: RunChecksOptions) => CheckResult;

const CHECKS: readonly CheckRunner[] = [
  checkCiWorkflows,
  checkClaudeRedGreenHook,
  checkLefthookInstalled,
  checkGitRemote,
  checkNodeVersion,
  checkPnpmVersion,
  checkVercelLink,
  checkGhAuth,
  checkBranchProtection,
];

export function runChecks(options: RunChecksOptions): readonly CheckResult[] {
  return CHECKS.map((check) => check(options));
}

function checkCiWorkflows(options: RunChecksOptions): CheckResult {
  const dir = join(options.projectDir, ".github/workflows");
  if (!existsSync(dir)) {
    return {
      name: "CI workflow files",
      status: "fail",
      remediation:
        "Add a workflow under `.github/workflows/` so quality gate and preview deploy run on every PR.",
    };
  }
  const yamlFiles = readdirSync(dir).filter(
    (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
  );
  if (yamlFiles.length === 0) {
    return {
      name: "CI workflow files",
      status: "fail",
      detail: ".github/workflows/ exists but contains no .yml files",
      remediation:
        "Add at least one workflow file under `.github/workflows/` (e.g., `ci.yml`).",
    };
  }
  return {
    name: "CI workflow files",
    status: "pass",
    detail: `${yamlFiles.length} workflow file(s)`,
  };
}

function checkClaudeRedGreenHook(options: RunChecksOptions): CheckResult {
  const settingsPath = join(options.projectDir, ".claude/settings.json");
  if (!existsSync(settingsPath)) {
    return {
      name: "Claude Code red-green hook",
      status: "fail",
      remediation:
        "Add `.claude/settings.json` with a PreToolUse hook invoking `scripts/red-green-gate.ts`. See docs/agent-compat.md.",
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(settingsPath, "utf8"));
  } catch (error) {
    return {
      name: "Claude Code red-green hook",
      status: "fail",
      detail: `failed to parse .claude/settings.json: ${(error as Error).message}`,
    };
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !hasPreToolUseHook(parsed)
  ) {
    return {
      name: "Claude Code red-green hook",
      status: "fail",
      detail: ".claude/settings.json is missing a PreToolUse hook",
      remediation:
        "Add `hooks.PreToolUse` matching `Edit|Write|MultiEdit` to `.claude/settings.json`. See docs/agent-compat.md.",
    };
  }
  return {
    name: "Claude Code red-green hook",
    status: "pass",
    detail: ".claude/settings.json declares a PreToolUse hook",
  };
}

function hasPreToolUseHook(value: object): boolean {
  if (!("hooks" in value)) {
    return false;
  }
  const hooks = (value as { readonly hooks?: unknown }).hooks;
  if (typeof hooks !== "object" || hooks === null) {
    return false;
  }
  if (!("PreToolUse" in hooks)) {
    return false;
  }
  const preToolUse = (hooks as { readonly PreToolUse?: unknown }).PreToolUse;
  return Array.isArray(preToolUse) && preToolUse.length > 0;
}

function checkLefthookInstalled(options: RunChecksOptions): CheckResult {
  const hooksDirResult = spawnSync(
    "git",
    ["-C", options.projectDir, "rev-parse", "--git-path", "hooks"],
    { encoding: "utf8" },
  );
  if (hooksDirResult.error !== undefined || hooksDirResult.status !== 0) {
    return {
      name: "lefthook git hooks",
      status: "fail",
      detail: "could not resolve git hooks directory",
      remediation: "Ensure the project is a git checkout.",
    };
  }
  const rawHooksDir = hooksDirResult.stdout.trim();
  const hooksDir = isAbsolute(rawHooksDir)
    ? rawHooksDir
    : join(options.projectDir, rawHooksDir);
  const hookPath = join(hooksDir, "pre-commit");
  if (!existsSync(hookPath)) {
    return {
      name: "lefthook git hooks",
      status: "fail",
      remediation:
        "Run `pnpm exec lefthook install` to install the pre-commit and commit-msg hooks.",
    };
  }
  const content = readFileSync(hookPath, "utf8");
  if (!/lefthook/i.test(content)) {
    return {
      name: "lefthook git hooks",
      status: "fail",
      detail:
        ".git/hooks/pre-commit exists but does not look like a lefthook hook",
      remediation:
        "Run `pnpm exec lefthook install` to overwrite with the lefthook-managed hook.",
    };
  }
  return {
    name: "lefthook git hooks",
    status: "pass",
  };
}

function checkGitRemote(options: RunChecksOptions): CheckResult {
  const result = spawnSync(
    "git",
    ["-C", options.projectDir, "remote", "get-url", "origin"],
    {
      encoding: "utf8",
    },
  );
  if (result.error !== undefined || result.status !== 0) {
    return {
      name: "git remote origin",
      status: "fail",
      detail: result.stderr?.trim() ?? "git remote get-url origin failed",
      remediation:
        "Add a remote with `git remote add origin <url>` pointing at the GitHub repo.",
    };
  }
  return {
    name: "git remote origin",
    status: "pass",
    detail: result.stdout.trim(),
  };
}

function checkNodeVersion(options: RunChecksOptions): CheckResult {
  const engines = readEngines(options.projectDir);
  if (engines === undefined) {
    return {
      name: "Node version vs engines.node",
      status: "fail",
      remediation:
        "Add a `package.json` at the project root with an `engines.node` constraint.",
    };
  }
  const required = engines.node;
  if (required === undefined) {
    return {
      name: "Node version vs engines.node",
      status: "skip",
      detail: "package.json has no engines.node",
    };
  }
  const current = (options.currentNodeVersion ?? process.version).replace(
    /^v/,
    "",
  );
  if (versionMatches(current, required)) {
    return {
      name: "Node version vs engines.node",
      status: "pass",
      detail: `${current} satisfies ${required}`,
    };
  }
  return {
    name: "Node version vs engines.node",
    status: "fail",
    detail: `${current} does not satisfy ${required}`,
    remediation: `Switch Node to ${required} (e.g., \`nvm use\`).`,
  };
}

function checkPnpmVersion(options: RunChecksOptions): CheckResult {
  const engines = readEngines(options.projectDir);
  if (engines?.pnpm === undefined) {
    return {
      name: "pnpm version vs engines.pnpm",
      status: "skip",
      detail: "package.json has no engines.pnpm",
    };
  }
  const required = engines.pnpm;
  const current = options.currentPnpmVersion ?? readPnpmVersion();
  if (current === undefined) {
    return {
      name: "pnpm version vs engines.pnpm",
      status: "fail",
      detail: "could not determine pnpm version",
      remediation: "Install pnpm and ensure it is on PATH.",
    };
  }
  if (versionMatches(current, required)) {
    return {
      name: "pnpm version vs engines.pnpm",
      status: "pass",
      detail: `${current} satisfies ${required}`,
    };
  }
  return {
    name: "pnpm version vs engines.pnpm",
    status: "fail",
    detail: `${current} does not satisfy ${required}`,
    remediation: `Install pnpm ${required} (e.g., \`corepack enable\` then \`corepack prepare pnpm@${required} --activate\`).`,
  };
}

function checkVercelLink(options: RunChecksOptions): CheckResult {
  const projectFile = join(options.projectDir, ".vercel/project.json");
  if (existsSync(projectFile)) {
    return {
      name: "Vercel project link",
      status: "pass",
      detail: ".vercel/project.json present",
    };
  }
  return {
    name: "Vercel project link",
    status: "skip",
    detail:
      ".vercel/project.json missing (run `vercel link` if this repo deploys to Vercel)",
  };
}

function checkGhAuth(options: RunChecksOptions): CheckResult {
  if (options.skipNetworkChecks === true) {
    return {
      name: "gh auth status",
      status: "skip",
      detail: "skipped (PREFLIGHT_SKIP_NETWORK=1)",
    };
  }
  const result = spawnSync("gh", ["auth", "status"], { encoding: "utf8" });
  if (result.error !== undefined) {
    return {
      name: "gh auth status",
      status: "fail",
      detail: "gh CLI not installed or not on PATH",
      remediation: "Install GitHub CLI: https://cli.github.com/",
    };
  }
  if (result.status !== 0) {
    return {
      name: "gh auth status",
      status: "fail",
      detail: result.stderr?.trim() ?? "gh auth status returned non-zero",
      remediation: "Run `gh auth login`.",
    };
  }
  return {
    name: "gh auth status",
    status: "pass",
  };
}

function checkBranchProtection(options: RunChecksOptions): CheckResult {
  if (options.skipNetworkChecks === true) {
    return {
      name: "main branch protection",
      status: "skip",
      detail: "skipped (PREFLIGHT_SKIP_NETWORK=1)",
    };
  }
  const remoteResult = spawnSync(
    "git",
    ["-C", options.projectDir, "remote", "get-url", "origin"],
    { encoding: "utf8" },
  );
  if (remoteResult.status !== 0) {
    return {
      name: "main branch protection",
      status: "skip",
      detail: "no origin remote",
    };
  }
  const slug = parseGitHubSlug(remoteResult.stdout.trim());
  if (slug === undefined) {
    return {
      name: "main branch protection",
      status: "skip",
      detail: "origin is not a GitHub remote",
    };
  }
  const protection = spawnSync(
    "gh",
    ["api", `repos/${slug}/branches/main/protection`],
    { encoding: "utf8" },
  );
  if (protection.error !== undefined) {
    return {
      name: "main branch protection",
      status: "skip",
      detail: "gh CLI not installed",
    };
  }
  if (protection.status !== 0) {
    return {
      name: "main branch protection",
      status: "fail",
      detail:
        "no branch protection configured on main (or no permission to read it)",
      remediation:
        "Configure branch protection on `main` to require PR review and CI checks.",
    };
  }
  return {
    name: "main branch protection",
    status: "pass",
  };
}

function readEngines(projectDir: string):
  | {
      readonly node?: string;
      readonly pnpm?: string;
    }
  | undefined {
  const packageJsonPath = join(projectDir, "package.json");
  if (!existsSync(packageJsonPath)) {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    if (typeof parsed === "object" && parsed !== null && "engines" in parsed) {
      const engines = (parsed as { readonly engines: unknown }).engines;
      if (typeof engines === "object" && engines !== null) {
        const obj = engines as {
          readonly node?: unknown;
          readonly pnpm?: unknown;
        };
        return {
          ...(typeof obj.node === "string" && { node: obj.node }),
          ...(typeof obj.pnpm === "string" && { pnpm: obj.pnpm }),
        };
      }
    }
  } catch {
    return undefined;
  }
  return {};
}

function readPnpmVersion(): string | undefined {
  const result = spawnSync("pnpm", ["--version"], { encoding: "utf8" });
  if (result.error !== undefined || result.status !== 0) {
    return undefined;
  }
  return result.stdout.trim();
}

function versionMatches(current: string, required: string): boolean {
  const trimmedRequired = required.trim();
  if (trimmedRequired.endsWith(".x")) {
    const major = trimmedRequired.slice(0, -2);
    const currentMajor = current.split(".")[0] ?? "";
    return currentMajor === major;
  }
  return current === trimmedRequired;
}

function parseGitHubSlug(remoteUrl: string): string | undefined {
  const trimmed = remoteUrl.trim();
  const httpsMatch = trimmed.match(
    /github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?\/?$/,
  );
  if (httpsMatch !== null && httpsMatch[1] !== undefined) {
    return httpsMatch[1];
  }
  return undefined;
}

function renderMarkdownTable(results: readonly CheckResult[]): string {
  const lines: string[] = ["| name | status | detail |", "| --- | --- | --- |"];
  for (const result of results) {
    const detail = result.detail ?? "";
    const status = `\`${result.status}\``;
    lines.push(
      `| ${escapePipe(result.name)} | ${status} | ${escapePipe(detail)} |`,
    );
  }
  return lines.join("\n");
}

function escapePipe(value: string): string {
  return value.replace(/\|/g, "\\|");
}

async function main(): Promise<void> {
  const targetIdx = process.argv.indexOf("--target");
  const projectDir =
    targetIdx >= 0 && process.argv[targetIdx + 1] !== undefined
      ? process.argv[targetIdx + 1]!
      : process.cwd();
  const skipNetwork = process.env.PREFLIGHT_SKIP_NETWORK === "1";
  const overrideNode = process.env.PREFLIGHT_NODE_VERSION;
  const overridePnpm = process.env.PREFLIGHT_PNPM_VERSION;

  const results = runChecks({
    projectDir,
    skipNetworkChecks: skipNetwork,
    ...(overrideNode !== undefined && { currentNodeVersion: overrideNode }),
    ...(overridePnpm !== undefined && { currentPnpmVersion: overridePnpm }),
  });

  process.stdout.write(`${renderMarkdownTable(results)}\n`);

  const failed = results.filter((r) => r.status === "fail");
  if (failed.length > 0) {
    process.stdout.write(
      `\n${failed.length} check(s) failed. See remediation hints above.\n`,
    );
    for (const f of failed) {
      if (f.remediation !== undefined) {
        process.stdout.write(`- ${f.name}: ${f.remediation}\n`);
      }
    }
    process.exit(1);
  }
  process.stdout.write("\nAll preflight checks passed (or skipped).\n");
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
