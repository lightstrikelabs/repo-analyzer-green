/**
 * @vitest-environment jsdom
 */

import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatAnswerSchemaVersion } from "../../domain/chat/chat-answer";
import { ConversationSchemaVersion } from "../../domain/chat/conversation";
import { BrowserLocalSessionStorageKey } from "../../infrastructure/persistence/browser-local-session-storage";
import { analyzeRepositoryResponseFixture } from "../../../test/support/analyze-repository-response-fixture";
import { ReportCardView } from "./report-card-view";

const timestamp = "2026-04-26T19:00:00.000Z";

describe("ReportCardView follow-up chat", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it("starts a section thread through the follow-up route and opens the slideout", async () => {
    const fetchMock = mockFollowUpFetch(
      followUpResponse({
        conversationId: "conversation:testing",
        question: "What should we fix first?",
      }),
    );
    const user = userEvent.setup();

    render(
      <ReportCardView
        analysis={analyzeRepositoryResponseFixture}
        apiKey="sk-or-v1-test"
        model="openai/gpt-5-mini"
      />,
    );

    const testingPanel = getTestingPanel();

    await user.type(
      within(testingPanel).getByLabelText("Ask About Testing"),
      "What should we fix first?",
    );
    await user.click(
      within(testingPanel).getByRole("button", { name: "Open Chat" }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(postedFollowUpBody(fetchMock)).toMatchObject({
      target: {
        kind: "report-section",
        sectionId: "testing",
      },
      question: "What should we fix first?",
      apiKey: "sk-or-v1-test",
      model: "openai/gpt-5-mini",
    });
    expect(screen.getByRole("heading", { name: "Conversations" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "What should we fix first?" }),
    ).toBeTruthy();
    expect(screen.getByText("Searches matching repo files")).toBeTruthy();
  });

  it("continues, closes, and restores a thread from browser-local state", async () => {
    const fetchMock = mockFollowUpFetch(
      followUpResponse({
        conversationId: "conversation:testing",
        question: "What should we fix first?",
      }),
      followUpResponse({
        conversationId: "conversation:testing",
        question: "Can we defer it?",
      }),
    );
    const user = userEvent.setup();

    const view = render(
      <ReportCardView
        analysis={analyzeRepositoryResponseFixture}
        apiKey="sk-or-v1-test"
        model="openai/gpt-5-mini"
      />,
    );

    await user.type(
      screen.getByLabelText("Ask About Testing"),
      "What should we fix first?",
    );
    await user.click(getTestingOpenChatButton());
    await screen.findByRole("heading", { name: "What should we fix first?" });

    await user.type(
      screen.getByLabelText("Follow-up question"),
      "Can we defer it?",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(postedFollowUpBody(fetchMock, 1)).toMatchObject({
      conversationId: "conversation:testing",
      question: "Can we defer it?",
    });

    await user.click(screen.getByRole("button", { name: "Close chat" }));
    expect(screen.getByText("Chats")).toBeTruthy();
    expect(screen.getByText("Recent Threads")).toBeTruthy();
    expect(screen.getByText("What should we fix first?")).toBeTruthy();

    await waitFor(() => {
      expect(storedSessionText()).toContain("conversation:testing");
    });
    view.unmount();

    render(
      <ReportCardView
        analysis={analyzeRepositoryResponseFixture}
        apiKey="sk-or-v1-test"
        model="openai/gpt-5-mini"
      />,
    );

    expect(await screen.findByText("Recent Threads")).toBeTruthy();
    expect(screen.getByText("What should we fix first?")).toBeTruthy();
  });

  it("shows a missing API key error without calling the follow-up route", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();

    render(<ReportCardView analysis={analyzeRepositoryResponseFixture} />);

    await user.type(
      screen.getByLabelText("Ask About Testing"),
      "What should we fix first?",
    );
    await user.click(getTestingOpenChatButton());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "OpenRouter API key is required for follow-up questions.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function mockFollowUpFetch(...responses: readonly object[]) {
  let callIndex = 0;
  const fetchMock = vi.fn<typeof fetch>(async (): Promise<Response> => {
    const response = responses[Math.min(callIndex, responses.length - 1)];
    callIndex += 1;

    if (response === undefined) {
      throw new Error("Expected a mocked follow-up response.");
    }

    return Response.json(response);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function getTestingPanel(): HTMLElement {
  const testingPanel = screen
    .getAllByRole("article")
    .find((element) =>
      within(element).queryByRole("heading", { name: "Testing" }),
    );
  if (testingPanel === undefined) {
    throw new Error("Expected Testing section panel.");
  }
  return testingPanel;
}

function getTestingOpenChatButton(): HTMLElement {
  return within(getTestingPanel()).getByRole("button", {
    name: "Open Chat",
  });
}

function postedFollowUpBody(
  fetchMock: ReturnType<typeof mockFollowUpFetch>,
  callIndex = 0,
) {
  const call = fetchMock.mock.calls[callIndex];
  if (call === undefined) {
    throw new Error("Expected follow-up fetch to be called.");
  }

  const init = call[1];
  if (
    init === undefined ||
    typeof init !== "object" ||
    !("body" in init) ||
    typeof init.body !== "string"
  ) {
    throw new Error("Expected follow-up fetch to include a JSON string body.");
  }

  const body: unknown = JSON.parse(init.body);
  return body;
}

function followUpResponse(input: {
  readonly conversationId: string;
  readonly question: string;
}) {
  return {
    conversation: {
      id: input.conversationId,
      schemaVersion: ConversationSchemaVersion,
      reportCardId: analyzeRepositoryResponseFixture.reportCard.id,
      repository: analyzeRepositoryResponseFixture.reportCard.repository,
      target: {
        kind: "dimension",
        dimension: "verifiability",
      },
      messages: [
        {
          id: `${input.conversationId}:message:1`,
          role: "user",
          content: "What should we fix first?",
          citations: [],
          assumptions: [],
          createdAt: timestamp,
        },
        {
          id: `${input.conversationId}:message:2`,
          role: "assistant",
          content: "Review the highest-risk test gap first.",
          citations: [
            {
              evidenceReference: packageEvidence(),
              relevance: "Evidence-backed claim",
            },
          ],
          assumptions: [],
          createdAt: timestamp,
        },
        ...(input.question === "Can we defer it?"
          ? [
              {
                id: `${input.conversationId}:message:3`,
                role: "user",
                content: "Can we defer it?",
                citations: [],
                assumptions: [],
                createdAt: timestamp,
              },
              {
                id: `${input.conversationId}:message:4`,
                role: "assistant",
                content: "Defer only if the test gap is not release-blocking.",
                citations: [],
                assumptions: [],
                createdAt: timestamp,
              },
            ]
          : []),
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    answer: {
      answer: {
        schemaVersion: ChatAnswerSchemaVersion,
        status: "answered",
        summary: "Review the highest-risk test gap first.",
        evidenceBackedClaims: [
          {
            claim: "The package manifest includes a test script.",
            citations: [
              {
                evidenceReference: packageEvidence(),
                quote: '"test": "vitest"',
              },
            ],
          },
        ],
        assumptions: [],
        caveats: [],
        suggestedNextQuestions: [],
      },
      metadata: {
        provider: "fixture",
        modelName: "fixture-chat",
        generatedAt: timestamp,
      },
    },
    evidence: {
      snippets: [
        {
          evidenceReference: packageEvidence(),
          text: '"test": "vitest"',
          source: "fresh-content",
          targetRelevance: "dimension",
          rank: 100,
        },
      ],
      missingContext: [],
    },
  };
}

function packageEvidence() {
  return {
    id: "evidence:package-json",
    kind: "file",
    label: "Package manifest",
    path: "package.json",
  };
}

function storedSessionText() {
  const rawSession = window.localStorage.getItem(BrowserLocalSessionStorageKey);
  if (rawSession === null) {
    throw new Error("Expected browser session to be saved.");
  }
  return rawSession;
}
