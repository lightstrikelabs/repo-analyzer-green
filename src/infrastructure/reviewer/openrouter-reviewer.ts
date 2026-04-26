import type { ReviewerMetadata } from "../../domain/report/report-card";
import { ReviewerAssessmentSchema } from "../../domain/reviewer/reviewer-assessment";
import type {
  MalformedReviewerResponse,
  Reviewer,
  ReviewerRequest,
  ReviewerResponseValidationIssue,
  ReviewerResult,
} from "../../domain/reviewer/reviewer";
import {
  renderReviewerPrompt,
  type ReviewerPromptInput,
} from "../../domain/reviewer/reviewer-prompt";
import {
  type OpenRouterChatCompletionControls,
  OpenRouterChatCompletionProvider,
} from "../llm/openrouter-chat-provider";
import type { OpenRouterProviderConfig } from "../llm/openrouter-config";

export const OpenRouterReviewerVersion = "openrouter-reviewer.v1";

export type OpenRouterReviewerControls = OpenRouterChatCompletionControls & {
  readonly maxEvidenceSummaryCharacters?: number;
};

export type OpenRouterReviewerOptions = {
  readonly chatProvider?: Pick<OpenRouterChatCompletionProvider, "complete">;
  readonly config: OpenRouterProviderConfig;
  readonly controls?: OpenRouterReviewerControls;
  readonly now?: () => Date;
};

export class OpenRouterReviewer implements Reviewer {
  private readonly chatProvider: Pick<
    OpenRouterChatCompletionProvider,
    "complete"
  >;
  private readonly config: OpenRouterProviderConfig;
  private readonly controls: OpenRouterReviewerControls | undefined;
  private readonly now: () => Date;

  constructor(options: OpenRouterReviewerOptions) {
    this.chatProvider =
      options.chatProvider ?? new OpenRouterChatCompletionProvider();
    this.config = options.config;
    this.controls = options.controls;
    this.now = options.now ?? (() => new Date());
  }

  async assess(request: ReviewerRequest): Promise<ReviewerResult> {
    const prompt = renderReviewerPrompt(promptInput(request, this.controls));
    const reviewerMetadata = this.reviewerMetadata();
    const completionRequest = {
      config: this.config,
      metadata: {
        usageContext: "reviewer-assessment" as const,
        repository: repositoryLabel(request.repository),
      },
      messages: prompt.messages,
      ...chatControlsProperty(this.controls),
    };
    const result = await this.chatProvider.complete(completionRequest);

    if (result.kind === "provider-failure") {
      return malformedResponse({
        reviewer: reviewerMetadata,
        rawResponse: "",
        validationIssues: [
          {
            path: [],
            message: result.userFacingCaveat,
          },
        ],
      });
    }

    const parsedJson = parseJson(result.content);

    if (!parsedJson.success) {
      return malformedResponse({
        reviewer: reviewerMetadata,
        rawResponse: result.content,
        validationIssues: [
          {
            path: [],
            message: "Reviewer response was not valid JSON.",
          },
        ],
      });
    }

    const parsedAssessment = ReviewerAssessmentSchema.safeParse(
      parsedJson.value,
    );

    if (!parsedAssessment.success) {
      return malformedResponse({
        reviewer: reviewerMetadata,
        rawResponse: result.content,
        validationIssues: parsedAssessment.error.issues.map((issue) => ({
          path: issue.path.filter(
            (pathSegment): pathSegment is string | number =>
              typeof pathSegment === "string" ||
              typeof pathSegment === "number",
          ),
          message: issue.message,
        })),
      });
    }

    return {
      kind: "assessment",
      assessment: parsedAssessment.data,
    };
  }

  private reviewerMetadata(): ReviewerMetadata {
    return {
      kind: "llm",
      name: "OpenRouter reviewer",
      reviewerVersion: OpenRouterReviewerVersion,
      modelProvider: "openrouter",
      modelName: this.config.model,
      reviewedAt: this.now().toISOString(),
    };
  }
}

type JsonParseResult =
  | {
      readonly success: true;
      readonly value: unknown;
    }
  | {
      readonly success: false;
    };

function promptInput(
  request: ReviewerRequest,
  controls: OpenRouterReviewerControls | undefined,
): ReviewerPromptInput {
  const input = {
    repository: request.repository,
    evidenceReferences: request.evidenceReferences,
    ...(request.evidenceSummary === undefined
      ? {}
      : { evidenceSummary: request.evidenceSummary }),
  };

  if (controls?.maxEvidenceSummaryCharacters === undefined) {
    return input;
  }

  return {
    ...input,
    maxEvidenceSummaryCharacters: controls.maxEvidenceSummaryCharacters,
  };
}

function parseJson(content: string): JsonParseResult {
  for (const candidate of jsonCandidates(content)) {
    try {
      return {
        success: true,
        value: JSON.parse(candidate),
      };
    } catch {
      continue;
    }
  }

  return {
    success: false,
  };
}

function jsonCandidates(content: string): readonly string[] {
  const trimmed = content.trim();
  const candidates = [trimmed];
  const fencedContent = extractFencedContent(trimmed);

  if (fencedContent !== undefined) {
    candidates.push(fencedContent);
  }

  const objectContent = extractFirstJsonObject(trimmed);

  if (objectContent !== undefined) {
    candidates.push(objectContent);
  }

  return [...new Set(candidates)];
}

function extractFencedContent(content: string): string | undefined {
  const match = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(content);
  return match?.[1]?.trim();
}

function extractFirstJsonObject(content: string): string | undefined {
  let startIndex: number | undefined;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];

    if (character === undefined) {
      continue;
    }

    if (startIndex === undefined) {
      if (character === "{") {
        startIndex = index;
        depth = 1;
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (character === "\\") {
        escaped = true;
        continue;
      }

      if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === "{") {
      depth += 1;
      continue;
    }

    if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return content.slice(startIndex, index + 1);
      }
    }
  }

  return undefined;
}

function malformedResponse(options: {
  readonly reviewer: ReviewerMetadata;
  readonly rawResponse: string;
  readonly validationIssues: readonly ReviewerResponseValidationIssue[];
}): MalformedReviewerResponse {
  return {
    kind: "malformed-response",
    reviewer: options.reviewer,
    rawResponse: options.rawResponse,
    validationIssues: options.validationIssues,
  };
}

function chatControlsProperty(
  controls: OpenRouterReviewerControls | undefined,
):
  | { readonly controls: OpenRouterChatCompletionControls }
  | Record<string, never> {
  const chatCompletionControls = chatControls(controls);

  if (chatCompletionControls === undefined) {
    return {};
  }

  return {
    controls: chatCompletionControls,
  };
}

function chatControls(
  controls: OpenRouterReviewerControls | undefined,
): OpenRouterChatCompletionControls | undefined {
  if (controls === undefined) {
    return undefined;
  }

  if (
    controls.maxOutputTokens === undefined &&
    controls.temperature === undefined
  ) {
    return undefined;
  }

  return {
    ...(controls.maxOutputTokens === undefined
      ? {}
      : { maxOutputTokens: controls.maxOutputTokens }),
    ...(controls.temperature === undefined
      ? {}
      : { temperature: controls.temperature }),
  };
}

function repositoryLabel(repository: ReviewerRequest["repository"]): string {
  const ownerPrefix =
    repository.owner === undefined ? "" : `${repository.owner}/`;
  const revisionSuffix =
    repository.revision === undefined ? "" : ` @ ${repository.revision}`;

  return `${repository.provider}:${ownerPrefix}${repository.name}${revisionSuffix}`;
}
