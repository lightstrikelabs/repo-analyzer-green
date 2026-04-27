import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const agentsMd = readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
const prTemplate = readFileSync(
  path.join(repoRoot, ".github/pull_request_template.md"),
  "utf8",
);

describe("AGENTS.md Before Any Code front matter", () => {
  it("declares a 'Before Any Code' section near the top of the document", () => {
    const beforeIdx = agentsMd.indexOf("## Before Any Code");
    expect(beforeIdx).toBeGreaterThan(-1);
    const firstNumberedRule = agentsMd.indexOf(
      "## 1. Scope Sessions And PRs Sanely",
    );
    expect(firstNumberedRule).toBeGreaterThan(-1);
    expect(beforeIdx).toBeLessThan(firstNumberedRule);
  });

  it.each([
    ["the linked GitHub issue artifact", /Linked issue/i],
    ["the branch artifact (not on main)", /branch.*main|not on `?main`?/i],
    ["the preflight artifact", /preflight|fork-day/i],
    [
      "the failing test (RED) artifact before non-test edits",
      /failing test|RED test|red test|test fails/i,
    ],
    [
      "the architecture/plan check",
      /architecture\.md|development-plan\.md|architecture and plan/i,
    ],
  ])("requires %s", (_label, pattern) => {
    const beforeIdx = agentsMd.indexOf("## Before Any Code");
    const nextHeadingMatch = agentsMd.slice(beforeIdx + 1).match(/\n## [^\n]+/);
    const sectionEnd =
      nextHeadingMatch === null
        ? agentsMd.length
        : beforeIdx + 1 + (nextHeadingMatch.index ?? 0);
    const section = agentsMd.slice(beforeIdx, sectionEnd);
    expect(section).toMatch(pattern);
  });

  it("tells the agent to stop and ask if any artifact is missing", () => {
    expect(agentsMd).toMatch(/stop and ask|stop, ask|skipping silently/i);
  });
});

describe("AGENTS.md Recent Misses log", () => {
  it("has a 'Recent Misses' section", () => {
    expect(agentsMd).toMatch(/^## Recent Misses\b/m);
  });

  it("seeds the log with the 2026-04-26 PDF/TDD miss linking PR #105 and PR #114", () => {
    const recentIdx = agentsMd.indexOf("## Recent Misses");
    expect(recentIdx).toBeGreaterThan(-1);
    const section = agentsMd.slice(recentIdx);
    expect(section).toMatch(/2026-04-26/);
    expect(section).toMatch(/#105/);
    expect(section).toMatch(/#114/);
    expect(section).toMatch(/PDF|red test|TDD/i);
  });
});

describe(".github/pull_request_template.md", () => {
  it("requires a Linked Issue field", () => {
    expect(prTemplate).toMatch(/^## Linked Issue\b/m);
  });

  it("references the Before Any Code checklist so reviewers can spot skipped artifacts", () => {
    expect(prTemplate).toMatch(/Before Any Code/i);
  });
});
