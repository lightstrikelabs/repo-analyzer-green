import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { describe, expect, it } from "vitest";

import {
  runChecks,
  type CheckResult,
  type RunChecksOptions,
} from "../../.agents/skills/preflight/scripts/preflight";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const scriptPath = path.join(
  repoRoot,
  ".agents/skills/preflight/scripts/preflight.ts",
);

type FixtureOverrides = {
  readonly omitWorkflows?: boolean;
  readonly omitClaudeSettings?: boolean;
  readonly omitClaudeHook?: boolean;
  readonly nodeEngine?: string;
  readonly pnpmEngine?: string;
};

function makeFixture(overrides: FixtureOverrides = {}): {
  readonly dir: string;
  readonly cleanup: () => void;
} {
  const dir = mkdtempSync(path.join(tmpdir(), "green-preflight-"));

  spawnSync("git", ["-C", dir, "init", "--quiet"]);
  spawnSync("git", [
    "-C",
    dir,
    "remote",
    "add",
    "origin",
    "https://github.com/lightstrikelabs/preflight-fixture.git",
  ]);
  writeFileSync(
    path.join(dir, ".git/hooks/pre-commit"),
    "#!/bin/sh\n# LEFTHOOK\nexit 0\n",
  );

  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify(
      {
        name: "fixture",
        engines: {
          node: overrides.nodeEngine ?? "24.x",
          pnpm: overrides.pnpmEngine ?? "10.29.3",
        },
      },
      null,
      2,
    ),
  );

  if (overrides.omitWorkflows !== true) {
    mkdirSync(path.join(dir, ".github/workflows"), { recursive: true });
    writeFileSync(
      path.join(dir, ".github/workflows/ci.yml"),
      "name: ci\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo ok\n",
    );
  }

  if (overrides.omitClaudeSettings !== true) {
    mkdirSync(path.join(dir, ".claude"), { recursive: true });
    if (overrides.omitClaudeHook === true) {
      writeFileSync(path.join(dir, ".claude/settings.json"), "{}\n");
    } else {
      writeFileSync(
        path.join(dir, ".claude/settings.json"),
        JSON.stringify(
          {
            hooks: {
              PreToolUse: [
                {
                  matcher: "Edit|Write|MultiEdit",
                  hooks: [{ type: "command", command: "node /dev/null" }],
                },
              ],
            },
          },
          null,
          2,
        ),
      );
    }
  }

  return {
    dir,
    cleanup: () => rmSync(dir, { force: true, recursive: true }),
  };
}

const baseOptions = (
  dir: string,
  extras: Partial<RunChecksOptions> = {},
): RunChecksOptions => ({
  projectDir: dir,
  currentNodeVersion: "v24.14.0",
  currentPnpmVersion: "10.29.3",
  skipNetworkChecks: true,
  ...extras,
});

function findCheck(
  results: readonly CheckResult[],
  pattern: RegExp,
): CheckResult {
  const match = results.find((r) => pattern.test(r.name));
  if (match === undefined) {
    throw new Error(
      `no check matched ${pattern}; saw: ${results.map((r) => r.name).join(", ")}`,
    );
  }
  return match;
}

