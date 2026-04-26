"use client";

import { useState } from "react";

import type { ReportCard } from "../../domain/report/report-card";
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
      readonly reportCard: ReportCard;
    }
  | {
      readonly kind: "error";
      readonly message: string;
    };

export function AnalyzeRepositoryPanel() {
  const [state, setState] = useState<AnalyzeState>({ kind: "idle" });

  async function analyzeFixture() {
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

    if (!response.ok || !isReportResponse(body)) {
      setState({
        kind: "error",
        message:
          "Analysis failed. Check the repository evidence and try again.",
      });
      return;
    }

    setState({
      kind: "loaded",
      reportCard: body.reportCard,
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
          Run the deterministic fixture path to produce a report card with
          dimensions, evidence, confidence, caveats, and follow-up questions.
        </p>
        <button
          type="button"
          onClick={analyzeFixture}
          disabled={state.kind === "loading"}
          className="mt-5 w-full rounded-md bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {state.kind === "loading" ? "Analyzing..." : "Analyze fixture"}
        </button>
        {state.kind === "error" ? (
          <p role="alert" className="mt-4 text-sm text-red-700">
            {state.message}
          </p>
        ) : null}
      </aside>

      <main className="min-w-0 rounded-md border border-slate-200 bg-slate-50 p-5">
        {state.kind === "loaded" ? (
          <ReportCardView reportCard={state.reportCard} />
        ) : (
          <section className="flex min-h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-6 text-center">
            <div>
              <h2 className="text-lg font-semibold text-slate-950">
                No report generated yet
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-700">
                Start with the fixture workflow while GitHub, live reviewer, and
                persistence adapters continue to evolve behind stable contracts.
              </p>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function isReportResponse(
  value: unknown,
): value is { readonly reportCard: ReportCard } {
  return (
    typeof value === "object" &&
    value !== null &&
    "reportCard" in value &&
    typeof value.reportCard === "object" &&
    value.reportCard !== null
  );
}
