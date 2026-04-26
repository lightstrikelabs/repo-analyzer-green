import path from "node:path";

import { z } from "zod";

import {
  analyzeRepository,
  type AnalyzeRepositoryInput,
  type AnalyzeRepositoryResult,
} from "../../../application/analyze-repository/analyze-repository";
import { buildAnalyzeRepositoryResponse } from "../../../application/analyze-repository/analyze-repository-response";
import { LocalFixtureRepositorySource } from "../../../infrastructure/filesystem/local-fixture-repository-source";
import { GitHubArchiveRepositorySource } from "../../../infrastructure/github/github-archive-repository-source";
import { GitHubRepositoryUrlSchema } from "../../../infrastructure/github/github-repository-url";
import {
  OpenRouterDefaultBaseUrl,
  OpenRouterDefaultModelId,
  OpenRouterModelIdSchema,
  type OpenRouterProviderConfig,
} from "../../../infrastructure/llm/openrouter-config";
import { FakeReviewer } from "../../../infrastructure/reviewer/fake-reviewer";
import { OpenRouterReviewer } from "../../../infrastructure/reviewer/openrouter-reviewer";
import { OpenRouterReviewerFallback } from "../../../infrastructure/reviewer/openrouter-reviewer-fallback";
import { StaticEvidenceReviewer } from "../../../infrastructure/reviewer/static-evidence-reviewer";
import {
  RepositorySourceError,
  type RepositoryReference,
  type RepositorySource,
} from "../../../domain/repository/repository-source";
import type { Reviewer } from "../../../domain/reviewer/reviewer";
import {
  ReviewerAssessmentSchemaVersion,
  type ReviewerAssessment,
} from "../../../domain/reviewer/reviewer-assessment";

export type AnalyzeRouteOptions = {
  readonly openRouterConfig?: OpenRouterProviderConfig;
};

type AnalyzeRouteDependencies = {
  readonly analyze: (
    input: AnalyzeRepositoryInput,
    options: AnalyzeRouteOptions,
  ) => Promise<AnalyzeRepositoryResult>;
};

type ApiValidationIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

const StructuredAnalyzeRepositoryRequestSchema = z
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

const RedStyleAnalyzeRepositoryRequestSchema = z
  .object({
    repoUrl: GitHubRepositoryUrlSchema,
    apiKey: z.preprocess(normalizeOptionalText, z.string().min(1).optional()),
    model: OpenRouterModelIdSchema.optional(),
  })
  .strict();

type StructuredAnalyzeRepositoryRequest = z.infer<
  typeof StructuredAnalyzeRepositoryRequestSchema
>;

type RedStyleAnalyzeRepositoryRequest = z.infer<
  typeof RedStyleAnalyzeRepositoryRequestSchema
>;

type ParsedAnalyzeRepositoryRequest =
  | {
      readonly kind: "structured";
      readonly data: StructuredAnalyzeRepositoryRequest;
    }
  | {
      readonly kind: "red-style";
      readonly data: RedStyleAnalyzeRepositoryRequest;
    };

type AnalyzeRequestParseResult =
  | {
      readonly success: true;
      readonly request: ParsedAnalyzeRepositoryRequest;
    }
  | {
      readonly success: false;
      readonly issues: readonly z.core.$ZodIssue[];
    };

