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

  it("registers the additional calibration fixtures", () => {
    expect(getRepositoryFixture("nextjs-web-app")).toMatchObject({
      archetype: "web-app",
      languages: ["Markdown", "TypeScript"],
      expectedFiles: [
        "README.md",
        "package.json",
        "src/app/layout.tsx",
        "src/app/page.tsx",
      ],
    });
    expect(getRepositoryFixture("go-cli-tool")).toMatchObject({
      archetype: "cli",
      languages: ["Go", "Markdown"],
      expectedFiles: ["README.md", "bin/repo-analyzer.go", "go.mod"],
    });
    expect(getRepositoryFixture("mkdocs-docs-site")).toMatchObject({
      archetype: "docs-heavy",
      languages: ["Markdown", "YAML"],
      expectedFiles: [
        "README.md",
        "docs/index.md",
        "docs/reference.md",
        "mkdocs.yml",
      ],
    });
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
