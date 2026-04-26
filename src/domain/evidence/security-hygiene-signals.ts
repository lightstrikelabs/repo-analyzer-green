import type {
  DependencyRelationship,
  DependencySignal,
} from "./manifest-workflow-signals";
import type { Confidence } from "../shared/confidence";
import type { EvidenceReference } from "../shared/evidence-reference";

export type SecurityHygieneFileSnapshot = {
  readonly path: string;
  readonly text?: string;
};

export type SecurityHygieneSignalInput = {
  readonly files: readonly SecurityHygieneFileSnapshot[];
  readonly dependencySignals?: readonly DependencySignal[];
  readonly maxTextScanBytes?: number;
};

export type SecuritySignalCategory = "hygiene" | "risk";

export type HumanReviewDisposition = {
  readonly required: true;
  readonly label: "hygiene/risk signal requiring human review";
  readonly rationale: string;
};

export type LockfileSecurityHygieneSignal = {
  readonly kind: "lockfile";
  readonly category: "hygiene";
  readonly path: string;
  readonly ecosystem: LockfileEcosystem;
  readonly packageManager: string;
  readonly confidence: Confidence;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly reviewDisposition: HumanReviewDisposition;
};

export type DependencyCountByRelationship = Readonly<
  Record<DependencyRelationship, number>
>;

export type PackageDependencyCountSecurityHygieneSignal = {
  readonly kind: "package-dependency-count";
  readonly category: "hygiene";
  readonly path: string;
  readonly totalDependencies: number;
  readonly byRelationship: DependencyCountByRelationship;
  readonly confidence: Confidence;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly reviewDisposition: HumanReviewDisposition;
};

export type EnvExampleSecurityHygieneSignal = {
  readonly kind: "env-example";
  readonly category: "hygiene";
  readonly path: string;
  readonly confidence: Confidence;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly reviewDisposition: HumanReviewDisposition;
};

export type SecretRiskSecurityHygieneSignal = {
  readonly kind: "secret-risk-path" | "secret-risk-content";
  readonly category: "risk";
  readonly path: string;
  readonly reason: string;
  readonly matchedPattern?: SecretRiskMatchedPattern;
  readonly lineStart?: number;
  readonly lineEnd?: number;
  readonly confidence: Confidence;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly reviewDisposition: HumanReviewDisposition;
};

export type SecurityHygieneLimitationKind =
  | "bounded-content-scan"
  | "content-unavailable"
  | "human-review-required"
  | "manifest-data-unavailable";

