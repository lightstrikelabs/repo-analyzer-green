import { describe, expect, it } from "vitest";

import { renderIssueBody } from "../../.agents/skills/distill-issue/scripts/render-issue-body";

const fullDraft = {
  title: "feat(ui): add PDF export of the report card",
  labels: ["type:ui", "priority:medium", "red-green-refactor"],
  problem:
    "The report card is browser-only; users currently have no way to share or archive a report outside of the live web UI.",
  intendedOutcome:
    "A Download PDF button on the report surface produces a clean, shareable PDF.",
  nonGoals: [
    "Server-side PDF generation",
    "New runtime dependencies for client-side PDF rendering",
  ],
  acceptanceCriteria: [
    "Failing component tests are added first",
    'The button is rendered as a real <button type="button">',
    "Clicking the button invokes window.print()",
  ],
  testExpectations:
    "Add component tests in src/components/report/report-card-view.test.tsx covering button presence and visibility.",
  architectureImpact:
    "New small client component; print-specific CSS; no domain or application changes.",
  blockers: "None.",
};

describe("renderIssueBody", () => {
  it("emits every required development-slice section in order", () => {
    const body = renderIssueBody(fullDraft);
    const sections = [
      "## Problem",
      "## Intended Outcome",
      "## Non-Goals",
      "## Acceptance Criteria",
      "## Test Expectations",
      "## Architecture Impact",
      "## Blockers Or Dependencies",
    ];
    let lastIndex = -1;
    for (const heading of sections) {
      const idx = body.indexOf(heading);
      expect(idx, `missing ${heading}`).toBeGreaterThan(-1);
      expect(idx, `${heading} appeared out of order`).toBeGreaterThan(
        lastIndex,
      );
      lastIndex = idx;
    }
  });

  it("renders acceptance criteria as unchecked task-list items", () => {
    const body = renderIssueBody(fullDraft);
    for (const item of fullDraft.acceptanceCriteria) {
      expect(body).toContain(`- [ ] ${item}`);
    }
  });

  it("renders non-goals as bullet items", () => {
    const body = renderIssueBody(fullDraft);
    for (const item of fullDraft.nonGoals) {
      expect(body).toContain(`- ${item}`);
    }
  });

  it("includes the problem and intended outcome text verbatim", () => {
    const body = renderIssueBody(fullDraft);
    expect(body).toContain(fullDraft.problem);
    expect(body).toContain(fullDraft.intendedOutcome);
  });

  it("renders empty non-goals as a placeholder line, not as an empty section", () => {
    const body = renderIssueBody({ ...fullDraft, nonGoals: [] });
    const nonGoalsIdx = body.indexOf("## Non-Goals");
    const acceptanceIdx = body.indexOf("## Acceptance Criteria");
    const between = body.slice(nonGoalsIdx, acceptanceIdx);
    expect(between).toMatch(/_None_|None\.|n\/a/i);
  });

  it("produces output that round-trips as valid Markdown headings", () => {
    const body = renderIssueBody(fullDraft);
    const headingMatches = body.match(/^## .+$/gm);
    expect(headingMatches).not.toBeNull();
    expect(headingMatches?.length).toBeGreaterThanOrEqual(7);
  });
});
