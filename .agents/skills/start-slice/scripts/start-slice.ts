import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

export type SliceArgs = {
  readonly issueNumber: number;
  readonly slug: string;
};

export type SliceParseResult =
  | { readonly ok: true; readonly args: SliceArgs }
  | { readonly ok: false; readonly error: string };

export type SlicePlanInput = {
  readonly issueNumber: number;
  readonly slug: string;
  readonly projectDir: string;
  readonly currentBranch: string;
  readonly isWorkingTreeDirty: boolean;
};

export type SlicePlan =
  | { readonly canProceed: false; readonly reason: string }
  | {
      readonly canProceed: true;
      readonly worktreePath: string;
      readonly branchName: string;
      readonly steps: readonly string[];
    };

const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function parseSliceArgs(argv: readonly string[]): SliceParseResult {
  const issueIdx = argv.indexOf("--issue");
  if (issueIdx === -1 || argv[issueIdx + 1] === undefined) {
    return { ok: false, error: "missing --issue <number>" };
  }
  const slugIdx = argv.indexOf("--slug");
  if (slugIdx === -1 || argv[slugIdx + 1] === undefined) {
    return { ok: false, error: "missing --slug <kebab-case>" };
  }
  const issueRaw = argv[issueIdx + 1]!;
  const issueNumber = Number.parseInt(issueRaw, 10);
  if (
    !Number.isInteger(issueNumber) ||
    issueNumber <= 0 ||
    `${issueNumber}` !== issueRaw
  ) {
    return {
      ok: false,
      error: `invalid --issue value ${JSON.stringify(issueRaw)}; expected a positive integer`,
    };
  }
  const slug = argv[slugIdx + 1]!;
  if (!SLUG_REGEX.test(slug)) {
    return {
      ok: false,
      error: `invalid --slug value ${JSON.stringify(slug)}; must be lowercase letters, digits, and hyphens, with no leading or trailing hyphen`,
    };
  }
  return { ok: true, args: { issueNumber, slug } };
}

export function planSlice(input: SlicePlanInput): SlicePlan {
  if (input.isWorkingTreeDirty) {
    return {
      canProceed: false,
      reason:
        "working tree has uncommitted changes; commit or stash them before starting a new slice",
    };
  }
  if (input.currentBranch !== "main") {
    return {
      canProceed: false,
      reason: `current branch is ${input.currentBranch}, not main; switch to main and re-run so the new worktree branches from a clean base`,
    };
  }
  const branchName = `${input.issueNumber}-${input.slug}`;
  const worktreePath = join(input.projectDir, "..", "worktrees", branchName);
  const steps: readonly string[] = [
    "git fetch origin main",
    `git worktree add "${worktreePath}" -b "${branchName}" origin/main`,
    `cd "${worktreePath}"`,
    "pnpm install --frozen-lockfile",
    "PREFLIGHT_SKIP_NETWORK=1 node .agents/skills/preflight/scripts/preflight.ts",
    "# Now write the failing test FIRST per AGENTS.md `## Before Any Code`",
  ];
  return { canProceed: true, worktreePath, branchName, steps };
}

function detectCurrentBranch(projectDir: string): string {
  const result = spawnSync(
    "git",
    ["-C", projectDir, "rev-parse", "--abbrev-ref", "HEAD"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    throw new Error(
      `failed to read current branch: ${result.stderr?.trim() ?? "unknown error"}`,
    );
  }
  return result.stdout.trim();
}

function detectWorkingTreeDirty(projectDir: string): boolean {
  const result = spawnSync("git", ["-C", projectDir, "status", "--porcelain"], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(
      `failed to read git status: ${result.stderr?.trim() ?? "unknown error"}`,
    );
  }
  return result.stdout.trim().length > 0;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes("--dry-run");
  const filtered = argv.filter((arg) => arg !== "--dry-run");

  const parsed = parseSliceArgs(filtered);
  if (!parsed.ok) {
    process.stderr.write(`${parsed.error}\n`);
    process.stderr.write(
      "Usage: node start-slice.ts --issue <number> --slug <kebab-case> [--dry-run]\n",
    );
    process.exit(2);
  }

  const projectDir = process.env.START_SLICE_PROJECT_DIR ?? process.cwd();
  if (!existsSync(join(projectDir, ".git"))) {
    process.stderr.write(`${projectDir} is not a git checkout\n`);
    process.exit(2);
  }

  const currentBranch = detectCurrentBranch(projectDir);
  const isWorkingTreeDirty = detectWorkingTreeDirty(projectDir);

  const plan = planSlice({
    issueNumber: parsed.args.issueNumber,
    slug: parsed.args.slug,
    projectDir,
    currentBranch,
    isWorkingTreeDirty,
  });

  if (!plan.canProceed) {
    process.stderr.write(`Refusing to start slice: ${plan.reason}\n`);
    process.exit(2);
  }

  if (dryRun) {
    process.stdout.write(
      `Plan for slice ${plan.branchName} at ${plan.worktreePath}:\n\n`,
    );
    for (const step of plan.steps) {
      process.stdout.write(`  ${step}\n`);
    }
    process.stdout.write(
      "\nNo changes made (dry run). Re-run without --dry-run to execute.\n",
    );
    return;
  }

  process.stdout.write(`Starting slice ${plan.branchName}...\n`);
  for (const step of plan.steps) {
    if (step.startsWith("#") || step.startsWith("cd ")) {
      process.stdout.write(`${step}\n`);
      continue;
    }
    process.stdout.write(`+ ${step}\n`);
    const result = spawnSync(step, {
      shell: true,
      stdio: "inherit",
      cwd: projectDir,
    });
    if (result.status !== 0) {
      process.stderr.write(`Step failed (exit ${result.status}): ${step}\n`);
      process.exit(result.status ?? 1);
    }
  }
  process.stdout.write(
    `\nWorktree ready at ${plan.worktreePath}.\nNext: write the failing test FIRST per AGENTS.md \`## Before Any Code\`.\n`,
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
