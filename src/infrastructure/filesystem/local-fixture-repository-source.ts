import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import type {
  RepositoryFileContent,
  RepositoryFileEntry,
  RepositoryPath,
  RepositoryReference,
  RepositorySource,
} from "../../domain/repository/repository-source";
import { RepositorySourceError } from "../../domain/repository/repository-source";

export type LocalRepositoryFixture = {
  readonly id: string;
  readonly rootPath: string;
};

export type LocalFixtureRepositorySourceOptions = {
  readonly fixtures: Readonly<Record<string, LocalRepositoryFixture>>;
};

export class LocalFixtureRepositorySource implements RepositorySource {
  private readonly fixtures: Readonly<Record<string, LocalRepositoryFixture>>;

  constructor(options: LocalFixtureRepositorySourceOptions) {
    this.fixtures = options.fixtures;
  }

  async listFiles(
    repository: RepositoryReference,
  ): Promise<readonly RepositoryFileEntry[]> {
    const fixture = this.requireFixture(repository);
    const files = await listFixtureFiles(fixture.rootPath);

    return files.map((file) => ({
      path: file.path,
      sizeBytes: file.sizeBytes,
      provenance: {
        repository,
        sourceKind: "local-fixture",
        sourceId: fixture.id,
        path: file.path,
      },
    }));
  }

  async readFile(
    repository: RepositoryReference,
    filePath: RepositoryPath,
  ): Promise<RepositoryFileContent> {
    const fixture = this.requireFixture(repository);
    const absolutePath = resolveFixtureFilePath(
      fixture.rootPath,
      filePath,
      repository,
    );

    try {
      const fileStat = await stat(absolutePath);
      if (!fileStat.isFile()) {
        throw notFound(repository, filePath);
      }
      const text = await readFile(absolutePath, "utf8");

      return {
        path: filePath,
        text,
        sizeBytes: fileStat.size,
        provenance: {
          repository,
          sourceKind: "local-fixture",
          sourceId: fixture.id,
          path: filePath,
        },
      };
    } catch (error) {
      if (error instanceof RepositorySourceError) {
        throw error;
      }
      throw notFound(repository, filePath);
    }
  }

  private requireFixture(
    repository: RepositoryReference,
  ): LocalRepositoryFixture {
    const fixture = this.fixtures[repository.name];

    if (fixture === undefined) {
      throw new RepositorySourceError(
        `Repository fixture '${repository.name}' is not registered.`,
        "repository-not-found",
        repository,
      );
    }

    return fixture;
  }
}

type DiscoveredFixtureFile = {
  readonly path: RepositoryPath;
  readonly sizeBytes: number;
};

async function listFixtureFiles(
  rootPath: string,
): Promise<readonly DiscoveredFixtureFile[]> {
  const files: DiscoveredFixtureFile[] = [];
  await collectFiles(rootPath, rootPath, files);
  return files.sort(compareDiscoveredFixtureFiles);
}

async function collectFiles(
  rootPath: string,
  currentPath: string,
  files: DiscoveredFixtureFile[],
): Promise<void> {
  const entries = await readdir(currentPath, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      await collectFiles(rootPath, entryPath, files);
      continue;
    }

    if (entry.isFile()) {
      const fileStat = await stat(entryPath);
      const repositoryPath = toRepositoryPath(rootPath, entryPath);
      files.push({
        path: repositoryPath,
        sizeBytes: fileStat.size,
      });
    }
  }
}

function resolveFixtureFilePath(
  rootPath: string,
  filePath: RepositoryPath,
  repository: RepositoryReference,
): string {
  if (!isNormalizedRepositoryPath(filePath)) {
    throw notFound(repository, filePath);
  }

  const absolutePath = path.resolve(rootPath, filePath);
  const relativePath = path.relative(rootPath, absolutePath);

  if (
    relativePath === "" ||
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath)
  ) {
    throw notFound(repository, filePath);
  }

  return absolutePath;
}

function isNormalizedRepositoryPath(filePath: RepositoryPath): boolean {
  return (
    filePath !== "" &&
    !filePath.includes("\\") &&
    !path.posix.isAbsolute(filePath) &&
    path.posix.normalize(filePath) === filePath &&
    filePath !== "." &&
    !filePath.startsWith("../")
  );
}

function toRepositoryPath(rootPath: string, filePath: string): RepositoryPath {
  return path.relative(rootPath, filePath).split(path.sep).join(path.posix.sep);
}

function notFound(
  repository: RepositoryReference,
  filePath: RepositoryPath,
): RepositorySourceError {
  return new RepositorySourceError(
    `Repository file '${filePath}' was not found in fixture '${repository.name}'.`,
    "file-not-found",
    repository,
  );
}

function compareDiscoveredFixtureFiles(
  left: DiscoveredFixtureFile,
  right: DiscoveredFixtureFile,
): number {
  if (left.path < right.path) {
    return -1;
  }

  if (left.path > right.path) {
    return 1;
  }

  return 0;
}
