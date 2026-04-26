import path from "node:path";

export type RepositoryFixtureId =
  | "minimal-node-library"
  | "nextjs-web-app"
  | "go-cli-tool"
  | "mkdocs-docs-site";

export type RepositoryFixtureArchetype =
  | "node-library"
  | "web-app"
  | "cli"
  | "docs-heavy";

export type RepositoryFixtureLanguage =
  | "Go"
  | "Markdown"
  | "TypeScript"
  | "YAML";

export type RepositoryFixture = {
  readonly id: RepositoryFixtureId;
  readonly archetype: RepositoryFixtureArchetype;
  readonly languages: readonly RepositoryFixtureLanguage[];
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
    languages: ["Markdown", "TypeScript"],
    rootPath: path.join(fixtureRoot, "minimal-node-library"),
    expectedFiles: [
      "README.md",
      "package.json",
      "src/add.ts",
      "test/add.spec.ts",
    ],
  },
  "nextjs-web-app": {
    id: "nextjs-web-app",
    archetype: "web-app",
    languages: ["Markdown", "TypeScript"],
    rootPath: path.join(fixtureRoot, "nextjs-web-app"),
    expectedFiles: [
      "README.md",
      "package.json",
      "src/app/layout.tsx",
      "src/app/page.tsx",
    ],
  },
  "go-cli-tool": {
    id: "go-cli-tool",
    archetype: "cli",
    languages: ["Go", "Markdown"],
    rootPath: path.join(fixtureRoot, "go-cli-tool"),
    expectedFiles: ["README.md", "bin/repo-analyzer.go", "go.mod"],
  },
  "mkdocs-docs-site": {
    id: "mkdocs-docs-site",
    archetype: "docs-heavy",
    languages: ["Markdown", "YAML"],
    rootPath: path.join(fixtureRoot, "mkdocs-docs-site"),
    expectedFiles: [
      "README.md",
      "docs/index.md",
      "docs/reference.md",
      "mkdocs.yml",
    ],
  },
};

export function getRepositoryFixture(
  id: RepositoryFixtureId,
): RepositoryFixture {
  return repositoryFixtures[id];
}
