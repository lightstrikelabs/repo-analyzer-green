import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScoreRing } from "./score-ring";

describe("ScoreRing", () => {
  it("renders numeric score and grade", () => {
    const html = renderToStaticMarkup(<ScoreRing score={86} grade="B" />);

    expect(html).toContain("86");
    expect(html).toContain("B");
    expect(html).toContain('aria-label="Score 86, grade B"');
  });

  it("renders a missing-score state", () => {
    const html = renderToStaticMarkup(
      <ScoreRing score={undefined} grade="Not assessed" />,
    );

    expect(html).toContain("N/A");
    expect(html).toContain("Not assessed");
    expect(html).toContain('aria-label="Score not assessed"');
  });
});
