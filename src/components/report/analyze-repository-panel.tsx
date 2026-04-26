"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import {
  AnalyzeRepositoryResponseSchema,
  type AnalyzeRepositoryResponse,
} from "../../application/analyze-repository/analyze-repository-response";
import {
  clearBrowserAnalysisSession,
  defaultBrowserRepositoryForm,
  loadBrowserAnalysisSession,
  saveBrowserAnalysisSession,
  type BrowserRepositoryForm,
} from "../../infrastructure/persistence/browser-analysis-session-storage";
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
    title: "Collecting repository evidence",
    detail: "Inventorying files, manifests, workflows, and omissions.",
    progress: 28,
  },
  {
    title: "Measuring code shape",
    detail: "Summarizing language mix, code lines, tests, and caveats.",
    progress: 52,
  },
  {
    title: "Reviewing dimensions",
    detail: "Combining deterministic evidence with reviewer assessment.",
    progress: 76,
  },
  {
    title: "Preparing report card",
    detail: "Linking findings, confidence, caveats, and evidence references.",
    progress: 92,
  },
];

export function AnalyzeRepositoryPanel() {
  const [status, setStatus] = useState<AnalyzeStatus>({ kind: "idle" });
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);
  const [repositoryForm, setRepositoryForm] = useState<BrowserRepositoryForm>(
    () => defaultBrowserRepositoryForm(),
  );
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
      schemaVersion: "browser-analysis-session.v1",
      form: repositoryForm,
      ...(latestReport === null ? {} : { latestReport }),
      updatedAt: new Date().toISOString(),
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

  async function analyzeRepository() {
    setStatus({ kind: "loading" });

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        repository: {
          provider: repositoryForm.provider,
          name: repositoryForm.name,
          ...(repositoryForm.owner === undefined
            ? {}
            : { owner: repositoryForm.owner }),
          ...(repositoryForm.url === undefined
            ? {}
            : { url: repositoryForm.url }),
          ...(repositoryForm.revision === undefined
            ? {}
            : { revision: repositoryForm.revision }),
        },
      }),
    });
    const body: unknown = await response.json();
    const parseResult = AnalyzeRepositoryResponseSchema.safeParse(body);

    if (!response.ok || !parseResult.success) {
      setStatus({
        kind: "error",
        message:
          "Analysis failed. Check the repository evidence and try again.",
      });
      return;
    }

    setLatestReport(parseResult.data);
    setStatus({ kind: "idle" });
  }

  function updateRepositoryForm(
    updater: (current: BrowserRepositoryForm) => BrowserRepositoryForm,
  ) {
    setRepositoryForm((current) => {
      const next = updater(current);
      return next;
    });
    setLatestReport(null);
    if (status.kind === "error") {
      setStatus({ kind: "idle" });
    }
  }

  function resetSavedSession() {
    clearBrowserAnalysisSession(window.localStorage);
    setRepositoryForm(defaultBrowserRepositoryForm());
    setLatestReport(null);
    setStatus({ kind: "idle" });
  }

  return (
    <div className="grid min-h-screen gap-6 px-6 py-6 lg:grid-cols-[360px_1fr]">
      <aside className="rounded-md border border-slate-200 bg-white p-5 print:hidden">
        <p className="text-sm font-medium uppercase text-emerald-700">
          Repo Analyzer Green
        </p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-950">
          Repository analysis
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Run the repository analysis workflow to produce a report card with
          dimensions, evidence, confidence, caveats, and follow-up questions.
        </p>

        <section className="mt-5 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase text-emerald-700">
                Browser session
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                Repository settings and the latest report are restored from this
                browser only.
              </p>
            </div>
            <button
              type="button"
              onClick={resetSavedSession}
              className="rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-white"
            >
              Reset
            </button>
          </div>

          <div className="grid gap-3">
            <Field label="Provider">
              <select
                value={repositoryForm.provider}
                onChange={(event) =>
                  updateRepositoryForm((current) => ({
                    ...current,
                    provider: event.target
                      .value as BrowserRepositoryForm["provider"],
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                disabled={status.kind === "loading"}
              >
                <option value="local-fixture">local-fixture</option>
                <option value="github">github</option>
              </select>
            </Field>

            <Field label="Repository name">
              <input
                value={repositoryForm.name}
                onChange={(event) =>
                  updateRepositoryForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                disabled={status.kind === "loading"}
              />
            </Field>

            <Field label="Revision">
              <input
                value={repositoryForm.revision ?? ""}
                onChange={(event) =>
                  updateRepositoryForm((current) => ({
                    ...current,
                    revision:
                      event.target.value.length === 0
                        ? undefined
                        : event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                disabled={status.kind === "loading"}
              />
            </Field>

            <details className="rounded-md border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-800">
                Advanced repository details
              </summary>
              <div className="mt-3 grid gap-3">
                <Field label="Owner">
                  <input
                    value={repositoryForm.owner ?? ""}
                    onChange={(event) =>
                      updateRepositoryForm((current) => ({
                        ...current,
                        owner:
                          event.target.value.length === 0
                            ? undefined
                            : event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                    disabled={status.kind === "loading"}
                  />
                </Field>

                <Field label="Repository URL">
                  <input
                    value={repositoryForm.url ?? ""}
                    onChange={(event) =>
                      updateRepositoryForm((current) => ({
                        ...current,
                        url:
                          event.target.value.length === 0
                            ? undefined
                            : event.target.value,
                      }))
                    }
                    className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                    disabled={status.kind === "loading"}
                  />
                </Field>
              </div>
            </details>

            <Field label="Reviewer model preference">
              <input
                value={repositoryForm.selectedModel}
                onChange={(event) =>
                  updateRepositoryForm((current) => ({
                    ...current,
                    selectedModel: event.target.value,
                  }))
                }
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-400"
                disabled={status.kind === "loading"}
              />
            </Field>
          </div>

          <p className="text-xs leading-5 text-slate-600">
            This browser stores the repository form, selected model preference,
            and the latest successful report. API keys are not persisted here.
          </p>

          <button
            type="button"
            onClick={analyzeRepository}
            disabled={status.kind === "loading"}
            className="w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {status.kind === "loading"
              ? "Analyzing repository..."
              : "Analyze repository"}
          </button>

          {status.kind === "error" ? (
            <p role="alert" className="text-sm text-red-700">
              {status.message}
            </p>
          ) : null}
        </section>
      </aside>

      <main className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-5">
        {reportContent.kind === "loaded" ? (
          <ReportCardView analysis={reportContent.analysis} />
        ) : reportContent.kind === "loading" ? (
          <AnalysisLoadingState phase={reportContent.phase} />
        ) : (
          <section className="flex min-h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-6 text-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No report generated yet
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-700">
                Start an analysis to generate dimensions, findings, confidence,
                caveats, and evidence references.
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
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
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
