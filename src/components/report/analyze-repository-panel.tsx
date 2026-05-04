"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  BarChart3,
  ChevronDown,
  Eye,
  EyeOff,
  GitBranch,
  KeyRound,
  Loader2,
  Lock,
  Play,
} from "lucide-react";

import {
  AnalyzeRepositoryResponseSchema,
  type AnalyzeRepositoryResponse,
} from "../../application/analyze-repository/analyze-repository-response";
import { GitHubRepositoryUrlSchema } from "../../infrastructure/github/github-repository-url";
import {
  OpenRouterDefaultModelId,
  OpenRouterFreeModelId,
  OpenRouterModelIdSchema,
} from "../../infrastructure/llm/openrouter-config";
import {
  defaultBrowserRepositoryForm,
  loadBrowserAnalysisSession,
  saveBrowserAnalysisSession,
  type BrowserRepositoryForm,
} from "../../infrastructure/persistence/browser-local-session-storage";
import { ReportCardView } from "./report-card-view";

type AnalyzeStatus =
  | {
      readonly kind: "idle";
    }
  | {
      readonly kind: "loading";
    }
  | {
      readonly kind: "error";
      readonly message: string;
    };

type LoadingPhase = {
  readonly title: string;
  readonly detail: string;
  readonly progress: number;
};

const loadingPhases: readonly [LoadingPhase, ...LoadingPhase[]] = [
  {
    title: "Cloning repository",
    detail: "Fetching the GitHub snapshot and preparing it for analysis.",
    progress: 16,
  },
  {
    title: "Mapping files",
    detail: "Classifying source, tests, docs, generated files, and omissions.",
    progress: 32,
  },
  {
    title: "Scoring quality",
    detail: "Combining deterministic evidence with the domain scoring policy.",
    progress: 50,
  },
  {
    title: "Checking tests and release gates",
    detail: "Looking for verification, CI, scripts, and release readiness.",
    progress: 66,
  },
  {
    title: "Scanning security and docs",
    detail:
      "Reviewing dependency hygiene, secrets risk, and onboarding signals.",
    progress: 82,
  },
  {
    title: "Writing reviewer notes",
    detail: "Preparing evidence-backed findings, confidence, and caveats.",
    progress: 94,
  },
];

