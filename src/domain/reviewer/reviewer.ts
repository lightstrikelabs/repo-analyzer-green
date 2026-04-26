import type {
  RepositoryIdentity,
  ReviewerMetadata,
} from "../report/report-card";
import type { EvidenceReference } from "../shared/evidence-reference";

import type { ReviewerAssessment } from "./reviewer-assessment";

export type ReviewerRequest = {
  readonly repository: RepositoryIdentity;
  readonly evidenceReferences: readonly EvidenceReference[];
  readonly evidenceSummary?: string;
};

export type ReviewerResponseValidationIssue = {
  readonly path: readonly (string | number)[];
  readonly message: string;
};

export type ReviewerAssessmentResult = {
  readonly kind: "assessment";
  readonly assessment: ReviewerAssessment;
};

export type MalformedReviewerResponse = {
  readonly kind: "malformed-response";
  readonly reviewer: ReviewerMetadata;
  readonly rawResponse: string;
  readonly validationIssues: readonly ReviewerResponseValidationIssue[];
};

export type ReviewerResult =
  | ReviewerAssessmentResult
  | MalformedReviewerResponse;

export interface Reviewer {
  assess(request: ReviewerRequest): Promise<ReviewerResult>;
}
