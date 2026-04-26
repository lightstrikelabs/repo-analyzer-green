import { describe, expect, it } from "vitest";

import {
  ChatAnswerContractSchema,
  ChatAnswerSchema,
  ChatAnswerSchemaVersion,
} from "./chat-answer";

const evidenceReference = {
  id: "evidence:package-json",
  kind: "file",
  label: "Package manifest",
  path: "package.json",
  lineStart: 1,
  lineEnd: 20,
} as const;

describe("chat answer contract", () => {
  it("parses an evidence-backed answer with claims, assumptions, caveats, citations, and next questions", () => {
    const parsed = ChatAnswerSchema.parse({
      schemaVersion: ChatAnswerSchemaVersion,
      status: "answered",
      summary:
        "The package manifest shows test and lint scripts, but release evidence is not available.",
      evidenceBackedClaims: [
        {
          claim: "package.json defines test and lint scripts.",
          citations: [
            {
              evidenceReference,
              quote: '"test": "vitest"',
            },
          ],
        },
      ],
      assumptions: [
        {
          statement:
            "Release automation may be manual because no workflow evidence was retrieved.",
          basis: "No release workflow snippet was available.",
        },
      ],
      caveats: [
        {
          summary:
            "This answer cannot verify whether CI passes on every branch.",
          missingEvidence: ["Branch protection settings"],
        },
      ],
      suggestedNextQuestions: [
        {
          question: "Where is release automation configured?",
          rationale: "Release evidence was missing from retrieved context.",
        },
      ],
    });

    expect(parsed.status).toBe("answered");
    if (parsed.status === "answered") {
      expect(parsed.evidenceBackedClaims[0]?.citations[0]?.quote).toContain(
        "vitest",
      );
      expect(parsed.assumptions[0]?.statement).toContain("Release automation");
      expect(parsed.caveats[0]?.missingEvidence).toEqual([
        "Branch protection settings",
      ]);
    }
  });

  it("rejects uncited file-specific claims", () => {
    const result = ChatAnswerSchema.safeParse({
      schemaVersion: ChatAnswerSchemaVersion,
      status: "answered",
      summary: "The repository has a package manifest.",
      evidenceBackedClaims: [
        {
          claim: "package.json defines a test script.",
          citations: [],
        },
      ],
      assumptions: [],
      caveats: [],
      suggestedNextQuestions: [],
    });

    expect(result.success).toBe(false);
  });

  it("supports explicit insufficient-context responses", () => {
    const parsed = ChatAnswerSchema.parse({
      schemaVersion: ChatAnswerSchemaVersion,
      status: "insufficient-context",
      summary:
        "The retrieved evidence does not include deployment or incident history.",
      missingContext: [
        {
          reason: "No deployment workflow evidence was retrieved.",
          requestedEvidence: "Deployment workflow",
        },
      ],
      suggestedNextQuestions: [
        {
          question: "Can you provide deployment workflow evidence?",
          rationale: "The current answer cannot verify release readiness.",
        },
      ],
    });

    expect(parsed.status).toBe("insufficient-context");
    if (parsed.status === "insufficient-context") {
      expect(parsed.missingContext[0]?.requestedEvidence).toBe(
        "Deployment workflow",
      );
    }
  });

  it("keeps provider metadata outside the answer payload", () => {
    const parsed = ChatAnswerContractSchema.parse({
      answer: {
        schemaVersion: ChatAnswerSchemaVersion,
        status: "answered",
        summary: "The cited package manifest includes a test script.",
        evidenceBackedClaims: [
          {
            claim: "package.json defines a test script.",
            citations: [
              {
                evidenceReference,
              },
            ],
          },
        ],
        assumptions: [],
        caveats: [],
        suggestedNextQuestions: [],
      },
      metadata: {
        provider: "openrouter",
        modelName: "anthropic/claude-sonnet-4.5",
        modelVersion: "2026-04",
        responseId: "chatcmpl_fixture",
        generatedAt: "2026-04-26T10:00:00-07:00",
      },
    });

    expect(parsed.answer).not.toHaveProperty("metadata");
    expect(parsed.metadata).toBeDefined();
    if (parsed.metadata !== undefined) {
      expect(parsed.metadata.provider).toBe("openrouter");
    }
  });
});
