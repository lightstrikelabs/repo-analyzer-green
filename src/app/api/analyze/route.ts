import path from "node:path";

import { z } from "zod";

import {
  analyzeRepository,
  type AnalyzeRepositoryInput,
  type AnalyzeRepositoryResult,
} from "../../../application/analyze-repository/analyze-repository";
import { LocalFixtureRepositorySource } from "../../../infrastructure/filesystem/local-fixture-repository-source";
import { FakeReviewer } from "../../../infrastructure/reviewer/fake-reviewer";
import {
  RepositorySourceError,
  type RepositoryReference,
} from "../../../domain/repository/repository-source";
import {
  ReviewerAssessmentSchemaVersion,
  type ReviewerAssessment,
} from "../../../domain/reviewer/reviewer-assessment";

type AnalyzeRouteDependencies = {
  readonly analyze: (
    input: AnalyzeRepositoryInput,
  ) => Promise<AnalyzeRepositoryResult>;
};

type ApiValidationIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

const AnalyzeRepositoryRequestSchema = z
  .object({
    repository: z
      .object({
        provider: z.enum(["github", "local-fixture"]),
        name: z.string().min(1),
        owner: z.string().min(1).optional(),
        url: z.url().optional(),
        revision: z.string().min(1).optional(),
      })
      .strict(),
  })
  .strict();

type AnalyzeRepositoryRequest = z.infer<typeof AnalyzeRepositoryRequestSchema>;

export async function POST(request: Request): Promise<Response> {
  return handleAnalyzeRequest(request, {
    analyze: analyzeWithDefaultDependencies,
  });
}

export async function handleAnalyzeRequest(
  request: Request,
  dependencies: AnalyzeRouteDependencies,
): Promise<Response> {
  const bodyResult = await readRequestBody(request);

  if (bodyResult.kind === "invalid-json") {
    return jsonError(400, {
      code: "invalid-json",
      message: "Request body must be valid JSON.",
    });
  }

  const parseResult = AnalyzeRepositoryRequestSchema.safeParse(bodyResult.body);

  if (!parseResult.success) {
    return jsonError(400, {
      code: "invalid-request",
      message: "Request body did not match the analyze contract.",
      issues: parseResult.error.issues.map(toApiValidationIssue),
    });
  }

  try {
    const result = await dependencies.analyze({
      repository: toRepositoryReference(parseResult.data.repository),
    });

    if (result.kind === "reviewer-malformed-response") {
      return jsonError(502, {
        code: "reviewer-malformed-response",
        message: "Reviewer response could not be validated.",
        issues: result.validationIssues,
      });
    }

    return Response.json({
      reportCard: result.reportCard,
    });
  } catch (error) {
    if (error instanceof RepositorySourceError) {
      return repositorySourceErrorResponse(error);
    }

    return jsonError(500, {
      code: "internal-error",
      message: "Repository analysis failed unexpectedly.",
    });
  }
}

function toRepositoryReference(
  repository: AnalyzeRepositoryRequest["repository"],
): RepositoryReference {
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

async function analyzeWithDefaultDependencies(
  input: AnalyzeRepositoryInput,
): Promise<AnalyzeRepositoryResult> {
  return analyzeRepository(input, {
    repositorySource: new LocalFixtureRepositorySource({
      fixtures: {
        "minimal-node-library": {
          id: "minimal-node-library",
          rootPath: path.join(
            process.cwd(),
            "test/fixtures/repositories/minimal-node-library",
          ),
        },
      },
    }),
    reviewer: new FakeReviewer({
      result: {
        kind: "assessment",
        assessment: defaultReviewerAssessment,
      },
    }),
  });
}

function repositorySourceErrorResponse(error: RepositorySourceError): Response {
  switch (error.code) {
    case "invalid-repository-reference":
      return jsonError(400, {
        code: error.code,
        message: "Repository reference is invalid.",
      });
    case "file-not-found":
    case "repository-not-found":
      return jsonError(404, {
        code: error.code,
        message: "Repository could not be found.",
      });
    case "download-failed":
    case "extraction-failed":
      return jsonError(502, {
        code: error.code,
        message: "Repository source could not be acquired.",
      });
  }
}

async function readRequestBody(request: Request): Promise<
  | {
      readonly kind: "body";
      readonly body: unknown;
    }
  | {
      readonly kind: "invalid-json";
    }
> {
  try {
    const body: unknown = await request.json();
    return {
      kind: "body",
      body,
    };
  } catch {
    return {
      kind: "invalid-json",
    };
  }
}

function toApiValidationIssue(issue: z.core.$ZodIssue): ApiValidationIssue {
  return {
    path: issue.path.map((segment) =>
      typeof segment === "number" ? segment : String(segment),
    ),
    message: issue.message,
  };
}

function jsonError(
  status: number,
  error: {
    readonly code: string;
    readonly message: string;
    readonly issues?: readonly ApiValidationIssue[];
  },
): Response {
  return Response.json(
    {
      error,
    },
    {
      status,
    },
  );
}

const defaultReviewerAssessment: ReviewerAssessment = {
  schemaVersion: ReviewerAssessmentSchemaVersion,
  reviewer: {
    kind: "fake",
    name: "Default fixture reviewer",
    reviewedAt: "2026-04-25T20:00:00-07:00",
  },
  assessedArchetype: {
    value: "library",
    confidence: {
      level: "high",
      score: 0.9,
      rationale:
        "The default route fixture contains package metadata and reusable TypeScript source.",
    },
    evidenceReferences: [
      {
        id: "evidence:package-json",
        kind: "file",
        label: "Package manifest",
        path: "package.json",
      },
    ],
    rationale:
      "The default fixture is a TypeScript library used for deterministic route behavior.",
  },
  dimensions: [
    {
      dimension: "maintainability",
      summary: "The default fixture has a small, readable source surface.",
      confidence: {
        level: "high",
        score: 0.9,
        rationale: "The fixture source is intentionally minimal.",
      },
      evidenceReferences: [
        {
          id: "evidence:source-file",
          kind: "file",
          label: "Source file",
          path: "src/add.ts",
        },
      ],
      strengths: ["The source module is small and explicit."],
      risks: [],
      missingEvidence: [],
    },
    {
      dimension: "verifiability",
      summary: "A focused unit test exercises the exported behavior.",
      confidence: {
        level: "high",
        score: 0.9,
        rationale: "The fixture includes a deterministic unit test.",
      },
      evidenceReferences: [
        {
          id: "evidence:test-file",
          kind: "file",
          label: "Unit test file",
          path: "test/add.spec.ts",
        },
      ],
      strengths: ["The public add function is covered by a unit test."],
      risks: [],
      missingEvidence: [],
    },
  ],
  caveats: [],
  followUpQuestions: [
    {
      id: "question:test-depth",
      question: "What behavior remains untested?",
      targetDimension: "verifiability",
      rationale: "The deterministic fixture is intentionally narrow.",
    },
  ],
};
