"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Boxes,
  FileText,
  MessageSquare,
  Send,
  ShieldCheck,
  TestTube2,
  Wrench,
} from "lucide-react";
import { z } from "zod";

import { buildReportDashboardViewModel } from "../../application/report-dashboard/report-dashboard-view-model";
import type {
  ReportDashboardBigNumber,
  ReportDashboardLanguageSlice,
  ReportDashboardReviewerNote,
  ReportDashboardSection,
  ReportDashboardSectionId,
} from "../../application/report-dashboard/report-dashboard-view-model";
import type { AnalyzeRepositoryResponse } from "../../application/analyze-repository/analyze-repository-response";
import { ChatAnswerContractSchema } from "../../domain/chat/chat-answer";
import {
  ConversationSchema,
  type ConversationTarget,
} from "../../domain/chat/conversation";
import { EvidenceReferenceSchema } from "../../domain/shared/evidence-reference";
import { OpenRouterDefaultModelId } from "../../infrastructure/llm/openrouter-config";
import {
  loadBrowserFollowUpState,
  saveBrowserFollowUpState,
  type BrowserFollowUpSession,
  type BrowserFollowUpState,
} from "../../infrastructure/persistence/browser-local-session-storage";
import { FollowUpSlideout } from "../chat/follow-up-slideout";
import { PrintReportButton } from "./print-report-button";
import { ScoreRing } from "./score-ring";
import { Sparkline } from "./sparkline";

const sectionIcons = {
  maintainability: Wrench,
  testing: TestTube2,
  security: ShieldCheck,
  architecture: Boxes,
  documentation: FileText,
} satisfies Record<ReportDashboardSectionId, typeof Wrench>;

