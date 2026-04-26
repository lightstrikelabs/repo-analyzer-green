import {
  collectFileInventory,
  type FileInventoryOptions,
  type FileInventory,
  type InventoryOmission,
} from "../../domain/evidence/file-inventory";
import {
  collectLanguageCodeShapeMetrics,
  type LanguageCodeShapeFileSnapshot,
  type LanguageCodeShapeMetricResult,
} from "../../domain/evidence/language-code-shape-metrics";
import {
  parseManifestWorkflowSignals,
  type DependencySignal,
  type ManifestWorkflowSignalResult,
  type PackageScriptSignal,
} from "../../domain/evidence/manifest-workflow-signals";
import {
  detectProjectArchetypeSignals,
  type ProjectArchetypeManifestSignal,
  type ProjectArchetypeSignalResult,
} from "../../domain/evidence/project-archetype-signals";
import {
  detectSecurityHygieneSignals,
  type SecurityHygieneSignalResult,
} from "../../domain/evidence/security-hygiene-signals";
import {
  ReportCardSchema,
  ReportCardSchemaVersion,
  type ReportCard,
  type RepositoryIdentity,
} from "../../domain/report/report-card";
import type { RepositoryFileContent } from "../../domain/repository/repository-source";
import type {
  RepositoryReference,
  RepositorySource,
} from "../../domain/repository/repository-source";
import type {
  MalformedReviewerResponse,
  Reviewer,
} from "../../domain/reviewer/reviewer";
import type { ReviewerAssessment } from "../../domain/reviewer/reviewer-assessment";
import { scoreRepositoryQuality } from "../../domain/scoring/scoring-policy";
import type { EvidenceReference } from "../../domain/shared/evidence-reference";

export type AnalyzeRepositoryInput = {
  readonly repository: RepositoryReference;
};

export type AnalyzeRepositoryDependencies = {
  readonly repositorySource: RepositorySource;
  readonly reviewer: Reviewer;
  readonly now?: () => Date;
  readonly createReportId?: (repository: RepositoryIdentity) => string;
  readonly evidenceCollector?: RepositoryEvidenceCollector;
  readonly fileInventoryOptions?: FileInventoryOptions;
};

export type RepositoryEvidenceCollector = (
  input: CollectRepositoryEvidenceInput,
) => Promise<RepositoryEvidenceBundle>;

export type CollectRepositoryEvidenceInput = {
  readonly repository: RepositoryReference;
  readonly repositorySource: RepositorySource;
  readonly options?: {
    readonly fileInventoryOptions?: FileInventoryOptions;
  };
};

export type RepositoryEvidenceBundle = {
  readonly repository: RepositoryIdentity;
  readonly fileInventory: FileInventory;
  readonly manifestWorkflowSignals: ManifestWorkflowSignalResult;
  readonly projectArchetypeSignals: ProjectArchetypeSignalResult;
  readonly languageCodeShapeMetrics: LanguageCodeShapeMetricResult;
  readonly securityHygieneSignals: SecurityHygieneSignalResult;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly evidenceSummary: string;
};

export type AnalyzeRepositoryReportCardResult = {
  readonly kind: "report-card";
  readonly reportCard: ReportCard;
  readonly evidenceBundle: RepositoryEvidenceBundle;
  readonly reviewerAssessment: ReviewerAssessment;
};

export type AnalyzeRepositoryMalformedReviewerResult = {
  readonly kind: "reviewer-malformed-response";
  readonly evidenceBundle: RepositoryEvidenceBundle;
  readonly reviewer: MalformedReviewerResponse["reviewer"];
  readonly rawResponse: string;
  readonly validationIssues: MalformedReviewerResponse["validationIssues"];
};

export type AnalyzeRepositoryResult =
  | AnalyzeRepositoryReportCardResult
  | AnalyzeRepositoryMalformedReviewerResult;

const scoringPolicyMetadata = {
  name: "repo-analyzer-green scoring policy",
  version: "0.1.0",
} as const;

