import path from "node:path";

import { z } from "zod";

import type { EvidenceReference } from "../shared/evidence-reference";

export type ManifestWorkflowFileSnapshot = {
  readonly path: string;
  readonly text: string;
};

export type ManifestWorkflowSignalInput = {
  readonly files: readonly ManifestWorkflowFileSnapshot[];
};

export type PackageManifestSignal = {
  readonly kind: "package-json";
  readonly path: string;
  readonly name?: string;
  readonly private?: boolean;
  readonly packageManager?: string;
  readonly main?: string;
  readonly module?: string;
  readonly types?: string;
  readonly exports?: boolean;
  readonly bin?: boolean;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type DependencyRelationship =
  | "production"
  | "development"
  | "peer"
  | "optional";

export type DependencySignal = {
  readonly path: string;
  readonly name: string;
  readonly relationship: DependencyRelationship;
  readonly versionRange: string;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type ScriptPurpose =
  | "build"
  | "development"
  | "lint"
  | "release"
  | "test"
  | "other";

export type PackageScriptSignal = {
  readonly path: string;
  readonly name: string;
  readonly command: string;
  readonly purpose: ScriptPurpose;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type WorkflowPurpose = "ci" | "release" | "other";

export type WorkflowSignal = {
  readonly kind: "github-workflow";
  readonly path: string;
  readonly name: string;
  readonly purpose: WorkflowPurpose;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type UnsupportedManifestEcosystem =
  | "dotnet"
  | "go"
  | "java"
  | "php"
  | "python"
  | "ruby"
  | "rust";

export type UnsupportedManifestNote = {
  readonly path: string;
  readonly ecosystem: UnsupportedManifestEcosystem;
  readonly detail: string;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type ManifestWorkflowOmissionReason = "invalid-shape" | "parse-error";

export type ManifestWorkflowOmission = {
  readonly path: string;
  readonly reason: ManifestWorkflowOmissionReason;
  readonly detail: string;
  readonly evidenceReferences: readonly EvidenceReference[];
};

export type ManifestWorkflowSignalResult = {
  readonly packageManifests: readonly PackageManifestSignal[];
  readonly dependencySignals: readonly DependencySignal[];
  readonly scriptSignals: readonly PackageScriptSignal[];
  readonly workflowSignals: readonly WorkflowSignal[];
  readonly unsupportedManifests: readonly UnsupportedManifestNote[];
  readonly omissions: readonly ManifestWorkflowOmission[];
};

type DependencyField = {
  readonly key:
    | "dependencies"
    | "devDependencies"
    | "optionalDependencies"
    | "peerDependencies";
  readonly relationship: DependencyRelationship;
};

type UnsupportedManifestDefinition = {
  readonly ecosystem: UnsupportedManifestEcosystem;
  readonly detail: string;
};

const packageJsonSchema = z
  .object({
    name: z.string().min(1).optional(),
    private: z.boolean().optional(),
    packageManager: z.string().min(1).optional(),
    main: z.string().min(1).optional(),
    module: z.string().min(1).optional(),
    types: z.string().min(1).optional(),
    exports: z
      .union([z.string(), z.record(z.string(), z.unknown())])
      .optional(),
    bin: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
    scripts: z.record(z.string(), z.string()).optional(),
    dependencies: z.record(z.string(), z.string()).optional(),
    devDependencies: z.record(z.string(), z.string()).optional(),
    optionalDependencies: z.record(z.string(), z.string()).optional(),
    peerDependencies: z.record(z.string(), z.string()).optional(),
  })
  .passthrough();

type PackageJsonData = z.infer<typeof packageJsonSchema>;

const dependencyFields: readonly DependencyField[] = [
  { key: "dependencies", relationship: "production" },
  { key: "devDependencies", relationship: "development" },
  { key: "peerDependencies", relationship: "peer" },
  { key: "optionalDependencies", relationship: "optional" },
];

const relationshipRank = new Map<DependencyRelationship, number>([
  ["production", 0],
  ["development", 1],
  ["peer", 2],
  ["optional", 3],
]);

const unsupportedManifestDefinitions = new Map<
  string,
  UnsupportedManifestDefinition
>([
  [
    "Cargo.toml",
    {
      ecosystem: "rust",
      detail: "Rust package manifests are detected but not parsed yet.",
    },
  ],
  [
    "Gemfile",
    {
      ecosystem: "ruby",
      detail: "Ruby dependency manifests are detected but not parsed yet.",
    },
  ],
  [
    "go.mod",
    {
      ecosystem: "go",
      detail: "Go module manifests are detected but not parsed yet.",
    },
  ],
  [
    "pom.xml",
    {
      ecosystem: "java",
      detail: "Java Maven manifests are detected but not parsed yet.",
    },
  ],
  [
    "pyproject.toml",
    {
      ecosystem: "python",
      detail: "Python project manifests are detected but not parsed yet.",
    },
  ],
  [
    "requirements.txt",
    {
      ecosystem: "python",
      detail: "Python dependency manifests are detected but not parsed yet.",
    },
  ],
  [
    "composer.json",
    {
      ecosystem: "php",
      detail: "PHP Composer manifests are detected but not parsed yet.",
    },
  ],
]);

export function parseManifestWorkflowSignals(
  input: ManifestWorkflowSignalInput,
): ManifestWorkflowSignalResult {
  const files = [...input.files].sort(compareFilesByPath);
  const packageManifests: PackageManifestSignal[] = [];
  const dependencySignals: DependencySignal[] = [];
  const scriptSignals: PackageScriptSignal[] = [];
  const workflowSignals: WorkflowSignal[] = [];
  const unsupportedManifests: UnsupportedManifestNote[] = [];
  const omissions: ManifestWorkflowOmission[] = [];

  for (const file of files) {
    if (isPackageJsonPath(file.path)) {
      const parseResult = parsePackageJson(file);

      if (parseResult.kind === "parsed") {
        packageManifests.push(
          packageManifestSignal(file.path, parseResult.data),
        );
        dependencySignals.push(
          ...dependencySignalsForPackageJson(file.path, parseResult.data),
        );
        scriptSignals.push(
          ...scriptSignalsForPackageJson(file.path, parseResult.data),
        );
      } else {
        omissions.push(parseResult.omission);
      }

      continue;
    }

    if (isGithubWorkflowPath(file.path)) {
      workflowSignals.push(workflowSignal(file));
      continue;
    }

    const unsupportedManifest = unsupportedManifestForFile(file);
    if (unsupportedManifest !== undefined) {
      unsupportedManifests.push(unsupportedManifest);
    }
  }

  return {
    packageManifests,
    dependencySignals: dependencySignals.sort(compareDependencySignals),
    scriptSignals: scriptSignals.sort(compareScriptSignals),
    workflowSignals,
    unsupportedManifests,
    omissions,
  };
}

type PackageJsonParseResult =
  | {
      readonly kind: "parsed";
      readonly data: PackageJsonData;
    }
  | {
      readonly kind: "omitted";
      readonly omission: ManifestWorkflowOmission;
    };

function parsePackageJson(
  file: ManifestWorkflowFileSnapshot,
): PackageJsonParseResult {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(file.text);
  } catch {
    return {
      kind: "omitted",
      omission: {
        path: file.path,
        reason: "parse-error",
        detail: "Package manifest is not valid JSON.",
        evidenceReferences: [packageJsonReference(file.path)],
      },
    };
  }

  const parsedPackageJson = packageJsonSchema.safeParse(parsedJson);
  if (!parsedPackageJson.success) {
    return {
      kind: "omitted",
      omission: {
        path: file.path,
        reason: "invalid-shape",
        detail: "Package manifest fields have unsupported value shapes.",
        evidenceReferences: [packageJsonReference(file.path)],
      },
    };
  }

  return {
    kind: "parsed",
    data: parsedPackageJson.data,
  };
}

function packageManifestSignal(
  filePath: string,
  data: PackageJsonData,
): PackageManifestSignal {
  return {
    kind: "package-json",
    path: filePath,
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.private !== undefined ? { private: data.private } : {}),
    ...(data.packageManager !== undefined
      ? { packageManager: data.packageManager }
      : {}),
    ...(data.main !== undefined ? { main: data.main } : {}),
    ...(data.module !== undefined ? { module: data.module } : {}),
    ...(data.types !== undefined ? { types: data.types } : {}),
    ...(data.exports !== undefined ? { exports: true } : {}),
    ...(data.bin !== undefined ? { bin: true } : {}),
    evidenceReferences: [packageJsonReference(filePath)],
  };
}

function dependencySignalsForPackageJson(
  filePath: string,
  data: PackageJsonData,
): readonly DependencySignal[] {
  const signals: DependencySignal[] = [];

  for (const field of dependencyFields) {
    const dependencies = data[field.key];

    if (dependencies === undefined) {
      continue;
    }

    for (const [name, versionRange] of Object.entries(dependencies)) {
      signals.push({
        path: filePath,
        name,
        relationship: field.relationship,
        versionRange,
        evidenceReferences: [packageJsonReference(filePath)],
      });
    }
  }

  return signals;
}

function scriptSignalsForPackageJson(
  filePath: string,
  data: PackageJsonData,
): readonly PackageScriptSignal[] {
  return Object.entries(data.scripts ?? {}).map(([name, command]) => ({
    path: filePath,
    name,
    command,
    purpose: scriptPurpose(name, command),
    evidenceReferences: [packageJsonReference(filePath)],
  }));
}

function workflowSignal(file: ManifestWorkflowFileSnapshot): WorkflowSignal {
  return {
    kind: "github-workflow",
    path: file.path,
    name: workflowName(file.path),
    purpose: workflowPurpose(file),
    evidenceReferences: [githubWorkflowReference(file.path)],
  };
}

function workflowPurpose(file: ManifestWorkflowFileSnapshot): WorkflowPurpose {
  const pathText = file.path.toLowerCase();
  const contentText = file.text.toLowerCase();
  const searchableText = `${pathText}\n${contentText}`;

  if (
    searchableText.includes("release") ||
    searchableText.includes("publish") ||
    searchableText.includes("deploy")
  ) {
    return "release";
  }

  if (
    searchableText.includes("ci") ||
    searchableText.includes("test") ||
    searchableText.includes("check") ||
    searchableText.includes("pull_request") ||
    searchableText.includes("push")
  ) {
    return "ci";
  }

  return "other";
}

function unsupportedManifestForFile(
  file: ManifestWorkflowFileSnapshot,
): UnsupportedManifestNote | undefined {
  const basename = path.posix.basename(file.path);
  const definition =
    unsupportedManifestDefinitions.get(basename) ??
    unsupportedManifestDefinitionFromExtension(file.path);

  if (definition === undefined) {
    return undefined;
  }

  return {
    path: file.path,
    ecosystem: definition.ecosystem,
    detail: definition.detail,
    evidenceReferences: [unsupportedManifestReference(file.path)],
  };
}

function unsupportedManifestDefinitionFromExtension(
  filePath: string,
): UnsupportedManifestDefinition | undefined {
  if (filePath.endsWith(".csproj")) {
    return {
      ecosystem: "dotnet",
      detail: ".NET project manifests are detected but not parsed yet.",
    };
  }

  if (filePath.endsWith(".gradle") || filePath.endsWith(".gradle.kts")) {
    return {
      ecosystem: "java",
      detail: "Java Gradle manifests are detected but not parsed yet.",
    };
  }

  return undefined;
}

function scriptPurpose(name: string, command: string): ScriptPurpose {
  const lowercaseName = name.toLowerCase();
  const lowercaseCommand = command.toLowerCase();

  if (lowercaseName.includes("build") || lowercaseCommand.includes(" build")) {
    return "build";
  }

  if (
    lowercaseName.includes("test") ||
    lowercaseCommand.includes("vitest") ||
    lowercaseCommand.includes("jest") ||
    lowercaseCommand.includes(" test")
  ) {
    return "test";
  }

  if (
    lowercaseName.includes("lint") ||
    lowercaseCommand.includes("eslint") ||
    lowercaseCommand.includes("oxlint") ||
    lowercaseCommand.includes(" lint")
  ) {
    return "lint";
  }

  if (
    lowercaseName === "dev" ||
    lowercaseName.startsWith("dev:") ||
    lowercaseCommand.includes(" dev")
  ) {
    return "development";
  }

  if (
    lowercaseName.includes("release") ||
    lowercaseName.includes("publish") ||
    lowercaseName.includes("deploy") ||
    lowercaseCommand.includes("npm publish")
  ) {
    return "release";
  }

  return "other";
}

function packageJsonReference(filePath: string): EvidenceReference {
  return {
    id: `manifest-workflow:package-json:${filePath}`,
    kind: "file",
    label: "Package manifest",
    path: filePath,
  };
}

function githubWorkflowReference(filePath: string): EvidenceReference {
  return {
    id: `manifest-workflow:github-workflow:${filePath}`,
    kind: "file",
    label: "GitHub workflow",
    path: filePath,
  };
}

function unsupportedManifestReference(filePath: string): EvidenceReference {
  return {
    id: `manifest-workflow:unsupported-manifest:${filePath}`,
    kind: "file",
    label: "Unsupported manifest",
    path: filePath,
  };
}

function isPackageJsonPath(filePath: string): boolean {
  return path.posix.basename(filePath) === "package.json";
}

function isGithubWorkflowPath(filePath: string): boolean {
  return /^\.github\/workflows\/[^/]+\.ya?ml$/iu.test(normalizePath(filePath));
}

function workflowName(filePath: string): string {
  const basename = path.posix.basename(filePath);
  const extension = path.posix.extname(basename);

  return basename.slice(0, basename.length - extension.length);
}

function normalizePath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//u, "");
}

function compareFilesByPath(
  left: ManifestWorkflowFileSnapshot,
  right: ManifestWorkflowFileSnapshot,
): number {
  return left.path.localeCompare(right.path);
}

function compareDependencySignals(
  left: DependencySignal,
  right: DependencySignal,
): number {
  return (
    left.path.localeCompare(right.path) ||
    dependencyRelationshipRank(left.relationship) -
      dependencyRelationshipRank(right.relationship) ||
    left.name.localeCompare(right.name)
  );
}

function compareScriptSignals(
  left: PackageScriptSignal,
  right: PackageScriptSignal,
): number {
  return (
    left.path.localeCompare(right.path) || left.name.localeCompare(right.name)
  );
}

function dependencyRelationshipRank(
  relationship: DependencyRelationship,
): number {
  return relationshipRank.get(relationship) ?? relationshipRank.size;
}
