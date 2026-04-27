"use client";

import { Loader2, MessageSquare, Send, X } from "lucide-react";

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
    <>
      <button
        className="fixed inset-0 z-40 bg-black/20 print:hidden"
        aria-label="Dismiss chat backdrop"
        type="button"
        onClick={onClose}
      />
      <aside
        aria-labelledby="follow-up-chat-title"
        className="fixed inset-y-0 right-0 z-50 grid w-full max-w-5xl grid-cols-1 border-l border-[#cfc9bb] bg-[#fbfaf7] shadow-2xl print:hidden md:grid-cols-[280px_minmax(0,1fr)]"
      >
        <nav
          aria-label="Conversations"
          className="hidden min-h-0 border-r border-[#d8d2c5] bg-white md:block"
        >
          <div className="border-b border-[#e4dfd4] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#146c60]">
              Conversations
            </p>
            <p className="mt-2 text-sm text-[#7b7468]">
              {sessions.length} active thread{sessions.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="p-3">
            <ConversationList
              activeConversationId={activeSession?.conversation.id ?? null}
              onSelectConversation={onSelectConversation}
              sessions={sessions}
            />
          </div>
        </nav>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
          <div className="flex items-start justify-between gap-4 border-b border-[#d8d2c5] bg-white p-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#146c60]">
                Follow-up
              </p>
              <h2
                id="follow-up-chat-title"
                className="mt-1 truncate text-lg font-semibold text-[#161616]"
              >
                Conversations
              </h2>
              <p className="mt-1 text-xs text-[#7b7468]">
                Evidence-focused follow-up
              </p>
              <select
                aria-label="Conversation"
                className="mt-3 h-10 w-full border border-[#cfc9bb] bg-[#fbfaf7] px-2 text-sm outline-none md:hidden"
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
            </div>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center border border-[#cfc9bb] text-[#3f3b35] transition hover:bg-[#f6f5f1]"
              onClick={onClose}
              title="Close chat"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Close chat</span>
            </button>
          </div>

          {activeSession === null ? (
            <EmptyThread />
          ) : (
            <ActiveThread session={activeSession} />
          )}

          <div className="border-t border-[#d8d2c5] bg-white p-4">
            {error === "" ? null : (
              <p
                className="mb-3 rounded-md border border-[#be123c] bg-[#fff1f2] px-3 py-2 text-sm text-[#9f1239]"
                role="alert"
              >
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Follow-up question</span>
                <textarea
                  value={draft}
                  onChange={(event) => onDraftChange(event.target.value)}
                  className="min-h-14 w-full resize-none border border-[#cfc9bb] bg-[#fbfaf7] p-3 text-sm text-[#161616] outline-none focus:border-[#146c60]"
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
                className="inline-flex h-14 items-center justify-center gap-2 bg-[#146c60] px-4 text-sm font-semibold text-white transition hover:bg-[#0f554b] disabled:cursor-not-allowed disabled:bg-[#8aa7a0]"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isLoading ? "Sending" : "Send"}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
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
    <div className="fixed bottom-4 right-4 z-30 print:hidden">
      <button
        className="flex items-center gap-2 rounded-md border border-[#cfc9bb] bg-white px-3 py-3 text-sm font-semibold text-[#25221e] shadow-lg transition hover:bg-[#f6f5f1]"
        onClick={onOpen}
        type="button"
      >
        <MessageSquare className="h-4 w-4 text-[#146c60]" aria-hidden="true" />
        <span>Chats</span>
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#146c60] px-1 text-xs text-white">
          {sessions.length}
        </span>
      </button>
      <div className="absolute bottom-14 right-0 w-[min(320px,calc(100vw-2rem))] rounded-md border border-[#cfc9bb] bg-white p-3 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[#e4dfd4] pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#146c60]">
              Recent Threads
            </p>
          </div>
          <button
            className="h-9 rounded-md bg-[#111111] px-3 text-xs font-semibold text-white transition hover:bg-[#333333]"
            onClick={onOpen}
            type="button"
          >
            Open
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          {sessions.slice(0, 3).map((session) => (
            <button
              key={session.conversation.id}
              type="button"
              className="rounded-md border border-[#e4dfd4] bg-[#fbfaf7] p-3 text-left transition hover:border-[#146c60] hover:bg-[#eef8f5]"
              onClick={() => {
                onSelectConversation(session.conversation.id);
                onOpen();
              }}
            >
              <p className="line-clamp-1 text-sm font-semibold text-[#25221e]">
                {firstUserQuestion(session)}
              </p>
              <p className="mt-1 text-xs text-[#7b7468]">
                {targetLabel(session.target)}
              </p>
            </button>
          ))}
        </div>
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
      <p className="rounded-md border border-dashed border-[#d8d2c5] bg-[#fbfaf7] p-3 text-sm leading-6 text-[#7b7468]">
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
              ? "border-[#146c60] bg-[#eef8f5]"
              : "border-[#e4dfd4] bg-white hover:bg-[#f6f5f1]"
          }`}
        >
          <p className="line-clamp-2 text-sm font-semibold text-[#25221e]">
            {firstUserQuestion(session)}
          </p>
          <p className="mt-2 text-xs text-[#7b7468]">
            {targetLabel(session.target)}
          </p>
        </button>
      ))}
    </div>
  );
}

function EmptyThread() {
  return (
    <div className="grid min-h-0 place-items-center bg-[#fbfaf7] p-6 text-center">
      <div>
        <MessageSquare
          className="mx-auto h-10 w-10 text-[#146c60]"
          aria-hidden="true"
        />
        <p className="mt-4 text-lg font-semibold text-[#161616]">
          No conversation selected
        </p>
        <p className="mt-2 text-sm leading-6 text-[#7b7468]">
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
    <div className="min-h-0 overflow-y-auto bg-[#fbfaf7] p-4">
      <div className="mx-auto grid max-w-3xl gap-4">
        <div className="border border-[#d8d2c5] bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7b7468]">
            {targetLabel(session.target)}
          </p>
          <h3 className="mt-2 text-xl font-semibold text-[#161616]">
            {firstUserQuestion(session)}
          </h3>
          <p className="mt-3 text-sm font-semibold text-[#3b5bdb]">
            Searches matching repo files
          </p>
          <p className="mt-1 text-sm leading-6 text-[#3f3b35]">
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
          ? "ml-auto border-[#146c60] bg-[#eef8f5]"
          : "mr-auto border-[#d8d2c5] bg-white"
      }`}
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7468]">
        {message.role === "user" ? "You" : "Reviewer"}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-6 text-[#3f3b35]">
        {message.content}
      </p>
      {message.citations.length > 0 ? (
        <p className="mt-2 break-words text-xs text-[#7b7468]">
          Evidence:{" "}
          {message.citations
            .map((citation) => citation.evidenceReference.id)
            .join(", ")}
        </p>
      ) : null}
      {message.assumptions.length > 0 ? (
        <p className="mt-2 text-xs text-[#7b7468]">
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
      <div className="rounded-md border border-[#d97706] bg-[#fff7ed] p-3">
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#c2410c]">
          Insufficient context
        </p>
        <p className="mt-2 text-sm leading-6 text-[#3f3b35]">
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
    <div className="grid gap-3 rounded-md border border-[#d8d2c5] bg-white p-3">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.12em] text-[#146c60]">
          Evidence-backed answer
        </p>
        <p className="mt-2 text-sm leading-6 text-[#3f3b35]">
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
    <section className="rounded-md border border-[#e4dfd4] bg-[#fbfaf7] p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#7b7468]">
        {title}
      </p>
      <ul className="mt-2 grid gap-2">
        {items.map((item, index) => (
          <li
            key={`${item}-${index}`}
            className="text-sm leading-6 text-[#3f3b35]"
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
