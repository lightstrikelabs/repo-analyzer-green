import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { extract } from "tar";

import type {
  RepositoryFileContent,
  RepositoryFileEntry,
  RepositoryPath,
  RepositoryReference,
  RepositorySource,
} from "../../domain/repository/repository-source";
import { RepositorySourceError } from "../../domain/repository/repository-source";

export type GitHubArchiveFetcher = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

export type GitHubArchiveExtractor = (input: {
  readonly archivePath: string;
  readonly destinationPath: string;
}) => Promise<void>;

export type GitHubArchiveRepositorySourceOptions = {
  readonly fetcher?: GitHubArchiveFetcher;
  readonly extractor?: GitHubArchiveExtractor;
  readonly temporaryRoot?: string;
};

type CachedRepository = {
  readonly repository: RepositoryReference;
  readonly rootPath: string;
};

type DiscoveredArchiveFile = {
  readonly path: RepositoryPath;
  readonly sizeBytes: number;
};

export class GitHubArchiveRepositorySource implements RepositorySource {
  private readonly fetcher: GitHubArchiveFetcher;
  private readonly extractor: GitHubArchiveExtractor;
  private readonly temporaryRoot: string | undefined;
  private readonly cachedRepositories = new Map<string, CachedRepository>();
  private ownedTemporaryRoot: string | undefined;

  constructor(options: GitHubArchiveRepositorySourceOptions = {}) {
    this.fetcher = options.fetcher ?? fetch;
    this.extractor = options.extractor ?? extractArchive;
    this.temporaryRoot = options.temporaryRoot;
  }

  async listFiles(
    repository: RepositoryReference,
  ): Promise<readonly RepositoryFileEntry[]> {
    const cachedRepository = await this.ensureRepository(repository);
    const files = await listArchiveFiles(cachedRepository.rootPath);

    return files.map((file) => ({
      path: file.path,
      sizeBytes: file.sizeBytes,
      provenance: {
        repository,
        sourceKind: "github-archive",
        sourceId: sourceIdForRepository(repository),
        path: file.path,
      },
    }));
  }

  async readFile(
    repository: RepositoryReference,
    filePath: RepositoryPath,
  ): Promise<RepositoryFileContent> {
    const cachedRepository = await this.ensureRepository(repository);
    const absolutePath = resolveArchiveFilePath(
      cachedRepository.rootPath,
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
          sourceKind: "github-archive",
          sourceId: sourceIdForRepository(repository),
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

  async dispose(): Promise<void> {
    this.cachedRepositories.clear();

    if (this.ownedTemporaryRoot !== undefined) {
      await rm(this.ownedTemporaryRoot, { recursive: true, force: true });
      this.ownedTemporaryRoot = undefined;
    }
  }

  private async ensureRepository(
    repository: RepositoryReference,
  ): Promise<CachedRepository> {
    validateGitHubRepository(repository);

    const cacheKey = sourceIdForRepository(repository);
    const cachedRepository = this.cachedRepositories.get(cacheKey);
    if (cachedRepository !== undefined) {
      return cachedRepository;
    }

    const rootPath = await this.prepareRepository(repository);
    const nextCachedRepository = { repository, rootPath };
    this.cachedRepositories.set(cacheKey, nextCachedRepository);
    return nextCachedRepository;
  }

  private async prepareRepository(
    repository: RepositoryReference,
  ): Promise<string> {
    const temporaryRoot = await this.requireTemporaryRoot();
    const repositoryRoot = await mkdtemp(
      path.join(temporaryRoot, `${sourceIdForRepository(repository)}-`),
    );
    const archivePath = path.join(repositoryRoot, "archive.tgz");
    const extractRoot = path.join(repositoryRoot, "repo");
    const archiveUrl = archiveUrlForRepository(repository);
    const response = await this.fetcher(archiveUrl, {
      headers: {
        Accept: "application/x-gzip",
        "User-Agent": "repo-analyzer-green",
      },
    });

    if (!response.ok) {
      throw new RepositorySourceError(
        `Unable to download GitHub repository archive (${response.status}).`,
        "download-failed",
        repository,
      );
    }

    await writeFile(archivePath, Buffer.from(await response.arrayBuffer()));
    await mkdir(extractRoot, { recursive: true });

    try {
      await this.extractor({
        archivePath,
        destinationPath: extractRoot,
      });
    } catch {
      throw new RepositorySourceError(
        "Unable to extract GitHub repository archive.",
        "extraction-failed",
        repository,
      );
    } finally {
      await rm(archivePath, { force: true });
    }

    return extractRoot;
  }

  private async requireTemporaryRoot(): Promise<string> {
    if (this.temporaryRoot !== undefined) {
      return this.temporaryRoot;
    }

    if (this.ownedTemporaryRoot === undefined) {
      this.ownedTemporaryRoot = await mkdtemp(
        path.join(tmpdir(), "repo-analyzer-green-github-"),
      );
    }

    return this.ownedTemporaryRoot;
  }
}

export function archiveUrlForRepository(
  repository: RepositoryReference,
): string {
  validateGitHubRepository(repository);

  return `https://codeload.github.com/${repository.owner}/${repository.name}/tar.gz/${repository.revision ?? "HEAD"}`;
}

function validateGitHubRepository(repository: RepositoryReference): void {
  if (
    repository.provider !== "github" ||
    repository.owner === undefined ||
    repository.name.trim() === ""
  ) {
    throw new RepositorySourceError(
      "Repository reference must identify a GitHub owner and repository name.",
      "invalid-repository-reference",
      repository,
    );
  }
}

async function extractArchive(input: {
  readonly archivePath: string;
  readonly destinationPath: string;
}): Promise<void> {
  await extract({
    file: input.archivePath,
    cwd: input.destinationPath,
    strip: 1,
  });
}

async function listArchiveFiles(
  rootPath: string,
): Promise<readonly DiscoveredArchiveFile[]> {
  const files: DiscoveredArchiveFile[] = [];
  await collectFiles(rootPath, rootPath, files);
  return files.sort(compareDiscoveredArchiveFiles);
}

async function collectFiles(
  rootPath: string,
  currentPath: string,
  files: DiscoveredArchiveFile[],
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
      files.push({
        path: toRepositoryPath(rootPath, entryPath),
        sizeBytes: fileStat.size,
      });
    }
  }
}

function resolveArchiveFilePath(
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

function sourceIdForRepository(repository: RepositoryReference): string {
  return `${repository.owner ?? "unknown"}-${repository.name}-${repository.revision ?? "HEAD"}`
    .replace(/[^a-z0-9._-]/giu, "-")
    .slice(0, 160);
}

function notFound(
  repository: RepositoryReference,
  filePath: RepositoryPath,
): RepositorySourceError {
  return new RepositorySourceError(
    `Repository file '${filePath}' was not found in GitHub archive '${repository.owner}/${repository.name}'.`,
    "file-not-found",
    repository,
  );
}

function compareDiscoveredArchiveFiles(
  left: DiscoveredArchiveFile,
  right: DiscoveredArchiveFile,
): number {
  if (left.path < right.path) {
    return -1;
  }

  if (left.path > right.path) {
    return 1;
  }

  return 0;
}