export type SecurityHygieneLimitation = {
  readonly kind: SecurityHygieneLimitationKind;
  readonly detail: string;
  readonly path?: string;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type SecurityHygieneSignalResult = {
  readonly lockfileSignals: readonly LockfileSecurityHygieneSignal[];
  readonly dependencyCountSignals: readonly PackageDependencyCountSecurityHygieneSignal[];
  readonly envExampleSignals: readonly EnvExampleSecurityHygieneSignal[];
  readonly secretRiskSignals: readonly SecretRiskSecurityHygieneSignal[];
  readonly limitations: readonly SecurityHygieneLimitation[];
};

type LockfileEcosystem =
  | "dotnet"
  | "go"
  | "java"
  | "javascript"
  | "php"
  | "python"
  | "ruby"
  | "rust"
  | "unknown";

type LockfileDefinition = {
  readonly ecosystem: LockfileEcosystem;
  readonly packageManager: string;
};

type SecretRiskMatchedPattern =
  | "aws-access-key-id"
  | "credential-assignment"
  | "private-key-block";

type SecretRiskPathHint = {
  readonly reason: string;
};

type DependencyCountAccumulator = {
  readonly path: string;
  readonly byRelationship: Record<DependencyRelationship, number>;
  readonly evidenceReferences: EvidenceReference[];
};

type ContentRiskMatch = {
  readonly matchedPattern: SecretRiskMatchedPattern;
  readonly lineNumber: number;
  readonly reason: string;
};

const defaultMaxTextScanBytes = 8 * 1024;

const dependencyRelationships: readonly DependencyRelationship[] = [
  "production",
  "development",
  "peer",
  "optional",
];

const lockfileDefinitions = new Map<string, LockfileDefinition>([
  ["bun.lock", { ecosystem: "javascript", packageManager: "bun" }],
  ["bun.lockb", { ecosystem: "javascript", packageManager: "bun" }],
  ["Cargo.lock", { ecosystem: "rust", packageManager: "cargo" }],
  ["composer.lock", { ecosystem: "php", packageManager: "composer" }],
  ["Gemfile.lock", { ecosystem: "ruby", packageManager: "bundler" }],
  ["go.sum", { ecosystem: "go", packageManager: "go modules" }],
  ["gradle.lockfile", { ecosystem: "java", packageManager: "gradle" }],
  ["mix.lock", { ecosystem: "unknown", packageManager: "mix" }],
  ["npm-shrinkwrap.json", { ecosystem: "javascript", packageManager: "npm" }],
  ["package-lock.json", { ecosystem: "javascript", packageManager: "npm" }],
  ["packages.lock.json", { ecosystem: "dotnet", packageManager: "nuget" }],
  ["Pipfile.lock", { ecosystem: "python", packageManager: "pipenv" }],
  ["pnpm-lock.yaml", { ecosystem: "javascript", packageManager: "pnpm" }],
  ["poetry.lock", { ecosystem: "python", packageManager: "poetry" }],
  ["pubspec.lock", { ecosystem: "unknown", packageManager: "pub" }],
  ["uv.lock", { ecosystem: "python", packageManager: "uv" }],
  ["yarn.lock", { ecosystem: "javascript", packageManager: "yarn" }],
]);

const credentialAssignmentPattern =
  /^\s*(?:export\s+)?([A-Z0-9_]*(?:API_KEY|ACCESS_KEY|CLIENT_SECRET|PASSWORD|PASSWD|PRIVATE_KEY|SECRET|TOKEN)[A-Z0-9_]*)\s*[:=]\s*["']?([^"'\s#]+)["']?/iu;
const awsAccessKeyIdPattern = /\bAKIA[0-9A-Z]{16}\b/u;
const privateKeyBlockPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----/u;

const reviewDisposition: HumanReviewDisposition = {
  required: true,
  label: "hygiene/risk signal requiring human review",
  rationale:
    "This is a security hygiene or risk indicator, not a verified security finding.",
};

const humanReviewLimitation: SecurityHygieneLimitation = {
  kind: "human-review-required",
  detail:
    "Security hygiene and possible secret-risk signals are indicators that require human review before drawing conclusions.",
  evidenceReferences: [
    {
      id: "security-hygiene:collector",
      kind: "collector",
      label: "Security hygiene signal collector",
    },
  ],
};

export function detectSecurityHygieneSignals(
  input: SecurityHygieneSignalInput,
): SecurityHygieneSignalResult {
  const maxTextScanBytes =
    input.maxTextScanBytes !== undefined
      ? Math.max(0, input.maxTextScanBytes)
      : defaultMaxTextScanBytes;
  const files = [...input.files].sort(compareFilesByPath);
  const lockfileSignals: LockfileSecurityHygieneSignal[] = [];
  const envExampleSignals: EnvExampleSecurityHygieneSignal[] = [];
  const secretRiskSignals: SecretRiskSecurityHygieneSignal[] = [];
  const limitations: SecurityHygieneLimitation[] = [humanReviewLimitation];

  for (const file of files) {
    const lockfileDefinition = lockfileDefinitionForPath(file.path);
    if (lockfileDefinition !== undefined) {
      lockfileSignals.push(lockfileSignal(file.path, lockfileDefinition));
    }

    if (isEnvExamplePath(file.path)) {
      envExampleSignals.push(envExampleSignal(file.path));
    }

    const pathRiskHint = secretRiskPathHint(file.path);
    if (pathRiskHint !== undefined) {
      secretRiskSignals.push(secretRiskPathSignal(file.path, pathRiskHint));
    }

    if (file.text === undefined) {
      if (pathRiskHint !== undefined) {
        limitations.push(contentUnavailableLimitation(file.path));
      }
      continue;
    }

    if (file.text.length > maxTextScanBytes) {
      limitations.push(
        boundedContentScanLimitation(file.path, maxTextScanBytes),
      );
    }

    const scannedText = file.text.slice(0, maxTextScanBytes);
    secretRiskSignals.push(
      ...contentRiskMatches(scannedText).map((match) =>
        secretRiskContentSignal(file.path, match),
      ),
    );
  }

  const dependencyCountSignals = dependencyCountSignalsForInput(
    input.dependencySignals ?? [],
    limitations,
  );

  return {
    lockfileSignals,
    dependencyCountSignals,
    envExampleSignals,
    secretRiskSignals,
    limitations: dedupeLimitations(limitations),
  };
}

function lockfileDefinitionForPath(
  filePath: string,
): LockfileDefinition | undefined {
  return lockfileDefinitions.get(basenameForPath(filePath));
}

function lockfileSignal(
  filePath: string,
  definition: LockfileDefinition,
): LockfileSecurityHygieneSignal {
  return {
    kind: "lockfile",
    category: "hygiene",
    path: filePath,
    ecosystem: definition.ecosystem,
    packageManager: definition.packageManager,
    confidence: {
      level: "high",
      score: 0.95,
      rationale:
        "A recognized dependency lockfile path is direct hygiene evidence, but it still requires human review for freshness and coverage.",
    },
    evidenceReferences: [fileReference(filePath, "lockfile", "Lockfile")],
    reviewDisposition,
  };
}

function envExampleSignal(filePath: string): EnvExampleSecurityHygieneSignal {
  return {
    kind: "env-example",
    category: "hygiene",
    path: filePath,
    confidence: {
      level: "high",
      score: 0.9,
      rationale:
        "An environment example or sample file is direct setup hygiene evidence, but its completeness requires human review.",
    },
    evidenceReferences: [
      fileReference(filePath, "env-example", "Environment example file"),
    ],
    reviewDisposition,
  };
}

function secretRiskPathSignal(
  filePath: string,
  hint: SecretRiskPathHint,
): SecretRiskSecurityHygieneSignal {
  return {
    kind: "secret-risk-path",
    category: "risk",
    path: filePath,
    reason: hint.reason,
    confidence: {
      level: "medium",
      score: 0.68,
      rationale:
        "The file path matches a common secret-risk convention and requires human review to determine whether sensitive material is present.",
    },
    evidenceReferences: [
      fileReference(filePath, "secret-risk-path", "Possible secret-risk path"),
    ],
    reviewDisposition,
  };
}

function secretRiskContentSignal(
  filePath: string,
  match: ContentRiskMatch,
): SecretRiskSecurityHygieneSignal {
  return {
    kind: "secret-risk-content",
    category: "risk",
    path: filePath,
    reason: match.reason,
    matchedPattern: match.matchedPattern,
    lineStart: match.lineNumber,
    lineEnd: match.lineNumber,
    confidence: {
      level: "medium",
      score: 0.74,
      rationale:
        "A bounded content scan matched credential-like text without exposing the value; this requires human review.",
    },
    evidenceReferences: [
      {
        ...fileReference(
          filePath,
          `secret-risk-content:${match.matchedPattern}`,
          "Possible secret-risk content",
        ),
        lineStart: match.lineNumber,
        lineEnd: match.lineNumber,
      },
    ],
    reviewDisposition,
  };
}

function dependencyCountSignalsForInput(
  dependencySignals: readonly DependencySignal[],
  limitations: SecurityHygieneLimitation[],
): readonly PackageDependencyCountSecurityHygieneSignal[] {
  if (dependencySignals.length === 0) {
    limitations.push({
      kind: "manifest-data-unavailable",
      detail:
        "No parsed package dependency manifest data was provided, so dependency-count hygiene signals are unavailable.",
      evidenceReferences: [
        {
          id: "security-hygiene:dependency-counts",
          kind: "collector",
          label: "Dependency count inputs",
        },
      ],
    });
    return [];
  }

  const byPath = new Map<string, DependencyCountAccumulator>();

  for (const dependencySignal of dependencySignals) {
    const existing = byPath.get(dependencySignal.path);
    const accumulator = existing ?? {
      path: dependencySignal.path,
      byRelationship: emptyDependencyCounts(),
      evidenceReferences: [],
    };

    accumulator.byRelationship[dependencySignal.relationship] += 1;
    accumulator.evidenceReferences.push(
      ...referencesForDependencySignal(dependencySignal),
    );
    byPath.set(dependencySignal.path, accumulator);
  }

  return [...byPath.values()]
    .map((accumulator) => dependencyCountSignal(accumulator))
    .sort(compareDependencyCountSignals);
}

function dependencyCountSignal(
  accumulator: DependencyCountAccumulator,
): PackageDependencyCountSecurityHygieneSignal {
  const totalDependencies = dependencyRelationships.reduce(
    (sum, relationship) => sum + accumulator.byRelationship[relationship],
    0,
  );

  return {
    kind: "package-dependency-count",
    category: "hygiene",
    path: accumulator.path,
    totalDependencies,
    byRelationship: {
      production: accumulator.byRelationship.production,
      development: accumulator.byRelationship.development,
      peer: accumulator.byRelationship.peer,
      optional: accumulator.byRelationship.optional,
    },
    confidence: {
      level: "medium",
      score: 0.82,
      rationale:
        "Counts are derived from parsed manifest dependency fields, but package risk and freshness require human review.",
    },
    evidenceReferences: uniqueEvidenceReferences(
      accumulator.evidenceReferences,
    ),
    reviewDisposition,
  };
}

function referencesForDependencySignal(
  dependencySignal: DependencySignal,
): readonly EvidenceReference[] {
  if (dependencySignal.evidenceReferences.length > 0) {
    return dependencySignal.evidenceReferences;
  }

  return [
    fileReference(
      dependencySignal.path,
      "package-dependency-count",
      "Package dependency manifest",
    ),
  ];
}

function contentRiskMatches(scannedText: string): readonly ContentRiskMatch[] {
  const matches: ContentRiskMatch[] = [];
  const lines = scannedText.split(/\r?\n/u);

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;

    if (privateKeyBlockPattern.test(line)) {
      matches.push({
        matchedPattern: "private-key-block",
        lineNumber,
        reason:
          "Bounded text scan found a private-key block marker without exposing key material.",
      });
      continue;
    }

    if (awsAccessKeyIdPattern.test(line)) {
      matches.push({
        matchedPattern: "aws-access-key-id",
        lineNumber,
        reason:
          "Bounded text scan found an AWS access-key-id-shaped token without exposing its value.",
      });
      continue;
    }

    const credentialAssignment = credentialAssignmentPattern.exec(line);
    if (
      credentialAssignment !== null &&
      credentialAssignment[2] !== undefined &&
      !isPlaceholderSecretValue(credentialAssignment[2])
    ) {
      matches.push({
        matchedPattern: "credential-assignment",
        lineNumber,
        reason:
          "Bounded text scan found a credential-like assignment without exposing its value.",
      });
    }
  }

  return matches;
}