export async function analyzeRepository(
  input: AnalyzeRepositoryInput,
  dependencies: AnalyzeRepositoryDependencies,
): Promise<AnalyzeRepositoryResult> {
  const evidenceCollector =
    dependencies.evidenceCollector ?? collectRepositoryEvidence;
  const evidenceBundle = await evidenceCollector({
    repository: input.repository,
    repositorySource: dependencies.repositorySource,
    options: {
      fileInventoryOptions: dependencies.fileInventoryOptions,
    },
  });
  const reviewerResult = await dependencies.reviewer.assess({
    repository: evidenceBundle.repository,
    evidenceReferences: evidenceBundle.evidenceReferences,
    evidenceSummary: evidenceBundle.evidenceSummary,
  });

  if (reviewerResult.kind === "malformed-response") {
    return {
      kind: "reviewer-malformed-response",
      evidenceBundle,
      reviewer: reviewerResult.reviewer,
      rawResponse: reviewerResult.rawResponse,
      validationIssues: reviewerResult.validationIssues,
    };
  }

  const reportInput = scoreRepositoryQuality({
    repository: evidenceBundle.repository,
    evidenceReferences: evidenceBundle.evidenceReferences,
    reviewerAssessment: reviewerResult.assessment,
  });
  const now = dependencies.now ?? (() => new Date());
  const reportCard = ReportCardSchema.parse({
    ...reportInput,
    id:
      dependencies.createReportId?.(evidenceBundle.repository) ??
      defaultReportId(evidenceBundle.repository),
    schemaVersion: ReportCardSchemaVersion,
    generatedAt: now().toISOString(),
    scoringPolicy: scoringPolicyMetadata,
  });

  return {
    kind: "report-card",
    reportCard,
    evidenceBundle,
    reviewerAssessment: reviewerResult.assessment,
  };
}

export async function collectRepositoryEvidence(
  input: CollectRepositoryEvidenceInput,
): Promise<RepositoryEvidenceBundle> {
  const repository = toRepositoryIdentity(input.repository);
  const fileInventory = await collectFileInventory(
    input.repository,
    input.repositorySource,
    input.options?.fileInventoryOptions,
  );
  const textFiles = await readInventoryTextFiles(
    input.repository,
    input.repositorySource,
    fileInventory,
  );
  const manifestWorkflowSignals = parseManifestWorkflowSignals({
    files: textFiles
      .filter((file) => isManifestOrWorkflowFile(file.path))
      .map((file) => ({
        path: file.path,
        text: file.text,
      })),
  });
  const projectArchetypeSignals = detectProjectArchetypeSignals({
    filePaths: fileInventory.files.map((file) => file.path),
    manifests: projectArchetypeManifestsFrom(manifestWorkflowSignals),
  });
  const languageCodeShapeMetrics = collectLanguageCodeShapeMetrics({
    files: [
      ...textFiles.map(toLanguageTextSnapshot),
      ...fileInventory.omissions.map(toLanguageSkippedSnapshot),
    ],
  });
  const securityHygieneSignals = detectSecurityHygieneSignals({
    files: textFiles.map((file) => ({
      path: file.path,
      text: file.text,
    })),
    dependencySignals: manifestWorkflowSignals.dependencySignals,
  });
  const evidenceReferences = evidenceReferencesFor({
    fileInventory,
    manifestWorkflowSignals,
    projectArchetypeSignals,
    languageCodeShapeMetrics,
    securityHygieneSignals,
  });

  return {
    repository,
    fileInventory,
    manifestWorkflowSignals,
    projectArchetypeSignals,
    languageCodeShapeMetrics,
    securityHygieneSignals,
    evidenceReferences,
    evidenceSummary: evidenceSummaryFor({
      fileInventory,
      manifestWorkflowSignals,
      projectArchetypeSignals,
      languageCodeShapeMetrics,
      securityHygieneSignals,
    }),
  };
}

function toRepositoryIdentity(
  repository: RepositoryReference,
): RepositoryIdentity {
  return {
    provider: repository.provider,
    name: repository.name,
    ...(repository.owner === undefined ? {} : { owner: repository.owner }),
    ...(repository.url === undefined ? {} : { url: repository.url }),
    ...(repository.revision === undefined
      ? {}
      : { revision: repository.revision }),
  };
}

async function readInventoryTextFiles(
  repository: RepositoryReference,
  source: RepositorySource,
  inventory: FileInventory,
): Promise<readonly RepositoryFileContent[]> {
  return Promise.all(
    inventory.files.map((file) => source.readFile(repository, file.path)),
  );
}

