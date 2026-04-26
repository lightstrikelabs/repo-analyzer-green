export type RepositoryProvider = "github" | "local-fixture";

export type RepositoryReference = {
  readonly provider: RepositoryProvider;
  readonly name: string;
  readonly owner?: string;
  readonly url?: string;
  readonly revision?: string;
};

export type RepositoryPath = string;

export type RepositorySourceKind = "github-archive" | "local-fixture";

export type RepositoryFileProvenance = {
  readonly repository: RepositoryReference;
  readonly sourceKind: RepositorySourceKind;
  readonly sourceId: string;
  readonly path: RepositoryPath;
};

export type RepositoryFileEntry = {
  readonly path: RepositoryPath;
  readonly sizeBytes: number;
  readonly provenance: RepositoryFileProvenance;
};

export type RepositoryFileContent = RepositoryFileEntry & {
  readonly text: string;
};

export interface RepositorySource {
  listFiles(
    repository: RepositoryReference,
  ): Promise<readonly RepositoryFileEntry[]>;
  readFile(
    repository: RepositoryReference,
    filePath: RepositoryPath,
  ): Promise<RepositoryFileContent>;
}

export class RepositorySourceError extends Error {
  constructor(
    message: string,
    readonly code:
      | "download-failed"
      | "extraction-failed"
      | "file-not-found"
      | "invalid-repository-reference"
      | "repository-not-found",
    readonly repository: RepositoryReference,
  ) {
    super(message);
    this.name = "RepositorySourceError";
  }
}
