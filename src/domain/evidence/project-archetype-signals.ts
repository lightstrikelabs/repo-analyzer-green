import type { ProjectArchetype } from "../report/report-card";
import type { Confidence } from "../shared/confidence";
import type { EvidenceReference } from "../shared/evidence-reference";

export type DetectedProjectArchetype = Extract<
  ProjectArchetype,
  | "web-app"
  | "library"
  | "cli"
  | "infrastructure"
  | "docs-heavy"
  | "generated-sdk"
  | "unknown"
>;

export type PackageJsonManifestSignal = {
  readonly kind: "package-json";
  readonly path: string;
  readonly name?: string;
  readonly private?: boolean;
  readonly scripts?: Readonly<Record<string, string>>;
  readonly dependencies?: readonly string[];
  readonly devDependencies?: readonly string[];
  readonly main?: string;
  readonly module?: string;
  readonly types?: string;
  readonly exports?: boolean;
  readonly bin?: boolean;
};

export type TerraformManifestSignal = {
  readonly kind: "terraform";
  readonly path: string;
};

export type DocsConfigManifestSignal = {
  readonly kind: "docs-config";
  readonly path: string;
  readonly tool: "docusaurus" | "mkdocs" | "vitepress" | "other";
};

export type OpenApiGeneratorManifestSignal = {
  readonly kind: "openapi-generator";
  readonly path: string;
};

export type ProjectArchetypeManifestSignal =
  | PackageJsonManifestSignal
  | TerraformManifestSignal
  | DocsConfigManifestSignal
  | OpenApiGeneratorManifestSignal;

export type ProjectArchetypeSignalInput = {
  readonly filePaths: readonly string[];
  readonly manifests: readonly ProjectArchetypeManifestSignal[];
};

export type ProjectArchetypeCandidate = {
  readonly archetype: DetectedProjectArchetype;
  readonly confidence: Confidence;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly matchedSignals: readonly string[];
};

export type ProjectArchetypeSignalResult = {
  readonly primaryArchetype: DetectedProjectArchetype;
  readonly candidates: readonly ProjectArchetypeCandidate[];
};

type ScoredCandidate = {
  readonly archetype: Exclude<DetectedProjectArchetype, "unknown">;
  readonly score: number;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly matchedSignals: readonly string[];
};

type PathSummary = {
  readonly normalizedPaths: readonly string[];
  readonly documentationFileCount: number;
  readonly sourceFileCount: number;
};

const fileInventoryReference: EvidenceReference = {
  id: "archetype-signal:file-inventory",
  kind: "collector",
  label: "Input file path signals",
};

export function detectProjectArchetypeSignals(
  input: ProjectArchetypeSignalInput,
): ProjectArchetypeSignalResult {
  const pathSummary = summarizePaths(input.filePaths);
  const scoredCandidates = [
    scoreGeneratedSdk(input, pathSummary),
    scoreWebApp(input, pathSummary),
    scoreCli(input, pathSummary),
    scoreInfrastructureModule(input, pathSummary),
    scoreDocsHeavy(input, pathSummary),
    scoreLibrary(input, pathSummary),
  ]
    .filter(isMeaningfulCandidate)
    .sort(compareCandidates);

  if (scoredCandidates.length === 0) {
    const unknownCandidate = createUnknownCandidate();

    return {
      primaryArchetype: "unknown",
      candidates: [unknownCandidate],
    };
  }

  const candidates = keepPlausibleCandidates(scoredCandidates).map(
    toProjectArchetypeCandidate,
  );
  const primaryArchetype = candidates[0]?.archetype ?? "unknown";

  return {
    primaryArchetype,
    candidates,
  };
}

function scoreGeneratedSdk(
  input: ProjectArchetypeSignalInput,
  pathSummary: PathSummary,
): ScoredCandidate {
  const signals: string[] = [];
  const references: EvidenceReference[] = [];

  if (hasManifest(input, "openapi-generator")) {
    signals.push("OpenAPI generator metadata is present.");
    references.push(...referencesForKind(input, "openapi-generator"));
  }

  const packageJson = packageJsonManifest(input);
  if (
    packageJson !== undefined &&
    hasAnyDependency(packageJson, [
      "@openapitools/openapi-generator-cli",
      "swagger-codegen",
      "openapi-typescript-codegen",
    ])
  ) {
    signals.push("Package manifest includes SDK generator tooling.");
    references.push(referenceForManifest(packageJson));
  }

  if (
    pathSummary.normalizedPaths.some(
      (path) =>
        path.startsWith(".openapi-generator/") ||
        path.includes("/generated/") ||
        path.includes("/apis/") ||
        path.includes("/models/"),
    )
  ) {
    signals.push("File paths match generated API client conventions.");
    references.push(fileInventoryReference);
  }

  if (packageJson?.name?.toLowerCase().includes("sdk") === true) {
    signals.push("Package name includes SDK terminology.");
    references.push(referenceForManifest(packageJson));
  }

  return createScoredCandidate("generated-sdk", signals, references);
}