function isManifestOrWorkflowFile(filePath: string): boolean {
  const basename = basenameForPath(filePath);

  return (
    basename === "package.json" ||
    basename === "Cargo.toml" ||
    basename === "Gemfile" ||
    basename === "go.mod" ||
    basename === "pom.xml" ||
    basename === "pyproject.toml" ||
    basename === "requirements.txt" ||
    basename === "composer.json" ||
    filePath.startsWith(".github/workflows/")
  );
}

function projectArchetypeManifestsFrom(
  signals: ManifestWorkflowSignalResult,
): readonly ProjectArchetypeManifestSignal[] {
  return signals.packageManifests.map((manifest) => ({
    kind: "package-json" as const,
    path: manifest.path,
    ...(manifest.name === undefined ? {} : { name: manifest.name }),
    ...(manifest.private === undefined ? {} : { private: manifest.private }),
    ...(scriptsByPath(manifest.path, signals.scriptSignals).length === 0
      ? {}
      : { scripts: scriptRecordFor(manifest.path, signals.scriptSignals) }),
    dependencies: dependencyNamesFor(
      manifest.path,
      signals.dependencySignals,
      "production",
    ),
    devDependencies: dependencyNamesFor(
      manifest.path,
      signals.dependencySignals,
      "development",
    ),
    ...(manifest.main === undefined ? {} : { main: manifest.main }),
    ...(manifest.module === undefined ? {} : { module: manifest.module }),
    ...(manifest.types === undefined ? {} : { types: manifest.types }),
    ...(manifest.exports === undefined ? {} : { exports: manifest.exports }),
    ...(manifest.bin === undefined ? {} : { bin: manifest.bin }),
  }));
}

function scriptsByPath(
  path: string,
  scripts: readonly PackageScriptSignal[],
): readonly PackageScriptSignal[] {
  return scripts.filter((script) => script.path === path);
}

function scriptRecordFor(
  path: string,
  scripts: readonly PackageScriptSignal[],
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    scriptsByPath(path, scripts).map((script) => [script.name, script.command]),
  );
}

function dependencyNamesFor(
  path: string,
  dependencies: readonly DependencySignal[],
  relationship: DependencySignal["relationship"],
): readonly string[] {
  return dependencies
    .filter(
      (dependency) =>
        dependency.path === path && dependency.relationship === relationship,
    )
    .map((dependency) => dependency.name)
    .sort(compareStrings);
}

function toLanguageTextSnapshot(
  file: RepositoryFileContent,
): LanguageCodeShapeFileSnapshot {
  return {
    path: file.path,
    sizeBytes: file.sizeBytes,
    text: file.text,
  };
}

function toLanguageSkippedSnapshot(
  omission: InventoryOmission,
): LanguageCodeShapeFileSnapshot {
  return {
    path: omission.path,
    sizeBytes: omission.sizeBytes,
    skippedReason: omission.reason,
    detail: omission.detail,
  };
}