function isPlaceholderSecretValue(value: string): boolean {
  const normalizedValue = value.trim().toLowerCase();

  return (
    normalizedValue.length === 0 ||
    normalizedValue.includes("changeme") ||
    normalizedValue.includes("change-me") ||
    normalizedValue.includes("dummy") ||
    normalizedValue.includes("example") ||
    normalizedValue.includes("placeholder") ||
    normalizedValue.includes("redacted") ||
    normalizedValue.includes("replace") ||
    normalizedValue.includes("sample") ||
    normalizedValue.includes("todo") ||
    normalizedValue.startsWith("your_") ||
    /^x+$/u.test(normalizedValue)
  );
}

function secretRiskPathHint(filePath: string): SecretRiskPathHint | undefined {
  if (isEnvExamplePath(filePath)) {
    return undefined;
  }

  const normalizedPath = normalizePath(filePath).toLowerCase();
  const basename = basenameForPath(filePath).toLowerCase();
  const extension = extensionForPath(basename);

  if (
    normalizedPath.includes("/secrets/") ||
    normalizedPath.startsWith("secrets/") ||
    basename.includes("secret") ||
    basename.includes("credential") ||
    basename.includes("service-account")
  ) {
    return {
      reason: "Secrets or credentials path may contain sensitive material.",
    };
  }

  if (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename.endsWith(".env") ||
    normalizedPath.includes("/.env.")
  ) {
    return {
      reason: "Environment file path may contain local or deployed secrets.",
    };
  }

  if (
    extension === ".key" ||
    extension === ".p12" ||
    extension === ".pem" ||
    extension === ".pfx"
  ) {
    return {
      reason: "Key or certificate file path may contain secret material.",
    };
  }

  return undefined;
}

