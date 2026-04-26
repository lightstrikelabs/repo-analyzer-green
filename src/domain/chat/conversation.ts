import { z } from "zod";

import {
  ReportDimensionKeySchema,
  RepositoryIdentitySchema,
} from "../report/report-card";
import { EvidenceReferenceSchema } from "../shared/evidence-reference";

export const ConversationSchemaVersion = "conversation.v1";

export const ConversationTargetSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("report"),
    })
    .strict(),
  z
    .object({
      kind: z.literal("dimension"),
      dimension: ReportDimensionKeySchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("finding"),
      findingId: z.string().min(1),
      dimension: ReportDimensionKeySchema.optional(),
    })
    .strict(),
  z
    .object({
      kind: z.literal("caveat"),
      caveatId: z.string().min(1),
    })
    .strict(),
  z
    .object({
      kind: z.literal("evidence"),
      evidenceReference: EvidenceReferenceSchema,
    })
    .strict(),
]);

export type ConversationTarget = z.infer<typeof ConversationTargetSchema>;

export const ChatMessageRoleSchema = z.enum(["user", "assistant"]);

export type ChatMessageRole = z.infer<typeof ChatMessageRoleSchema>;

export const ChatEvidenceCitationSchema = z
  .object({
    evidenceReference: EvidenceReferenceSchema,
    relevance: z.string().min(1).optional(),
  })
  .strict();

export type ChatEvidenceCitation = z.infer<typeof ChatEvidenceCitationSchema>;

export const ChatAssumptionSchema = z
  .object({
    statement: z.string().min(1),
    basis: z.string().min(1).optional(),
  })
  .strict();

export type ChatAssumption = z.infer<typeof ChatAssumptionSchema>;

export const ChatModelMetadataSchema = z
  .object({
    provider: z.string().min(1),
    modelName: z.string().min(1),
    modelVersion: z.string().min(1).optional(),
    responseId: z.string().min(1).optional(),
  })
  .strict();

export type ChatModelMetadata = z.infer<typeof ChatModelMetadataSchema>;

export const ChatMessageSchema = z
  .object({
    id: z.string().min(1),
    role: ChatMessageRoleSchema,
    content: z.string().min(1),
    citations: z.array(ChatEvidenceCitationSchema).default([]),
    assumptions: z.array(ChatAssumptionSchema).default([]),
    modelMetadata: ChatModelMetadataSchema.optional(),
    createdAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(
    (message) => message.role !== "user" || message.modelMetadata === undefined,
    {
      message: "User messages cannot include model metadata.",
      path: ["modelMetadata"],
    },
  );

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ConversationOwnershipSchema = z
  .object({
    ownerId: z.string().min(1).optional(),
    workspaceId: z.string().min(1).optional(),
  })
  .strict();

export type ConversationOwnership = z.infer<typeof ConversationOwnershipSchema>;

export const ConversationSchema = z
  .object({
    id: z.string().min(1),
    schemaVersion: z.literal(ConversationSchemaVersion),
    reportCardId: z.string().min(1),
    repository: RepositoryIdentitySchema,
    target: ConversationTargetSchema.optional(),
    messages: z.array(ChatMessageSchema).default([]),
    ownership: ConversationOwnershipSchema.optional(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(
    (conversation) =>
      Date.parse(conversation.updatedAt) >= Date.parse(conversation.createdAt),
    {
      message: "Conversation updatedAt cannot predate createdAt.",
      path: ["updatedAt"],
    },
  );

export type Conversation = z.infer<typeof ConversationSchema>;
