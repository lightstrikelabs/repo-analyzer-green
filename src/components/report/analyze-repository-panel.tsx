"use client";

import { useEffect, useState } from "react";

import {
  AnalyzeRepositoryResponseSchema,
  type AnalyzeRepositoryResponse,
} from "../../application/analyze-repository/analyze-repository-response";
import { ReportCardView } from "./report-card-view";

type AnalyzeState =
  | {
      readonly kind: "idle";
    }
  | {
      readonly kind: "loading";
    }
  | {
      readonly kind: "loaded";
      readonly analysis: AnalyzeRepositoryResponse;
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
  const [state, setState] = useState<AnalyzeState>({ kind: "idle" });
  const [loadingPhaseIndex, setLoadingPhaseIndex] = useState(0);

  useEffect(() => {
    if (state.kind !== "loading") {
      setLoadingPhaseIndex(0);
      return;
    }

    const intervalId = window.setInterval(() => {
      setLoadingPhaseIndex((current) =>
        Math.min(current + 1, loadingPhases.length - 1),
      );
    }, 1_200);

    return () => window.clearInterval(intervalId);
  }, [state.kind]);

  async function analyzeRepository() {
    setState({ kind: "loading" });

    const response = await fetch("/api/analyze", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        repository: {
          provider: "local-fixture",
          name: "minimal-node-library",
          revision: "fixture",
        },
      }),
    });
    const body: unknown = await response.json();
    const parseResult = AnalyzeRepositoryResponseSchema.safeParse(body);

    if (!response.ok || !parseResult.success) {
      setState({
        kind: "error",
        message:
          "Analysis failed. Check the repository evidence and try again.",
      });
      return;
    }

    setState({
      kind: "loaded",
      analysis: parseResult.data,
    });
  }

  return (
    <div className="grid min-h-screen gap-6 px-6 py-6 lg:grid-cols-[340px_1fr]">
      <aside className="rounded-md border border-slate-200 bg-white p-5">
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
        <button
          type="button"
          onClick={analyzeRepository}
          disabled={state.kind === "loading"}
          className="mt-5 w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {state.kind === "loading"
            ? "Analyzing repository..."
            : "Analyze repository"}
        </button>
        {state.kind === "error" ? (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {state.message}
          </p>
        ) : null}
      </aside>

      <main className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-5">
        {state.kind === "loaded" ? (
          <ReportCardView analysis={state.analysis} />
        ) : state.kind === "loading" ? (
          <AnalysisLoadingState
            phase={loadingPhases[loadingPhaseIndex] ?? loadingPhases[0]}
          />
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
