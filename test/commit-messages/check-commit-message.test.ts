import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const scriptPath = path.join(repoRoot, "scripts/check-commit-message.ts");

function runValidator(args: ReadonlyArray<string>, input?: string) {
  return spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    input,
  });
}

describe("commit message validator", () => {
  it("accepts conventional commit subjects with useful scopes", () => {
    const subjects = [
      "feat(chat): model targeted follow-up conversations",
      "fix: preserve evidence citations",
      "docs(architecture): define commit standards",
      "refactor(domain/scoring): isolate confidence policy",
      "feat!: require report schema migration",
    ];

    for (const subject of subjects) {
      const result = runValidator(["--message", subject]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
    }
  });

  it("rejects non-conventional or low-signal subjects", () => {
    const subjects = [
      "update stuff",
      "feat(ui): ",
      "style(ui): adjust page",
      "fix: update",
      "docs: define commit standards.",
      "feat(BadScope): add thing",
    ];

    for (const subject of subjects) {
      const result = runValidator(["--message", subject]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Invalid commit message subject");
    }
  });

  it("reads the subject from a commit message file", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "green-commit-message-"));
    const messagePath = path.join(directory, "COMMIT_EDITMSG");

    try {
      writeFileSync(
        messagePath,
        [
          "test(type-safety): guard unsafe type escapes",
          "",
          "Explain the domain reason for this guard.",
        ].join("\n"),
      );

      const result = runValidator(["--file", messagePath]);

      expect(result.status).toBe(0);
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("reads the subject from stdin when no source flag is provided", () => {
    const result = runValidator(
      [],
      "ci(github): validate pull request titles\n",
    );

    expect(result.status).toBe(0);
  });
});
