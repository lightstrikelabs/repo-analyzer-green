import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Sparkline } from "./sparkline";

describe("Sparkline", () => {
  it("renders a stable svg polyline for score points", () => {
    const html = renderToStaticMarkup(
      <Sparkline
        points={[
          { label: "Score", value: 80 },
          { label: "Confidence", value: 90 },
          { label: "Evidence", value: 50 },
          { label: "Risk", value: 25 },
        ]}
      />,
    );

    expect(html).toContain("Section signal trend");
    expect(html).toContain("<polyline");
    expect(html).toContain("Score 80");
    expect(html).toContain("Confidence 90");
  });

  it("renders an empty state when no chart points exist", () => {
    const html = renderToStaticMarkup(<Sparkline points={[]} />);

    expect(html).toContain("No chart data");
  });
});