export function ReportCardView({
  apiKey = "",
  analysis,
  model = OpenRouterDefaultModelId,
}: {
  readonly apiKey?: string;
  readonly analysis: AnalyzeRepositoryResponse;
  readonly model?: string;
}) {
  const dashboard = buildReportDashboardViewModel(analysis);
  const strongestArea = dashboard.sections
    .filter((section) => section.score !== undefined)
    .toSorted((left, right) => (right.score ?? 0) - (left.score ?? 0))[0];
  const reportCard = analysis.reportCard;
  const [sessions, setSessions] = useState<BrowserFollowUpSession[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState("");
  const [loadingTarget, setLoadingTarget] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const activeSession = useMemo(
    () =>
      sessions.find(
        (session) => session.conversation.id === activeConversationId,
      ) ??
      sessions[0] ??
      null,
    [activeConversationId, sessions],
  );

  useEffect(() => {
    const stored = loadBrowserFollowUpState(window.localStorage, reportCard.id);
    const nextState: BrowserFollowUpState = stored ?? {
      sessions: [],
      activeConversationId: null,
    };
    setSessions(nextState.sessions);
    setActiveConversationId(
      nextState.activeConversationId ??
        nextState.sessions[0]?.conversation.id ??
        null,
    );
    setHydrated(true);
  }, [reportCard.id]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    saveBrowserFollowUpState(window.localStorage, reportCard.id, {
      sessions,
      activeConversationId,
    });
  }, [activeConversationId, hydrated, reportCard.id, sessions]);

  async function startSectionConversation(
    section: ReportDashboardSection,
    question: string,
  ) {
    const trimmedQuestion =
      question.trim() === ""
        ? `What should we inspect first for ${section.title}?`
        : question.trim();

    await sendFollowUpRequest({
      loadingKey: section.id,
      question: trimmedQuestion,
      requestBody: {
        reportCard,
        target: {
          kind: "report-section",
          sectionId: section.id,
        },
        question: trimmedQuestion,
        apiKey,
        model,
      },
    });
  }

  async function continueActiveConversation() {
    const question = chatDraft.trim();
    if (question === "" || activeSession === null) {
      return;
    }

    await sendFollowUpRequest({
      loadingKey: activeSession.conversation.id,
      question,
      requestBody: {
        reportCard,
        conversationId: activeSession.conversation.id,
        messages: activeSession.conversation.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        question,
        apiKey,
        model,
      },
    });
  }

  async function sendFollowUpRequest(input: {
    readonly loadingKey: string;
    readonly question: string;
    readonly requestBody: FollowUpRequestBody;
  }) {
    setChatOpen(true);
    setChatError("");
    setLoadingTarget(input.loadingKey);

    try {
      const trimmedApiKey = apiKey.trim();
      if (trimmedApiKey === "") {
        setChatError("OpenRouter API key is required for follow-up questions.");
        return;
      }

      const response = await fetch("/api/follow-up", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ...input.requestBody,
          apiKey: trimmedApiKey,
        }),
      });
      const body: unknown = await response.json();

      if (!response.ok) {
        setChatError(errorMessageFor(body));
        return;
      }

      const parseResult = FollowUpApiResponseSchema.safeParse(body);
      if (!parseResult.success) {
        setChatError("Follow-up answer could not be loaded.");
        return;
      }

      const nextSession = sessionFromApiResult(parseResult.data);
      setSessions((current) => [
        nextSession,
        ...current.filter(
          (session) => session.conversation.id !== nextSession.conversation.id,
        ),
      ]);
      setActiveConversationId(nextSession.conversation.id);
      setChatDraft("");
    } catch {
      setChatError("Follow-up answer failed unexpectedly.");
    } finally {
      setLoadingTarget(null);
    }
  }

  return (
    <section className="space-y-5" aria-labelledby="overview-title">
      <section
        aria-labelledby="overview-title"
        className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div className="border border-[#d8d2c5] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <p className="break-words text-sm font-medium text-[#5f5b53]">
                {dashboard.overview.repositoryLabel}
              </p>
              <h3
                id="overview-title"
                className="mt-1 text-2xl font-semibold tracking-normal text-[#111111]"
              >
                Evidence-backed report
              </h3>
              <p className="mt-5 max-w-3xl text-sm leading-6 text-[#3f3b35]">
                {dashboard.overview.summary}
              </p>
            </div>
            <div className="flex flex-col items-end gap-4">
              <PrintReportButton />
              <ScoreRing
                score={dashboard.overview.overallScore}
                grade={dashboard.overview.grade}
              />
            </div>
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

        <div className="border border-[#d8d2c5] bg-white p-5 lg:w-72">
          <p className="text-sm font-semibold text-[#111111]">Reviewer</p>
          <p className="mt-2 text-sm leading-6 text-[#3f3b35]">
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
          <ReportSectionPanel
            key={section.id}
            loading={loadingTarget === section.id}
            onAsk={(question) => startSectionConversation(section, question)}
            section={section}
          />
        ))}
      </section>

      <details className="rounded-md border border-[#d8d2c5] bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[#25221e]">
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

      <FollowUpSlideout
        activeConversationId={activeSession?.conversation.id ?? null}
        draft={chatDraft}
        error={chatError}
        isLoading={loadingTarget !== null}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
        onContinue={continueActiveConversation}
        onDraftChange={setChatDraft}
        onOpen={() => setChatOpen(true)}
        onSelectConversation={setActiveConversationId}
        sessions={sessions}
      />
    </section>
  );
}

