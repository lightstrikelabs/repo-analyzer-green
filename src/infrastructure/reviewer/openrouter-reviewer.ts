import type { ReviewerMetadata } from "../../domain/report/report-card";
import { ReviewerAssessmentSchema } from "../../domain/reviewer/reviewer-assessment";
import type {
  MalformedReviewerResponse,
  Reviewer,
  ReviewerRequest,
  ReviewerResponseValidationIssue,
  ReviewerResult,
} from "../../domain/reviewer/reviewer";
import type { EvidenceReference } from "../../domain/shared/evidence-reference";
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
const DefaultReviewerMaxOutputTokens = 6_000;

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
      normalizeReviewerAssessmentInput(
        parsedJson.value,
        request.evidenceReferences,
      ),
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
  const candidates = [...jsonCandidates(content)];
  const seenCandidates = new Set(candidates);
  let lastParsedValue: unknown;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    if (candidate === undefined) {
      continue;
    }

    try {
      const value = normalizeParsedJsonValue(JSON.parse(candidate));
      lastParsedValue = value;

      if (typeof value === "string") {
        for (const nestedCandidate of jsonCandidates(value)) {
          if (!seenCandidates.has(nestedCandidate)) {
            seenCandidates.add(nestedCandidate);
            candidates.push(nestedCandidate);
          }
        }
        continue;
      }

      return {
        success: true,
        value,
      };
    } catch {
      continue;
    }
  }

  if (lastParsedValue !== undefined) {
    return {
      success: true,
      value: lastParsedValue,
    };
  }

  return {
    success: false,
  };
}

function normalizeParsedJsonValue(value: unknown): unknown {
  return Array.isArray(value) && value.length === 1 ? value[0] : value;
}

function normalizeReviewerAssessmentInput(
  value: unknown,
  evidenceReferences: readonly EvidenceReference[],
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    assessedArchetype: normalizeAssessedArchetypeRecord(
      value.assessedArchetype,
      evidenceReferences,
    ),
    dimensions: normalizeEvidenceReferencesRecords(
      value.dimensions,
      evidenceReferences,
    ),
    caveats: normalizeEvidenceReferencesRecords(
      value.caveats,
      evidenceReferences,
    ),
  };
}

function normalizeAssessedArchetypeRecord(
  value: unknown,
  evidenceReferences: readonly EvidenceReference[],
): unknown {
  const normalizedValue = normalizeEvidenceReferencesRecord(
    value,
    evidenceReferences,
  );

  if (!isRecord(normalizedValue)) {
    return normalizedValue;
  }

  return {
    ...normalizedValue,
    rationale:
      typeof normalizedValue.rationale === "string" &&
      normalizedValue.rationale.trim() !== ""
        ? normalizedValue.rationale
        : "Reviewer did not provide an archetype rationale; treat the archetype assessment as lower assurance.",
  };
}

function normalizeEvidenceReferencesRecords(
  value: unknown,
  evidenceReferences: readonly EvidenceReference[],
): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) =>
    normalizeEvidenceReferencesRecord(item, evidenceReferences),
  );
}

function normalizeEvidenceReferencesRecord(
  value: unknown,
  evidenceReferences: readonly EvidenceReference[],
): unknown {
  if (!isRecord(value)) {
    return value;
  }

  return {
    ...value,
    confidence: normalizeConfidence(value.confidence),
    evidenceReferences: normalizeEvidenceReferences(
      value.evidenceReferences,
      evidenceReferences,
    ),
  };
}

function normalizeConfidence(value: unknown): unknown {
  if (!isRecord(value) || typeof value.rationale === "string") {
    return value;
  }

  return {
    ...value,
    rationale:
      "Reviewer did not provide a confidence rationale; treat this confidence as lower assurance.",
  };
}

function normalizeEvidenceReferences(
  value: unknown,
  evidenceReferences: readonly EvidenceReference[],
): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  return value.map((item) =>
    normalizeEvidenceReference(item, evidenceReferences),
  );
}

function normalizeEvidenceReference(
  value: unknown,
  evidenceReferences: readonly EvidenceReference[],
): unknown {
  if (typeof value === "string") {
    return evidenceReferenceForReviewerText(value, evidenceReferences);
  }

  if (!isRecord(value)) {
    return value;
  }

  const normalizedReference = { ...value };
  removeInvalidOptionalTextProperty(normalizedReference, "path");
  removeInvalidOptionalTextProperty(normalizedReference, "notes");
  removeInvalidOptionalLineProperty(normalizedReference, "lineStart");
  removeInvalidOptionalLineProperty(normalizedReference, "lineEnd");
  removeInvertedOptionalLineEnd(normalizedReference);
  return normalizedReference;
}

function removeInvalidOptionalTextProperty(
  record: Record<string, unknown>,
  key: "notes" | "path",
): void {
  if (record[key] === undefined) {
    return;
  }

  if (typeof record[key] !== "string" || record[key].trim() === "") {
    delete record[key];
  }
}

function removeInvalidOptionalLineProperty(
  record: Record<string, unknown>,
  key: "lineEnd" | "lineStart",
): void {
  if (record[key] === undefined) {
    return;
  }

  if (
    typeof record[key] !== "number" ||
    !Number.isInteger(record[key]) ||
    record[key] <= 0
  ) {
    delete record[key];
  }
}

function removeInvertedOptionalLineEnd(record: Record<string, unknown>): void {
  if (
    typeof record.lineStart === "number" &&
    typeof record.lineEnd === "number" &&
    record.lineEnd < record.lineStart
  ) {
    delete record.lineEnd;
  }
}

function evidenceReferenceForReviewerText(
  text: string,
  evidenceReferences: readonly EvidenceReference[],
): EvidenceReference {
  const matchingReference = evidenceReferences.find(
    (reference) =>
      reference.id === text ||
      reference.label === text ||
      reference.path === text,
  );

  if (matchingReference !== undefined) {
    return matchingReference;
  }

  return {
    id: `reviewer:${stableReferenceId(text)}`,
    kind: "reviewer",
    label: text,
  };
}

function stableReferenceId(text: string): string {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return normalized === "" ? "reference" : normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
): { readonly controls: OpenRouterChatCompletionControls } {
  return {
    controls: chatControls(controls),
  };
}

function chatControls(
  controls: OpenRouterReviewerControls | undefined,
): OpenRouterChatCompletionControls {
  return {
    maxOutputTokens:
      controls?.maxOutputTokens ?? DefaultReviewerMaxOutputTokens,
    responseFormat: controls?.responseFormat ?? "json_object",
    temperature: controls?.temperature ?? 0,
  };
}

function repositoryLabel(repository: ReviewerRequest["repository"]): string {
  const ownerPrefix =
    repository.owner === undefined ? "" : `${repository.owner}/`;
  const revisionSuffix =
    repository.revision === undefined ? "" : ` @ ${repository.revision}`;

  return `${repository.provider}:${ownerPrefix}${repository.name}${revisionSuffix}`;
}
