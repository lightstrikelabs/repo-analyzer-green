import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnalyzeRepositoryPanel } from "./analyze-repository-panel";

describe("AnalyzeRepositoryPanel", () => {
  it("hides the analysis sidebar in printed output", () => {
    const html = renderToStaticMarkup(<AnalyzeRepositoryPanel />);

    expect(html).toContain("Browser session");
    expect(html).toMatch(/<aside[^>]*class="[^"]*print:hidden[^"]*"/);
  });
});