function isEnvExamplePath(filePath: string): boolean {
  const basename = basenameForPath(filePath).toLowerCase();
  const normalizedBasename = basename.startsWith(".")
    ? basename.slice(1)
    : basename;

  return (
    normalizedBasename === "env.example" ||
    normalizedBasename === "env.sample" ||
    normalizedBasename === "env.template" ||
    normalizedBasename === "env.dist" ||
    normalizedBasename.endsWith(".env.example") ||
    normalizedBasename.endsWith(".env.sample") ||
    normalizedBasename.endsWith(".env.template") ||
    normalizedBasename.endsWith(".env.dist")
  );
}

function boundedContentScanLimitation(
  filePath: string,
  maxTextScanBytes: number,
): SecurityHygieneLimitation {
  return {
    kind: "bounded-content-scan",
    path: filePath,
    detail: `Only the first ${maxTextScanBytes} characters were scanned for secret-risk content hints.`,
    evidenceReferences: [
      fileReference(filePath, "bounded-content-scan", "Bounded content scan"),
    ],
  };
}

function contentUnavailableLimitation(
  filePath: string,
): SecurityHygieneLimitation {
  return {
    kind: "content-unavailable",
    path: filePath,
    detail:
      "File content was not provided, so only path-based secret-risk hints were detected.",
    evidenceReferences: [
      fileReference(filePath, "content-unavailable", "Content unavailable"),
    ],
  };
}

