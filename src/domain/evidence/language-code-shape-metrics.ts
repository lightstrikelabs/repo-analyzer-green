import type { EvidenceReference } from "../shared/evidence-reference";

export type LanguageCodeShapeSkippedReason =
  | "binary"
  | "generated"
  | "ignored"
  | "oversized"
  | "vendor";

export type LanguageCodeShapeOmissionReason =
  | LanguageCodeShapeSkippedReason
  | "unsupported-extension";

export type LanguageCodeShapeTextFileSnapshot = {
  readonly path: string;
  readonly sizeBytes: number;
  readonly text: string;
};

export type LanguageCodeShapeSkippedFileSnapshot = {
  readonly path: string;
  readonly sizeBytes: number;
  readonly skippedReason: LanguageCodeShapeSkippedReason;
  readonly detail: string;
};

export type LanguageCodeShapeFileSnapshot =
  | LanguageCodeShapeTextFileSnapshot
  | LanguageCodeShapeSkippedFileSnapshot;

export type LanguageCodeShapeMetricInput = {
  readonly files: readonly LanguageCodeShapeFileSnapshot[];
  readonly largeFileSizeBytes?: number;
};

export type LanguageCodeShapeLanguageMetric = {
  readonly language: string;
  readonly extensions: readonly string[];
  readonly fileCount: number;
  readonly sourceFileCount: number;
  readonly textLineCount: number;
  readonly codeLineCount: number;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type LanguageCodeShapeFileMetric = {
  readonly path: string;
  readonly extension: string;
  readonly language: string;
  readonly sizeBytes: number;
  readonly isSource: boolean;
  readonly isTest: boolean;
  readonly isDocumentation: boolean;
  readonly isLarge: boolean;
  readonly textLineCount: number;
  readonly nonEmptyLineCount: number;
  readonly codeLineCount: number;
  readonly branchLikeTokenCount: number;
  readonly deferredWorkMarkerCount: number;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type LanguageCodeShapeDeferredWorkMarker = {
  readonly path: string;
  readonly marker: "TODO" | "FIXME" | "HACK" | "XXX";
  readonly line: number;
  readonly excerpt: string;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type LanguageCodeShapeBranchLikeToken = {
  readonly path: string;
  readonly token: string;
  readonly count: number;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type LanguageCodeShapeLargeFile = {
  readonly path: string;
  readonly sizeBytes: number;
  readonly thresholdBytes: number;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type LanguageCodeShapeOmission = {
  readonly path: string;
  readonly sizeBytes: number;
  readonly reason: LanguageCodeShapeOmissionReason;
  readonly detail: string;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type LanguageCodeShapeCaveatKind =
  | "large-files"
  | "metric-limitation"
  | "skipped-files"
  | "unsupported-files";

export type LanguageCodeShapeCaveat = {
  readonly kind: LanguageCodeShapeCaveatKind;
  readonly detail: string;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type LanguageCodeShapeSummary = {
  readonly analyzedFileCount: number;
  readonly sourceFileCount: number;
  readonly testFileCount: number;
  readonly documentationFileCount: number;
  readonly largeFileCount: number;
  readonly skippedFileCount: number;
  readonly unsupportedFileCount: number;
  readonly totalTextLineCount: number;
  readonly totalCodeLineCount: number;
  readonly totalDeferredWorkMarkerCount: number;
  readonly totalBranchLikeTokenCount: number;
};

export type LanguageCodeShapeMetricResult = {
  readonly summary: LanguageCodeShapeSummary;
  readonly languageMix: readonly LanguageCodeShapeLanguageMetric[];
  readonly files: readonly LanguageCodeShapeFileMetric[];
  readonly deferredWorkMarkers: readonly LanguageCodeShapeDeferredWorkMarker[];
  readonly branchLikeTokens: readonly LanguageCodeShapeBranchLikeToken[];
  readonly largeFiles: readonly LanguageCodeShapeLargeFile[];
  readonly omissions: readonly LanguageCodeShapeOmission[];
  readonly caveats: readonly LanguageCodeShapeCaveat[];
};

type CommentSyntax = {
  readonly line?: readonly string[];
  readonly block?: readonly {
    readonly start: string;
    readonly end: string;
  }[];
};

type LanguageDefinition = {
  readonly language: string;
  readonly extension: string;
  readonly isSource: boolean;
  readonly isDocumentation: boolean;
  readonly countCodeLines: boolean;
  readonly comments: CommentSyntax;
};

type LanguageAccumulator = {
  readonly language: string;
  readonly extensions: Set<string>;
  readonly paths: string[];
  fileCount: number;
  sourceFileCount: number;
  textLineCount: number;
  codeLineCount: number;
};

type CommentState = {
  inBlockComment: boolean;
  blockEnd: string;
};

const defaultLargeFileSizeBytes = 256 * 1024;

const collectorReference: EvidenceReference = {
  id: "language-code-shape:collector",
  kind: "collector",
  label: "Language and code-shape metrics collector",
};

const definitions: readonly LanguageDefinition[] = [
  source(".c", "C", cStyleComments()),
  source(".cc", "C++", cStyleComments()),
  source(".cpp", "C++", cStyleComments()),
  source(".cs", "C#", cStyleComments()),
  source(".css", "CSS", {
    block: [{ start: "/*", end: "*/" }],
  }),
  source(".go", "Go", cStyleComments()),
  source(".h", "C/C++ Header", cStyleComments()),
  source(".html", "HTML", {
    block: [{ start: "<!--", end: "-->" }],
  }),
  source(".hpp", "C++ Header", cStyleComments()),
  source(".java", "Java", cStyleComments()),
  source(".cjs", "JavaScript", cStyleComments()),
  source(".js", "JavaScript", cStyleComments()),
  source(".jsx", "JavaScript", cStyleComments()),
  source(".kt", "Kotlin", cStyleComments()),
  source(".mjs", "JavaScript", cStyleComments()),
  source(".php", "PHP", cStyleComments()),
  source(".py", "Python", { line: ["#"] }),
  source(".rb", "Ruby", { line: ["#"] }),
  source(".rs", "Rust", cStyleComments()),
  source(".scss", "SCSS", cStyleComments()),
  source(".svelte", "Svelte", {
    block: [{ start: "<!--", end: "-->" }],
  }),
  source(".swift", "Swift", cStyleComments()),
  source(".cts", "TypeScript", cStyleComments()),
  source(".mts", "TypeScript", cStyleComments()),
  source(".ts", "TypeScript", cStyleComments()),
  source(".tsx", "TypeScript", cStyleComments()),
  source(".vue", "Vue", {
    block: [{ start: "<!--", end: "-->" }],
  }),
  nonSource(".adoc", "AsciiDoc", true),
  nonSource(".json", "JSON", false),
  nonSource(".md", "Markdown", true),
  nonSource(".mdx", "MDX", true),
  nonSource(".rst", "reStructuredText", true),
  nonSource(".toml", "TOML", false, { line: ["#"] }),
  nonSource(".txt", "Text", true),
  nonSource(".yaml", "YAML", false, { line: ["#"] }),
  nonSource(".yml", "YAML", false, { line: ["#"] }),
];

const languageDefinitions = new Map(
  definitions.map((definition) => [definition.extension, definition]),
);

const deferredWorkMarkerPattern = /\b(TODO|FIXME|HACK|XXX)\b/gi;
const branchWordTokens = [
  "case",
  "catch",
  "elif",
  "except",
  "for",
  "guard",
  "if",
  "match",
  "switch",
  "when",
  "while",
] as const;
const branchOperatorTokens = ["&&", "||", "?"] as const;

export function collectLanguageCodeShapeMetrics(
  input: LanguageCodeShapeMetricInput,
): LanguageCodeShapeMetricResult {
  const largeFileSizeBytes =
    input.largeFileSizeBytes ?? defaultLargeFileSizeBytes;
  const files = [...input.files].sort(compareSnapshots);
  const fileMetrics: LanguageCodeShapeFileMetric[] = [];
  const deferredWorkMarkers: LanguageCodeShapeDeferredWorkMarker[] = [];
  const branchLikeTokens: LanguageCodeShapeBranchLikeToken[] = [];
  const largeFiles: LanguageCodeShapeLargeFile[] = [];
  const omissions: LanguageCodeShapeOmission[] = [];
  const languageAccumulators = new Map<string, LanguageAccumulator>();
  let skippedFileCount = 0;
  let unsupportedFileCount = 0;

  for (const file of files) {
    if (isSkippedSnapshot(file)) {
      skippedFileCount += 1;
      omissions.push(
        omission(file.path, file.sizeBytes, file.skippedReason, file.detail),
      );
      continue;
    }

    const extension = extensionForPath(file.path);
    const definition = languageDefinitions.get(extension);

    if (definition === undefined) {
      unsupportedFileCount += 1;
      omissions.push(
        omission(
          file.path,
          file.sizeBytes,
          "unsupported-extension",
          unsupportedExtensionDetail(extension),
        ),
      );
      continue;
    }

    const lineAnalysis = analyzeLines(file.text, definition);
    const isTest = isTestFile(file.path);
    const isDocumentation =
      definition.isDocumentation || isDocumentationPath(file.path);
    const isLarge = file.sizeBytes > largeFileSizeBytes;
    const markers = deferredWorkMarkersForFile(file, lineAnalysis.lines);
    const branchCounts = definition.isSource
      ? branchTokenCountsForFile(file, lineAnalysis.codeFragments)
      : [];
    const branchLikeTokenCount = branchCounts.reduce(
      (sum, token) => sum + token.count,
      0,
    );

    deferredWorkMarkers.push(...markers);
    branchLikeTokens.push(...branchCounts);

    if (isLarge) {
      largeFiles.push(largeFileFor(file, largeFileSizeBytes));
    }

    fileMetrics.push({
      path: file.path,
      extension,
      language: definition.language,
      sizeBytes: file.sizeBytes,
      isSource: definition.isSource,
      isTest,
      isDocumentation,
      isLarge,
      textLineCount: lineAnalysis.textLineCount,
      nonEmptyLineCount: lineAnalysis.nonEmptyLineCount,
      codeLineCount: lineAnalysis.codeLineCount,
      branchLikeTokenCount,
      deferredWorkMarkerCount: markers.length,
      evidenceReferences: [fileReference(file.path, "Analyzed file")],
    });

    recordLanguageMetric(
      languageAccumulators,
      definition,
      file.path,
      lineAnalysis.textLineCount,
      lineAnalysis.codeLineCount,
    );
  }

  return {
    summary: summaryFor(
      fileMetrics,
      skippedFileCount,
      unsupportedFileCount,
      deferredWorkMarkers.length,
    ),
    languageMix: languageMixFrom(languageAccumulators),
    files: fileMetrics,
    deferredWorkMarkers: deferredWorkMarkers.sort(compareDeferredMarkers),
    branchLikeTokens: branchLikeTokens.sort(compareBranchLikeTokens),
    largeFiles,
    omissions,
    caveats: caveatsFor(
      skippedFileCount,
      unsupportedFileCount,
      largeFiles.length,
    ),
  };
}

function source(
  extension: string,
  language: string,
  comments: CommentSyntax,
): LanguageDefinition {
  return {
    language,
    extension,
    isSource: true,
    isDocumentation: false,
    countCodeLines: true,
    comments,
  };
}

function nonSource(
  extension: string,
  language: string,
  isDocumentation: boolean,
  comments: CommentSyntax = {},
): LanguageDefinition {
  return {
    language,
    extension,
    isSource: false,
    isDocumentation,
    countCodeLines: false,
    comments,
  };
}

function cStyleComments(): CommentSyntax {
  return {
    line: ["//"],
    block: [{ start: "/*", end: "*/" }],
  };
}

function analyzeLines(
  text: string,
  definition: LanguageDefinition,
): {
  readonly lines: readonly string[];
  readonly codeFragments: readonly string[];
  readonly textLineCount: number;
  readonly nonEmptyLineCount: number;
  readonly codeLineCount: number;
} {
  const lines = splitTextLines(text);
  const commentState: CommentState = {
    inBlockComment: false,
    blockEnd: "",
  };
  const codeFragments: string[] = [];
  let nonEmptyLineCount = 0;
  let codeLineCount = 0;

  for (const line of lines) {
    if (line.trim().length > 0) {
      nonEmptyLineCount += 1;
    }

    const codeFragment = definition.countCodeLines
      ? stripComments(line, definition.comments, commentState).trim()
      : "";

    if (codeFragment.length > 0) {
      codeLineCount += 1;
      codeFragments.push(codeFragment);
    }
  }

  return {
    lines,
    codeFragments,
    textLineCount: lines.length,
    nonEmptyLineCount,
    codeLineCount,
  };
}

function stripComments(
  line: string,
  comments: CommentSyntax,
  state: CommentState,
): string {
  let remaining = line;
  let output = "";

  while (remaining.length > 0) {
    if (state.inBlockComment) {
      const endIndex = remaining.indexOf(state.blockEnd);
      if (endIndex === -1) {
        return output;
      }

      remaining = remaining.slice(endIndex + state.blockEnd.length);
      state.inBlockComment = false;
      state.blockEnd = "";
      continue;
    }

    const nextBlockStart = nextBlockCommentStart(remaining, comments);
    const nextLineStart = nextLineCommentStart(remaining, comments);
    const nextCommentStart = firstCommentStart(nextBlockStart, nextLineStart);

    if (nextCommentStart === undefined) {
      output += remaining;
      break;
    }

    output += remaining.slice(0, nextCommentStart.index);

    if (nextCommentStart.kind === "line") {
      break;
    }

    const blockEndIndex = remaining.indexOf(
      nextCommentStart.end,
      nextCommentStart.index + nextCommentStart.start.length,
    );

    if (blockEndIndex === -1) {
      state.inBlockComment = true;
      state.blockEnd = nextCommentStart.end;
      break;
    }

    remaining = remaining.slice(blockEndIndex + nextCommentStart.end.length);
  }

  return output;
}

function nextBlockCommentStart(
  line: string,
  comments: CommentSyntax,
):
  | {
      readonly kind: "block";
      readonly index: number;
      readonly start: string;
      readonly end: string;
    }
  | undefined {
  let next:
    | {
        readonly kind: "block";
        readonly index: number;
        readonly start: string;
        readonly end: string;
      }
    | undefined;

  for (const block of comments.block ?? []) {
    const index = line.indexOf(block.start);
    if (index === -1) {
      continue;
    }

    if (next === undefined || index < next.index) {
      next = {
        kind: "block",
        index,
        start: block.start,
        end: block.end,
      };
    }
  }

  return next;
}

function nextLineCommentStart(
  line: string,
  comments: CommentSyntax,
):
  | {
      readonly kind: "line";
      readonly index: number;
    }
  | undefined {
  let next:
    | {
        readonly kind: "line";
        readonly index: number;
      }
    | undefined;

  for (const marker of comments.line ?? []) {
    const index = line.indexOf(marker);
    if (index === -1) {
      continue;
    }

    if (next === undefined || index < next.index) {
      next = {
        kind: "line",
        index,
      };
    }
  }

  return next;
}

function firstCommentStart(
  block:
    | {
        readonly kind: "block";
        readonly index: number;
        readonly start: string;
        readonly end: string;
      }
    | undefined,
  line:
    | {
        readonly kind: "line";
        readonly index: number;
      }
    | undefined,
):
  | {
      readonly kind: "block";
      readonly index: number;
      readonly start: string;
      readonly end: string;
    }
  | {
      readonly kind: "line";
      readonly index: number;
    }
  | undefined {
  if (block === undefined) {
    return line;
  }

  if (line === undefined) {
    return block;
  }

  return block.index < line.index ? block : line;
}

function splitTextLines(text: string): readonly string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const lastLine = lines.at(-1);

  if (lastLine === "") {
    return lines.slice(0, -1);
  }

  return lines;
}

function deferredWorkMarkersForFile(
  file: LanguageCodeShapeTextFileSnapshot,
  lines: readonly string[],
): readonly LanguageCodeShapeDeferredWorkMarker[] {
  const markers: LanguageCodeShapeDeferredWorkMarker[] = [];

  lines.forEach((line, index) => {
    for (const match of line.matchAll(deferredWorkMarkerPattern)) {
      const marker = markerFrom(match[1]);
      if (marker === undefined) {
        continue;
      }

      markers.push({
        path: file.path,
        marker,
        line: index + 1,
        excerpt: line.trim(),
        evidenceReferences: [
          {
            id: `language-code-shape:deferred-work:${file.path}:${index + 1}:${marker}`,
            kind: "file",
            label: `Deferred work marker ${marker}`,
            path: file.path,
            lineStart: index + 1,
            lineEnd: index + 1,
          },
        ],
      });
    }
  });

  return markers;
}

function markerFrom(
  value: string | undefined,
): LanguageCodeShapeDeferredWorkMarker["marker"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  const marker = value.toUpperCase();

  if (
    marker === "TODO" ||
    marker === "FIXME" ||
    marker === "HACK" ||
    marker === "XXX"
  ) {
    return marker;
  }

  return undefined;
}

function branchTokenCountsForFile(
  file: LanguageCodeShapeTextFileSnapshot,
  codeFragments: readonly string[],
): readonly LanguageCodeShapeBranchLikeToken[] {
  const joinedCode = codeFragments.join("\n");
  const tokenCounts = new Map<string, number>();

  for (const token of branchWordTokens) {
    const count = countWordToken(joinedCode, token);
    if (count > 0) {
      tokenCounts.set(token, count);
    }
  }

  for (const token of branchOperatorTokens) {
    const count = countLiteralToken(joinedCode, token);
    if (count > 0) {
      tokenCounts.set(token, count);
    }
  }

  return [...tokenCounts.entries()]
    .map(([token, count]) => ({
      path: file.path,
      token,
      count,
      evidenceReferences: [fileReference(file.path, "Branch-like token scan")],
    }))
    .sort(compareBranchLikeTokens);
}

function countWordToken(text: string, token: string): number {
  const pattern = new RegExp(`\\b${escapeRegExp(token)}\\b`, "g");
  return [...text.matchAll(pattern)].length;
}

function countLiteralToken(text: string, token: string): number {
  if (token.length === 0) {
    return 0;
  }

  return text.split(token).length - 1;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function largeFileFor(
  file: LanguageCodeShapeTextFileSnapshot,
  thresholdBytes: number,
): LanguageCodeShapeLargeFile {
  return {
    path: file.path,
    sizeBytes: file.sizeBytes,
    thresholdBytes,
    evidenceReferences: [
      {
        id: `language-code-shape:large-file:${file.path}`,
        kind: "file",
        label: "Large file signal",
        path: file.path,
        notes: `File is ${file.sizeBytes} bytes; threshold is ${thresholdBytes} bytes.`,
      },
    ],
  };
}

function recordLanguageMetric(
  accumulators: Map<string, LanguageAccumulator>,
  definition: LanguageDefinition,
  path: string,
  textLineCount: number,
  codeLineCount: number,
): void {
  const existing = accumulators.get(definition.language);

  if (existing === undefined) {
    accumulators.set(definition.language, {
      language: definition.language,
      extensions: new Set([definition.extension]),
      paths: [path],
      fileCount: 1,
      sourceFileCount: definition.isSource ? 1 : 0,
      textLineCount,
      codeLineCount,
    });
    return;
  }

  existing.extensions.add(definition.extension);
  existing.paths.push(path);
  existing.fileCount += 1;
  existing.sourceFileCount += definition.isSource ? 1 : 0;
  existing.textLineCount += textLineCount;
  existing.codeLineCount += codeLineCount;
}

function languageMixFrom(
  accumulators: ReadonlyMap<string, LanguageAccumulator>,
): readonly LanguageCodeShapeLanguageMetric[] {
  return [...accumulators.values()]
    .map((accumulator) => ({
      language: accumulator.language,
      extensions: [...accumulator.extensions].sort(),
      fileCount: accumulator.fileCount,
      sourceFileCount: accumulator.sourceFileCount,
      textLineCount: accumulator.textLineCount,
      codeLineCount: accumulator.codeLineCount,
      evidenceReferences: accumulator.paths
        .sort(compareStrings)
        .map((path) => fileReference(path, `${accumulator.language} file`)),
    }))
    .sort(compareLanguageMetrics);
}

function summaryFor(
  files: readonly LanguageCodeShapeFileMetric[],
  skippedFileCount: number,
  unsupportedFileCount: number,
  totalDeferredWorkMarkerCount: number,
): LanguageCodeShapeSummary {
  const totalBranchLikeTokenCount = files.reduce(
    (sum, file) => sum + file.branchLikeTokenCount,
    0,
  );

  return {
    analyzedFileCount: files.length,
    sourceFileCount: files.filter((file) => file.isSource).length,
    testFileCount: files.filter((file) => file.isTest).length,
    documentationFileCount: files.filter((file) => file.isDocumentation).length,
    largeFileCount: files.filter((file) => file.isLarge).length,
    skippedFileCount,
    unsupportedFileCount,
    totalTextLineCount: files.reduce(
      (sum, file) => sum + file.textLineCount,
      0,
    ),
    totalCodeLineCount: files.reduce(
      (sum, file) => sum + file.codeLineCount,
      0,
    ),
    totalDeferredWorkMarkerCount,
    totalBranchLikeTokenCount,
  };
}

function caveatsFor(
  skippedFileCount: number,
  unsupportedFileCount: number,
  largeFileCount: number,
): readonly LanguageCodeShapeCaveat[] {
  const caveats: LanguageCodeShapeCaveat[] = [
    {
      kind: "metric-limitation",
      detail:
        "Language and code-shape metrics are static heuristics and do not prove repository quality.",
      evidenceReferences: [collectorReference],
    },
  ];

  if (skippedFileCount > 0) {
    caveats.push({
      kind: "skipped-files",
      detail: `${skippedFileCount} file snapshots were skipped before language/code-shape analysis.`,
      evidenceReferences: [collectorReference],
    });
  }

  if (unsupportedFileCount > 0) {
    caveats.push({
      kind: "unsupported-files",
      detail: `${unsupportedFileCount} file snapshot had an unsupported extension and was omitted from code-shape metrics.`,
      evidenceReferences: [collectorReference],
    });
  }

  if (largeFileCount > 0) {
    caveats.push({
      kind: "large-files",
      detail: `${largeFileCount} analyzed file exceeded the large-file threshold; review whether generated or bundled code is present.`,
      evidenceReferences: [collectorReference],
    });
  }

  return caveats;
}

function omission(
  path: string,
  sizeBytes: number,
  reason: LanguageCodeShapeOmissionReason,
  detail: string,
): LanguageCodeShapeOmission {
  return {
    path,
    sizeBytes,
    reason,
    detail,
    evidenceReferences: [fileReference(path, "Language/code-shape omission")],
  };
}

function unsupportedExtensionDetail(extension: string): string {
  if (extension.length === 0) {
    return "Files without extensions are not supported for code-shape metrics.";
  }

  return `Extension ${extension} is not supported for code-shape metrics.`;
}

function fileReference(path: string, label: string): EvidenceReference {
  return {
    id: `language-code-shape:file:${path}`,
    kind: "file",
    label,
    path,
  };
}

function extensionForPath(path: string): string {
  const basename = basenameForPath(path);
  const dotIndex = basename.lastIndexOf(".");

  if (dotIndex <= 0 || dotIndex === basename.length - 1) {
    return "";
  }

  return basename.slice(dotIndex).toLowerCase();
}

function basenameForPath(path: string): string {
  const slashIndex = path.lastIndexOf("/");

  if (slashIndex === -1) {
    return path;
  }

  return path.slice(slashIndex + 1);
}

function isSkippedSnapshot(
  file: LanguageCodeShapeFileSnapshot,
): file is LanguageCodeShapeSkippedFileSnapshot {
  return "skippedReason" in file;
}

function isDocumentationPath(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  const basename = basenameForPath(normalizedPath);

  return (
    normalizedPath.startsWith("docs/") ||
    normalizedPath.includes("/docs/") ||
    basename === "readme" ||
    basename.startsWith("readme.") ||
    basename === "changelog" ||
    basename.startsWith("changelog.") ||
    basename === "contributing" ||
    basename.startsWith("contributing.") ||
    basename === "license" ||
    basename.startsWith("license.")
  );
}

function isTestFile(path: string): boolean {
  const normalizedPath = path.toLowerCase();
  const basename = basenameForPath(normalizedPath);

  return (
    normalizedPath.startsWith("test/") ||
    normalizedPath.includes("/test/") ||
    normalizedPath.startsWith("tests/") ||
    normalizedPath.includes("/tests/") ||
    normalizedPath.startsWith("__tests__/") ||
    normalizedPath.includes("/__tests__/") ||
    basename.includes(".test.") ||
    basename.includes(".spec.")
  );
}

function compareSnapshots(
  left: LanguageCodeShapeFileSnapshot,
  right: LanguageCodeShapeFileSnapshot,
): number {
  return compareStrings(left.path, right.path);
}

function compareLanguageMetrics(
  left: LanguageCodeShapeLanguageMetric,
  right: LanguageCodeShapeLanguageMetric,
): number {
  return compareStrings(left.language, right.language);
}

function compareDeferredMarkers(
  left: LanguageCodeShapeDeferredWorkMarker,
  right: LanguageCodeShapeDeferredWorkMarker,
): number {
  const pathComparison = compareStrings(left.path, right.path);
  if (pathComparison !== 0) {
    return pathComparison;
  }

  if (left.line !== right.line) {
    return left.line - right.line;
  }

  return compareStrings(left.marker, right.marker);
}

function compareBranchLikeTokens(
  left: LanguageCodeShapeBranchLikeToken,
  right: LanguageCodeShapeBranchLikeToken,
): number {
  const pathComparison = compareStrings(left.path, right.path);
  if (pathComparison !== 0) {
    return pathComparison;
  }

  return compareStrings(left.token, right.token);
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}