describe("preflight runChecks", () => {
  it("reports no failures for a fully-configured fixture", () => {
    const { dir, cleanup } = makeFixture();
    try {
      const results = runChecks(baseOptions(dir));
      const failures = results.filter((r) => r.status === "fail");
      expect(failures.map((f) => f.name)).toEqual([]);
    } finally {
      cleanup();
    }
  });

  it("fails the CI workflow check when .github/workflows is missing", () => {
    const { dir, cleanup } = makeFixture({ omitWorkflows: true });
    try {
      const results = runChecks(baseOptions(dir));
      const ci = findCheck(results, /CI workflow/i);
      expect(ci.status).toBe("fail");
    } finally {
      cleanup();
    }
  });

  it("fails the Claude hook check when .claude/settings.json is missing", () => {
    const { dir, cleanup } = makeFixture({ omitClaudeSettings: true });
    try {
      const results = runChecks(baseOptions(dir));
      const hook = findCheck(results, /Claude.*hook|red-green hook/i);
      expect(hook.status).toBe("fail");
    } finally {
      cleanup();
    }
  });

  it("fails the Claude hook check when settings.json lacks a PreToolUse hook", () => {
    const { dir, cleanup } = makeFixture({ omitClaudeHook: true });
    try {
      const results = runChecks(baseOptions(dir));
      const hook = findCheck(results, /Claude.*hook|red-green hook/i);
      expect(hook.status).toBe("fail");
    } finally {
      cleanup();
    }
  });

  it("fails the Node version check when current version does not match engines.node", () => {
    const { dir, cleanup } = makeFixture({ nodeEngine: "20.x" });
    try {
      const results = runChecks(
        baseOptions(dir, { currentNodeVersion: "v24.14.0" }),
      );
      const node = findCheck(results, /Node/i);
      expect(node.status).toBe("fail");
    } finally {
      cleanup();
    }
  });

  it("fails the pnpm version check when current pnpm does not match engines.pnpm", () => {
    const { dir, cleanup } = makeFixture({ pnpmEngine: "9.0.0" });
    try {
      const results = runChecks(
        baseOptions(dir, { currentPnpmVersion: "10.29.3" }),
      );
      const pnpmCheck = findCheck(results, /pnpm/i);
      expect(pnpmCheck.status).toBe("fail");
    } finally {
      cleanup();
    }
  });

  it("passes the lefthook check inside a git worktree (.git is a file pointing at the main git dir)", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "green-preflight-wt-"));
    const mainGitDir = mkdtempSync(
      path.join(tmpdir(), "green-preflight-wt-main-"),
    );
    try {
      spawnSync("git", ["init", "--quiet", mainGitDir]);
      spawnSync("git", [
        "-C",
        mainGitDir,
        "remote",
        "add",
        "origin",
        "https://github.com/lightstrikelabs/preflight-fixture.git",
      ]);
      const realWorktreeGitDir = path.join(
        mainGitDir,
        ".git/worktrees/fake-wt",
      );
      mkdirSync(realWorktreeGitDir, { recursive: true });
      writeFileSync(
        path.join(mainGitDir, ".git/hooks/pre-commit"),
        "#!/bin/sh\n# LEFTHOOK\nexit 0\n",
      );
      writeFileSync(path.join(dir, ".git"), `gitdir: ${realWorktreeGitDir}\n`);
      writeFileSync(
        path.join(realWorktreeGitDir, "commondir"),
        path.join(mainGitDir, ".git"),
      );
      writeFileSync(
        path.join(realWorktreeGitDir, "HEAD"),
        "ref: refs/heads/fake\n",
      );
      writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify(
          { name: "wt", engines: { node: "24.x", pnpm: "10.29.3" } },
          null,
          2,
        ),
      );

      const results = runChecks(baseOptions(dir));
      const lefthook = findCheck(results, /lefthook/i);
      expect(lefthook.status).toBe("pass");
    } finally {
      rmSync(dir, { force: true, recursive: true });
      rmSync(mainGitDir, { force: true, recursive: true });
    }
  });

  it("each result carries a name and a status", () => {
    const { dir, cleanup } = makeFixture();
    try {
      const results = runChecks(baseOptions(dir));
      expect(results.length).toBeGreaterThan(0);
      for (const result of results) {
        expect(typeof result.name).toBe("string");
        expect(["pass", "fail", "skip"]).toContain(result.status);
      }
    } finally {
      cleanup();
    }
  });
});

describe("preflight CLI", () => {
  function runCli(targetDir: string): ReturnType<typeof spawnSync> {
    return spawnSync(process.execPath, [scriptPath, "--target", targetDir], {
      encoding: "utf8",
      env: {
        ...process.env,
        PREFLIGHT_SKIP_NETWORK: "1",
        PREFLIGHT_NODE_VERSION: "v24.14.0",
        PREFLIGHT_PNPM_VERSION: "10.29.3",
      },
    });
  }

  it("exits 0 when every check passes or skips", () => {
    const { dir, cleanup } = makeFixture();
    try {
      const result = runCli(dir);
      expect(result.status).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("exits non-zero when at least one check fails", () => {
    const { dir, cleanup } = makeFixture({ omitWorkflows: true });
    try {
      const result = runCli(dir);
      expect(result.status).not.toBe(0);
      expect(result.stdout).toMatch(/CI workflow/i);
      expect(result.stdout).toMatch(/fail/i);
    } finally {
      cleanup();
    }
  });

  it("prints a markdown-style summary with one row per check", () => {
    const { dir, cleanup } = makeFixture();
    try {
      const result = runCli(dir);
      expect(result.stdout).toMatch(/^\|.*name.*\|.*status.*\|/im);
    } finally {
      cleanup();
    }
  });
});
