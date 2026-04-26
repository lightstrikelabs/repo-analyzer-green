import { describe, expect, it } from "vitest";

import type {
  RepositoryFileContent,
  RepositoryFileEntry,
  RepositoryPath,
  RepositoryReference,
  RepositorySource,
} from "../repository/repository-source";

import { collectFileInventory } from "./file-inventory";

const repository: RepositoryReference = {
  provider: "local-fixture",
  name: "inventory-fixture",
  revision: "test",
};

describe("collectFileInventory", () => {
  it("records file inventory with path, size, extension, and classification signals", async () => {
    const inventory = await collectFileInventory(
      repository,
      new FakeRepositorySource([
        textFile("README.md", "# Package\n"),
        textFile("src/add.ts", "export function add() {}\n"),
        textFile("test/add.spec.ts", "import { describe } from 'vitest';\n"),
        textFile("package.json", '{"scripts":{"test":"vitest"}}\n'),
      ]),
    );

    expect(inventory.files).toEqual([
      expect.objectContaining({
        path: "README.md",
        sizeBytes: 10,
        extension: ".md",
        signals: expect.arrayContaining(["documentation"]),
      }),
      expect.objectContaining({
        path: "package.json",
        sizeBytes: 30,
        extension: ".json",
        signals: expect.arrayContaining(["manifest", "configuration"]),
      }),
      expect.objectContaining({
        path: "src/add.ts",
        sizeBytes: 25,
        extension: ".ts",
        signals: expect.arrayContaining(["source"]),
      }),
      expect.objectContaining({
        path: "test/add.spec.ts",
        sizeBytes: 35,
        extension: ".ts",
        signals: expect.arrayContaining(["test", "source"]),
      }),
    ]);
    expect(inventory.omissions).toEqual([]);
  });

  it("records ignored, oversized, binary, generated, and vendor omissions with reasons", async () => {
    const inventory = await collectFileInventory(
      repository,
      new FakeRepositorySource([
        textFile(".git/config", "[core]\n"),
        textFile("src/add.ts", "export function add() {}\n"),
        textFile("dist/add.js", "export function add() {}\n"),
        textFile("node_modules/lib/index.js", "module.exports = {}\n"),
        textFile("src/api.generated.ts", "export const generated = true;\n"),
        textFile("assets/logo.png", "png\0bytes"),
        textFile("docs/reference.md", "x".repeat(51)),
      ]),
      { maxFileSizeBytes: 50 },
    );

    expect(inventory.files.map((file) => file.path)).toEqual(["src/add.ts"]);
    expect(inventory.omissions).toEqual([
      expect.objectContaining({
        path: ".git/config",
        reason: "ignored",
        detail: "version-control metadata is ignored",
      }),
      expect.objectContaining({
        path: "assets/logo.png",
        reason: "binary",
        detail: "file content appears to be binary",
      }),
      expect.objectContaining({
        path: "dist/add.js",
        reason: "generated",
        detail: "generated output directory is omitted",
      }),
      expect.objectContaining({
        path: "docs/reference.md",
        reason: "oversized",
        detail: "file exceeds the 50 byte inventory limit",
      }),
      expect.objectContaining({
        path: "node_modules/lib/index.js",
        reason: "vendor",
        detail: "vendor dependency directory is omitted",
      }),
      expect.objectContaining({
        path: "src/api.generated.ts",
        reason: "generated",
        detail: "generated filename pattern is omitted",
      }),
    ]);
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
        sourceId: "inventory-fixture",
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
        sourceId: "inventory-fixture",
        path: file.path,
      },
    };
  }
}