function fileReference(
  filePath: string,
  referenceKind: string,
  label: string,
): EvidenceReference {
  return {
    id: `security-hygiene:${referenceKind}:${filePath}`,
    kind: "file",
    label,
    path: filePath,
  };
}

function emptyDependencyCounts(): Record<DependencyRelationship, number> {
  return {
    production: 0,
    development: 0,
    peer: 0,
    optional: 0,
  };
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//u, "");
}

function basenameForPath(filePath: string): string {
  return normalizePath(filePath).split("/").at(-1) ?? filePath;
}

function extensionForPath(filePath: string): string {
  const extensionStart = filePath.lastIndexOf(".");

  if (extensionStart <= 0) {
    return "";
  }

  return filePath.slice(extensionStart);
}

function compareFilesByPath(
  left: SecurityHygieneFileSnapshot,
  right: SecurityHygieneFileSnapshot,
): number {
  return left.path.localeCompare(right.path);
}

function compareDependencyCountSignals(
  left: PackageDependencyCountSecurityHygieneSignal,
  right: PackageDependencyCountSecurityHygieneSignal,
): number {
  return left.path.localeCompare(right.path);
}

function uniqueEvidenceReferences(
  references: readonly EvidenceReference[],
): readonly EvidenceReference[] {
  const seenIds = new Set<string>();
  const uniqueReferences: EvidenceReference[] = [];

  for (const reference of references) {
    if (seenIds.has(reference.id)) {
      continue;
    }

    seenIds.add(reference.id);
    uniqueReferences.push(reference);
  }

  return uniqueReferences;
}

function dedupeLimitations(
  limitations: readonly SecurityHygieneLimitation[],
): readonly SecurityHygieneLimitation[] {
  const seenKeys = new Set<string>();
  const dedupedLimitations: SecurityHygieneLimitation[] = [];

  for (const limitation of limitations) {
    const key = `${limitation.kind}:${limitation.path ?? ""}:${limitation.detail}`;
    if (seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    dedupedLimitations.push(limitation);
  }

  return dedupedLimitations;
}
