import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { describe, expect, it } from "vitest";

import {
  decide,
  recentTestEditsFromLedger,
  type Ledger,
} from "../../scripts/red-green-gate";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const scriptPath = path.join(repoRoot, "scripts/red-green-gate.ts");

function runHook(
  payload: unknown,
  options: { readonly projectDir: string },
): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [scriptPath], {
    input: JSON.stringify(payload),
    cwd: options.projectDir,
    encoding: "utf8",
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: options.projectDir,
    },
  });
}

function runCommitGate(options: {
  readonly projectDir: string;
}): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [scriptPath, "--staged"], {
    cwd: options.projectDir,
    encoding: "utf8",
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: options.projectDir,
    },
  });
}

function makeProjectDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "green-rg-"));
  mkdirSync(path.join(dir, "src"), { recursive: true });
  mkdirSync(path.join(dir, "docs"), { recursive: true });
  spawnSync("git", ["init"], { cwd: dir, encoding: "utf8" });
  spawnSync("git", ["config", "user.email", "test@example.com"], {
    cwd: dir,
    encoding: "utf8",
  });
  spawnSync("git", ["config", "user.name", "Test User"], {
    cwd: dir,
    encoding: "utf8",
  });
  return dir;
}

const allowlist: readonly string[] = [
  "docs/**",
  "**/*.md",
  "**/*.css",
  "**/*.json",
  "scripts/**",
  "test/**",
  "e2e/**",
  ".github/**",
  ".claude/**",
];

