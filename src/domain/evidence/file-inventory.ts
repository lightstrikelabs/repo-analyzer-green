import path from "node:path";

import type {
  RepositoryFileEntry,
  RepositoryReference,
  RepositorySource,
} from "../repository/repository-source";
import { RepositorySourceError } from "../repository/repository-source";

export type FileClassificationSignal =
  | "configuration"
  | "documentation"
  | "lockfile"
  | "manifest"
  | "source"
  | "test";

export type FileOmissionReason =
  | "binary"
  | "generated"
  | "ignored"
  | "oversized"
  | "vendor";

export type InventoryFile = {
  readonly path: string;
  readonly sizeBytes: number;
  readonly extension: string;
  readonly signals: readonly FileClassificationSignal[];
};

export type InventoryOmission = {
  readonly path: string;
  readonly sizeBytes: number;
  readonly reason: FileOmissionReason;
  readonly detail: string;
};

export type FileInventory = {
  readonly files: readonly InventoryFile[];
  readonly omissions: readonly InventoryOmission[];
};

export type FileInventoryOptions = {
  readonly maxFileSizeBytes?: number;
  readonly maxFileCount?: number;
};

const defaultMaxFileSizeBytes = 256 * 1024;
const defaultMaxFileCount = 10_000;

const ignoredDirectoryDetails = new Map<string, string>([
  [".git", "version-control metadata is ignored"],
  [".hg", "version-control metadata is ignored"],
  [".svn", "version-control metadata is ignored"],
]);

const generatedDirectoryDetails = new Map<string, string>([
  [".next", "generated output directory is omitted"],
  ["build", "generated output directory is omitted"],
  ["coverage", "generated output directory is omitted"],
  ["dist", "generated output directory is omitted"],
  ["out", "generated output directory is omitted"],
]);

const vendorDirectoryDetails = new Map<string, string>([
  ["node_modules", "vendor dependency directory is omitted"],
  ["vendor", "vendor dependency directory is omitted"],
]);

const manifestFilenames = new Set([
  "Cargo.toml",
  "Gemfile",
  "go.mod",
  "package.json",
  "pom.xml",
  "pyproject.toml",
  "requirements.txt",
]);

const lockfileFilenames = new Set([
  "Cargo.lock",
  "Gemfile.lock",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "yarn.lock",
]);

const documentationFilenames = new Set([
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
]);

const configurationFilenames = new Set([
  ".eslintrc",
  ".prettierrc",
  "next.config.js",
  "next.config.mjs",
  "next.config.ts",
  "tsconfig.json",
  "vitest.config.ts",
]);

const sourceExtensions = new Set([
  ".c",
  ".cpp",
  ".cs",
  ".go",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".php",
  ".py",
  ".rb",
  ".rs",
  ".swift",
  ".ts",
  ".tsx",
]);

const documentationExtensions = new Set([
  ".adoc",
  ".md",
  ".mdx",
  ".rst",
  ".txt",
]);
const configurationExtensions = new Set([".json", ".toml", ".yaml", ".yml"]);

export async function collectFileInventory(
  repository: RepositoryReference,
  source: RepositorySource,
  options: FileInventoryOptions = {},
): Promise<FileInventory> {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? defaultMaxFileSizeBytes;
  const maxFileCount = options.maxFileCount ?? defaultMaxFileCount;
  const entries = [...(await source.listFiles(repository))].sort(comparePaths);
  const files: InventoryFile[] = [];
  const omissions: InventoryOmission[] = [];

  if (entries.length > maxFileCount) {
    throw new RepositorySourceError(
      "Repository contains too many files to analyze.",
      "repository-too-large",
      repository,
      `File count ${entries.length} exceeds the ${maxFileCount} file inventory limit.`,
    );
  }

  for (const entry of entries) {
    const pathOmission = omissionFromPath(entry);

    if (pathOmission !== undefined) {
      omissions.push(pathOmission);
      continue;
    }

    if (entry.sizeBytes > maxFileSizeBytes) {
      omissions.push({
        path: entry.path,
        sizeBytes: entry.sizeBytes,
        reason: "oversized",
        detail: `file exceeds the ${maxFileSizeBytes} byte inventory limit`,
      });
      continue;
    }

    const file = await source.readFile(repository, entry.path);

    if (appearsBinary(file.text)) {
      omissions.push({
        path: entry.path,
        sizeBytes: entry.sizeBytes,
        reason: "binary",
        detail: "file content appears to be binary",
      });
      continue;
    }

    files.push({
      path: entry.path,
      sizeBytes: entry.sizeBytes,
      extension: path.posix.extname(entry.path),
      signals: classifyFile(entry.path),
    });
  }

  return { files, omissions };
}

function omissionFromPath(
  entry: RepositoryFileEntry,
): InventoryOmission | undefined {
  const segments = entry.path.split("/");

  for (const segment of segments) {
    const ignoredDetail = ignoredDirectoryDetails.get(segment);
    if (ignoredDetail !== undefined) {
      return omission(entry, "ignored", ignoredDetail);
    }

    const vendorDetail = vendorDirectoryDetails.get(segment);
    if (vendorDetail !== undefined) {
      return omission(entry, "vendor", vendorDetail);
    }

    const generatedDetail = generatedDirectoryDetails.get(segment);
    if (generatedDetail !== undefined) {
      return omission(entry, "generated", generatedDetail);
    }
  }

  const basename = path.posix.basename(entry.path);
  if (
    basename.includes(".generated.") ||
    basename.endsWith(".generated") ||
    basename.endsWith(".min.js") ||
    basename.endsWith(".min.css")
  ) {
    return omission(
      entry,
      "generated",
      "generated filename pattern is omitted",
    );
  }

  return undefined;
}

function omission(
  entry: RepositoryFileEntry,
  reason: FileOmissionReason,
  detail: string,
): InventoryOmission {
  return {
    path: entry.path,
    sizeBytes: entry.sizeBytes,
    reason,
    detail,
  };
}

function appearsBinary(text: string): boolean {
  return text.includes("\0");
}

function classifyFile(filePath: string): readonly FileClassificationSignal[] {
  const basename = path.posix.basename(filePath);
  const extension = path.posix.extname(filePath);
  const signals: FileClassificationSignal[] = [];

  if (isDocumentationFile(basename, extension)) {
    signals.push("documentation");
  }

  if (manifestFilenames.has(basename)) {
    signals.push("manifest");
  }

  if (lockfileFilenames.has(basename)) {
    signals.push("lockfile");
  }

  if (isConfigurationFile(basename, extension)) {
    signals.push("configuration");
  }

  if (isTestFile(filePath)) {
    signals.push("test");
  }

  if (sourceExtensions.has(extension)) {
    signals.push("source");
  }

  return signals;
}

function isDocumentationFile(basename: string, extension: string): boolean {
  return (
    documentationFilenames.has(basename) ||
    documentationExtensions.has(extension)
  );
}

function isConfigurationFile(basename: string, extension: string): boolean {
  return (
    configurationFilenames.has(basename) ||
    configurationExtensions.has(extension)
  );
}

function isTestFile(filePath: string): boolean {
  const basename = path.posix.basename(filePath);

  return (
    filePath.startsWith("test/") ||
    filePath.includes("/test/") ||
    filePath.startsWith("tests/") ||
    filePath.includes("/tests/") ||
    basename.includes(".test.") ||
    basename.includes(".spec.")
  );
}

function comparePaths(
  left: RepositoryFileEntry,
  right: RepositoryFileEntry,
): number {
  if (left.path < right.path) {
    return -1;
  }

  if (left.path > right.path) {
    return 1;
  }

  return 0;
}