function BigNumberTile({
  bigNumber,
}: {
  readonly bigNumber: ReportDashboardBigNumber;
}) {
  return (
    <div className="border border-[#d8d2c5] bg-white p-5">
      <p className="text-sm font-medium text-[#5f5b53]">{bigNumber.label}</p>
      <p className="mt-3 break-words text-4xl font-semibold tracking-normal text-[#111111]">
        {bigNumber.value}
      </p>
      <p className="mt-2 text-sm leading-5 text-[#7b7468]">
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
      className="border border-[#d8d2c5] bg-white p-5"
    >
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-[#146c60]" aria-hidden="true" />
        <h3 id="language-mix-title" className="text-lg font-semibold">
          Language Mix
        </h3>
      </div>

      {emptyMessage === undefined ? (
        <div className="mt-5 grid gap-4">
          {languageSlices.map((slice) => (
            <div key={slice.language}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-[#3f3b35]">
                  {slice.language}
                </span>
                <span className="text-[#7b7468]">{slice.percentOfCode}%</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden bg-[#ebe6db]">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.max(slice.percentOfCode, 3)}%`,
                    backgroundColor: slice.color,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-[#7b7468]">
                {formatNumber(slice.fileCount)} files,{" "}
                {formatNumber(slice.codeLineCount)} code lines
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 text-sm leading-6 text-[#3f3b35]">{emptyMessage}</p>
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
      className="border border-[#d8d2c5] bg-white p-5"
    >
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-[#3b5bdb]" aria-hidden="true" />
        <h3 id="reviewer-notes-title" className="text-lg font-semibold">
          Reviewer Notes
        </h3>
      </div>
      {notes.length === 0 ? (
        <p className="mt-5 text-sm leading-6 text-[#3f3b35]">
          No reviewer notes were available.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-[#e4dfd4]">
          {notes.map((note, index) => (
            <li key={`${note.tone}-${index}`} className="py-3 first:pt-0">
              <p className="text-sm leading-6 text-[#3f3b35]">{note.text}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7468]">
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
  loading,
  onAsk,
  section,
}: {
  readonly loading: boolean;
  readonly onAsk: (question: string) => Promise<void>;
  readonly section: ReportDashboardSection;
}) {
  const signals = [...section.highlights, ...section.risks, ...section.caveats];
  const Icon = sectionIcons[section.id];

  return (
    <article className="border border-[#d8d2c5] bg-white">
      <div className="grid gap-5 p-5 lg:grid-cols-[240px_minmax(0,1fr)_minmax(260px,0.72fr)]">
        <div>
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-[#d97706]" aria-hidden="true" />
            <h4 className="text-lg font-semibold text-[#161616]">
              {section.title}
            </h4>
          </div>
          <div className="mt-5 flex items-center gap-4">
            <ScoreRing
              score={section.score}
              grade={formatRating(section.rating)}
            />
            <Sparkline points={section.chartPoints} />
          </div>
          <p className="mt-4 text-sm font-medium text-[#3f3b35]">
            {section.confidenceLabel}
          </p>
        </div>

        <div className="min-w-0">
          <p className="text-sm leading-6 text-[#3f3b35]">{section.summary}</p>
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

        <SectionAskBox
          loading={loading}
          onAsk={onAsk}
          sectionTitle={section.title}
        />
      </div>
    </article>
  );
}

function SectionAskBox({
  loading,
  onAsk,
  sectionTitle,
}: {
  readonly loading: boolean;
  readonly onAsk: (question: string) => Promise<void>;
  readonly sectionTitle: string;
}) {
  const [draft, setDraft] = useState("");

  async function handleOpenChat() {
    await onAsk(draft);
    setDraft("");
  }

  return (
    <div className="border-t border-[#e4dfd4] pt-5 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7468]">
          Ask About {sectionTitle}
        </span>
        <textarea
          aria-label={`Ask About ${sectionTitle}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="mt-3 min-h-28 w-full resize-y border border-[#cfc9bb] bg-[#fbfaf7] p-3 text-sm text-[#161616] outline-none focus:border-[#146c60]"
          placeholder="What should we fix first?"
          disabled={loading}
        />
      </label>
      <button
        type="button"
        onClick={handleOpenChat}
        disabled={loading}
        className="mt-3 inline-flex h-10 items-center justify-center gap-2 bg-[#146c60] px-4 text-sm font-semibold text-white transition hover:bg-[#0f554b] disabled:cursor-not-allowed disabled:bg-[#8aa7a0]"
        title="Ask follow-up"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        {loading ? "Opening" : "Open Chat"}
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
    <div className="border-t border-[#e4dfd4] pt-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7468]">
        {metric.label}
      </p>
      <p className="mt-1 break-words text-2xl font-semibold tracking-normal text-[#161616]">
        {metric.value}
      </p>
      <p className="mt-1 text-xs leading-5 text-[#7b7468]">{metric.detail}</p>
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
      <h5 className="text-sm font-semibold text-[#161616]">{title}</h5>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-[#7b7468]">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm leading-5 text-[#3f3b35]">
          {items.map((item, index) => (
            <li
              key={`${item}-${index}`}
              className="border border-[#e4dfd4] bg-[#fbfaf7] px-3 py-2"
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
      <h4 className="text-sm font-semibold text-[#161616]">{title}</h4>
      {items.length === 0 ? (
        <p className="mt-2 text-sm leading-6 text-[#7b7468]">{emptyMessage}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((item, index) => (
            <li
              key={`${item.title}-${item.detail}-${index}`}
              className="text-sm"
            >
              <p className="font-medium text-[#161616]">{item.title}</p>
              <p className="mt-1 leading-6 text-[#3f3b35]">{item.detail}</p>
              {item.meta === undefined || item.meta === "" ? null : (
                <p className="mt-1 break-words text-xs text-[#7b7468]">
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

type FollowUpRequestBody = {
  readonly reportCard: AnalyzeRepositoryResponse["reportCard"];
  readonly target?: {
    readonly kind: "report-section";
    readonly sectionId: ReportDashboardSectionId;
  };
  readonly conversationId?: string;
  readonly messages?: readonly {
    readonly role: "user" | "assistant";
    readonly content: string;
  }[];
  readonly question: string;
  readonly apiKey: string;
  readonly model: string;
};

const FollowUpEvidenceSchema = z
  .object({
    snippets: z.array(
      z
        .object({
          evidenceReference: EvidenceReferenceSchema,
          text: z.string(),
          source: z.enum(["fresh-content", "saved-metadata"]),
          targetRelevance: z.enum([
            "report",
            "dimension",
            "finding",
            "caveat",
            "evidence",
          ]),
          rank: z.number(),
          lineStart: z.number().optional(),
          lineEnd: z.number().optional(),
        })
        .strict(),
    ),
    missingContext: z.array(
      z
        .object({
          evidenceReference: EvidenceReferenceSchema,
          reason: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

const FollowUpApiResponseSchema = z
  .object({
    conversation: ConversationSchema,
    answer: ChatAnswerContractSchema,
    evidence: FollowUpEvidenceSchema,
  })
  .passthrough();

const FollowUpApiErrorSchema = z
  .object({
    error: z
      .object({
        message: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

type FollowUpApiResponse = z.infer<typeof FollowUpApiResponseSchema>;
type FollowUpEvidence = z.infer<typeof FollowUpEvidenceSchema>;

function sessionFromApiResult(
  result: FollowUpApiResponse,
): BrowserFollowUpSession {
  const target = result.conversation.target ?? { kind: "report" };

  return {
    conversation: result.conversation,
    target,
    answer: result.answer,
    evidenceSummary: summarizeEvidence(result.evidence),
    title: titleForConversation(result.conversation.messages, target),
  };
}

function titleForConversation(
  messages: FollowUpApiResponse["conversation"]["messages"],
  target: ConversationTarget,
): string {
  const firstQuestion =
    messages.find((message) => message.role === "user")?.content ??
    "Follow-up question";

  return `${targetLabel(target)}: ${firstQuestion}`;
}

function summarizeEvidence(evidence: FollowUpEvidence): string {
  if (evidence.snippets.length === 0) {
    return evidence.missingContext.length === 0
      ? "No evidence snippets were retrieved."
      : `Missing evidence for ${evidence.missingContext.map((item) => item.evidenceReference.label).join(", ")}.`;
  }

  const labels = evidence.snippets
    .slice(0, 3)
    .map((snippet) => snippet.evidenceReference.label);
  return `Retrieved ${evidence.snippets.length} snippet${evidence.snippets.length === 1 ? "" : "s"} from ${labels.join(", ")}.`;
}

function targetLabel(target: ConversationTarget): string {
  switch (target.kind) {
    case "report":
      return "Report";
    case "dimension":
      return target.dimension;
    case "finding":
      return target.findingId;
    case "caveat":
      return target.caveatId;
    case "evidence":
      return target.evidenceReference.label;
  }
}

function errorMessageFor(body: unknown): string {
  const parsedError = FollowUpApiErrorSchema.safeParse(body);
  return parsedError.success
    ? parsedError.data.error.message
    : "Follow-up answer failed unexpectedly.";
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
      <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7468]">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-[#161616]">{value}</dd>
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
