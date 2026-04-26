import { z } from "zod";

import { ChatAssumptionSchema } from "./conversation";
import { EvidenceReferenceSchema } from "../shared/evidence-reference";

export const ChatAnswerSchemaVersion = "chat-answer.v1";

export const ChatAnswerCitationSchema = z
  .object({
    evidenceReference: EvidenceReferenceSchema,
    quote: z.string().min(1).optional(),
  })
  .strict();

export type ChatAnswerCitation = z.infer<typeof ChatAnswerCitationSchema>;

export const EvidenceBackedClaimSchema = z
  .object({
    claim: z.string().min(1),
    citations: z.array(ChatAnswerCitationSchema).default([]),
  })
  .strict()
  .refine((claim) => claim.citations.length > 0, {
    message: "Evidence-backed claims must include at least one citation.",
    path: ["citations"],
  });

export type EvidenceBackedClaim = z.infer<typeof EvidenceBackedClaimSchema>;

export const ChatAnswerCaveatSchema = z
  .object({
    summary: z.string().min(1),
    missingEvidence: z.array(z.string().min(1)).default([]),
  })
  .strict();

export type ChatAnswerCaveat = z.infer<typeof ChatAnswerCaveatSchema>;

export const ChatAnswerSuggestedQuestionSchema = z
  .object({
    question: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export type ChatAnswerSuggestedQuestion = z.infer<
  typeof ChatAnswerSuggestedQuestionSchema
>;

export const ChatAnswerMissingContextSchema = z
  .object({
    reason: z.string().min(1),
    requestedEvidence: z.string().min(1).optional(),
  })
  .strict();

export type ChatAnswerMissingContext = z.infer<
  typeof ChatAnswerMissingContextSchema
>;

export const AnsweredChatAnswerSchema = z
  .object({
    schemaVersion: z.literal(ChatAnswerSchemaVersion),
    status: z.literal("answered"),
    summary: z.string().min(1),
    evidenceBackedClaims: z.array(EvidenceBackedClaimSchema).min(1),
    assumptions: z.array(ChatAssumptionSchema).default([]),
    caveats: z.array(ChatAnswerCaveatSchema).default([]),
    suggestedNextQuestions: z
      .array(ChatAnswerSuggestedQuestionSchema)
      .default([]),
  })
  .strict();

export type AnsweredChatAnswer = z.infer<typeof AnsweredChatAnswerSchema>;

export const InsufficientContextChatAnswerSchema = z
  .object({
    schemaVersion: z.literal(ChatAnswerSchemaVersion),
    status: z.literal("insufficient-context"),
    summary: z.string().min(1),
    missingContext: z.array(ChatAnswerMissingContextSchema).min(1),
    suggestedNextQuestions: z
      .array(ChatAnswerSuggestedQuestionSchema)
      .default([]),
  })
  .strict();

export type InsufficientContextChatAnswer = z.infer<
  typeof InsufficientContextChatAnswerSchema
>;

export const ChatAnswerSchema = z.discriminatedUnion("status", [
  AnsweredChatAnswerSchema,
  InsufficientContextChatAnswerSchema,
]);

export type ChatAnswer = z.infer<typeof ChatAnswerSchema>;

export const ChatAnswerMetadataSchema = z
  .object({
    provider: z.string().min(1),
    modelName: z.string().min(1),
    modelVersion: z.string().min(1).optional(),
    responseId: z.string().min(1).optional(),
    generatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type ChatAnswerMetadata = z.infer<typeof ChatAnswerMetadataSchema>;

export const ChatAnswerContractSchema = z
  .object({
    answer: ChatAnswerSchema,
    metadata: ChatAnswerMetadataSchema.optional(),
  })
  .strict();

export type ChatAnswerContract = z.infer<typeof ChatAnswerContractSchema>;
