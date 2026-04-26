import {
  ReviewerAssessmentSchema,
  type ReviewerAssessment,
} from "../../domain/reviewer/reviewer-assessment";
import type {
  Reviewer,
  ReviewerRequest,
  ReviewerResult,
} from "../../domain/reviewer/reviewer";

export type FakeReviewerOptions = {
  readonly result: ReviewerResult;
};

export class FakeReviewer implements Reviewer {
  private readonly result: ReviewerResult;
  private readonly requests: ReviewerRequest[] = [];

  constructor(options: FakeReviewerOptions) {
    this.result = normalizeResult(options.result);
  }

  get receivedRequests(): readonly ReviewerRequest[] {
    return [...this.requests];
  }

  async assess(request: ReviewerRequest): Promise<ReviewerResult> {
    this.requests.push(request);
    return this.result;
  }
}

function normalizeResult(result: ReviewerResult): ReviewerResult {
  switch (result.kind) {
    case "assessment":
      return {
        kind: "assessment",
        assessment: parseAssessment(result.assessment),
      };
    case "malformed-response":
      return result;
  }
}

function parseAssessment(assessment: ReviewerAssessment): ReviewerAssessment {
  return ReviewerAssessmentSchema.parse(assessment);
}
