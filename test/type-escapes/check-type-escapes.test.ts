import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const scriptPath = path.join(repoRoot, "scripts/check-type-escapes.mjs");

function runGuard(targets: ReadonlyArray<string> = []) {
  return spawnSync(process.execPath, [scriptPath, ...targets], {
    cwd: repoRoot,
    encoding: "utf8",
  });
}

describe("unsafe type escape guard", () => {
  it("passes documented boundary-adapter exceptions", () => {
    const result = runGuard(["test/fixtures/type-escapes/allowed"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("rejects unsafe escapes without a nearby marker", () => {
    const result = runGuard(["test/fixtures/type-escapes/rejected"]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("unsafe-cases.ts");
    expect(result.stderr).toContain("string-marker.ts");
    expect(result.stderr).toContain(["as", "any"].join(" "));
    expect(result.stderr).toContain([":", "any"].join(" "));
    expect(result.stderr).toContain("<" + "any" + ">");
    expect(result.stderr).toContain(["as", "unknown", "as"].join(" "));
  });

  it("excludes rejected example fixtures during the default repository scan", () => {
    const result = runGuard();

    expect(result.status).toBe(0);
  });
});
