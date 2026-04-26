import { access } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { getRepositoryFixture, repositoryFixtures } from "../support/fixtures";

describe("repository fixtures", () => {
  it("registers the minimal Node library fixture", () => {
    const fixture = getRepositoryFixture("minimal-node-library");

    expect(fixture.archetype).toBe("node-library");
    expect(fixture.expectedFiles).toEqual([
      "README.md",
      "package.json",
      "src/add.ts",
      "test/add.spec.ts",
    ]);
  });

  it("keeps registered fixture files present on disk", async () => {
    for (const fixture of Object.values(repositoryFixtures)) {
      for (const expectedFile of fixture.expectedFiles) {
        await expect(
          access(path.join(fixture.rootPath, expectedFile)),
        ).resolves.toBeUndefined();
      }
    }
  });
});
