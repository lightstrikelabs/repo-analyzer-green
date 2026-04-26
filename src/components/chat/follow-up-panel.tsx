"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { z } from "zod";

import type { AnalyzeRepositoryResponse } from "../../application/analyze-repository/analyze-repository-response";
import {
  continueFollowUpConversation,
  startFollowUpConversation,
  type ChatReviewer,
  type ConversationRepository,
  type FollowUpChatDependencies,
} from "../../application/follow-up-chat/follow-up-chat";
import type {
  ChatAnswer,
  ChatAnswerContract,
} from "../../domain/chat/chat-answer";
import { ChatAnswerContractSchema } from "../../domain/chat/chat-answer";
import {
  ConversationSchema,
  ConversationTargetSchema,
  type Conversation,
  type ConversationTarget,
} from "../../domain/chat/conversation";
import type { ConversationTargetSelector } from "../../domain/chat/conversation-target-resolver";
import type { EvidenceContentResult } from "../../domain/chat/evidence-retrieval";
import type { EvidenceReference } from "../../domain/shared/evidence-reference";

type FollowUpSession = {
  readonly conversation: Conversation;
  readonly target: ConversationTarget;
  readonly answer: ChatAnswerContract;
  readonly evidenceSummary: string;
  readonly title: string;
};

type StoredFollowUpState = {
  readonly sessions: FollowUpSession[];
  readonly activeConversationId: string | null;
};

const StoredFollowUpSessionSchema = z
  .object({
    conversation: ConversationSchema,
    target: ConversationTargetSchema,
    answer: ChatAnswerContractSchema,
    evidenceSummary: z.string(),
    title: z.string(),
  })
  .strict();

const StoredFollowUpStateSchema = z
  .object({
    sessions: z.array(StoredFollowUpSessionSchema),
    activeConversationId: z.string().nullable(),
  })
  .strict();

const storagePrefix = "repo-analyzer-green.follow-up";