function scoreWebApp(
  input: ProjectArchetypeSignalInput,
  pathSummary: PathSummary,
): ScoredCandidate {
  const signals: string[] = [];
  const references: EvidenceReference[] = [];
  const packageJson = packageJsonManifest(input);

  if (
    packageJson !== undefined &&
    hasAnyDependency(packageJson, [
      "next",
      "react",
      "vue",
      "svelte",
      "@angular/core",
      "vite",
    ])
  ) {
    signals.push(
      "Package manifest includes browser application framework dependencies.",
    );
    references.push(referenceForManifest(packageJson));
  }

  if (
    packageJson !== undefined &&
    hasAnyScriptCommand(packageJson, ["next dev", "next build", "vite"])
  ) {
    signals.push("Package scripts run a web application framework.");
    references.push(referenceForManifest(packageJson));
  }

  if (
    pathSummary.normalizedPaths.some(
      (path) =>
        path.startsWith("src/app/") ||
        path.startsWith("app/") ||
        path.startsWith("pages/") ||
        path.startsWith("src/pages/") ||
        path === "index.html",
    )
  ) {
    signals.push("Route or browser entrypoint files are present.");
    references.push(fileInventoryReference);
  }

  return createScoredCandidate("web-app", signals, references);
}

function scoreCli(
  input: ProjectArchetypeSignalInput,
  pathSummary: PathSummary,
): ScoredCandidate {
  const signals: string[] = [];
  const references: EvidenceReference[] = [];
  const packageJson = packageJsonManifest(input);

  if (packageJson?.bin === true) {
    signals.push("Package manifest declares executable bin entries.");
    references.push(referenceForManifest(packageJson));
  }

  if (
    packageJson !== undefined &&
    hasAnyDependency(packageJson, ["commander", "yargs", "cac", "oclif"])
  ) {
    signals.push(
      "Package manifest includes command-line framework dependencies.",
    );
    references.push(referenceForManifest(packageJson));
  }

  if (
    pathSummary.normalizedPaths.some(
      (path) => path.startsWith("bin/") || path.includes("/commands/"),
    )
  ) {
    signals.push("Command entrypoint paths are present.");
    references.push(fileInventoryReference);
  }

  return createScoredCandidate("cli", signals, references);
}

function scoreInfrastructureModule(
  input: ProjectArchetypeSignalInput,
  pathSummary: PathSummary,
): ScoredCandidate {
  const signals: string[] = [];
  const references: EvidenceReference[] = [];

  if (hasManifest(input, "terraform")) {
    signals.push("Terraform manifest signal is present.");
    references.push(...referencesForKind(input, "terraform"));
  }

  if (
    pathSummary.normalizedPaths.some(
      (path) =>
        path.endsWith(".tf") ||
        path.startsWith("terraform/") ||
        path.startsWith("modules/") ||
        path.startsWith("charts/") ||
        path.startsWith("k8s/"),
    )
  ) {
    signals.push("Infrastructure-as-code paths are present.");
    references.push(fileInventoryReference);
  }

  return createScoredCandidate("infrastructure", signals, references);
}

function scoreDocsHeavy(
  input: ProjectArchetypeSignalInput,
  pathSummary: PathSummary,
): ScoredCandidate {
  const signals: string[] = [];
  const references: EvidenceReference[] = [];

  if (hasManifest(input, "docs-config")) {
    signals.push("Documentation site configuration is present.");
    references.push(...referencesForKind(input, "docs-config"));
  }

  if (
    pathSummary.documentationFileCount >= 3 &&
    pathSummary.documentationFileCount > pathSummary.sourceFileCount
  ) {
    signals.push("Documentation files outnumber source files.");
    references.push(fileInventoryReference);
  }

  return createScoredCandidate("docs-heavy", signals, references);
}

function scoreLibrary(
  input: ProjectArchetypeSignalInput,
  pathSummary: PathSummary,
): ScoredCandidate {
  const signals: string[] = [];
  const references: EvidenceReference[] = [];
  const packageJson = packageJsonManifest(input);

  if (
    packageJson?.main !== undefined ||
    packageJson?.module !== undefined ||
    packageJson?.types !== undefined ||
    packageJson?.exports === true
  ) {
    signals.push("Package manifest declares reusable package entrypoints.");
    references.push(referenceForManifest(packageJson));
  }

  if (
    pathSummary.sourceFileCount > 0 &&
    pathSummary.normalizedPaths.some((path) => path.startsWith("src/"))
  ) {
    signals.push("Source module paths are present.");
    references.push(fileInventoryReference);
  }

  if (packageJson?.private === false) {
    signals.push("Package manifest is publishable.");
    references.push(referenceForManifest(packageJson));
  }

  return createScoredCandidate("library", signals, references);
}

function summarizePaths(filePaths: readonly string[]): PathSummary {
  const normalizedPaths = filePaths.map(normalizePath);

  return {
    normalizedPaths,
    documentationFileCount: normalizedPaths.filter(isDocumentationPath).length,
    sourceFileCount: normalizedPaths.filter(isSourcePath).length,
  };
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase();
}

