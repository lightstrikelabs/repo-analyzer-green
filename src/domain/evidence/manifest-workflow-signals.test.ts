import { describe, expect, it } from "vitest";

import { parseManifestWorkflowSignals } from "./manifest-workflow-signals";

describe("parseManifestWorkflowSignals", () => {
  it("reads package, dependency, build, and test signals from package.json", () => {
    const result = parseManifestWorkflowSignals({
      files: [
        {
          path: "package.json",
          text: JSON.stringify({
            name: "@fixture/web-app",
            private: true,
            packageManager: "pnpm@10.29.3",
            scripts: {
              build: "next build",
              test: "vitest run",
              lint: "oxlint .",
              dev: "next dev",
            },
            dependencies: {
              next: "^16.0.0",
              react: "^19.0.0",
            },
            devDependencies: {
              typescript: "^5.0.0",
              vitest: "^4.0.0",
            },
          }),
        },
      ],
    });

    expect(result.packageManifests).toEqual([
      {
        kind: "package-json",
        path: "package.json",
        name: "@fixture/web-app",
        private: true,
        packageManager: "pnpm@10.29.3",
        evidenceReferences: [
          {
            id: "manifest-workflow:package-json:package.json",
            kind: "file",
            label: "Package manifest",
            path: "package.json",
          },
        ],
      },
    ]);
    expect(result.dependencySignals).toEqual([
      expect.objectContaining({
        path: "package.json",
        name: "next",
        relationship: "production",
      }),
      expect.objectContaining({
        path: "package.json",
        name: "react",
        relationship: "production",
      }),
      expect.objectContaining({
        path: "package.json",
        name: "typescript",
        relationship: "development",
      }),
      expect.objectContaining({
        path: "package.json",
        name: "vitest",
        relationship: "development",
      }),
    ]);
    expect(result.scriptSignals).toEqual([
      expect.objectContaining({
        path: "package.json",
        name: "build",
        command: "next build",
        purpose: "build",
      }),
      expect.objectContaining({
        path: "package.json",
        name: "dev",
        command: "next dev",
        purpose: "development",
      }),
      expect.objectContaining({
        path: "package.json",
        name: "lint",
        command: "oxlint .",
        purpose: "lint",
      }),
      expect.objectContaining({
        path: "package.json",
        name: "test",
        command: "vitest run",
        purpose: "test",
      }),
    ]);
    expect(result.omissions).toEqual([]);
    expect(result.unsupportedManifests).toEqual([]);
  });

  it("records GitHub CI and release workflow files as evidence", () => {
    const result = parseManifestWorkflowSignals({
      files: [
        {
          path: ".github/workflows/ci.yml",
          text: "name: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n",
        },
        {
          path: ".github/workflows/publish.yaml",
          text: "name: Release\non:\n  release:\n    types: [published]\n",
        },
        {
          path: ".github/workflows/notes.txt",
          text: "not a workflow",
        },
      ],
    });

    expect(result.workflowSignals).toEqual([
      {
        kind: "github-workflow",
        path: ".github/workflows/ci.yml",
        name: "ci",
        purpose: "ci",
        evidenceReferences: [
          {
            id: "manifest-workflow:github-workflow:.github/workflows/ci.yml",
            kind: "file",
            label: "GitHub workflow",
            path: ".github/workflows/ci.yml",
          },
        ],
      },
      {
        kind: "github-workflow",
        path: ".github/workflows/publish.yaml",
        name: "publish",
        purpose: "release",
        evidenceReferences: [
          {
            id: "manifest-workflow:github-workflow:.github/workflows/publish.yaml",
            kind: "file",
            label: "GitHub workflow",
            path: ".github/workflows/publish.yaml",
          },
        ],
      },
    ]);
  });

  it("records unsupported manifest notes without failing", () => {
    const result = parseManifestWorkflowSignals({
      files: [
        {
          path: "go.mod",
          text: "module example.com/fixture\n",
        },
        {
          path: "pyproject.toml",
          text: '[project]\nname = "fixture"\n',
        },
      ],
    });

    expect(result.packageManifests).toEqual([]);
    expect(result.dependencySignals).toEqual([]);
    expect(result.scriptSignals).toEqual([]);
    expect(result.unsupportedManifests).toEqual([
      expect.objectContaining({
        path: "go.mod",
        ecosystem: "go",
        detail: "Go module manifests are detected but not parsed yet.",
      }),
      expect.objectContaining({
        path: "pyproject.toml",
        ecosystem: "python",
        detail: "Python project manifests are detected but not parsed yet.",
      }),
    ]);
    expect(result.omissions).toEqual([]);
  });

  it("omits invalid supported manifests with provenance instead of throwing", () => {
    const result = parseManifestWorkflowSignals({
      files: [
        {
          path: "package.json",
          text: "{ invalid json",
        },
      ],
    });

    expect(result.packageManifests).toEqual([]);
    expect(result.omissions).toEqual([
      {
        path: "package.json",
        reason: "parse-error",
        detail: "Package manifest is not valid JSON.",
        evidenceReferences: [
          {
            id: "manifest-workflow:package-json:package.json",
            kind: "file",
            label: "Package manifest",
            path: "package.json",
          },
        ],
      },
    ]);
  });
});
