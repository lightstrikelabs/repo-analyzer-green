import { mkdir, writeFile } from "node:fs/promises";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const scriptPath = path.join(repoRoot, "scripts/check-barrel-files.ts");

function runGuard(targets: readonly string[]) {
  return spawnSync(process.execPath, [scriptPath, ...targets], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("barrel file guard", () => {
  it("passes when directories do not contain index.ts files", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "green-no-barrel-"));

    try {
      await writeFile(
        path.join(directory, "route-segment.ts"),
        "export const routeSegment = 'index-page';\n",
      );

      const result = runGuard([directory]);

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("rejects all index.ts files", async () => {
    const directory = mkdtempSync(path.join(tmpdir(), "green-barrel-"));
    const nestedDirectory = path.join(directory, "feature");

    try {
      await mkdir(nestedDirectory);
      await writeFile(
        path.join(nestedDirectory, "index.ts"),
        "export const value = 1;\n",
      );

      const result = runGuard([directory]);

      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Internal barrel files are not allowed");
      expect(result.stderr).toContain("feature/index.ts");
    } finally {
      rmSync(directory, { force: true, recursive: true });
    }
  });
});