function isDocumentationPath(path: string): boolean {
  return (
    path === "readme.md" ||
    path.startsWith("docs/") ||
    path.endsWith(".md") ||
    path.endsWith(".mdx") ||
    path === "mkdocs.yml" ||
    path.startsWith("website/docs/")
  );
}

function isSourcePath(path: string): boolean {
  return (
    path.startsWith("src/") &&
    (path.endsWith(".ts") ||
      path.endsWith(".tsx") ||
      path.endsWith(".js") ||
      path.endsWith(".jsx") ||
      path.endsWith(".py") ||
      path.endsWith(".go") ||
      path.endsWith(".rs"))
  );
}

function packageJsonManifest(
  input: ProjectArchetypeSignalInput,
): PackageJsonManifestSignal | undefined {
  return input.manifests.find((manifest) => manifest.kind === "package-json");
}

function hasManifest(
  input: ProjectArchetypeSignalInput,
  kind: ProjectArchetypeManifestSignal["kind"],
): boolean {
  return input.manifests.some((manifest) => manifest.kind === kind);
}

function referencesForKind(
  input: ProjectArchetypeSignalInput,
  kind: ProjectArchetypeManifestSignal["kind"],
): readonly EvidenceReference[] {
  return input.manifests
    .filter((manifest) => manifest.kind === kind)
    .map(referenceForManifest);
}

function referenceForManifest(
  manifest: ProjectArchetypeManifestSignal,
): EvidenceReference {
  return {
    id: `archetype-signal:${manifest.kind}`,
    kind: "file",
    label: labelForManifest(manifest),
    path: manifest.path,
  };
}

function labelForManifest(manifest: ProjectArchetypeManifestSignal): string {
  switch (manifest.kind) {
    case "package-json":
      return "Package manifest";
    case "terraform":
      return "Terraform manifest";
    case "docs-config":
      return "Documentation configuration";
    case "openapi-generator":
      return "OpenAPI generator metadata";
  }
}

function hasAnyDependency(
  manifest: PackageJsonManifestSignal,
  dependencyNames: readonly string[],
): boolean {
  const dependencies = new Set([
    ...(manifest.dependencies ?? []),
    ...(manifest.devDependencies ?? []),
  ]);

  return dependencyNames.some((dependencyName) =>
    dependencies.has(dependencyName),
  );
}

function hasAnyScriptCommand(
  manifest: PackageJsonManifestSignal,
  commands: readonly string[],
): boolean {
  return Object.values(manifest.scripts ?? {}).some((script) =>
    commands.some((command) => script.includes(command)),
  );
}

function createScoredCandidate(
  archetype: Exclude<DetectedProjectArchetype, "unknown">,
  signals: readonly string[],
  references: readonly EvidenceReference[],
): ScoredCandidate {
  const uniqueReferences = uniqueEvidenceReferences(references);

  return {
    archetype,
    score: Math.min(1, signals.length * 0.35),
    evidenceReferences:
      uniqueReferences.length > 0 ? uniqueReferences : [fileInventoryReference],
    matchedSignals: signals,
  };
}

function isMeaningfulCandidate(candidate: ScoredCandidate): boolean {
  return candidate.score >= 0.35;
}

function compareCandidates(
  first: ScoredCandidate,
  second: ScoredCandidate,
): number {
  return second.score - first.score;
}

function keepPlausibleCandidates(
  candidates: readonly ScoredCandidate[],
): readonly ScoredCandidate[] {
  const highestScore = candidates[0]?.score ?? 0;

  return candidates.filter(
    (candidate) =>
      candidate.score >= 0.55 || candidate.score >= highestScore - 0.25,
  );
}

function toProjectArchetypeCandidate(
  candidate: ScoredCandidate,
): ProjectArchetypeCandidate {
  return {
    archetype: candidate.archetype,
    confidence: confidenceForScore(candidate.score, candidate.matchedSignals),
    evidenceReferences: candidate.evidenceReferences,
    matchedSignals: candidate.matchedSignals,
  };
}

function confidenceForScore(
  score: number,
  matchedSignals: readonly string[],
): Confidence {
  return {
    level: score >= 0.7 ? "high" : "medium",
    score,
    rationale: matchedSignals.join(" "),
  };
}

function createUnknownCandidate(): ProjectArchetypeCandidate {
  return {
    archetype: "unknown",
    confidence: {
      level: "low",
      score: 0.2,
      rationale: "No strong project archetype signals were detected.",
    },
    evidenceReferences: [fileInventoryReference],
    matchedSignals: ["No strong project archetype signals were detected."],
  };
}

function uniqueEvidenceReferences(
  references: readonly EvidenceReference[],
): readonly EvidenceReference[] {
  const seenReferenceIds = new Set<string>();
  const uniqueReferences: EvidenceReference[] = [];

  for (const reference of references) {
    if (!seenReferenceIds.has(reference.id)) {
      seenReferenceIds.add(reference.id);
      uniqueReferences.push(reference);
    }
  }

  return uniqueReferences;
}
