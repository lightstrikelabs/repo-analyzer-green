import { buildReportDashboardViewModel } from "../../application/report-dashboard/report-dashboard-view-model";
import type {
  ReportDashboardBigNumber,
  ReportDashboardLanguageSlice,
  ReportDashboardReviewerNote,
  ReportDashboardSection,
} from "../../application/report-dashboard/report-dashboard-view-model";
import type { AnalyzeRepositoryResponse } from "../../application/analyze-repository/analyze-repository-response";
import { FollowUpPanel } from "../chat/follow-up-panel";
import { PrintReportButton } from "./print-report-button";
import { ScoreRing } from "./score-ring";
import { Sparkline } from "./sparkline";

export function ReportCardView({
  analysis,
}: {
  readonly analysis: AnalyzeRepositoryResponse;
}) {
  const dashboard = buildReportDashboardViewModel(analysis);
  const strongestArea = dashboard.sections
    .filter((section) => section.score !== undefined)
    .toSorted((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];

  return (
    <section className="space-y-5" aria-labelledby="report-title">
      <header className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Repository Quality
          </p>
          <h2
            id="report-title"
            className="mt-1 text-3xl font-semibold text-slate-950"
          >
            Report Card
          </h2>
        </div>
        <PrintReportButton />
      </header>

      <section
        aria-labelledby="overview-title"
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-slate-600">
                {dashboard.overview.repositoryLabel}
              </p>
              <h3
                id="overview-title"
                className="mt-2 text-2xl font-semibold text-slate-950"
              >
                Evidence-backed report
              </h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">
                {dashboard.overview.summary}
              </p>
            </div>
            <ScoreRing
              score={dashboard.overview.overallScore}
              grade={dashboard.overview.grade}
            />
          </div>

          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
            <MetadataItem
              label="Analyzed"
              value={formatDateTime(dashboard.overview.analyzedAt)}
            />
            <MetadataItem
              label="Strongest Area"
              value={strongestArea?.title ?? "Not assessed"}
            />
            <MetadataItem label="Grade" value={dashboard.overview.grade} />
          </dl>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-5 lg:w-72">
          <p className="text-sm font-semibold text-slate-950">Reviewer</p>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            {dashboard.overview.reviewerNote}
          </p>
        </div>
      </section>

      <section
        aria-label="Report metrics"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {dashboard.bigNumbers.map((bigNumber) => (
          <BigNumberTile key={bigNumber.id} bigNumber={bigNumber} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <LanguageMixPanel
          languageSlices={dashboard.languageSlices}
          emptyMessage={dashboard.emptyLanguageMessage}
        />
        <ReviewerNotesPanel notes={dashboard.reviewerNotes} />
      </section>

      <section aria-labelledby="sections-title" className="space-y-3">
        <h3 id="sections-title" className="sr-only">
          Report Sections
        </h3>
        {dashboard.sections.map((section) => (
          <ReportSectionPanel key={section.id} section={section} />
        ))}
      </section>

      <details className="rounded-md border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Evidence, Caveats, And Suggested Follow-Ups
        </summary>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <DetailList
            title="Caveats"
            emptyMessage="No caveats were reported."
            items={analysis.reportCard.caveats.map((caveat) => ({
              title: caveat.title,
              detail: caveat.summary,
              meta: caveat.missingEvidence.join(", "),
            }))}
          />
          <DetailList
            title="Evidence References"
            emptyMessage="No evidence references were preserved."
            items={analysis.reportCard.evidenceReferences.map((reference) => ({
              title: reference.label,
              detail: reference.path ?? reference.id,
              meta: reference.id,
            }))}
          />
          <DetailList
            title="Suggested Follow-Ups"
            emptyMessage="No follow-up questions were recommended."
            items={analysis.reportCard.recommendedNextQuestions.map(
              (question) => ({
                title: question.question,
                detail: question.rationale,
                meta: question.targetDimension,
              }),
            )}
          />
        </div>
      </details>

      <FollowUpPanel analysis={analysis} />
    </section>
  );
}

function BigNumberTile({
  bigNumber,
}: {
  readonly bigNumber: ReportDashboardBigNumber;
}) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-4">
      <p className="text-sm font-medium text-slate-600">{bigNumber.label}</p>
      <p className="mt-2 break-words text-3xl font-semibold text-slate-950">
        {bigNumber.value}
      </p>
      <p className="mt-1 text-sm leading-5 text-slate-600">
        {bigNumber.detail}
      </p>
    </div>
  );
}

function LanguageMixPanel({
  languageSlices,
  emptyMessage,
}: {
  readonly languageSlices: readonly ReportDashboardLanguageSlice[];
  readonly emptyMessage: string | undefined;
}) {
  return (
    <section
      aria-labelledby="language-mix-title"
      className="rounded-md border border-slate-200 bg-white p-5"
    >
      <p className="text-sm font-medium uppercase text-emerald-700">
        Static evidence
      </p>
      <h3
        id="language-mix-title"
        className="mt-1 text-lg font-semibold text-slate-950"
      >
        Language Mix
      </h3>

      {emptyMessage === undefined ? (
        <div className="mt-5 grid gap-4">
          {languageSlices.map((slice) => (
            <div key={slice.language}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-900">
                  {slice.language}
                </span>
                <span className="text-slate-600">{slice.percentOfCode}%</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(slice.percentOfCode, 3)}%`,
                    backgroundColor: slice.color,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {formatNumber(slice.fileCount)} files,{" "}
                {formatNumber(slice.codeLineCount)} code lines
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-6 text-slate-700">{emptyMessage}</p>
      )}
    </section>
  );
}

function ReviewerNotesPanel({
  notes,
}: {
  readonly notes: readonly ReportDashboardReviewerNote[];
}) {
  return (
    <section
      aria-labelledby="reviewer-notes-title"
      className="rounded-md border border-slate-200 bg-white p-5"
    >
      <p className="text-sm font-medium uppercase text-emerald-700">
        Reviewer assessment
      </p>
      <h3
        id="reviewer-notes-title"
        className="mt-1 text-lg font-semibold text-slate-950"
      >
        Reviewer Notes
      </h3>
      {notes.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-slate-700">
          No reviewer notes were available.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-slate-200">
          {notes.map((note, index) => (
            <li key={`${note.tone}-${index}`} className="py-3 first:pt-0">
              <p className="text-sm leading-6 text-slate-800">{note.text}</p>
              <p className="mt-1 text-xs font-semibold uppercase text-slate-500">
                {note.tone}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportSectionPanel({
  section,
}: {
  readonly section: ReportDashboardSection;
}) {
  const signals = [...section.highlights, ...section.risks, ...section.caveats];

  return (
    <article className="rounded-md border border-slate-200 bg-white p-5">
      <div className="grid gap-5 xl:grid-cols-[170px_minmax(0,1fr)_minmax(220px,300px)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-slate-950">
              {section.title}
            </h4>
            <span className="rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold uppercase text-slate-700">
              {formatRating(section.rating)}
            </span>
          </div>
          <div className="mt-4">
            <ScoreRing
              score={section.score}
              grade={formatRating(section.rating)}
            />
          </div>
          <p className="mt-4 text-sm font-medium text-slate-900">
            {section.confidenceLabel}
          </p>
          <div className="mt-4">
            <Sparkline points={section.chartPoints} />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-sm leading-6 text-slate-700">{section.summary}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {section.metrics.map((metric) => (
              <MetricTile key={metric.label} metric={metric} />
            ))}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <TextList
              title="Signals"
              emptyMessage="No reviewer signals were available."
              items={signals}
            />
            <TextList
              title="Next Checks"
              emptyMessage="No next checks were recommended."
              items={section.nextChecks}
            />
          </div>
        </div>

        <SectionAskBox sectionTitle={section.title} />
      </div>
    </article>
  );
}

function SectionAskBox({ sectionTitle }: { readonly sectionTitle: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <label className="block">
        <span className="text-sm font-semibold text-slate-900">
          Ask About {sectionTitle}
        </span>
        <textarea
          aria-label={`Ask About ${sectionTitle}`}
          className="mt-2 h-24 w-full resize-none rounded-md border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none transition focus:border-emerald-500"
          placeholder={`Ask about ${sectionTitle.toLowerCase()}...`}
        />
      </label>
      <button
        type="button"
        className="mt-3 h-10 w-full rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Open Chat
      </button>
    </div>
  );
}

function MetricTile({
  metric,
}: {
  readonly metric: ReportDashboardSection["metrics"][number];
}) {
  return (
    <div className="border-t border-slate-200 pt-3">
      <p className="text-xs font-semibold uppercase text-slate-500">
        {metric.label}
      </p>
      <p className="mt-1 break-words text-2xl font-semibold text-slate-950">
        {metric.value}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{metric.detail}</p>
    </div>
  );
}

function TextList({
  title,
  emptyMessage,
  items,
}: {
  readonly title: string;
  readonly emptyMessage: string;
  readonly items: readonly string[];
}) {
  return (
    <section>
      <h5 className="text-sm font-semibold text-slate-950">{title}</h5>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="rounded-md bg-slate-50 px-3 py-2"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DetailList({
  title,
  emptyMessage,
  items,
}: {
  readonly title: string;
  readonly emptyMessage: string;
  readonly items: readonly {
    readonly title: string;
    readonly detail: string;
    readonly meta: string | undefined;
  }[];
}) {
  return (
    <section>
      <h4 className="text-sm font-semibold text-slate-950">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.title}-${item.detail}-${index}`}
              className="text-sm"
            >
              <p className="font-medium text-slate-950">{item.title}</p>
              <p className="mt-1 leading-6 text-slate-700">{item.detail}</p>
              {item.meta === undefined || item.meta === "" ? null : (
                <p className="mt-1 break-words text-xs text-slate-500">
                  {item.meta}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MetadataItem({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-slate-950">{value}</dd>
    </div>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRating(rating: string): string {
  return rating
    .split("-")
    .map((word) => word.slice(0, 1).toUpperCase() + word.slice(1))
    .join(" ");
}
