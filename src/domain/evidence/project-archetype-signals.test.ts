import { describe, expect, it } from "vitest";

import { detectProjectArchetypeSignals } from "./project-archetype-signals";

describe("detectProjectArchetypeSignals", () => {
  it("detects a web app from framework manifests and route files", () => {
    const result = detectProjectArchetypeSignals({
      filePaths: ["package.json", "src/app/page.tsx", "src/app/layout.tsx"],
      manifests: [
        {
          kind: "package-json",
          path: "package.json",
          dependencies: ["next", "react", "react-dom"],
          scripts: {
            dev: "next dev",
            build: "next build",
          },
          private: true,
        },
      ],
    });

    expect(result.candidates[0]).toMatchObject({
      archetype: "web-app",
      confidence: {
        level: "high",
      },
    });
  });

  it("detects a library from package export metadata", () => {
    const result = detectProjectArchetypeSignals({
      filePaths: ["package.json", "src/add.ts", "src/add.test.ts"],
      manifests: [
        {
          kind: "package-json",
          path: "package.json",
          name: "@fixture/math",
          main: "dist/add.js",
          types: "dist/add.d.ts",
          exports: true,
          scripts: {
            build: "tsc",
            test: "vitest run",
          },
        },
      ],
    });

    expect(result.candidates[0]?.archetype).toBe("library");
    expect(result.candidates[0]?.evidenceReferences).toContainEqual({
      id: "archetype-signal:package-json",
      kind: "file",
      label: "Package manifest",
      path: "package.json",
    });
  });

  it("detects a CLI from bin metadata and command framework dependencies", () => {
    const result = detectProjectArchetypeSignals({
      filePaths: ["package.json", "bin/fixture.ts", "src/commands/run.ts"],
      manifests: [
        {
          kind: "package-json",
          path: "package.json",
          bin: true,
          dependencies: ["commander"],
        },
      ],
    });

    expect(result.candidates[0]?.archetype).toBe("cli");
    expect(result.candidates[0]?.confidence.score).toBeGreaterThanOrEqual(0.8);
  });

  it("detects an infrastructure module from IaC manifests and paths", () => {
    const result = detectProjectArchetypeSignals({
      filePaths: [
        "versions.tf",
        "main.tf",
        "variables.tf",
        "modules/database/main.tf",
      ],
      manifests: [
        {
          kind: "terraform",
          path: "main.tf",
        },
      ],
    });

    expect(result.candidates[0]?.archetype).toBe("infrastructure-module");
  });

  it("detects a docs-heavy repo from documentation density and docs tooling", () => {
    const result = detectProjectArchetypeSignals({
      filePaths: [
        "README.md",
        "docs/getting-started.md",
        "docs/reference.md",
        "docs/tutorial.md",
        "mkdocs.yml",
      ],
      manifests: [
        {
          kind: "docs-config",
          path: "mkdocs.yml",
          tool: "mkdocs",
        },
      ],
    });

    expect(result.candidates[0]).toMatchObject({
      archetype: "docs-heavy",
      confidence: {
        level: "high",
      },
    });
  });

  it("detects a generated SDK from generator metadata", () => {
    const result = detectProjectArchetypeSignals({
      filePaths: [
        "package.json",
        ".openapi-generator/VERSION",
        "src/apis/PetApi.ts",
        "src/models/Pet.ts",
      ],
      manifests: [
        {
          kind: "package-json",
          path: "package.json",
          name: "@fixture/petstore-sdk",
          devDependencies: ["@openapitools/openapi-generator-cli"],
        },
        {
          kind: "openapi-generator",
          path: ".openapi-generator/VERSION",
        },
      ],
    });

    expect(result.candidates[0]?.archetype).toBe("generated-sdk");
  });

  it("returns unknown with low confidence when there is no meaningful signal", () => {
    const result = detectProjectArchetypeSignals({
      filePaths: ["scratch.txt"],
      manifests: [],
    });

    expect(result.candidates).toEqual([
      {
        archetype: "unknown",
        confidence: {
          level: "low",
          score: 0.2,
          rationale: "No strong project archetype signals were detected.",
        },
        evidenceReferences: [
          {
            id: "archetype-signal:file-inventory",
            kind: "collector",
            label: "Input file path signals",
          },
        ],
        matchedSignals: ["No strong project archetype signals were detected."],
      },
    ]);
  });

  it("keeps multiple plausible archetypes when evidence is ambiguous", () => {
    const result = detectProjectArchetypeSignals({
      filePaths: ["package.json", "src/app/page.tsx", "src/client.ts"],
      manifests: [
        {
          kind: "package-json",
          path: "package.json",
          dependencies: ["next", "react"],
          main: "dist/client.js",
          types: "dist/client.d.ts",
          exports: true,
          scripts: {
            build: "next build && tsc --emitDeclarationOnly",
          },
        },
      ],
    });

    expect(result.primaryArchetype).toBe("web-app");
    expect(result.candidates.map((candidate) => candidate.archetype)).toEqual([
      "web-app",
      "library",
    ]);
  });
});
