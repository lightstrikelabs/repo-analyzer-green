import { z } from "zod";

import {
  ChatAnswerSchema,
  ChatAnswerContractSchema,
  type ChatAnswerContract,
} from "../../domain/chat/chat-answer";
import type { ConversationTarget } from "../../domain/chat/conversation";
import type {
  ChatReviewer,
  ChatReviewerRequest,
} from "../../application/follow-up-chat/follow-up-chat";
import type {
  DimensionAssessment,
  ReportCard,
  ReportCaveat,
  ReportFinding,
} from "../../domain/report/report-card";
import {
  type OpenRouterChatCompletionControls,
  OpenRouterChatCompletionProvider,
  type OpenRouterProviderFailureCode,
} from "../llm/openrouter-chat-provider";
import type { OpenRouterProviderConfig } from "../llm/openrouter-config";

export type FollowUpValidationIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

export class FollowUpAnswerValidationError extends Error {
  readonly issues: readonly FollowUpValidationIssue[];

  constructor(issues: readonly FollowUpValidationIssue[]) {
    super("Follow-up answer could not be validated.");
    this.name = "FollowUpAnswerValidationError";
    this.issues = issues;
  }
}

export class FollowUpProviderError extends Error {
  readonly code: OpenRouterProviderFailureCode;
  readonly status: number | undefined;

  constructor(
    code: OpenRouterProviderFailureCode,
    message: string,
    status?: number,
  ) {
    super(message);
    this.name = "FollowUpProviderError";
    this.code = code;
    this.status = status;
  }
}

export type OpenRouterChatReviewerOptions = {
  readonly chatProvider?: Pick<OpenRouterChatCompletionProvider, "complete">;
  readonly config: OpenRouterProviderConfig;
  readonly controls?: OpenRouterChatCompletionControls;
  readonly now?: () => Date;
};

const DefaultFollowUpMaxOutputTokens = 4_000;
const DefaultFollowUpTemperature = 0.2;

const ProviderChatAnswerResponseSchema = z
  .object({
    answer: ChatAnswerSchema,
  })
  .strict();

export class OpenRouterChatReviewer implements ChatReviewer {
  private readonly chatProvider: Pick<
    OpenRouterChatCompletionProvider,
    "complete"
  >;
  private readonly config: OpenRouterProviderConfig;
  private readonly controls: OpenRouterChatCompletionControls | undefined;
  private readonly now: () => Date;

  constructor(options: OpenRouterChatReviewerOptions) {
    this.chatProvider =
      options.chatProvider ?? new OpenRouterChatCompletionProvider();
    this.config = options.config;
    this.controls = chatControls(options.controls);
    this.now = options.now ?? (() => new Date());
  }

  async answer(request: ChatReviewerRequest): Promise<ChatAnswerContract> {
    const result = await this.chatProvider.complete({
      config: this.config,
      metadata: {
        usageContext: "follow-up-answer",
        repository: repositoryLabel(request),
      },
      messages: [
        {
          role: "system",
          content: systemPrompt(),
        },
        {
          role: "user",
          content: JSON.stringify(promptContext(request)),
        },
        ...request.conversation.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      ],
      ...(this.controls === undefined ? {} : { controls: this.controls }),
    });

    if (result.kind === "provider-failure") {
      throw new FollowUpProviderError(
        result.code,
        followUpProviderMessage(result.userFacingCaveat),
        result.status,
      );
    }

    const parsedJson = parseJson(result.content);
    if (!parsedJson.success) {
      throw new FollowUpAnswerValidationError([
        {
          path: [],
          message: "Follow-up answer response was not valid JSON.",
        },
      ]);
    }

    const parsedAnswer = ProviderChatAnswerResponseSchema.safeParse(
      normalizeChatAnswerResponseInput(parsedJson.value),
    );
    if (!parsedAnswer.success) {
      throw new FollowUpAnswerValidationError(
        parsedAnswer.error.issues.map(toValidationIssue),
      );
    }

    const parsedContract = ChatAnswerContractSchema.safeParse({
      answer: parsedAnswer.data.answer,
      metadata: {
        provider: "openrouter",
        modelName: result.model,
        ...(result.rawResponseId === undefined
          ? {}
          : { responseId: result.rawResponseId }),
        generatedAt: this.now().toISOString(),
      },
    });

    if (!parsedContract.success) {
      throw new FollowUpAnswerValidationError(
        parsedContract.error.issues.map(toValidationIssue),
      );
    }

    return parsedContract.data;
  }
}

