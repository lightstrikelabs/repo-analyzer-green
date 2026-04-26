/**
 * @vitest-environment jsdom
 */

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OpenRouterDefaultModelId } from "../../infrastructure/llm/openrouter-config";
import { BrowserLocalSessionStorageKey } from "../../infrastructure/persistence/browser-local-session-storage";
import { analyzeRepositoryResponseFixture } from "../../../test/support/analyze-repository-response-fixture";

import { AnalyzeRepositoryPanel } from "./analyze-repository-panel";

describe("AnalyzeRepositoryPanel", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it("renders the red-style first screen and keeps the analysis shell out of print", () => {
    const html = renderToStaticMarkup(<AnalyzeRepositoryPanel />);

    expect(html).toContain("Repository Quality");
    expect(html).toContain("Report Card");
    expect(html).toContain("GitHub repository URL");
    expect(html).toContain("OpenRouter API key");
    expect(html).toContain("Advanced");
    expect(html).toMatch(/<section[^>]*class="[^"]*print:hidden[^"]*"/);
  });

  it("submits the red-style request and persists the URL and model without the API key", async () => {
    const fetchMock = mockSuccessfulAnalyzeFetch();
    const user = userEvent.setup();

    render(<AnalyzeRepositoryPanel />);

    await user.type(
      screen.getByLabelText("GitHub repository URL"),
      "https://github.com/lightstrikelabs/repo-analyzer-green",
    );
    await user.type(screen.getByLabelText("OpenRouter API key"), "sk-test");
    await user.click(screen.getByText("Advanced"));
    await user.clear(screen.getByLabelText("OpenRouter Model"));
    await user.type(
      screen.getByLabelText("OpenRouter Model"),
      "openai/gpt-4.1-mini",
    );
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Evidence-backed report" }),
      ).toBeTruthy();
    });

    expect(postedBody(fetchMock)).toEqual({
      repoUrl: "https://github.com/lightstrikelabs/repo-analyzer-green",
      apiKey: "sk-test",
      model: "openai/gpt-4.1-mini",
    });

    const rawSession = storedSessionText();
    expect(rawSession).toContain(
      "https://github.com/lightstrikelabs/repo-analyzer-green",
    );
    expect(rawSession).toContain("openai/gpt-4.1-mini");
    expect(rawSession).not.toContain("sk-test");
  });

  it("resets the advanced model field to the free router default", async () => {
    const user = userEvent.setup();

    render(<AnalyzeRepositoryPanel />);

    await user.click(screen.getByText("Advanced"));
    await user.clear(screen.getByLabelText("OpenRouter Model"));
    await user.type(screen.getByLabelText("OpenRouter Model"), "custom/model");
    await user.click(screen.getByRole("button", { name: "Use Free Router" }));

    expect(modelInputValue()).toBe(OpenRouterDefaultModelId);
  });

  it("advances through red-style loading phases while analysis is pending", () => {
    vi.useFakeTimers();
    const fetchPromise = new Promise<Response>(() => {});
    const fetchMock = vi.fn(() => fetchPromise);
    vi.stubGlobal("fetch", fetchMock);

    render(<AnalyzeRepositoryPanel />);

    fireEvent.change(screen.getByLabelText("GitHub repository URL"), {
      target: {
        value: "https://github.com/lightstrikelabs/repo-analyzer-green",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));

    expect(screen.getByText("Cloning repository")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1_200);
    });
    expect(screen.getByText("Mapping files")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1_200);
    });
    expect(screen.getByText("Scoring quality")).toBeTruthy();
  });

  it("shows product-focused validation copy for invalid repository URLs", async () => {
    const fetchMock = mockSuccessfulAnalyzeFetch();
    const user = userEvent.setup();

    render(<AnalyzeRepositoryPanel />);

    await user.type(screen.getByLabelText("GitHub repository URL"), "not-url");
    await user.click(screen.getByRole("button", { name: "Analyze" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Enter a valid GitHub repository URL.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

function mockSuccessfulAnalyzeFetch() {
  const fetchMock = vi.fn<typeof fetch>(async (_input, _init) =>
    Response.json(analyzeRepositoryResponseFixture),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function postedBody(fetchMock: ReturnType<typeof mockSuccessfulAnalyzeFetch>) {
  const firstCall = fetchMock.mock.calls[0];
  if (firstCall === undefined) {
    throw new Error("Expected analyze fetch to be called.");
  }

  const init = firstCall[1];
  if (
    init === undefined ||
    typeof init !== "object" ||
    !("body" in init) ||
    typeof init.body !== "string"
  ) {
    throw new Error("Expected analyze fetch to include a JSON string body.");
  }

  const body: unknown = JSON.parse(init.body);
  return body;
}

function storedSessionText() {
  const rawSession = window.localStorage.getItem(BrowserLocalSessionStorageKey);
  if (rawSession === null) {
    throw new Error("Expected browser session to be saved.");
  }
  return rawSession;
}

function modelInputValue() {
  const modelInput = screen.getByLabelText("OpenRouter Model");
  if (!(modelInput instanceof HTMLInputElement)) {
    throw new Error("Expected model field to be an input.");
  }
  return modelInput.value;
}
