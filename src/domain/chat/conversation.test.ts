import { describe, expect, it } from "vitest";

import {
  ChatMessageSchema,
  ConversationSchema,
  ConversationSchemaVersion,
  ConversationTargetSchema,
} from "./conversation";

const repository = {
  provider: "github",
  owner: "lightstrikelabs",
  name: "repo-analyzer-green",
  url: "https://github.com/lightstrikelabs/repo-analyzer-green",
  revision: "main",
};

const evidenceReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
  lineStart: 1,
  lineEnd: 40,
};

describe("conversation domain models", () => {
  it("models a conversation that belongs to a report card and repository", () => {
    const parsed = ConversationSchema.parse({
      id: "conversation:repo-analyzer-green:maintainability",
      schemaVersion: ConversationSchemaVersion,
      reportCardId: "report:repo-analyzer-green",
      repository,
      target: {
        kind: "dimension",
        dimension: "maintainability",
      },
      ownership: {
        ownerId: "user:1",
        workspaceId: "workspace:lightstrike",
      },
      messages: [],
      createdAt: "2026-04-26T08:00:00-07:00",
      updatedAt: "2026-04-26T08:01:00-07:00",
    });

    expect(parsed.reportCardId).toBe("report:repo-analyzer-green");
    expect(parsed.repository.owner).toBe("lightstrikelabs");
    expect(parsed.target?.kind).toBe("dimension");
    expect(parsed.ownership?.workspaceId).toBe("workspace:lightstrike");
  });

  it("allows follow-up targets for the whole report, findings, caveats, and evidence", () => {
    expect(
      ConversationTargetSchema.safeParse({
        kind: "report",
      }).success,
    ).toBe(true);
    expect(
      ConversationTargetSchema.safeParse({
        kind: "finding",
        findingId: "finding:maintainability:risk:0",
        dimension: "maintainability",
      }).success,
    ).toBe(true);
    expect(
      ConversationTargetSchema.safeParse({
        kind: "caveat",
        caveatId: "caveat:operability:missing-evidence",
      }).success,
    ).toBe(true);
    expect(
      ConversationTargetSchema.safeParse({
        kind: "evidence",
        evidenceReference,
      }).success,
    ).toBe(true);
  });

  it("preserves assistant citations, assumptions, and model metadata", () => {
    const parsed = ChatMessageSchema.parse({
      id: "message:assistant:1",
      role: "assistant",
      content:
        "The package manifest includes scripts, but release automation is missing from available evidence.",
      citations: [
        {
          evidenceReference,
          relevance: "Manifest scripts support the setup claim.",
        },
      ],
      assumptions: [
        {
          statement:
            "The repository may publish manually because no release workflow was collected.",
          basis: "No workflow evidence was present in the report.",
        },
      ],
      modelMetadata: {
        provider: "openrouter",
        modelName: "anthropic/claude-sonnet-4.5",
        modelVersion: "2026-04",
        responseId: "chatcmpl_fixture",
      },
      createdAt: "2026-04-26T08:02:00-07:00",
    });

    expect(parsed.citations[0]?.evidenceReference.path).toBe("package.json");
    expect(parsed.assumptions[0]?.statement).toContain("publish manually");
    expect(parsed.modelMetadata?.provider).toBe("openrouter");
  });

  it("rejects user messages with model metadata", () => {
    const result = ChatMessageSchema.safeParse({
      id: "message:user:1",
      role: "user",
      content: "What should we fix first?",
      modelMetadata: {
        provider: "openrouter",
        modelName: "model",
      },
      createdAt: "2026-04-26T08:02:00-07:00",
    });

    expect(result.success).toBe(false);
  });

  it("rejects conversations whose updated timestamp predates creation", () => {
    const result = ConversationSchema.safeParse({
      id: "conversation:invalid",
      schemaVersion: ConversationSchemaVersion,
      reportCardId: "report:repo-analyzer-green",
      repository,
      messages: [],
      createdAt: "2026-04-26T08:00:00-07:00",
      updatedAt: "2026-04-26T07:59:00-07:00",
    });

    expect(result.success).toBe(false);
  });
});
