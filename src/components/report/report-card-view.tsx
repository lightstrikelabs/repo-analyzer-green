import type {
  DimensionAssessment,
  ReportCard,
  ReportCaveat,
  ReportFinding,
} from "../../domain/report/report-card";
import type { EvidenceReference } from "../../domain/shared/evidence-reference";

export function ReportCardView({
  reportCard,
}: {
  readonly reportCard: ReportCard;
}) {
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
      </header>

      <section aria-labelledby="dimensions-title" className="space-y-3">
        <h3
          id="dimensions-title"
          className="text-lg font-semibold text-slate-950"
        >
          Dimensions
        </h3>
        <div className="grid gap-3 lg:grid-cols-2">
          {reportCard.dimensionAssessments.map((assessment) => (
            <DimensionCard key={assessment.dimension} assessment={assessment} />
          ))}
        </div>
      </section>

      <section aria-labelledby="findings-title" className="space-y-3">
        <h3
          id="findings-title"
          className="text-lg font-semibold text-slate-950"
        >
          Findings
        </h3>
        <div className="space-y-2">
          {reportCard.dimensionAssessments.flatMap((assessment) =>
            assessment.findings.map((finding) => (
              <FindingRow key={finding.id} finding={finding} />
            )),
          )}
        </div>
      </section>

      <section aria-labelledby="caveats-title" className="space-y-3">
        <h3 id="caveats-title" className="text-lg font-semibold text-slate-950">
          Caveats And Missing Evidence
        </h3>
        {reportCard.caveats.length === 0 ? (
          <p className="text-sm text-slate-600">No caveats were reported.</p>
        ) : (
          <div className="space-y-2">
            {reportCard.caveats.map((caveat) => (
              <CaveatRow key={caveat.id} caveat={caveat} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="evidence-title" className="space-y-3">
        <h3
          id="evidence-title"
          className="text-lg font-semibold text-slate-950"
        >
          Evidence References
        </h3>
        <ul className="grid gap-2 lg:grid-cols-2">
          {reportCard.evidenceReferences.map((reference) => (
            <EvidenceReferenceItem key={reference.id} reference={reference} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="questions-title" className="space-y-3">
        <h3
          id="questions-title"
          className="text-lg font-semibold text-slate-950"
        >
          Follow-Up Questions
        </h3>
        <ul className="space-y-2">
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
    </article>
  );
}

function DimensionCard({
  assessment,
}: {
  readonly assessment: DimensionAssessment;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-semibold text-slate-950">{assessment.title}</h4>
        <span className="rounded border border-slate-300 px-2 py-1 text-xs font-medium uppercase text-slate-700">
          {assessment.rating}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-700">
        {assessment.summary}
      </p>
      <p className="mt-3 text-sm font-medium text-slate-900">
        {assessment.confidence.level} confidence
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-600">
        {assessment.confidence.rationale}
      </p>
    </section>
  );
}

function FindingRow({ finding }: { readonly finding: ReportFinding }) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-medium text-slate-950">{finding.title}</h4>
        <span className="text-xs font-medium uppercase text-slate-600">
          {finding.severity}
        </span>
      </div>
      <p className="mt-1 text-sm leading-6 text-slate-700">{finding.summary}</p>
      <p className="mt-2 text-xs text-slate-600">
        Evidence:{" "}
        {finding.evidenceReferences.map((reference) => reference.id).join(", ")}
      </p>
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
        <p className="mt-1 font-mono text-xs text-slate-600">
          {reference.path}
        </p>
      )}
    </li>
  );
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