export function AnalyzeRepositoryPanel() {
  const [status, setStatus] = useState<AnalyzeStatus>({ kind: "idle" });
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const [repositoryForm, setRepositoryForm] = useState<BrowserRepositoryForm>(
    () => defaultBrowserRepositoryForm(),
  );
  const [apiKey, setApiKey] = useState("");
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [latestReport, setLatestReport] =
    useState<AnalyzeRepositoryResponse | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = loadBrowserAnalysisSession(window.localStorage);
    if (stored !== null) {
      setRepositoryForm(stored.form);
      setLatestReport(stored.latestReport ?? null);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveBrowserAnalysisSession(window.localStorage, {
      form: repositoryForm,
      ...(latestReport === null ? {} : { latestReport }),
    });
  }, [hydrated, latestReport, repositoryForm]);

  useEffect(() => {
    if (status.kind !== "loading") {
      setLoadingPhaseIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingPhaseIndex((current) =>
        Math.min(current + 1, loadingPhases.length - 1),
      );
    }, 1_200);

    return () => window.clearInterval(intervalId);
  }, [status.kind]);

  const reportContent = useMemo(() => {
    if (status.kind === "loading") {
      return {
        kind: "loading" as const,
        phase: loadingPhases[loadingPhaseIndex] ?? loadingPhases[0],
      };
    }

    if (latestReport !== null) {
      return {
        kind: "loaded" as const,
        analysis: latestReport,
      };
    }

    return { kind: "idle" as const };
  }, [latestReport, loadingPhaseIndex, status.kind]);

  async function analyzeRepository(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const repositoryUrlResult = GitHubRepositoryUrlSchema.safeParse(
      repositoryForm.repoUrl,
    );
    if (!repositoryUrlResult.success) {
      setStatus({
        kind: "error",
        message: "Enter a valid GitHub repository URL.",
      });
      return;
    }

    const normalizedRepositoryUrl = repositoryUrlResult.data.url;
    if (normalizedRepositoryUrl === undefined) {
      setStatus({
        kind: "error",
        message: "Enter a valid GitHub repository URL.",
      });
      return;
    }

    const modelResult = OpenRouterModelIdSchema.safeParse(
      repositoryForm.selectedModel,
    );
    if (!modelResult.success) {
      setStatus({
        kind: "error",
        message: "Enter a valid OpenRouter model id.",
      });
      return;
    }

    const trimmedApiKey = apiKey.trim();
    setStatus({ kind: "loading" });

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        repoUrl: normalizedRepositoryUrl,
        ...(trimmedApiKey.length === 0 ? {} : { apiKey: trimmedApiKey }),
        model: modelResult.data,
      }),
    });
    const body: unknown = await response.json();
    const parseResult = AnalyzeRepositoryResponseSchema.safeParse(body);

    if (!response.ok || !parseResult.success) {
      setStatus({
        kind: "error",
        message: "Analysis failed. Check the repository URL and try again.",
      });
      return;
    }

    setLatestReport(parseResult.data);
    setStatus({ kind: "idle" });
  }

  function updateRepositoryForm(
    updater: (current: BrowserRepositoryForm) => BrowserRepositoryForm,
  ) {
    setRepositoryForm((current) => updater(current));
    setLatestReport(null);
    if (status.kind === "error") {
      setStatus({ kind: "idle" });
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f5f1] text-[#161616]">
      <section className="border-b border-[#d9d5ca] bg-[#fbfaf7] print:hidden">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#146c60]">
                Repository Quality
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#111111] sm:text-4xl">
                Report Card
              </h1>
            </div>
            {latestReport === null ? null : (
              <div className="flex items-center gap-3 text-sm text-[#5f5b53]">
                <Lock className="h-4 w-4" aria-hidden="true" />
                <span>
                  {latestReport.reportCard.reviewerMetadata.modelName ??
                    latestReport.reportCard.reviewerMetadata.name}
                </span>
              </div>
            )}
          </div>

          <form
            data-1p-ignore
            data-lpignore="true"
            autoComplete="off"
            noValidate
            onSubmit={analyzeRepository}
            className="grid gap-3"
          >
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.8fr)_auto]">
              <label
                className="flex min-w-0 items-center gap-3 border border-[#cfc9bb] bg-white px-3 py-2"
                data-testid="repo-url-control"
              >
                <GitBranch
                  className="h-5 w-5 shrink-0 text-[#146c60]"
                  aria-hidden="true"
                />
                <span className="sr-only">GitHub repository URL</span>
                <input
                  name="repository-url"
                  type="url"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="off"
                  spellCheck={false}
                  value={repositoryForm.repoUrl}
                  onChange={(event) =>
                    updateRepositoryForm((current) => ({
                      ...current,
                      repoUrl: event.target.value,
                    }))
                  }
                  placeholder="https://github.com/owner/repo"
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[#161616] outline-none placeholder:text-[#8f887b]"
                  disabled={status.kind === "loading"}
                />
              </label>

              <label
                className="flex min-w-0 items-center gap-3 border border-[#cfc9bb] bg-white px-3 py-2"
                data-testid="api-key-control"
              >
                <KeyRound
                  className="h-5 w-5 shrink-0 text-[#3b5bdb]"
                  aria-hidden="true"
                />
                <span className="sr-only">OpenRouter API key</span>
                <input
                  name="openrouter-api-token"
                  type={apiKeyVisible ? "text" : "password"}
                  autoCapitalize="none"
                  autoCorrect="off"
                  autoComplete="new-password"
                  data-1p-ignore
                  data-lpignore="true"
                  spellCheck={false}
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  placeholder="OpenRouter API key"
                  className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[#161616] outline-none placeholder:text-[#8f887b]"
                  disabled={status.kind === "loading"}
                />
                <button
                  type="button"
                  onClick={() => setApiKeyVisible((current) => !current)}
                  disabled={status.kind === "loading"}
                  aria-label={apiKeyVisible ? "Hide API key" : "Show API key"}
                  className="grid h-7 w-7 shrink-0 place-items-center text-[#7b7468] transition hover:text-[#161616] disabled:cursor-not-allowed disabled:text-[#bdb6a8]"
                >
                  {apiKeyVisible ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </label>

              <button
                type="submit"
                disabled={status.kind === "loading"}
                className="inline-flex h-14 items-center justify-center gap-2 rounded-md bg-[#111111] px-5 text-sm font-semibold text-white transition hover:bg-[#333333] disabled:cursor-not-allowed disabled:bg-[#77736a]"
                title="Analyze repository"
              >
                {status.kind === "loading" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {status.kind === "loading" ? "Analyzing" : "Analyze"}
              </button>
            </div>

            <details className="group border border-[#d8d2c5] bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm font-semibold text-[#3f3b35]">
                <span>Advanced</span>
                <ChevronDown
                  className="h-4 w-4 text-[#7b7468] transition group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="grid gap-3 border-t border-[#e4dfd4] p-4 md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-end">
                <label className="grid gap-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7468]">
                    OpenRouter Model
                  </span>
                  <input
                    name="openrouter-model-id"
                    value={repositoryForm.selectedModel}
                    onChange={(event) =>
                      updateRepositoryForm((current) => ({
                        ...current,
                        selectedModel: event.target.value,
                      }))
                    }
                    placeholder={OpenRouterDefaultModelId}
                    autoCapitalize="none"
                    autoCorrect="off"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 border border-[#cfc9bb] bg-[#fbfaf7] px-3 text-sm outline-none focus:border-[#146c60]"
                    disabled={status.kind === "loading"}
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    updateRepositoryForm((current) => ({
                      ...current,
                      selectedModel: OpenRouterDefaultModelId,
                    }))
                  }
                  disabled={status.kind === "loading"}
                  className="h-11 border border-[#cfc9bb] px-4 text-sm font-semibold text-[#3f3b35] transition hover:bg-[#f6f5f1] disabled:cursor-not-allowed disabled:text-[#8f887b]"
                >
                  Use GPT-5 Mini
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateRepositoryForm((current) => ({
                      ...current,
                      selectedModel: OpenRouterFreeModelId,
                    }))
                  }
                  disabled={status.kind === "loading"}
                  className="h-11 border border-[#cfc9bb] px-4 text-sm font-semibold text-[#3f3b35] transition hover:bg-[#f6f5f1] disabled:cursor-not-allowed disabled:text-[#8f887b]"
                >
                  Use Free Router
                </button>
              </div>
            </details>
          </form>

          {status.kind === "error" ? (
            <div
              role="alert"
              className="border border-[#be123c] bg-[#fff1f2] px-4 py-3 text-sm text-[#9f1239]"
            >
              {status.message}
            </div>
          ) : null}
        </div>
      </section>

      <section className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {reportContent.kind === "loaded" ? (
          <ReportCardView
            analysis={reportContent.analysis}
            apiKey={apiKey}
            model={repositoryForm.selectedModel}
          />
        ) : reportContent.kind === "loading" ? (
          <AnalysisLoadingState phase={reportContent.phase} />
        ) : (
          <section className="grid min-h-[54vh] place-items-center border border-dashed border-[#cfc9bb] bg-[#fbfaf7] p-5 text-center sm:p-8">
            <div>
              <BarChart3
                className="mx-auto h-10 w-10 text-[#146c60]"
                aria-hidden="true"
              />
              <h2 className="mt-5 text-xl font-semibold text-[#161616]">
                No report loaded
              </h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-[#7b7468]">
                Enter a repository URL to begin.
              </p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

function AnalysisLoadingState({ phase }: { readonly phase: LoadingPhase }) {
  return (
    <section className="grid min-h-[54vh] place-items-center border border-dashed border-[#cfc9bb] bg-[#fbfaf7] p-5 text-center sm:p-8">
      <div className="w-full max-w-md">
        <BarChart3
          className="mx-auto h-10 w-10 text-[#146c60]"
          aria-hidden="true"
        />
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-[#146c60]">
          Analysis in progress
        </p>
        <h2 className="mt-3 text-xl font-semibold text-[#161616]">
          {phase.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#7b7468]">{phase.detail}</p>
        <div
          className="mt-6 border border-[#d8d2c5] bg-white p-4 text-left"
          aria-label={`Analysis ${phase.progress}% complete`}
        >
          <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7468]">
            <span>Progress</span>
            <span>{phase.progress}%</span>
          </div>
          <div className="mt-3 h-3 overflow-hidden bg-[#ebe6db]">
            <div
              className="h-full bg-[#146c60] transition-all duration-700 ease-out"
              style={{ width: `${phase.progress}%` }}
            />
          </div>
        </div>
        <div className="mt-4 flex items-start gap-3 border border-[#d8d2c5] bg-white p-4 text-left">
          <Loader2
            className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-[#d97706]"
            aria-hidden="true"
          />
          <div
            aria-hidden="true"
            className="min-w-0 text-sm leading-6 text-[#3f3b35]"
          >
            {phase.detail}
          </div>
        </div>
      </div>
    </section>
  );
}