function chatControls(
  controls: OpenRouterChatCompletionControls | undefined,
): OpenRouterChatCompletionControls {
  return {
    maxOutputTokens:
      controls?.maxOutputTokens ?? DefaultFollowUpMaxOutputTokens,
    reasoning: controls?.reasoning ?? {
      effort: "minimal",
      exclude: true,
    },
    responseFormat: controls?.responseFormat ?? "json_object",
    temperature: controls?.temperature ?? DefaultFollowUpTemperature,
  };
}

type JsonParseResult =
  | {
      readonly success: true;
      readonly value: unknown;
    }
  | {
      readonly success: false;
    };

function systemPrompt(): string {
  return [
    "You answer follow-up questions about a repository quality report.",
    "Return JSON only matching the chat-answer contract exactly.",
    "The top-level response must be an object with one answer property.",
    "Use the key summary for answer text; never use text, message, or answerText.",
    "Do not include keys outside the requested response shape.",
    "Cite evidence references for every evidence-backed claim.",
    "Use insufficient-context when snippets or report context cannot support an answer.",
  ].join(" ");
}

function promptContext(request: ChatReviewerRequest) {
  return {
    report: compactReportContext(request.reportCard, request.target),
    question: request.question,
    evidence: request.evidence,
    responseShape: {
      answer: {
        schemaVersion: "chat-answer.v1",
        status: "answered",
        summary: "string",
        evidenceBackedClaims: [
          {
            claim: "string",
            citations: [
              {
                evidenceReference:
                  "copy one exact evidenceReference object from evidence.snippets",
                quote: "optional short quote from the snippet",
              },
            ],
          },
        ],
        assumptions: [],
        caveats: [
          {
            summary: "string",
            missingEvidence: [],
          },
        ],
        suggestedNextQuestions: [
          {
            question: "string",
            rationale: "string",
          },
        ],
      },
      insufficientContextAnswer: {
        schemaVersion: "chat-answer.v1",
        status: "insufficient-context",
        summary: "string",
        missingContext: [
          {
            reason: "string",
            requestedEvidence: "optional string",
          },
        ],
        suggestedNextQuestions: [
          {
            question: "string",
            rationale: "string",
          },
        ],
      },
    },
  };
}

function compactReportContext(
  reportCard: ReportCard,
  target: ConversationTarget,
) {
  return {
    id: reportCard.id,
    schemaVersion: reportCard.schemaVersion,
    generatedAt: reportCard.generatedAt,
    repository: reportCard.repository,
    assessedArchetype: reportCard.assessedArchetype,
    scoringPolicy: reportCard.scoringPolicy,
    reviewerMetadata: reportCard.reviewerMetadata,
    target: compactTargetContext(reportCard, target),
  };
}

function compactTargetContext(
  reportCard: ReportCard,
  target: ConversationTarget,
) {
  switch (target.kind) {
    case "report":
      return {
        kind: "report" as const,
        dimensions: reportCard.dimensionAssessments.map(compactDimension),
        caveats: reportCard.caveats.map(compactCaveat),
        recommendedNextQuestions: reportCard.recommendedNextQuestions,
      };
    case "dimension": {
      const assessment = reportCard.dimensionAssessments.find(
        (candidate) => candidate.dimension === target.dimension,
      );
      return {
        kind: "dimension" as const,
        assessment:
          assessment === undefined ? undefined : compactDimension(assessment),
        caveats:
          assessment === undefined
            ? []
            : caveatsForDimension(reportCard, assessment).map(compactCaveat),
      };
    }
    case "finding": {
      const match = findFinding(reportCard, target.findingId);
      return {
        kind: "finding" as const,
        finding:
          match === undefined ? undefined : compactFinding(match.finding),
        dimension:
          match === undefined ? undefined : compactDimension(match.assessment),
      };
    }
    case "caveat": {
      const caveat = reportCard.caveats.find(
        (candidate) => candidate.id === target.caveatId,
      );
      return {
        kind: "caveat" as const,
        caveat: caveat === undefined ? undefined : compactCaveat(caveat),
        affectedDimensions:
          caveat === undefined
            ? []
            : reportCard.dimensionAssessments
                .filter((assessment) =>
                  caveat.affectedDimensions.includes(assessment.dimension),
                )
                .map(compactDimension),
      };
    }
    case "evidence":
      return {
        kind: "evidence" as const,
        evidenceReference: target.evidenceReference,
      };
  }
}