describe("red-green-gate decide", () => {
  it("blocks editing a non-test source file when no colocated test was edited recently", () => {
    const decision = decide({
      filesTouched: ["src/components/report/print-report-button.tsx"],
      recentTestEdits: [],
      allowlist,
      overrideMarkers: new Map(),
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.blockedFiles).toEqual([
        "src/components/report/print-report-button.tsx",
      ]);
      expect(decision.reason).toMatch(/colocated test/i);
    }
  });

  it("allows editing a non-test source file when its colocated test was edited recently", () => {
    const decision = decide({
      filesTouched: ["src/components/report/print-report-button.tsx"],
      recentTestEdits: ["src/components/report/print-report-button.test.tsx"],
      allowlist,
      overrideMarkers: new Map(),
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows editing a colocated .ts source file when its .test.ts was edited recently", () => {
    const decision = decide({
      filesTouched: ["src/domain/scoring/scoring-policy.ts"],
      recentTestEdits: ["src/domain/scoring/scoring-policy.test.ts"],
      allowlist,
      overrideMarkers: new Map(),
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows editing a test file directly without requiring a paired source edit", () => {
    const decision = decide({
      filesTouched: ["src/components/report/report-card-view.test.tsx"],
      recentTestEdits: [],
      allowlist,
      overrideMarkers: new Map(),
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows editing allowlisted paths without a paired test", () => {
    const decision = decide({
      filesTouched: [
        "docs/architecture.md",
        "src/app/globals.css",
        "AGENTS.md",
        "package.json",
        ".claude/settings.json",
      ],
      recentTestEdits: [],
      allowlist: [...allowlist, "AGENTS.md", "CLAUDE.md"],
      overrideMarkers: new Map(),
    });

    expect(decision.allowed).toBe(true);
  });

  it("allows editing a non-test source file when an override marker is recorded for it", () => {
    const decision = decide({
      filesTouched: ["src/components/report/print-report-button.tsx"],
      recentTestEdits: [],
      allowlist,
      overrideMarkers: new Map([
        [
          "src/components/report/print-report-button.tsx",
          "trivial rename only, no behavior change",
        ],
      ]),
    });

    expect(decision.allowed).toBe(true);
  });

  it("blocks the batch when one file is unpaired even if other files are paired or allowlisted", () => {
    const decision = decide({
      filesTouched: [
        "src/components/report/print-report-button.tsx",
        "src/components/report/report-card-view.tsx",
        "docs/architecture.md",
      ],
      recentTestEdits: ["src/components/report/print-report-button.test.tsx"],
      allowlist,
      overrideMarkers: new Map(),
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.blockedFiles).toEqual([
        "src/components/report/report-card-view.tsx",
      ]);
    }
  });
});

describe("red-green-gate recentTestEditsFromLedger", () => {
  const windowMs = 30 * 60 * 1000;
  const nowMs = Date.parse("2026-04-26T18:00:00.000Z");

  it("returns test edits made within the recency window", () => {
    const ledger: Ledger = {
      testEdits: [
        {
          path: "src/components/report/print-report-button.test.tsx",
          editedAtIso: "2026-04-26T17:50:00.000Z",
        },
      ],
    };

    expect(recentTestEditsFromLedger(ledger, windowMs, nowMs)).toEqual([
      "src/components/report/print-report-button.test.tsx",
    ]);
  });

  it("excludes test edits older than the recency window", () => {
    const ledger: Ledger = {
      testEdits: [
        {
          path: "src/components/report/print-report-button.test.tsx",
          editedAtIso: "2026-04-26T17:00:00.000Z",
        },
      ],
    };

    expect(recentTestEditsFromLedger(ledger, windowMs, nowMs)).toEqual([]);
  });

  it("ignores ledger entries with unparseable timestamps", () => {
    const ledger: Ledger = {
      testEdits: [
        {
          path: "src/components/report/print-report-button.test.tsx",
          editedAtIso: "not-a-date",
        },
      ],
    };

    expect(recentTestEditsFromLedger(ledger, windowMs, nowMs)).toEqual([]);
  });
});

describe("red-green-gate CLI", () => {
  it("blocks Edit on a non-test source file when no colocated test was edited", () => {
    const projectDir = makeProjectDir();
    try {
      writeFileSync(
        path.join(projectDir, "src/foo.tsx"),
        "export const a = 1;\n",
      );

      const result = runHook(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Edit",
          tool_input: {
            file_path: path.join(projectDir, "src/foo.tsx"),
            old_string: "export const a = 1;",
            new_string: "export const a = 2;",
          },
        },
        { projectDir },
      );

      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/colocated test/i);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });

  it("allows Edit on a non-test source file after the colocated test file was edited", () => {
    const projectDir = makeProjectDir();
    try {
      writeFileSync(
        path.join(projectDir, "src/foo.tsx"),
        "export const a = 1;\n",
      );
      writeFileSync(
        path.join(projectDir, "src/foo.test.tsx"),
        "import { it } from 'vitest';\nit('a', () => {});\n",
      );

      const recordTest = runHook(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Edit",
          tool_input: {
            file_path: path.join(projectDir, "src/foo.test.tsx"),
            old_string: "it('a', () => {});",
            new_string: "it('a', () => { expect(1).toBe(2); });",
          },
        },
        { projectDir },
      );
      expect(recordTest.status).toBe(0);

      const ledgerPath = path.join(
        projectDir,
        ".claude/state/red-green-ledger.json",
      );
      expect(existsSync(ledgerPath)).toBe(true);
      const ledger: Ledger = JSON.parse(readFileSync(ledgerPath, "utf8"));
      expect(ledger.testEdits.map((entry) => entry.path)).toContain(
        "src/foo.test.tsx",
      );

      const editSource = runHook(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Edit",
          tool_input: {
            file_path: path.join(projectDir, "src/foo.tsx"),
            old_string: "export const a = 1;",
            new_string: "export const a = 2;",
          },
        },
        { projectDir },
      );

      expect(editSource.status).toBe(0);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });

  it("allows Write on an allowlisted path without a paired test", () => {
    const projectDir = makeProjectDir();
    try {
      const result = runHook(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Write",
          tool_input: {
            file_path: path.join(projectDir, "docs/note.md"),
            content: "# note\n",
          },
        },
        { projectDir },
      );

      expect(result.status).toBe(0);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });

  it("allows Write when the new content carries the red-green:exempt marker", () => {
    const projectDir = makeProjectDir();
    try {
      const result = runHook(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Write",
          tool_input: {
            file_path: path.join(projectDir, "src/foo.tsx"),
            content:
              "// red-green:exempt — trivial rename, no behavior change\nexport const a = 1;\n",
          },
        },
        { projectDir },
      );

      expect(result.status).toBe(0);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });

  it("ignores tool calls that are not Edit, Write, or MultiEdit", () => {
    const projectDir = makeProjectDir();
    try {
      const result = runHook(
        {
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command: "ls" },
        },
        { projectDir },
      );

      expect(result.status).toBe(0);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });
});

describe("red-green-gate staged commit gate", () => {
  it("blocks a staged source file when the colocated test file is not staged", () => {
    const projectDir = makeProjectDir();
    try {
      writeFileSync(
        path.join(projectDir, "src/foo.tsx"),
        "export const a = 1;\n",
      );
      spawnSync("git", ["add", "src/foo.tsx"], {
        cwd: projectDir,
        encoding: "utf8",
      });

      const result = runCommitGate({ projectDir });

      expect(result.status).toBe(2);
      expect(result.stderr).toMatch(/colocated test/i);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });

  it("allows a staged source file when the colocated test file is staged too", () => {
    const projectDir = makeProjectDir();
    try {
      writeFileSync(
        path.join(projectDir, "src/foo.tsx"),
        "export const a = 1;\n",
      );
      writeFileSync(
        path.join(projectDir, "src/foo.test.tsx"),
        "import { it } from 'vitest';\nit('a', () => {});\n",
      );
      spawnSync("git", ["add", "src/foo.tsx", "src/foo.test.tsx"], {
        cwd: projectDir,
        encoding: "utf8",
      });

      const result = runCommitGate({ projectDir });

      expect(result.status).toBe(0);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });

  it("allows allowlisted staged files without a paired test", () => {
    const projectDir = makeProjectDir();
    try {
      writeFileSync(path.join(projectDir, "docs/note.md"), "# note\n");
      spawnSync("git", ["add", "docs/note.md"], {
        cwd: projectDir,
        encoding: "utf8",
      });

      const result = runCommitGate({ projectDir });

      expect(result.status).toBe(0);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });

  it("allows a staged source file when the inline exemption marker is present", () => {
    const projectDir = makeProjectDir();
    try {
      writeFileSync(
        path.join(projectDir, "src/foo.tsx"),
        "// red-green:exempt — config-only change\nexport const a = 1;\n",
      );
      spawnSync("git", ["add", "src/foo.tsx"], {
        cwd: projectDir,
        encoding: "utf8",
      });

      const result = runCommitGate({ projectDir });

      expect(result.status).toBe(0);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });

  it("allows a staged YAML hook config file when the inline exemption marker is present", () => {
    const projectDir = makeProjectDir();
    try {
      writeFileSync(
        path.join(projectDir, "lefthook.yml"),
        "# red-green:exempt — hook wiring is tooling-only\npre-commit:\n  commands: {}\n",
      );
      spawnSync("git", ["add", "lefthook.yml"], {
        cwd: projectDir,
        encoding: "utf8",
      });

      const result = runCommitGate({ projectDir });

      expect(result.status).toBe(0);
    } finally {
      rmSync(projectDir, { force: true, recursive: true });
    }
  });
});
