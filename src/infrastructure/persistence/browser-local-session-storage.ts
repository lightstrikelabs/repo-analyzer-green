import { z } from "zod";

import { AnalyzeRepositoryResponseSchema } from "../../application/analyze-repository/analyze-repository-response";
import { ChatAnswerContractSchema } from "../../domain/chat/chat-answer";
import {
  ConversationSchema,
  ConversationTargetSchema,
} from "../../domain/chat/conversation";
import {
  RepositoryIdentitySchema,
  type RepositoryIdentity,
} from "../../domain/report/report-card";

export const BrowserLocalSessionSchemaVersion = "browser-local-session.v1";

export const BrowserRepositoryFormSchema = RepositoryIdentitySchema.extend({
  selectedModel: z.string().min(1),
}).strict();

export type BrowserRepositoryForm = z.infer<typeof BrowserRepositoryFormSchema>;

export const BrowserAnalysisSessionSchema = z
  .object({
    form: BrowserRepositoryFormSchema,
    latestReport: AnalyzeRepositoryResponseSchema.optional(),
  })
  .strict();

export type BrowserAnalysisSession = z.infer<
  typeof BrowserAnalysisSessionSchema
>;

export const BrowserFollowUpSessionSchema = z
  .object({
    conversation: ConversationSchema,
    target: ConversationTargetSchema,
    answer: ChatAnswerContractSchema,
    evidenceSummary: z.string(),
    title: z.string(),
  })
  .strict();

export type BrowserFollowUpSession = z.infer<
  typeof BrowserFollowUpSessionSchema
>;

export const BrowserFollowUpStateSchema = z
  .object({
    sessions: z.array(BrowserFollowUpSessionSchema),
    activeConversationId: z.string().nullable(),
  })
  .strict();

export type BrowserFollowUpState = z.infer<typeof BrowserFollowUpStateSchema>;

export const BrowserLocalSessionSchema = z
  .object({
    schemaVersion: z.literal(BrowserLocalSessionSchemaVersion),
    analysis: BrowserAnalysisSessionSchema,
    followUpThreads: z.record(z.string(), BrowserFollowUpStateSchema),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export type BrowserLocalSession = z.infer<typeof BrowserLocalSessionSchema>;

export interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const BrowserLocalSessionStorageKey =
  "repo-analyzer-green.browser-local-session";

export function loadBrowserLocalSession(
  storage: BrowserStorageLike,
): BrowserLocalSession | null {
  const raw = storage.getItem(BrowserLocalSessionStorageKey);
  if (raw === null) {
    return null;
  }

  try {
    return BrowserLocalSessionSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveBrowserLocalSession(
  storage: BrowserStorageLike,
  session: BrowserLocalSession,
): void {
  storage.setItem(BrowserLocalSessionStorageKey, JSON.stringify(session));
}

export function loadBrowserAnalysisSession(
  storage: BrowserStorageLike,
): BrowserAnalysisSession | null {
  return loadBrowserLocalSession(storage)?.analysis ?? null;
}

export function saveBrowserAnalysisSession(
  storage: BrowserStorageLike,
  analysis: BrowserAnalysisSession,
): void {
  const current =
    loadBrowserLocalSession(storage) ?? defaultBrowserLocalSession();
  saveBrowserLocalSession(
    storage,
    BrowserLocalSessionSchema.parse({
      ...current,
      analysis,
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function loadBrowserFollowUpState(
  storage: BrowserStorageLike,
  reportCardId: string,
): BrowserFollowUpState | null {
  return (
    loadBrowserLocalSession(storage)?.followUpThreads[reportCardId] ?? null
  );
}

export function saveBrowserFollowUpState(
  storage: BrowserStorageLike,
  reportCardId: string,
  state: BrowserFollowUpState,
): void {
  const current =
    loadBrowserLocalSession(storage) ?? defaultBrowserLocalSession();
  saveBrowserLocalSession(
    storage,
    BrowserLocalSessionSchema.parse({
      ...current,
      followUpThreads: {
        ...current.followUpThreads,
        [reportCardId]: state,
      },
      updatedAt: new Date().toISOString(),
    }),
  );
}

export function clearBrowserLocalSession(storage: BrowserStorageLike): void {
  storage.removeItem(BrowserLocalSessionStorageKey);
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

function defaultBrowserLocalSession(): BrowserLocalSession {
  return {
    schemaVersion: BrowserLocalSessionSchemaVersion,
    analysis: {
      form: defaultBrowserRepositoryForm(),
    },
    followUpThreads: {},
    updatedAt: new Date().toISOString(),
  };
}