export function FollowUpPanel({
  analysis,
}: {
  readonly analysis: AnalyzeRepositoryResponse;
}) {
  const reportCard = analysis.reportCard;
  const [sessions, setSessions] = useState<FollowUpSession[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const repositoryRef = useRef<Map<string, Conversation>>(new Map());
  const contentSource = useMemo(() => createContentSource(), []);

  useEffect(() => {
    const stored = readStoredState(reportCard.id);
    setSessions(stored.sessions);
    setActiveConversationId(
      stored.activeConversationId ??
        stored.sessions[0]?.conversation.id ??
        null,
    );
    repositoryRef.current = new Map(
      stored.sessions.map((session) => [
        session.conversation.id,
        session.conversation,
      ]),
    );
    setHydrated(true);
  }, [reportCard.id]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    persistState(reportCard.id, { sessions, activeConversationId });
    repositoryRef.current = new Map(
      sessions.map((session) => [
        session.conversation.id,
        session.conversation,
      ]),
    );
  }, [activeConversationId, hydrated, reportCard.id, sessions]);

  const dependencies = useMemo<FollowUpChatDependencies>(
    () => ({
      conversationRepository: createConversationRepository(
        repositoryRef,
        setSessions,
      ),
      chatReviewer: createDemoChatReviewer(),
      contentSource,
      now: () => new Date(),
      createId: (() => {
        let index = 0;
        return (prefix: string) => `${prefix}:${++index}`;
      })(),
    }),
    [contentSource],
  );

  const activeSession =
    sessions.find(
      (session) => session.conversation.id === activeConversationId,
    ) ??
    sessions[0] ??
    null;

  async function startConversation(
    selector: ConversationTargetSelector,
    question: string,
  ) {
    setLoading(true);
    setError("");
    try {
      const result = await startFollowUpConversation(
        {
          reportCard,
          targetSelector: selector,
          question,
        },
        dependencies,
      );

      if (result.kind !== "conversation") {
        setError(targetErrorMessage(result));
        return;
      }

      const nextSession = sessionFromResult(result);
      setSessions((current) => [
        nextSession,
        ...current.filter(
          (session) => session.conversation.id !== nextSession.conversation.id,
        ),
      ]);
      setActiveConversationId(nextSession.conversation.id);
      setDraft("");
    } finally {
      setLoading(false);
    }
  }

  async function continueConversation() {
    const question = draft.trim();
    if (!question || activeSession === null) return;

    setLoading(true);
    setError("");
    try {
      const result = await continueFollowUpConversation(
        {
          conversationId: activeSession.conversation.id,
          reportCard,
          question,
        },
        dependencies,
      );

      if (result.kind !== "conversation") {
        setError(targetErrorMessage(result));
        return;
      }

      const nextSession = sessionFromResult(result);
      setSessions((current) => [
        nextSession,
        ...current.filter(
          (session) => session.conversation.id !== nextSession.conversation.id,
        ),
      ]);
      setActiveConversationId(nextSession.conversation.id);
      setDraft("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="follow-up-panel-title"
      className="rounded-md border border-slate-200 bg-white p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <p className="text-sm font-medium uppercase text-emerald-700">
            Follow-up
          </p>
          <h3
            id="follow-up-panel-title"
            className="mt-1 text-lg font-semibold text-slate-950"
          >
            Chat with evidence
          </h3>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Ask about the report, a dimension, a finding, a caveat, or a
            specific evidence item. Answers stay grounded in retrieved snippets
            and caveats.
          </p>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={() =>
            startConversation(
              { kind: "report" },
              "What should we inspect first?",
            )
          }
          disabled={loading}
        >
          Ask about report
        </button>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <ShortcutGroup title="Suggested Questions">
            {reportCard.recommendedNextQuestions.length === 0 ? (
              <p className="text-sm leading-6 text-slate-600">
                No suggested questions were reported.
              </p>
            ) : (
              reportCard.recommendedNextQuestions.map((question) => (
                <button
                  key={question.id}
                  type="button"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
                  onClick={() =>
                    startConversation(
                      question.targetDimension === undefined
                        ? { kind: "report" }
                        : {
                            kind: "dimension",
                            dimension: question.targetDimension,
                          },
                      question.question,
                    )
                  }
                  disabled={loading}
                >
                  <p className="text-sm font-medium text-slate-950">
                    {question.question}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    {question.rationale}
                  </p>
                </button>
              ))
            )}
          </ShortcutGroup>

          <ShortcutGroup title="Report Areas">
            <ShortcutButton
              label="Ask about report"
              onClick={() =>
                startConversation(
                  { kind: "report" },
                  "What should we inspect first?",
                )
              }
              disabled={loading}
            />
            {reportCard.dimensionAssessments.map((assessment) => (
              <ShortcutButton
                key={assessment.dimension}
                label={`Ask about ${assessment.title}`}
                onClick={() =>
                  startConversation(
                    { kind: "dimension", dimension: assessment.dimension },
                    `What evidence supports ${assessment.title}?`,
                  )
                }
                disabled={loading}
              />
            ))}
            {reportCard.dimensionAssessments.flatMap((assessment) =>
              assessment.findings.map((finding) => (
                <ShortcutButton
                  key={finding.id}
                  label={`Ask about ${finding.title}`}
                  onClick={() =>
                    startConversation(
                      {
                        kind: "finding",
                        findingId: finding.id,
                      },
                      `What should we do about ${finding.title}?`,
                    )
                  }
                  disabled={loading}
                />
              )),
            )}
            {reportCard.caveats.map((caveat) => (
              <ShortcutButton
                key={caveat.id}
                label={`Ask about ${caveat.title}`}
                onClick={() =>
                  startConversation(
                    { kind: "caveat", caveatId: caveat.id },
                    `What evidence resolves ${caveat.title}?`,
                  )
                }
                disabled={loading}
              />
            ))}
            {reportCard.evidenceReferences.map((reference) => (
              <ShortcutButton
                key={reference.id}
                label={`Ask about ${reference.label}`}
                onClick={() =>
                  startConversation(
                    { kind: "evidence", evidenceReferenceId: reference.id },
                    `What does ${reference.label} tell us?`,
                  )
                }
                disabled={loading}
              />
            ))}
          </ShortcutGroup>

          <ShortcutGroup title="Threads">
            {sessions.length === 0 ? (
              <p className="text-sm leading-6 text-slate-600">
                No conversations yet. Use a shortcut to start one.
              </p>
            ) : (
              <div className="grid gap-2">
                {sessions.map((session) => (
                  <button
                    key={session.conversation.id}
                    type="button"
                    onClick={() =>
                      setActiveConversationId(session.conversation.id)
                    }
                    className={`rounded-md border p-3 text-left transition ${
                      session.conversation.id === activeConversationId
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <p className="line-clamp-2 text-sm font-medium text-slate-950">
                      {session.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {targetLabel(session.target)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ShortcutGroup>
        </aside>

        <div className="grid min-h-[520px] grid-rows-[minmax(0,1fr)_auto] rounded-md border border-slate-200 bg-slate-50">
          <div className="min-h-0 overflow-y-auto p-4">
            {activeSession === null ? (
              <div className="grid h-full place-items-center rounded-md border border-dashed border-slate-300 bg-white p-6 text-center">
                <div>
                  <div className="mx-auto h-10 w-10 rounded-full border border-emerald-300 bg-emerald-50" />
                  <p className="mt-4 text-lg font-semibold text-slate-950">
                    No conversation selected
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Ask a question to start a thread.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto grid max-w-3xl gap-4">
                {activeSession.conversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={`max-w-[90%] rounded-md border p-4 ${
                      message.role === "user"
                        ? "ml-auto border-emerald-200 bg-emerald-50"
                        : "mr-auto border-slate-200 bg-white"
                    }`}
                  >
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {message.role === "user" ? "You" : "Reviewer"}
                    </p>
                    <p className="text-sm leading-6 text-slate-800">
                      {message.content}
                    </p>
                    {message.citations.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Evidence:{" "}
                        {message.citations
                          .map((citation) => citation.evidenceReference.id)
                          .join(", ")}
                      </p>
                    ) : null}
                    {message.assumptions.length > 0 ? (
                      <p className="mt-2 text-xs text-slate-600">
                        Assumptions:{" "}
                        {message.assumptions
                          .map((assumption) => assumption.statement)
                          .join(" ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeSession === null ? null : (
            <div className="border-t border-slate-200 bg-white p-4">
              <div className="grid gap-4">
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Evidence summary
                  </p>
                  <p className="mt-2 leading-6">
                    {activeSession.evidenceSummary}
                  </p>
                </div>
                <AnswerSections answer={activeSession.answer.answer} />
                <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="block">
                    <span className="sr-only">Follow-up question</span>
                    <textarea
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      className="min-h-16 w-full resize-none rounded-md border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-emerald-400"
                      placeholder="Ask a follow-up about this conversation..."
                      disabled={loading}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={continueConversation}
                    disabled={loading || draft.trim().length === 0}
                    className="rounded-md bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {error ? (
            <p
              className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function ShortcutGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-600">
        {title}
      </h4>
      <div className="mt-3 grid gap-2">{children}</div>
    </section>
  );
}

function ShortcutButton({
  label,
  onClick,
  disabled,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:bg-slate-100"
    >
      {label}
    </button>
  );
}

function AnswerSections({ answer }: { readonly answer: ChatAnswer }) {
  if (answer.status === "insufficient-context") {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-800">
          Insufficient context
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-800">
          {answer.summary}
        </p>
        <div className="mt-3 grid gap-2">
          {answer.missingContext.map((context) => (
            <div
              key={context.reason}
              className="rounded-md bg-white p-3 text-sm"
            >
              <p className="font-medium text-slate-950">{context.reason}</p>
              {context.requestedEvidence ? (
                <p className="mt-1 text-xs text-slate-600">
                  Requested evidence: {context.requestedEvidence}
                </p>
              ) : null}
            </div>
          ))}
        </div>
        {answer.suggestedNextQuestions.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              Suggested next questions
            </p>
            <ul className="mt-2 grid gap-2">
              {answer.suggestedNextQuestions.map((question) => (
                <li
                  key={question.question}
                  className="rounded-md bg-white p-3 text-sm"
                >
                  <p className="font-medium text-slate-950">
                    {question.question}
                  </p>
                  <p className="mt-1 text-slate-600">{question.rationale}</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-md border border-slate-200 bg-white p-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-emerald-700">
          Evidence-backed answer
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-800">
          {answer.summary}
        </p>
      </div>
      <div className="grid gap-2">
        <SectionList
          title="Claims"
          items={answer.evidenceBackedClaims.map((claim) => claim.claim)}
        />
        <SectionList
          title="Assumptions"
          items={answer.assumptions.map((assumption) => assumption.statement)}
        />
        <SectionList
          title="Caveats"
          items={answer.caveats.map((caveat) => caveat.summary)}
        />
        <SectionList
          title="Suggested next questions"
          items={answer.suggestedNextQuestions.map(
            (question) => question.question,
          )}
        />
      </div>
    </div>
  );
}

function SectionList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  if (items.length === 0) return null;

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </p>
      <ul className="mt-2 grid gap-2">
        {items.map((item) => (
          <li key={item} className="text-sm leading-6 text-slate-800">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function sessionFromResult(result: {
  readonly conversation: Conversation;
  readonly answer: ChatAnswerContract;
  readonly evidence: {
    readonly snippets: readonly {
      readonly evidenceReference: { readonly label: string };
      readonly text: string;
      readonly source: "fresh-content" | "saved-metadata";
      readonly targetRelevance:
        | "report"
        | "dimension"
        | "finding"
        | "caveat"
        | "evidence";
      readonly rank: number;
    }[];
    readonly missingContext: readonly {
      readonly evidenceReference: { readonly label: string };
      readonly reason: string;
    }[];
  };
}): FollowUpSession {
  return {
    conversation: result.conversation,
    target: result.conversation.target ?? { kind: "report" },
    answer: result.answer,
    evidenceSummary: summarizeEvidence(result.evidence),
    title: titleForConversation(result.conversation, result.answer.answer),
  };
}

function titleForConversation(
  conversation: Conversation,
  answer: ChatAnswer,
): string {
  const message = conversation.messages[0];
  const prefix = targetLabel(conversation.target ?? { kind: "report" });
  return `${prefix}: ${message?.content ?? answer.summary}`;
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

function targetErrorMessage(result: { readonly kind: string }): string {
  return result.kind === "conversation-not-found"
    ? "Conversation not found."
    : "Selected target could not be resolved.";
}

function persistState(reportId: string, state: StoredFollowUpState) {
  window.localStorage.setItem(storageKey(reportId), JSON.stringify(state));
}

function readStoredState(reportId: string): StoredFollowUpState {
  const raw = window.localStorage.getItem(storageKey(reportId));
  if (raw === null) {
    return {
      sessions: [],
      activeConversationId: null,
    };
  }

  try {
    return StoredFollowUpStateSchema.parse(JSON.parse(raw));
  } catch {
    // Ignore malformed local state.
  }

  return {
    sessions: [],
    activeConversationId: null,
  };
}

function storageKey(reportId: string): string {
  return `${storagePrefix}:${reportId}`;
}

function createConversationRepository(
  repositoryRef: React.MutableRefObject<Map<string, Conversation>>,
  setSessions: React.Dispatch<React.SetStateAction<FollowUpSession[]>>,
): ConversationRepository {
  return {
    async get(id: string) {
      return repositoryRef.current.get(id);
    },
    async save(conversation: Conversation) {
      repositoryRef.current.set(conversation.id, conversation);
      setSessions((current) =>
        current.map((session) =>
          session.conversation.id === conversation.id
            ? {
                ...session,
                conversation,
              }
            : session,
        ),
      );
    },
  };
}

function createDemoChatReviewer(): ChatReviewer {
  return {
    async answer(request) {
      const contract = buildDemoAnswer(request.evidence, request.question);
      return contract;
    },
  };
}

function summarizeEvidence(input: {
  readonly snippets: readonly {
    readonly evidenceReference: { readonly label: string };
    readonly text: string;
    readonly source: "fresh-content" | "saved-metadata";
    readonly targetRelevance:
      | "report"
      | "dimension"
      | "finding"
      | "caveat"
      | "evidence";
    readonly rank: number;
  }[];
  readonly missingContext: readonly {
    readonly evidenceReference: { readonly label: string };
    readonly reason: string;
  }[];
}): string {
  if (input.snippets.length === 0) {
    return input.missingContext.length === 0
      ? "No evidence snippets were retrieved."
      : `Missing evidence for ${input.missingContext.map((item) => item.evidenceReference.label).join(", ")}.`;
  }

  const labels = input.snippets
    .slice(0, 3)
    .map((snippet) => snippet.evidenceReference.label);
  return `Retrieved ${input.snippets.length} snippet${input.snippets.length === 1 ? "" : "s"} from ${labels.join(", ")}.`;
}

function buildDemoAnswer(
  evidence: {
    readonly snippets: readonly {
      readonly evidenceReference: EvidenceReference;
      readonly text: string;
      readonly source: "fresh-content" | "saved-metadata";
      readonly targetRelevance:
        | "report"
        | "dimension"
        | "finding"
        | "caveat"
        | "evidence";
      readonly rank: number;
    }[];
    readonly missingContext: readonly {
      readonly evidenceReference: EvidenceReference;
      readonly reason: string;
    }[];
  },
  question: string,
): ChatAnswerContract {
  if (evidence.snippets.length === 0) {
    const missingContext =
      evidence.missingContext.length > 0
        ? evidence.missingContext.map((item) => ({
            reason: item.reason,
            requestedEvidence: item.evidenceReference.label,
          }))
        : [
            {
              reason: "The demo content source did not provide enough context.",
              requestedEvidence: "Repository evidence",
            },
          ];

    return {
      answer: {
        schemaVersion: "chat-answer.v1",
        status: "insufficient-context",
        summary: `I need more evidence to answer: ${question}`,
        missingContext,
        suggestedNextQuestions: [
          {
            question: "Can you provide the missing evidence?",
            rationale: "The current retrieval did not yield enough context.",
          },
        ],
      },
      metadata: {
        provider: "fixture",
        modelName: "demo-chat-reviewer",
        generatedAt: new Date().toISOString(),
      },
    };
  }

  const topSnippet = evidence.snippets[0];
  if (topSnippet === undefined) {
    return {
      answer: {
        schemaVersion: "chat-answer.v1",
        status: "insufficient-context",
        summary: `I need more evidence to answer: ${question}`,
        missingContext: [],
        suggestedNextQuestions: [
          {
            question: "Can you provide the missing evidence?",
            rationale: "The current retrieval did not yield enough context.",
          },
        ],
      },
      metadata: {
        provider: "fixture",
        modelName: "demo-chat-reviewer",
        generatedAt: new Date().toISOString(),
      },
    };
  }

  return {
    answer: {
      schemaVersion: "chat-answer.v1",
      status: "answered",
      summary: `Based on ${topSnippet.evidenceReference.label}, ${question.toLowerCase()}`,
      evidenceBackedClaims: evidence.snippets.slice(0, 2).map((snippet) => ({
        claim: `Relevant evidence from ${snippet.evidenceReference.label} supports the answer.`,
        citations: [
          {
            evidenceReference: snippet.evidenceReference,
            quote: snippet.text.slice(0, 120),
          },
        ],
      })),
      assumptions: evidence.missingContext.map((item) => ({
        statement: item.reason,
        basis: `Missing evidence: ${item.evidenceReference.label}`,
      })),
      caveats: evidence.missingContext.map((item) => ({
        summary: item.reason,
        missingEvidence: [item.evidenceReference.label],
      })),
      suggestedNextQuestions: [
        {
          question: "What should we inspect next?",
          rationale: "Follow-up can focus on the weakest evidence gap.",
        },
      ],
    },
    metadata: {
      provider: "fixture",
      modelName: "demo-chat-reviewer",
      generatedAt: new Date().toISOString(),
    },
  };
}

function createContentSource() {
  const textByPath = new Map<string, string>([
    [
      "package.json",
      [
        "{",
        '  "scripts": {',
        '    "test": "vitest",',
        '    "lint": "oxlint ."',
        "  }",
        "}",
      ].join("\n"),
    ],
    [
      ".github/workflows/ci.yml",
      "name: CI\njobs:\n  quality:\n    steps:\n      - run: pnpm test",
    ],
  ]);

  return {
    async readEvidence(
      reference: EvidenceReference,
    ): Promise<EvidenceContentResult> {
      const content =
        reference.path === undefined
          ? undefined
          : textByPath.get(reference.path);

      if (content === undefined) {
        return {
          kind: "missing",
          reason: `No fixture content was registered for ${reference.label}.`,
        };
      }

      return {
        kind: "content",
        text: content,
      };
    },
  };
}
