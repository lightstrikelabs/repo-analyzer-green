import { describe, expect, it } from "vitest";

import { detectSecurityHygieneSignals } from "./security-hygiene-signals";

describe("detectSecurityHygieneSignals", () => {
  it("detects common lockfiles and package dependency counts from manifest data", () => {
    const result = detectSecurityHygieneSignals({
      files: [
        { path: "package.json" },
        { path: "pnpm-lock.yaml" },
        { path: "services/api/package-lock.json" },
        { path: "services/api/package.json" },
        { path: "uv.lock" },
      ],
      dependencySignals: [
        {
          path: "package.json",
          name: "next",
          relationship: "production",
          versionRange: "^16.0.0",
          evidenceReferences: [],
        },
        {
          path: "package.json",
          name: "react",
          relationship: "production",
          versionRange: "^19.0.0",
          evidenceReferences: [],
        },
        {
          path: "package.json",
          name: "vitest",
          relationship: "development",
          versionRange: "^4.0.0",
          evidenceReferences: [],
        },
        {
          path: "services/api/package.json",
          name: "fastify",
          relationship: "production",
          versionRange: "^5.0.0",
          evidenceReferences: [],
        },
        {
          path: "services/api/package.json",
          name: "@types/node",
          relationship: "development",
          versionRange: "^24.0.0",
          evidenceReferences: [],
        },
      ],
    });

    expect(result.lockfileSignals).toEqual([
      expect.objectContaining({
        kind: "lockfile",
        category: "hygiene",
        path: "pnpm-lock.yaml",
        ecosystem: "javascript",
        packageManager: "pnpm",
        reviewDisposition: expect.objectContaining({
          required: true,
          label: "hygiene/risk signal requiring human review",
        }),
      }),
      expect.objectContaining({
        kind: "lockfile",
        path: "services/api/package-lock.json",
        packageManager: "npm",
      }),
      expect.objectContaining({
        kind: "lockfile",
        path: "uv.lock",
        ecosystem: "python",
        packageManager: "uv",
      }),
    ]);
    expect(result.dependencyCountSignals).toEqual([
      expect.objectContaining({
        kind: "package-dependency-count",
        category: "hygiene",
        path: "package.json",
        totalDependencies: 3,
        byRelationship: {
          production: 2,
          development: 1,
          peer: 0,
          optional: 0,
        },
      }),
      expect.objectContaining({
        kind: "package-dependency-count",
        path: "services/api/package.json",
        totalDependencies: 2,
        byRelationship: {
          production: 1,
          development: 1,
          peer: 0,
          optional: 0,
        },
      }),
    ]);
    expect(result.dependencyCountSignals[0]?.confidence.level).toBe("medium");
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "human-review-required",
        }),
      ]),
    );
  });

  it("detects environment example and sample files as hygiene evidence", () => {
    const result = detectSecurityHygieneSignals({
      files: [
        { path: ".env.example" },
        { path: "config/.env.sample" },
        { path: "apps/web/env.template" },
        { path: "README.md" },
      ],
    });

    expect(result.envExampleSignals).toEqual([
      expect.objectContaining({
        kind: "env-example",
        category: "hygiene",
        path: ".env.example",
        confidence: expect.objectContaining({
          level: "high",
        }),
      }),
      expect.objectContaining({
        kind: "env-example",
        path: "apps/web/env.template",
      }),
      expect.objectContaining({
        kind: "env-example",
        path: "config/.env.sample",
      }),
    ]);
    expect(result.envExampleSignals[0]?.reviewDisposition.label).toBe(
      "hygiene/risk signal requiring human review",
    );
  });

  it("detects possible secret-risk hints from paths and bounded text content", () => {
    const result = detectSecurityHygieneSignals({
      files: [
        {
          path: ".env.local",
          text: "STRIPE_SECRET_KEY=sk_live_123456789abcdefghijklmnop\n",
        },
        {
          path: "keys/private.pem",
          text: "-----BEGIN PRIVATE KEY-----\nredacted\n",
        },
        {
          path: "secrets/prod/service-account.json",
        },
        {
          path: "src/config.ts",
          text: "export const mode = 'test';\n",
        },
      ],
    });

    expect(result.secretRiskSignals).toEqual([
      expect.objectContaining({
        kind: "secret-risk-path",
        category: "risk",
        path: ".env.local",
        reason: "Environment file path may contain local or deployed secrets.",
      }),
      expect.objectContaining({
        kind: "secret-risk-content",
        path: ".env.local",
        matchedPattern: "credential-assignment",
        lineStart: 1,
        reason:
          "Bounded text scan found a credential-like assignment without exposing its value.",
      }),
      expect.objectContaining({
        kind: "secret-risk-path",
        path: "keys/private.pem",
        reason: "Key or certificate file path may contain secret material.",
      }),
      expect.objectContaining({
        kind: "secret-risk-content",
        path: "keys/private.pem",
        matchedPattern: "private-key-block",
        lineStart: 1,
      }),
      expect.objectContaining({
        kind: "secret-risk-path",
        path: "secrets/prod/service-account.json",
        reason: "Secrets or credentials path may contain sensitive material.",
      }),
    ]);
    expect(result.secretRiskSignals[0]?.confidence.rationale).toContain(
      "requires human review",
    );
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "content-unavailable",
          path: "secrets/prod/service-account.json",
        }),
      ]),
    );
  });

  it("limits content scanning to the configured byte budget", () => {
    const result = detectSecurityHygieneSignals({
      maxTextScanBytes: 12,
      files: [
        {
          path: "src/settings.ts",
          text: "safe text\nAWS_ACCESS_KEY_ID=AKIAABCDEFGHIJKLMNOP\n",
        },
      ],
    });

    expect(result.secretRiskSignals).toEqual([]);
    expect(result.limitations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "bounded-content-scan",
          path: "src/settings.ts",
          detail:
            "Only the first 12 characters were scanned for secret-risk content hints.",
        }),
      ]),
    );
  });
});
