import { z } from "zod";

import { AnalyzeRepositoryResponseSchema } from "../../application/analyze-repository/analyze-repository-response";
import {
  OpenRouterDefaultModelId,
  OpenRouterModelIdSchema,
} from "../llm/openrouter-config";

export const BrowserAnalysisSessionSchemaVersion =
  "browser-analysis-session.v1";

export const BrowserRepositoryFormSchema = z
  .object({
    repoUrl: z.string(),
    selectedModel: OpenRouterModelIdSchema,
  })
  .strict();

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
    repoUrl: "",
    selectedModel: OpenRouterDefaultModelId,
  };
}
