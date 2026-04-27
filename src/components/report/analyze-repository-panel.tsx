"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

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
  clearBrowserLocalSession,
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

  function resetSavedSession() {
    clearBrowserLocalSession(window.localStorage);
    setRepositoryForm(defaultBrowserRepositoryForm());
    setApiKey("");
    setLatestReport(null);
    setStatus({ kind: "idle" });
  }

  return (
    <div className="min-h-screen bg-stone-50 text-slate-950">
      <section className="border-b border-slate-200 bg-white px-4 py-5 print:hidden sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-emerald-700">
                Repository Quality
              </p>
              <h1 className="mt-1 text-3xl font-semibold text-slate-950">
                Report Card
              </h1>
            </div>
            <button
              type="button"
              onClick={resetSavedSession}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Reset
            </button>
          </div>

          <form
            noValidate
            onSubmit={analyzeRepository}
            className="mt-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_minmax(220px,320px)_auto]"
          >
            <Field label="GitHub repository URL">
              <input
                type="url"
                inputMode="url"
                autoComplete="url"
                value={repositoryForm.repoUrl}
                onChange={(event) =>
                  updateRepositoryForm((current) => ({
                    ...current,
                    repoUrl: event.target.value,
                  }))
                }
                placeholder="https://github.com/owner/repo"
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                disabled={status.kind === "loading"}
              />
            </Field>

            <Field label="OpenRouter API key">
              <input
                type="password"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                className="h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                disabled={status.kind === "loading"}
              />
            </Field>

            <button
              type="submit"
              disabled={status.kind === "loading"}
              className="h-11 rounded-md bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {status.kind === "loading" ? "Analyzing" : "Analyze"}
            </button>

            <details className="lg:col-span-3">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                Advanced
              </summary>
              <div className="mt-3 grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[minmax(220px,420px)_auto_auto]">
                <Field label="OpenRouter Model">
                  <input
                    value={repositoryForm.selectedModel}
                    onChange={(event) =>
                      updateRepositoryForm((current) => ({
                        ...current,
                        selectedModel: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
                    disabled={status.kind === "loading"}
                  />
                </Field>
                <button
                  type="button"
                  onClick={() =>
                    updateRepositoryForm((current) => ({
                      ...current,
                      selectedModel: OpenRouterDefaultModelId,
                    }))
                  }
                  disabled={status.kind === "loading"}
                  className="h-10 self-end rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
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
                  className="h-10 self-end rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  Use Free Router
                </button>
              </div>
            </details>
          </form>

          {status.kind === "error" ? (
            <p role="alert" className="mt-3 text-sm font-medium text-red-700">
              {status.message}
            </p>
          ) : null}
        </div>
      </section>

      <main className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6">
        {reportContent.kind === "loaded" ? (
          <ReportCardView
            analysis={reportContent.analysis}
            apiKey={apiKey}
            model={repositoryForm.selectedModel}
          />
        ) : reportContent.kind === "loading" ? (
          <AnalysisLoadingState phase={reportContent.phase} />
        ) : (
          <section className="flex min-h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-6 text-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No report loaded
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-700">
                Enter a repository URL to begin.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

function AnalysisLoadingState({ phase }: { readonly phase: LoadingPhase }) {
  return (
    <section className="flex min-h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-6 text-center">
      <div className="w-full max-w-md">
        <p className="text-sm font-medium uppercase text-emerald-700">
          Analysis in progress
        </p>
        <h2 className="mt-3 text-lg font-semibold text-slate-950">
          {phase.title}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-700">{phase.detail}</p>
        <div
          className="mt-5 h-2 overflow-hidden rounded-full bg-slate-200"
          aria-label={`Analysis ${phase.progress}% complete`}
        >
          <div
            className="h-full rounded-full bg-emerald-600 transition-[width]"
            style={{ width: `${phase.progress}%` }}
          />
        </div>
      </div>
    </section>
  );
}
