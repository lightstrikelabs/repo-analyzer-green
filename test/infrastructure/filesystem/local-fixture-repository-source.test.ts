import { describe, expect, it } from "vitest";

import type { RepositoryReference } from "../../../src/domain/repository";
import { RepositorySourceError } from "../../../src/domain/repository";
import { LocalFixtureRepositorySource } from "../../../src/infrastructure/filesystem";

import { repositoryFixtures } from "../../support/fixtures";

const minimalNodeLibrary: RepositoryReference = {
  provider: "local-fixture",
  name: "minimal-node-library",
  revision: "fixture",
};

describe("LocalFixtureRepositorySource", () => {
  it("lists files from a registered repository fixture with provenance", async () => {
    const source = new LocalFixtureRepositorySource({
      fixtures: repositoryFixtures,
    });

    const files = await source.listFiles(minimalNodeLibrary);

    expect(files.map((file) => file.path)).toEqual([
      "README.md",
      "package.json",
      "src/add.ts",
      "test/add.spec.ts",
    ]);
    expect(files[0]?.provenance).toEqual({
      repository: minimalNodeLibrary,
      sourceKind: "local-fixture",
      sourceId: "minimal-node-library",
      path: "README.md",
    });
  });

  it("reads file contents from a registered repository fixture with provenance", async () => {
    const source = new LocalFixtureRepositorySource({
      fixtures: repositoryFixtures,
    });

    const file = await source.readFile(minimalNodeLibrary, "src/add.ts");

    expect(file.path).toBe("src/add.ts");
    expect(file.text).toContain("export function add");
    expect(file.provenance).toEqual({
      repository: minimalNodeLibrary,
      sourceKind: "local-fixture",
      sourceId: "minimal-node-library",
      path: "src/add.ts",
    });
  });

  it("fails explicitly when a repository fixture is not registered", async () => {
    const source = new LocalFixtureRepositorySource({
      fixtures: repositoryFixtures,
    });
    const missingRepository: RepositoryReference = {
      provider: "local-fixture",
      name: "missing-fixture",
    };

    await expect(source.listFiles(missingRepository)).rejects.toMatchObject({
      code: "repository-not-found",
      repository: missingRepository,
    });
  });

  it("fails explicitly when a requested fixture file is missing", async () => {
    const source = new LocalFixtureRepositorySource({
      fixtures: repositoryFixtures,
    });

    await expect(
      source.readFile(minimalNodeLibrary, "src/missing.ts"),
    ).rejects.toBeInstanceOf(RepositorySourceError);
    await expect(
      source.readFile(minimalNodeLibrary, "src/missing.ts"),
    ).rejects.toMatchObject({
      code: "file-not-found",
      repository: minimalNodeLibrary,
    });
  });

  it("does not allow fixture reads outside the fixture root", async () => {
    const source = new LocalFixtureRepositorySource({
      fixtures: repositoryFixtures,
    });

    await expect(
      source.readFile(
        minimalNodeLibrary,
        "../minimal-node-library/package.json",
      ),
    ).rejects.toMatchObject({
      code: "file-not-found",
      repository: minimalNodeLibrary,
    });
  });
});
