import path from "node:path";

export type RepositoryFixtureId = "minimal-node-library";

export type RepositoryFixture = {
  readonly id: RepositoryFixtureId;
  readonly archetype: "node-library";
  readonly rootPath: string;
  readonly expectedFiles: readonly string[];
};

const fixtureRoot = path.resolve(process.cwd(), "test/fixtures/repositories");

export const repositoryFixtures: Record<
  RepositoryFixtureId,
  RepositoryFixture
> = {
  "minimal-node-library": {
    id: "minimal-node-library",
    archetype: "node-library",
    rootPath: path.join(fixtureRoot, "minimal-node-library"),
    expectedFiles: [
      "README.md",
      "package.json",
      "src/add.ts",
      "test/add.spec.ts",
    ],
  },
};

export function getRepositoryFixture(
  id: RepositoryFixtureId,
): RepositoryFixture {
  return repositoryFixtures[id];
}
