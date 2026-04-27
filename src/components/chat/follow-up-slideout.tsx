"use client";

import type { ChatAnswer } from "../../domain/chat/chat-answer";
import type {
  ChatMessage,
  ConversationTarget,
} from "../../domain/chat/conversation";
import type { BrowserFollowUpSession } from "../../infrastructure/persistence/browser-local-session-storage";

export function FollowUpSlideout({
  activeConversationId,
  draft,
  error,
  isOpen,
  isLoading,
  onClose,
  onContinue,
  onDraftChange,
  onOpen,
  onSelectConversation,
  sessions,
}: {
  readonly activeConversationId: string | null;
  readonly draft: string;
  readonly error: string;
  readonly isOpen: boolean;
  readonly isLoading: boolean;
  readonly onClose: () => void;
  readonly onContinue: () => void;
  readonly onDraftChange: (value: string) => void;
  readonly onOpen: () => void;
  readonly onSelectConversation: (conversationId: string) => void;
  readonly sessions: readonly BrowserFollowUpSession[];
}) {
  const activeSession =
    sessions.find(
      (session) => session.conversation.id === activeConversationId,
    ) ??
    sessions[0] ??
    null;

  if (!isOpen) {
    if (sessions.length === 0) {
      return null;
    }

    return (
      <FloatingChatMenu
        onOpen={onOpen}
        onSelectConversation={onSelectConversation}
        sessions={sessions}
      />
    );
  }

  return (
    <aside
      aria-labelledby="follow-up-chat-title"
      className="fixed inset-y-0 right-0 z-40 grid w-full max-w-5xl grid-rows-[auto_minmax(0,1fr)] border-l border-slate-200 bg-white shadow-2xl print:hidden lg:w-[86vw]"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
            Follow-up
          </p>
          <h2
            id="follow-up-chat-title"
            className="mt-1 text-xl font-semibold text-slate-950"
          >
            Conversations
          </h2>
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          onClick={onClose}
        >
          Close chat
        </button>
      </header>

      <div className="grid min-h-0 lg:grid-cols-[280px_minmax(0,1fr)]">
        <nav
          aria-label="Conversations"
          className="hidden min-h-0 border-r border-slate-200 bg-slate-50 p-3 lg:block"
        >
          <ConversationList
            activeConversationId={activeSession?.conversation.id ?? null}
            onSelectConversation={onSelectConversation}
            sessions={sessions}
          />
        </nav>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 lg:hidden">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Conversation
              </span>
              <select
                className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
                value={activeSession?.conversation.id ?? ""}
                onChange={(event) => onSelectConversation(event.target.value)}
              >
                {sessions.map((session) => (
                  <option
                    key={session.conversation.id}
                    value={session.conversation.id}
                  >
                    {session.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {activeSession === null ? (
            <EmptyThread />
          ) : (
            <ActiveThread session={activeSession} />
          )}

          <div className="border-t border-slate-200 bg-white p-4">
            {error === "" ? null : (
              <p
                className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
              <label className="block">
                <span className="sr-only">Follow-up question</span>
                <textarea
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  className="min-h-16 w-full resize-none rounded-md border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition focus:border-blue-500"
                  placeholder="Ask a follow-up about this conversation..."
                  disabled={isLoading || activeSession === null}
                />
              </label>
              <button
                type="button"
                onClick={onContinue}
                disabled={
                  isLoading ||
                  activeSession === null ||
                  draft.trim().length === 0
                }
                className="rounded-md bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isLoading ? "Sending" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function FloatingChatMenu({
  onOpen,
  onSelectConversation,
  sessions,
}: {
  readonly onOpen: () => void;
  readonly onSelectConversation: (conversationId: string) => void;
  readonly sessions: readonly BrowserFollowUpSession[];
}) {
  return (
    <div className="fixed bottom-4 right-4 z-30 w-[min(92vw,320px)] rounded-md border border-slate-200 bg-white p-3 shadow-xl print:hidden">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-md bg-slate-950 px-4 py-3 text-left text-sm font-semibold text-white"
        onClick={onOpen}
      >
        <span>Chats</span>
        <span>{sessions.length}</span>
      </button>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
        Recent Threads
      </p>
      <div className="mt-2 grid gap-2">
        {sessions.slice(0, 3).map((session) => (
          <button
            key={session.conversation.id}
            type="button"
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm text-slate-800"
            onClick={() => {
              onSelectConversation(session.conversation.id);
              onOpen();
            }}
          >
            {firstUserQuestion(session)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ConversationList({
  activeConversationId,
  onSelectConversation,
  sessions,
}: {
  readonly activeConversationId: string | null;
  readonly onSelectConversation: (conversationId: string) => void;
  readonly sessions: readonly BrowserFollowUpSession[];
}) {
  if (sessions.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-slate-300 bg-white p-3 text-sm leading-6 text-slate-600">
        Ask a section question to start a thread.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {sessions.map((session) => (
        <button
          key={session.conversation.id}
          type="button"
          onClick={() => onSelectConversation(session.conversation.id)}
          className={`rounded-md border p-3 text-left transition ${
            session.conversation.id === activeConversationId
              ? "border-blue-300 bg-blue-50"
              : "border-slate-200 bg-white hover:bg-slate-50"
          }`}
        >
          <p className="line-clamp-2 text-sm font-semibold text-slate-950">
            {firstUserQuestion(session)}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {targetLabel(session.target)}
          </p>
        </button>
      ))}
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="grid min-h-0 place-items-center bg-slate-50 p-6 text-center">
      <div>
        <p className="text-lg font-semibold text-slate-950">
          No conversation selected
        </p>
        <p className="mt-2 text-sm leading-6 text-slate-700">
          Ask a section question to start a thread.
        </p>
      </div>
    </div>
  );
}

function ActiveThread({
  session,
}: {
  readonly session: BrowserFollowUpSession;
}) {
  return (
    <div className="min-h-0 overflow-y-auto bg-slate-50 p-4">
      <div className="mx-auto grid max-w-3xl gap-4">
        <div className="rounded-md border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {targetLabel(session.target)}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-950">
            {firstUserQuestion(session)}
          </h3>
          <p className="mt-3 text-sm font-semibold text-blue-700">
            Searches matching repo files
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {session.evidenceSummary}
          </p>
        </div>

        {session.conversation.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        <AnswerSections answer={session.answer.answer} />
      </div>
    </div>
  );
}

function MessageBubble({ message }: { readonly message: ChatMessage }) {
  return (
    <div
      className={`max-w-[90%] rounded-md border p-4 ${
        message.role === "user"
          ? "ml-auto border-emerald-200 bg-emerald-50"
          : "mr-auto border-slate-200 bg-white"
      }`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {message.role === "user" ? "You" : "Reviewer"}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">
        {message.content}
      </p>
      {message.citations.length > 0 ? (
        <p className="mt-2 break-words text-xs text-slate-600">
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
        <SectionList
          title="Missing context"
          items={answer.missingContext.map((context) => context.reason)}
        />
        <SectionList
          title="Suggested next questions"
          items={answer.suggestedNextQuestions.map(
            (question) => question.question,
          )}
        />
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
  );
}

function SectionList({
  title,
  items,
}: {
  readonly title: string;
  readonly items: readonly string[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
        {title}
      </p>
      <ul className="mt-2 grid gap-2">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="text-sm leading-6 text-slate-800"
          >
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

function firstUserQuestion(session: BrowserFollowUpSession): string {
  return (
    session.conversation.messages.find((message) => message.role === "user")
      ?.content ?? session.title
  );
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
