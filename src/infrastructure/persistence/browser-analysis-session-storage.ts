import { z } from "zod";

import { AnalyzeRepositoryResponseSchema } from "../../application/analyze-repository/analyze-repository-response";
import {
  RepositoryIdentitySchema,
  type RepositoryIdentity,
} from "../../domain/report/report-card";

export const BrowserAnalysisSessionSchemaVersion =
  "browser-analysis-session.v1";

export const BrowserRepositoryFormSchema = RepositoryIdentitySchema.extend({
  selectedModel: z.string().min(1),
}).strict();

export type BrowserRepositoryForm = z.infer<typeof BrowserRepositoryFormSchema>;

export const BrowserAnalysisSessionSchema = z
  .object({
    schemaVersion: z.literal(BrowserAnalysisSessionSchemaVersion),
    form: BrowserRepositoryFormSchema,
    latestReport: AnalyzeRepositoryResponseSchema.optional(),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type BrowserAnalysisSession = z.infer<
  typeof BrowserAnalysisSessionSchema
>;

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const storageKey = "repo-analyzer-green.analysis-session";

export function loadBrowserAnalysisSession(
  storage: BrowserStorageLike,
): BrowserAnalysisSession | null {
  const raw = storage.getItem(storageKey);
  if (raw === null) {
    return null;
  }

  try {
    return BrowserAnalysisSessionSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveBrowserAnalysisSession(
  storage: BrowserStorageLike,
  session: BrowserAnalysisSession,
): void {
  storage.setItem(storageKey, JSON.stringify(session));
}

export function clearBrowserAnalysisSession(storage: BrowserStorageLike): void {
  storage.removeItem(storageKey);
}

export function defaultBrowserRepositoryForm(): BrowserRepositoryForm {
  return {
    provider: "local-fixture",
    name: "minimal-node-library",
    revision: "fixture",
    selectedModel: "fixture-default",
  };
}

export function browserRepositoryIdentityFromForm(
  form: BrowserRepositoryForm,
): RepositoryIdentity {
  return {
    provider: form.provider,
    name: form.name,
    ...(form.owner === undefined ? {} : { owner: form.owner }),
    ...(form.url === undefined ? {} : { url: form.url }),
    ...(form.revision === undefined ? {} : { revision: form.revision }),
    ...(form.defaultBranch === undefined
      ? {}
      : { defaultBranch: form.defaultBranch }),
  };
}

export function browserRepositoryFormFromIdentity(
  identity: RepositoryIdentity,
  selectedModel = "fixture-default",
): BrowserRepositoryForm {
  return {
    provider: identity.provider,
    name: identity.name,
    ...(identity.owner === undefined ? {} : { owner: identity.owner }),
    ...(identity.url === undefined ? {} : { url: identity.url }),
    ...(identity.revision === undefined ? {} : { revision: identity.revision }),
    ...(identity.defaultBranch === undefined
      ? {}
      : { defaultBranch: identity.defaultBranch }),
    selectedModel,
  };
}