type NormalizedAnalyzeRequest = {
  readonly repository: RepositoryReference;
  readonly options: AnalyzeRouteOptions;
};

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

  const parseResult = parseAnalyzeRepositoryRequest(bodyResult.body);

  if (!parseResult.success) {
    return jsonError(400, {
      code: "invalid-request",
      message: "Request body did not match the analyze contract.",
      issues: parseResult.issues.map(toApiValidationIssue),
    });
  }
  const normalizedRequest = normalizeAnalyzeRequest(parseResult.request);

  try {
    const result = await dependencies.analyze(
      {
        repository: normalizedRequest.repository,
      },
      normalizedRequest.options,
    );

    if (result.kind === "reviewer-malformed-response") {
      return jsonError(502, {
        code: "reviewer-malformed-response",
        message: "Reviewer response could not be validated.",
        issues: result.validationIssues,
      });
    }

    return Response.json(buildAnalyzeRepositoryResponse(result));
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
  repository: StructuredAnalyzeRepositoryRequest["repository"],
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

function parseAnalyzeRepositoryRequest(
  body: unknown,
): AnalyzeRequestParseResult {
  if (typeof body === "object" && body !== null && "repoUrl" in body) {
    const result = RedStyleAnalyzeRepositoryRequestSchema.safeParse(body);
    return result.success
      ? {
          success: true,
          request: {
            kind: "red-style",
            data: result.data,
          },
        }
      : {
          success: false,
          issues: result.error.issues,
        };
  }

  const result = StructuredAnalyzeRepositoryRequestSchema.safeParse(body);
  return result.success
    ? {
        success: true,
        request: {
          kind: "structured",
          data: result.data,
        },
      }
    : {
        success: false,
        issues: result.error.issues,
      };
}

function normalizeAnalyzeRequest(
  request: ParsedAnalyzeRepositoryRequest,
): NormalizedAnalyzeRequest {
  if (request.kind === "structured") {
    return {
      repository: toRepositoryReference(request.data.repository),
      options: {},
    };
  }

  return {
    repository: request.data.repoUrl,
    options: openRouterRouteOptions(request.data),
  };
}

function openRouterRouteOptions(
  request: RedStyleAnalyzeRepositoryRequest,
): AnalyzeRouteOptions {
  if (request.apiKey === undefined) {
    return {};
  }

  return {
    openRouterConfig: {
      provider: "openrouter",
      apiKey: request.apiKey,
      model: request.model ?? OpenRouterDefaultModelId,
      baseUrl: OpenRouterDefaultBaseUrl,
    },
  };
}

async function analyzeWithDefaultDependencies(
  input: AnalyzeRepositoryInput,
  options: AnalyzeRouteOptions,
): Promise<AnalyzeRepositoryResult> {
  const repositorySource = repositorySourceFor(input.repository);

  try {
    return await analyzeRepository(input, {
      repositorySource,
      reviewer: reviewerFor(input.repository, options),
    });
  } finally {
    if (repositorySource instanceof GitHubArchiveRepositorySource) {
      await repositorySource.dispose();
    }
  }
}

function repositorySourceErrorResponse(error: RepositorySourceError): Response {
  switch (error.code) {
    case "invalid-repository-reference":
      return jsonError(400, {
        code: error.code,
        message: "Repository reference is invalid.",
      });
    case "repository-too-large":
      return jsonError(413, {
        code: error.code,
        message: "Repository is too large to analyze.",
        ...(error.detail === undefined ? {} : { detail: error.detail }),
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

function repositorySourceFor(
  repository: RepositoryReference,
): RepositorySource {
  if (repository.provider === "github") {
    return new GitHubArchiveRepositorySource();
  }

  return new LocalFixtureRepositorySource({
    fixtures: {
      "minimal-node-library": {
        id: "minimal-node-library",
        rootPath: path.join(
          process.cwd(),
          "test/fixtures/repositories/minimal-node-library",
        ),
      },
    },
  });
}

function reviewerFor(
  repository: RepositoryReference,
  options: AnalyzeRouteOptions,
): Reviewer {
  if (options.openRouterConfig !== undefined) {
    return new OpenRouterReviewerFallback({
      primary: new OpenRouterReviewer({
        config: options.openRouterConfig,
      }),
      fallback: new StaticEvidenceReviewer(),
    });
  }

  if (repository.provider === "github") {
    return new StaticEvidenceReviewer();
  }

  return new FakeReviewer({
    result: {
      kind: "assessment",
      assessment: defaultReviewerAssessment,
    },
  });
}

function normalizeOptionalText(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
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
