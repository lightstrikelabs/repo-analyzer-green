import { describe, expect, it } from "vitest";

import { collectRepositoryEvidence } from "./analyze-repository";
import {
  EvidenceBundleRecordSchemaVersion,
  parseEvidenceBundleRecord,
  toEvidenceBundleRecord,
  type EvidenceArtifactRecord,
} from "./evidence-bundle-record";
import type {
  RepositoryFileContent,
  RepositoryFileEntry,
  RepositoryPath,
  RepositoryReference,
  RepositorySource,
} from "../../domain/repository/repository-source";

const repository: RepositoryReference = {
  provider: "local-fixture",
  name: "evidence-bundle-fixture",
  revision: "fixture",
};

describe("evidence bundle record", () => {
  it("round-trips evidence metadata and separate raw artifact pointers", async () => {
    const evidenceBundle = await collectRepositoryEvidence({
      repository,
      repositorySource: new FakeRepositorySource([
        textFile("README.md", "# Fixture\n"),
        textFile(
          "package.json",
          JSON.stringify(
            {
              name: "evidence-bundle-fixture",
              private: true,
              scripts: {
                dev: "next dev",
                test: "vitest",
              },
              dependencies: {
                next: "^15.0.0",
                react: "^19.0.0",
              },
            },
            null,
            2,
          ),
        ),
        textFile(
          "src/app/layout.tsx",
          "export default function Layout() { return null; }\n",
        ),
        textFile(
          "src/app/page.tsx",
          "export default function Page() { return null; }\n",
        ),
        textFile(
          "test/page.test.tsx",
          "import { describe, it } from 'vitest';\n",
        ),
        textFile("dist/app.js", "export const generated = true;\n"),
        textFile(".git/config", "[core]\n"),
        textFile("assets/logo.png", "png\0bytes"),
      ]),
    });

    const record = toEvidenceBundleRecord({
      repository: evidenceBundle.repository,
      collectedAt: "2026-04-25T20:05:00-07:00",
      evidenceBundle,
      rawArtifacts: [
        {
          id: "artifact:repository-snapshot",
          kind: "repository-snapshot",
          label: "Compressed repository snapshot",
          storageKey: "evidence/evidence-bundle-fixture/snapshot.tar.zst",
          byteSize: 4096,
          sha256: "sha256:0123456789abcdef",
          provenance: {
            repository: evidenceBundle.repository,
            sourceKind: "local-fixture",
            sourceId: "evidence-bundle-fixture",
            path: "snapshot.tar.zst",
          },
        } satisfies EvidenceArtifactRecord,
      ],
    });

    const parsed = parseEvidenceBundleRecord(
      JSON.parse(JSON.stringify(record)),
    );

    expect(parsed.schemaVersion).toBe(EvidenceBundleRecordSchemaVersion);
    expect(parsed.repository).toEqual(repository);
    expect(parsed.metadata.evidenceReferences.length).toBeGreaterThan(0);
    expect(parsed.metadata.fileInventory.omissions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".git/config",
          reason: "ignored",
        }),
        expect.objectContaining({
          path: "assets/logo.png",
          reason: "binary",
        }),
        expect.objectContaining({
          path: "dist/app.js",
          reason: "generated",
        }),
      ]),
    );
    expect(parsed.rawArtifacts).toEqual([
      expect.objectContaining({
        id: "artifact:repository-snapshot",
        kind: "repository-snapshot",
        provenance: expect.objectContaining({
          repository: expect.objectContaining({
            name: "evidence-bundle-fixture",
          }),
          sourceKind: "local-fixture",
        }),
      }),
    ]);
  });

  it("rejects malformed metadata and artifact records", () => {
    expect(() =>
      parseEvidenceBundleRecord({
        schemaVersion: EvidenceBundleRecordSchemaVersion,
        repository,
        collectedAt: "2026-04-25T20:05:00-07:00",
        metadata: {
          evidenceSummary: "summary",
          fileInventory: {
            files: [],
            omissions: [
              {
                path: "dist/app.js",
                sizeBytes: 31,
                reason: "generated",
                detail: "generated output directory is omitted",
              },
            ],
          },
          manifestWorkflowSignals: {
            packageManifests: [],
            dependencySignals: [],
            scriptSignals: [],
            workflowSignals: [],
            unsupportedManifests: [],
            omissions: [],
          },
          projectArchetypeSignals: {
            primaryArchetype: "web-app",
            candidates: [],
          },
          languageCodeShapeMetrics: {
            summary: {
              analyzedFileCount: 0,
              sourceFileCount: 0,
              testFileCount: 0,
              documentationFileCount: 0,
              largeFileCount: 0,
              skippedFileCount: 0,
              unsupportedFileCount: 0,
              totalTextLineCount: 0,
              totalCodeLineCount: 0,
              totalDeferredWorkMarkerCount: 0,
              totalBranchLikeTokenCount: 0,
            },
            languageMix: [],
            files: [],
            deferredWorkMarkers: [],
            branchLikeTokens: [],
            largeFiles: [],
            omissions: [],
            caveats: [],
          },
          securityHygieneSignals: {
            lockfileSignals: [],
            dependencyCountSignals: [],
            envExampleSignals: [],
            secretRiskSignals: [],
            limitations: [],
          },
          evidenceReferences: [],
        },
        rawArtifacts: [
          {
            id: "artifact:bad",
            kind: "repository-snapshot",
            label: "Broken snapshot",
            storageKey: "",
            provenance: {
              repository,
              sourceKind: "local-fixture",
              sourceId: "evidence-bundle-fixture",
            },
          },
        ],
      }),
    ).toThrow();
  });
});

function textFile(path: RepositoryPath, text: string): FakeRepositoryFile {
  return {
    path,
    text,
    sizeBytes: Buffer.byteLength(text),
  };
}

type FakeRepositoryFile = {
  readonly path: RepositoryPath;
  readonly text: string;
  readonly sizeBytes: number;
};

class FakeRepositorySource implements RepositorySource {
  private readonly files: readonly FakeRepositoryFile[];

  constructor(files: readonly FakeRepositoryFile[]) {
    this.files = files;
  }

  async listFiles(): Promise<readonly RepositoryFileEntry[]> {
    return this.files.map((file) => ({
      path: file.path,
      sizeBytes: file.sizeBytes,
      provenance: {
        repository,
        sourceKind: "local-fixture",
        sourceId: "evidence-bundle-fixture",
        path: file.path,
      },
    }));
  }

  async readFile(
    _repository: RepositoryReference,
    filePath: RepositoryPath,
  ): Promise<RepositoryFileContent> {
    const file = this.files.find((candidate) => candidate.path === filePath);

    if (file === undefined) {
      throw new Error(`Missing fake file: ${filePath}`);
    }

    return {
      path: file.path,
      text: file.text,
      sizeBytes: file.sizeBytes,
      provenance: {
        repository,
        sourceKind: "local-fixture",
        sourceId: "evidence-bundle-fixture",
        path: file.path,
      },
    };
  }
}
