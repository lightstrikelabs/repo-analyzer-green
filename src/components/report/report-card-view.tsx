import type {
  DimensionAssessment,
  ReportCard,
  ReportCaveat,
  ReportFinding,
  ReportRating,
} from "../../domain/report/report-card";
import type { EvidenceReference } from "../../domain/shared/evidence-reference";
import type {
  AnalyzeRepositoryResponse,
  DashboardLanguageMixItem,
} from "../../application/analyze-repository/analyze-repository-response";
import { FollowUpPanel } from "../chat/follow-up-panel";
import { PrintReportButton } from "./print-report-button";

export function ReportCardView({
  analysis,
}: {
  readonly analysis: AnalyzeRepositoryResponse;
}) {
  const reportCard = analysis.reportCard;
  const findings = reportCard.dimensionAssessments.flatMap(
    (assessment) => assessment.findings,
  );
  const strongestDimension = strongestAssessedDimension(
    reportCard.dimensionAssessments,
  );
  const bigNumbers = [
    {
      label: "Dimensions",
      value: String(reportCard.dimensionAssessments.length),
      caption: "Assessed with reviewer confidence",
    },
    {
      label: "Findings",
      value: String(findings.length),
      caption: "Linked to evidence references",
    },
    {
      label: "Evidence",
      value: String(reportCard.evidenceReferences.length),
      caption: "References preserved for follow-up",
    },
    {
      label: "Caveats",
      value: String(reportCard.caveats.length),
      caption: "Missing context stays visible",
    },
  ] as const;

  return (
    <article className="space-y-6" aria-labelledby="report-title">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-medium text-slate-600">
          {repositoryLabel(reportCard)}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2
              id="report-title"
              className="text-2xl font-semibold text-slate-950"
            >
              Evidence-backed report
            </h2>
            <p className="mt-2 text-sm text-slate-700">
              Archetype:{" "}
              <span className="font-medium text-slate-950">
                {reportCard.assessedArchetype}
              </span>
            </p>
          </div>
          <p className="text-sm text-slate-600">
            Reviewer: {reportCard.reviewerMetadata.name}
          </p>
        </div>
        <PrintReportButton />
      </header>

      <section
        aria-labelledby="overview-title"
        className="grid gap-4 lg:grid-cols-[minmax(260px,0.9fr)_minmax(0,1.1fr)]"
      >
        <div className="rounded-md border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium uppercase text-emerald-700">
            Report overview
          </p>
          <h3
            id="overview-title"
            className="mt-2 text-xl font-semibold text-slate-950"
          >
            {reportCard.assessedArchetype} quality assessment
          </h3>
          <p className="mt-4 text-sm leading-6 text-slate-700">
            {analysis.dashboardInsights.evidenceSummary}
          </p>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <MetadataItem
              label="Generated"
              value={formatDateTime(reportCard.generatedAt)}
            />
            <MetadataItem
              label="Scoring policy"
              value={`${reportCard.scoringPolicy.name} ${reportCard.scoringPolicy.version}`}
            />
            <MetadataItem
              label="Reviewer kind"
              value={reportCard.reviewerMetadata.kind}
            />
            <MetadataItem
              label="Strongest dimension"
              value={strongestDimension?.title ?? "Not scored"}
            />
          </dl>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {bigNumbers.map((item) => (
            <div
              key={item.label}
              className="rounded-md border border-slate-200 bg-white p-4"
            >
              <p className="text-sm font-medium text-slate-600">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold text-slate-950">
                {item.value}
              </p>
              <p className="mt-1 text-sm leading-5 text-slate-600">
                {item.caption}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <LanguageMixPanel
          languageMix={analysis.dashboardInsights.languageMix}
          totalCodeLineCount={
            analysis.dashboardInsights.codeShapeSummary.totalCodeLineCount
          }
        />
        <ReviewerNotesPanel findings={findings} />
      </section>

      <section aria-labelledby="dimensions-title" className="space-y-3">
        <h3
          id="dimensions-title"
          className="text-lg font-semibold text-slate-950"
        >
          Dimensions
        </h3>
        <div className="space-y-3">
          {reportCard.dimensionAssessments.map((assessment) => (
            <DimensionPanel
              key={assessment.dimension}
              assessment={assessment}
              caveats={reportCard.caveats}
            />
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <CaveatsPanel caveats={reportCard.caveats} />
        <EvidencePanel references={reportCard.evidenceReferences} />
      </section>

      <section aria-labelledby="questions-title" className="space-y-3">
        <h3
          id="questions-title"
          className="text-lg font-semibold text-slate-950"
        >
          Follow-Up Questions
        </h3>
        <ul className="grid gap-2 lg:grid-cols-2">
          {reportCard.recommendedNextQuestions.map((question) => (
            <li
              key={question.id}
              className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-800"
            >
              <p className="font-medium text-slate-950">{question.question}</p>
              <p className="mt-1 text-slate-600">{question.rationale}</p>
            </li>
          ))}
        </ul>
      </section>

      <FollowUpPanel analysis={analysis} />
    </article>
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
      <dd className="mt-1 break-words text-slate-900">{value}</dd>
    </div>
  );
}

function LanguageMixPanel({
  languageMix,
  totalCodeLineCount,
}: {
  readonly languageMix: readonly DashboardLanguageMixItem[];
  readonly totalCodeLineCount: number;
}) {
  return (
    <section
      aria-labelledby="language-mix-title"
      className="rounded-md border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Static evidence
          </p>
          <h3
            id="language-mix-title"
            className="mt-1 text-lg font-semibold text-slate-950"
          >
            Language Mix
          </h3>
        </div>
        <p className="text-sm text-slate-600">
          {formatNumber(totalCodeLineCount)} code lines
        </p>
      </div>

      {languageMix.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-slate-700">
          No language mix was available in the collected evidence.
        </p>
      ) : (
        <div className="mt-5 grid gap-4">
          {languageMix.map((item, index) => (
            <div key={item.language}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-slate-900">
                  {item.language}
                </span>
                <span className="text-slate-600">
                  {item.percentOfCode}% of code
                </span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(item.percentOfCode, 3)}%`,
                    backgroundColor: languageColor(index),
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {formatNumber(item.fileCount)} files,{" "}
                {formatNumber(item.sourceFileCount)} source files,{" "}
                {formatNumber(item.codeLineCount)} code lines
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ReviewerNotesPanel({
  findings,
}: {
  readonly findings: readonly ReportFinding[];
}) {
  return (
    <section
      aria-labelledby="reviewer-notes-title"
      className="rounded-md border border-slate-200 bg-white p-5"
    >
      <p className="text-sm font-medium uppercase text-blue-700">
        Reviewer assessment
      </p>
      <h3
        id="reviewer-notes-title"
        className="mt-1 text-lg font-semibold text-slate-950"
      >
        Reviewer Notes
      </h3>
      {findings.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-slate-700">
          No findings were reported by the reviewer.
        </p>
      ) : (
        <div className="mt-5 divide-y divide-slate-200">
          {findings.map((finding) => (
            <FindingRow key={finding.id} finding={finding} compact />
          ))}
        </div>
      )}
    </section>
  );
}

function DimensionPanel({
  assessment,
  caveats,
}: {
  readonly assessment: DimensionAssessment;
  readonly caveats: readonly ReportCaveat[];
}) {
  const relevantCaveats = caveats.filter((caveat) =>
    caveat.affectedDimensions.includes(assessment.dimension),
  );

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5">
      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-slate-950">
              {assessment.title}
            </h4>
            <RatingBadge rating={assessment.rating} />
          </div>
          <ScoreStrip score={assessment.score} />
          <p className="mt-4 text-sm font-medium text-slate-900">
            {assessment.confidence.level} confidence
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {assessment.confidence.rationale}
          </p>
        </div>

        <div>
          <p className="text-sm leading-6 text-slate-700">
            {assessment.summary}
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <MetricTile
              label="Evidence"
              value={String(assessment.evidenceReferences.length)}
              detail="References for this dimension"
            />
            <MetricTile
              label="Findings"
              value={String(assessment.findings.length)}
              detail="Reviewer observations"
            />
            <MetricTile
              label="Caveats"
              value={String(relevantCaveats.length)}
              detail="Known missing context"
            />
          </div>

          {assessment.findings.length === 0 ? null : (
            <div className="mt-5 space-y-2">
              {assessment.findings.map((finding) => (
                <FindingRow key={finding.id} finding={finding} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ScoreStrip({ score }: { readonly score: number | undefined }) {
  if (score === undefined) {
    return (
      <p className="mt-4 text-sm text-slate-600">
        No numeric score assigned for this dimension.
      </p>
    );
  }

  return (
    <div className="mt-4" aria-label={`Dimension score ${score}`}>
      <div className="flex items-end justify-between text-sm">
        <span className="font-medium text-slate-700">Dimension score</span>
        <span className="text-2xl font-semibold text-slate-950">{score}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-emerald-600"
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

function RatingBadge({ rating }: { readonly rating: ReportRating }) {
  return (
    <span
      className={`rounded border px-2 py-1 text-xs font-medium uppercase ${ratingStyle(
        rating,
      )}`}
    >
      {rating}
    </span>
  );
}

function MetricTile({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}) {
  return (
    <div className="border-t border-slate-200 pt-3">
      <p className="text-xs font-semibold uppercase text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-600">{detail}</p>
    </div>
  );
}

function FindingRow({
  finding,
  compact = false,
}: {
  readonly finding: ReportFinding;
  readonly compact?: boolean;
}) {
  return (
    <section
      className={
        compact
          ? "py-3 first:pt-0 last:pb-0"
          : "rounded-md border border-slate-200 bg-slate-50 p-3"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h5 className="font-medium text-slate-950">{finding.title}</h5>
        <span
          className={`rounded px-2 py-1 text-xs font-medium uppercase ${severityStyle(
            finding.severity,
          )}`}
        >
          {finding.severity}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-700">{finding.summary}</p>
      <p className="mt-2 text-xs text-slate-600">
        Evidence: {referenceIds(finding.evidenceReferences)}
      </p>
    </section>
  );
}

function CaveatsPanel({
  caveats,
}: {
  readonly caveats: readonly ReportCaveat[];
}) {
  return (
    <section aria-labelledby="caveats-title" className="space-y-3">
      <h3 id="caveats-title" className="text-lg font-semibold text-slate-950">
        Caveats And Missing Evidence
      </h3>
      {caveats.length === 0 ? (
        <p className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-600">
          No caveats were reported.
        </p>
      ) : (
        <div className="space-y-2">
          {caveats.map((caveat) => (
            <CaveatRow key={caveat.id} caveat={caveat} />
          ))}
        </div>
      )}
    </section>
  );
}

function CaveatRow({ caveat }: { readonly caveat: ReportCaveat }) {
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50 p-3">
      <h4 className="font-medium text-slate-950">{caveat.title}</h4>
      <p className="mt-1 text-sm leading-6 text-slate-700">{caveat.summary}</p>
      {caveat.missingEvidence.length > 0 ? (
        <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
          {caveat.missingEvidence.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function EvidencePanel({
  references,
}: {
  readonly references: readonly EvidenceReference[];
}) {
  return (
    <section aria-labelledby="evidence-title" className="space-y-3">
      <h3 id="evidence-title" className="text-lg font-semibold text-slate-950">
        Evidence References
      </h3>
      <ul className="grid gap-2">
        {references.map((reference) => (
          <EvidenceReferenceItem key={reference.id} reference={reference} />
        ))}
      </ul>
    </section>
  );
}

function EvidenceReferenceItem({
  reference,
}: {
  readonly reference: EvidenceReference;
}) {
  return (
    <li className="rounded-md border border-slate-200 bg-white p-3 text-sm">
      <p className="font-medium text-slate-950">{reference.id}</p>
      <p className="mt-1 text-slate-700">{reference.label}</p>
      {reference.path === undefined ? null : (
        <p className="mt-1 break-all font-mono text-xs text-slate-600">
          {reference.path}
        </p>
      )}
    </li>
  );
}

function strongestAssessedDimension(
  assessments: readonly DimensionAssessment[],
): DimensionAssessment | undefined {
  return assessments
    .filter((assessment) => assessment.score !== undefined)
    .toSorted((left, right) => {
      const leftScore = left.score ?? 0;
      const rightScore = right.score ?? 0;
      return rightScore - leftScore;
    })[0];
}

function repositoryLabel(reportCard: ReportCard): string {
  const owner = reportCard.repository.owner;
  const ownerPrefix = owner === undefined ? "" : `${owner}/`;
  const revision =
    reportCard.repository.revision === undefined
      ? ""
      : ` @ ${reportCard.repository.revision}`;

  return `${reportCard.repository.provider}:${ownerPrefix}${reportCard.repository.name}${revision}`;
}

function referenceIds(references: readonly EvidenceReference[]): string {
  return references.map((reference) => reference.id).join(", ");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function languageColor(index: number): string {
  const colors = ["#047857", "#2563eb", "#d97706", "#be123c", "#7c3aed"];
  return colors[index % colors.length] ?? "#047857";
}

function ratingStyle(rating: ReportRating): string {
  switch (rating) {
    case "excellent":
      return "border-emerald-300 bg-emerald-50 text-emerald-800";
    case "good":
      return "border-blue-300 bg-blue-50 text-blue-800";
    case "fair":
      return "border-amber-300 bg-amber-50 text-amber-800";
    case "weak":
      return "border-orange-300 bg-orange-50 text-orange-800";
    case "poor":
      return "border-red-300 bg-red-50 text-red-800";
    case "not-assessed":
      return "border-slate-300 bg-slate-50 text-slate-700";
  }
}

function severityStyle(severity: ReportFinding["severity"]): string {
  switch (severity) {
    case "info":
      return "bg-slate-100 text-slate-700";
    case "low":
      return "bg-blue-100 text-blue-800";
    case "medium":
      return "bg-amber-100 text-amber-800";
    case "high":
      return "bg-orange-100 text-orange-800";
    case "critical":
      return "bg-red-100 text-red-800";
  }
}