function evidenceReferencesFor(input: {
  readonly fileInventory: FileInventory;
  readonly manifestWorkflowSignals: ManifestWorkflowSignalResult;
  readonly projectArchetypeSignals: ProjectArchetypeSignalResult;
  readonly languageCodeShapeMetrics: LanguageCodeShapeMetricResult;
  readonly securityHygieneSignals: SecurityHygieneSignalResult;
}): readonly EvidenceReference[] {
  return dedupeEvidenceReferences([
    ...input.fileInventory.files.map((file) =>
      fileReference(file.path, "Inventory file"),
    ),
    ...input.fileInventory.omissions.map((omission) =>
      fileReference(omission.path, "Inventory omission"),
    ),
    ...input.manifestWorkflowSignals.packageManifests.flatMap(
      (signal) => signal.evidenceReferences,
    ),
    ...input.manifestWorkflowSignals.dependencySignals.flatMap(
      (signal) => signal.evidenceReferences,
    ),
    ...input.manifestWorkflowSignals.scriptSignals.flatMap(
      (signal) => signal.evidenceReferences,
    ),
    ...input.manifestWorkflowSignals.workflowSignals.flatMap(
      (signal) => signal.evidenceReferences,
    ),
    ...input.manifestWorkflowSignals.unsupportedManifests.flatMap(
      (signal) => signal.evidenceReferences,
    ),
    ...input.manifestWorkflowSignals.omissions.flatMap(
      (omission) => omission.evidenceReferences,
    ),
    ...input.projectArchetypeSignals.candidates.flatMap(
      (candidate) => candidate.evidenceReferences,
    ),
    ...input.languageCodeShapeMetrics.languageMix.flatMap(
      (metric) => metric.evidenceReferences,
    ),
    ...input.languageCodeShapeMetrics.files.flatMap(
      (metric) => metric.evidenceReferences,
    ),
    ...input.languageCodeShapeMetrics.deferredWorkMarkers.flatMap(
      (marker) => marker.evidenceReferences,
    ),
    ...input.languageCodeShapeMetrics.branchLikeTokens.flatMap(
      (token) => token.evidenceReferences,
    ),
    ...input.languageCodeShapeMetrics.largeFiles.flatMap(
      (file) => file.evidenceReferences,
    ),
    ...input.languageCodeShapeMetrics.omissions.flatMap(
      (omission) => omission.evidenceReferences,
    ),
    ...input.languageCodeShapeMetrics.caveats.flatMap(
      (caveat) => caveat.evidenceReferences,
    ),
    ...input.securityHygieneSignals.lockfileSignals.flatMap(
      (signal) => signal.evidenceReferences,
    ),
    ...input.securityHygieneSignals.dependencyCountSignals.flatMap(
      (signal) => signal.evidenceReferences,
    ),
    ...input.securityHygieneSignals.envExampleSignals.flatMap(
      (signal) => signal.evidenceReferences,
    ),
    ...input.securityHygieneSignals.secretRiskSignals.flatMap(
      (signal) => signal.evidenceReferences,
    ),
    ...input.securityHygieneSignals.limitations.flatMap(
      (limitation) => limitation.evidenceReferences,
    ),
  ]);
}

function evidenceSummaryFor(input: {
  readonly fileInventory: FileInventory;
  readonly manifestWorkflowSignals: ManifestWorkflowSignalResult;
  readonly projectArchetypeSignals: ProjectArchetypeSignalResult;
  readonly languageCodeShapeMetrics: LanguageCodeShapeMetricResult;
  readonly securityHygieneSignals: SecurityHygieneSignalResult;
}): string {
  return [
    `Files analyzed: ${input.fileInventory.files.length}`,
    `Files omitted: ${input.fileInventory.omissions.length}`,
    `Primary archetype signal: ${input.projectArchetypeSignals.primaryArchetype}`,
    `Package manifests: ${input.manifestWorkflowSignals.packageManifests.length}`,
    `Workflow files: ${input.manifestWorkflowSignals.workflowSignals.length}`,
    `Source files: ${input.languageCodeShapeMetrics.summary.sourceFileCount}`,
    `Test files: ${input.languageCodeShapeMetrics.summary.testFileCount}`,
    `Security hygiene signals: ${securitySignalCount(input.securityHygieneSignals)}`,
  ].join("\n");
}

function securitySignalCount(signals: SecurityHygieneSignalResult): number {
  return (
    signals.lockfileSignals.length +
    signals.dependencyCountSignals.length +
    signals.envExampleSignals.length +
    signals.secretRiskSignals.length
  );
}

function fileReference(path: string, label: string): EvidenceReference {
  return {
    id: `application:evidence:file:${path}`,
    kind: "file",
    label,
    path,
  };
}

function dedupeEvidenceReferences(
  references: readonly EvidenceReference[],
): readonly EvidenceReference[] {
  return [
    ...new Map(
      references.map((reference) => [reference.id, reference]),
    ).values(),
  ].sort(compareEvidenceReferences);
}

function defaultReportId(repository: RepositoryIdentity): string {
  return `report:${repository.provider}:${repository.owner ?? "unknown"}:${repository.name}:${repository.revision ?? "current"}`
    .replace(/[^a-z0-9:._-]/giu, "-")
    .slice(0, 180);
}

function basenameForPath(path: string): string {
  const slashIndex = path.lastIndexOf("/");

  if (slashIndex === -1) {
    return path;
  }

  return path.slice(slashIndex + 1);
}

function compareEvidenceReferences(
  left: EvidenceReference,
  right: EvidenceReference,
): number {
  return compareStrings(left.id, right.id);
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
