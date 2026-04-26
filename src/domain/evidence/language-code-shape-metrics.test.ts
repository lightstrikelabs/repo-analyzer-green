import { describe, expect, it } from "vitest";

import { collectLanguageCodeShapeMetrics } from "./language-code-shape-metrics";

describe("collectLanguageCodeShapeMetrics", () => {
  it("collects language mix, line counts, file shape flags, branch tokens, and deferred markers", () => {
    const result = collectLanguageCodeShapeMetrics({
      files: [
        {
          path: "README.md",
          sizeBytes: 24,
          text: "# Fixture\n\nTODO: add API docs\n",
        },
        {
          path: "src/app.ts",
          sizeBytes: 169,
          text: [
            "// setup",
            "export function decide(flag: boolean) {",
            '  if (flag && process.env.NODE_ENV !== "test") {',
            "    // TODO: simplify this branch",
            '    return "live";',
            "  }",
            '  return "test";',
            "}",
            "",
          ].join("\n"),
        },
        {
          path: "src/service.py",
          sizeBytes: 48,
          text: [
            "# note",
            "for item in items:",
            "    if item:",
            "        pass",
            "",
          ].join("\n"),
        },
        {
          path: "test/app.test.ts",
          sizeBytes: 75,
          text: [
            'import { expect, it } from "vitest";',
            'it("runs", () => {',
            '  expect(decide(true)).toBe("live");',
            "});",
            "",
          ].join("\n"),
        },
      ],
    });

    expect(result.languageMix).toEqual([
      expect.objectContaining({
        language: "Markdown",
        fileCount: 1,
        textLineCount: 3,
        codeLineCount: 0,
      }),
      expect.objectContaining({
        language: "Python",
        fileCount: 1,
        textLineCount: 4,
        codeLineCount: 3,
      }),
      expect.objectContaining({
        language: "TypeScript",
        fileCount: 2,
        textLineCount: 12,
        codeLineCount: 10,
      }),
    ]);
    expect(result.summary).toEqual({
      analyzedFileCount: 4,
      sourceFileCount: 3,
      testFileCount: 1,
      documentationFileCount: 1,
      largeFileCount: 0,
      skippedFileCount: 0,
      unsupportedFileCount: 0,
      totalTextLineCount: 19,
      totalCodeLineCount: 13,
      totalDeferredWorkMarkerCount: 2,
      totalBranchLikeTokenCount: 4,
    });
    expect(result.files).toEqual([
      expect.objectContaining({
        path: "README.md",
        language: "Markdown",
        isDocumentation: true,
        isSource: false,
        textLineCount: 3,
        codeLineCount: 0,
        deferredWorkMarkerCount: 1,
      }),
      expect.objectContaining({
        path: "src/app.ts",
        language: "TypeScript",
        isSource: true,
        isTest: false,
        branchLikeTokenCount: 2,
        deferredWorkMarkerCount: 1,
        codeLineCount: 6,
      }),
      expect.objectContaining({
        path: "src/service.py",
        language: "Python",
        branchLikeTokenCount: 2,
        codeLineCount: 3,
      }),
      expect.objectContaining({
        path: "test/app.test.ts",
        language: "TypeScript",
        isSource: true,
        isTest: true,
        codeLineCount: 4,
      }),
    ]);
    expect(result.deferredWorkMarkers).toEqual([
      expect.objectContaining({
        path: "README.md",
        marker: "TODO",
        line: 3,
      }),
      expect.objectContaining({
        path: "src/app.ts",
        marker: "TODO",
        line: 4,
        evidenceReferences: [
          {
            id: "language-code-shape:deferred-work:src/app.ts:4:TODO",
            kind: "file",
            label: "Deferred work marker TODO",
            path: "src/app.ts",
            lineStart: 4,
            lineEnd: 4,
          },
        ],
      }),
    ]);
    expect(result.branchLikeTokens).toEqual([
      expect.objectContaining({
        path: "src/app.ts",
        token: "&&",
        count: 1,
      }),
      expect.objectContaining({
        path: "src/app.ts",
        token: "if",
        count: 1,
      }),
      expect.objectContaining({
        path: "src/service.py",
        token: "for",
        count: 1,
      }),
      expect.objectContaining({
        path: "src/service.py",
        token: "if",
        count: 1,
      }),
    ]);
    expect(result.omissions).toEqual([]);
    expect(result.caveats).toContainEqual(
      expect.objectContaining({
        kind: "metric-limitation",
        detail:
          "Language and code-shape metrics are static heuristics and do not prove repository quality.",
      }),
    );
  });

  it("records unsupported, skipped, and large-file evidence without reading from infrastructure", () => {
    const result = collectLanguageCodeShapeMetrics({
      largeFileSizeBytes: 20,
      files: [
        {
          path: "assets/logo.png",
          sizeBytes: 512,
          skippedReason: "binary",
          detail: "file content appears to be binary",
        },
        {
          path: "src/big.ts",
          sizeBytes: 40,
          text: "export const answer = 42;\n",
        },
        {
          path: "src/generated-client.ts",
          sizeBytes: 4096,
          skippedReason: "generated",
          detail: "generated source snapshot was intentionally skipped",
        },
        {
          path: "src/notebook.ipynb",
          sizeBytes: 2,
          text: "{}",
        },
      ],
    });

    expect(result.largeFiles).toEqual([
      {
        path: "src/big.ts",
        sizeBytes: 40,
        thresholdBytes: 20,
        evidenceReferences: [
          {
            id: "language-code-shape:large-file:src/big.ts",
            kind: "file",
            label: "Large file signal",
            path: "src/big.ts",
            notes: "File is 40 bytes; threshold is 20 bytes.",
          },
        ],
      },
    ]);
    expect(result.omissions).toEqual([
      expect.objectContaining({
        path: "assets/logo.png",
        reason: "binary",
        detail: "file content appears to be binary",
      }),
      expect.objectContaining({
        path: "src/generated-client.ts",
        reason: "generated",
        detail: "generated source snapshot was intentionally skipped",
      }),
      expect.objectContaining({
        path: "src/notebook.ipynb",
        reason: "unsupported-extension",
        detail: "Extension .ipynb is not supported for code-shape metrics.",
      }),
    ]);
    expect(result.summary).toMatchObject({
      analyzedFileCount: 1,
      sourceFileCount: 1,
      largeFileCount: 1,
      skippedFileCount: 2,
      unsupportedFileCount: 1,
    });
    expect(result.caveats).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "skipped-files",
          detail:
            "2 file snapshots were skipped before language/code-shape analysis.",
        }),
        expect.objectContaining({
          kind: "unsupported-files",
          detail:
            "1 file snapshot had an unsupported extension and was omitted from code-shape metrics.",
        }),
        expect.objectContaining({
          kind: "metric-limitation",
        }),
      ]),
    );
  });
});