function compactDimension(assessment: DimensionAssessment) {
  return {
    dimension: assessment.dimension,
    title: assessment.title,
    summary: assessment.summary,
    rating: assessment.rating,
    ...(assessment.score === undefined ? {} : { score: assessment.score }),
    confidence: assessment.confidence,
    evidenceReferences: assessment.evidenceReferences,
    findings: assessment.findings.map(compactFinding),
    caveatIds: assessment.caveatIds,
  };
}

function compactFinding(finding: ReportFinding) {
  return {
    id: finding.id,
    dimension: finding.dimension,
    severity: finding.severity,
    title: finding.title,
    summary: finding.summary,
    confidence: finding.confidence,
    evidenceReferences: finding.evidenceReferences,
  };
}

function compactCaveat(caveat: ReportCaveat) {
  return {
    id: caveat.id,
    title: caveat.title,
    summary: caveat.summary,
    affectedDimensions: caveat.affectedDimensions,
    missingEvidence: caveat.missingEvidence,
  };
}

function caveatsForDimension(
  reportCard: ReportCard,
  assessment: DimensionAssessment,
): readonly ReportCaveat[] {
  return reportCard.caveats.filter(
    (caveat) =>
      assessment.caveatIds.includes(caveat.id) ||
      caveat.affectedDimensions.includes(assessment.dimension),
  );
}

function findFinding(
  reportCard: ReportCard,
  findingId: string,
):
  | {
      readonly assessment: DimensionAssessment;
      readonly finding: ReportFinding;
    }
  | undefined {
  for (const assessment of reportCard.dimensionAssessments) {
    const finding = assessment.findings.find(
      (candidate) => candidate.id === findingId,
    );

    if (finding !== undefined) {
      return {
        assessment,
        finding,
      };
    }
  }

  return undefined;
}

function repositoryLabel(request: ChatReviewerRequest): string {
  const repository = request.reportCard.repository;
  const ownerPrefix =
    repository.owner === undefined ? "" : `${repository.owner}/`;
  const revisionSuffix =
    repository.revision === undefined ? "" : ` @ ${repository.revision}`;

  return `${repository.provider}:${ownerPrefix}${repository.name}${revisionSuffix}`;
}

function parseJson(content: string): JsonParseResult {
  try {
    return {
      success: true,
      value: JSON.parse(content),
    };
  } catch {
    return {
      success: false,
    };
  }
}

function normalizeChatAnswerResponseInput(value: unknown): unknown {
  if (!isRecord(value) || !isRecord(value.answer)) {
    return value;
  }

  return {
    ...value,
    answer: normalizeChatAnswerInput(value.answer),
  };
}

function normalizeChatAnswerInput(answer: Record<string, unknown>): unknown {
  return withoutUndefinedEntries({
    ...answer,
    summary: normalizeAnswerSummary(answer),
    evidenceBackedClaims: normalizeEvidenceBackedClaims(
      answer.evidenceBackedClaims,
    ),
    text: undefined,
    message: undefined,
    answerText: undefined,
  });
}

function normalizeAnswerSummary(answer: Record<string, unknown>): unknown {
  if (typeof answer.summary === "string" && answer.summary.trim() !== "") {
    return answer.summary;
  }

  if (typeof answer.text === "string" && answer.text.trim() !== "") {
    return answer.text;
  }

  if (
    typeof answer.answerText === "string" &&
    answer.answerText.trim() !== ""
  ) {
    return answer.answerText;
  }

  if (typeof answer.message === "string" && answer.message.trim() !== "") {
    return answer.message;
  }

  return answer.summary;
}

function normalizeEvidenceBackedClaims(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((claim) => {
    if (!isRecord(claim)) {
      return claim;
    }

    return {
      ...claim,
      citations: normalizeCitations(claim.citations),
    };
  });
}

function normalizeCitations(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((citation) => {
    if (!isRecord(citation)) {
      return citation;
    }

    return {
      ...citation,
      evidenceReference: normalizeCitationEvidenceReference(
        citation.evidenceReference,
      ),
    };
  });
}

function normalizeCitationEvidenceReference(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }

  if (isRecord(value.evidenceReference)) {
    return value.evidenceReference;
  }

  return value;
}

function withoutUndefinedEntries(
  record: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(record).filter((entry) => entry[1] !== undefined),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toValidationIssue(issue: z.core.$ZodIssue): FollowUpValidationIssue {
  return {
    path: issue.path.filter(
      (segment): segment is string | number =>
        typeof segment === "string" || typeof segment === "number",
    ),
    message: issue.message,
  };
}

function followUpProviderMessage(message: string): string {
  return message.replace(
    "OpenRouter reviewer output",
    "OpenRouter follow-up answer",
  );
}
