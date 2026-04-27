import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("docs/skills.md", () => {
  const skillsMd = (): string =>
    readFileSync(path.join(repoRoot, "docs/skills.md"), "utf8");

  it("exists as a regular file", () => {
    const target = path.join(repoRoot, "docs/skills.md");
    expect(existsSync(target)).toBe(true);
    expect(statSync(target).isFile()).toBe(true);
  });

  it("places skills at the canonical .agents/skills/<name>/SKILL.md path", () => {
    expect(skillsMd()).toMatch(/\.agents\/skills\/<name>\/SKILL\.md/);
  });

  it("documents the required frontmatter fields name and description", () => {
    const content = skillsMd();
    expect(content).toMatch(/^[-|]\s*\*?\*?name\*?\*?/im);
    expect(content).toMatch(/^[-|]\s*\*?\*?description\*?\*?/im);
  });

  it("documents naming rules (lowercase, hyphens, max 64 chars, parent-dir match)", () => {
    const content = skillsMd();
    expect(content).toMatch(/lowercase/i);
    expect(content).toMatch(/hyphen/i);
    expect(content).toMatch(/64/);
    expect(content).toMatch(/parent (directory|dir)/i);
  });

  it("explains how each of the three agents discovers skills", () => {
    const content = skillsMd();
    expect(content).toContain("Claude Code");
    expect(content).toContain("Codex");
    expect(content).toContain("pi");
  });

  it("points readers at the Anthropic skill-creator skill for scaffolding", () => {
    expect(skillsMd()).toMatch(/skill-creator/i);
  });

  it("links to docs/agent-compat.md for the cross-agent path layout", () => {
    expect(skillsMd()).toContain("agent-compat.md");
  });

  it("includes a review checklist for new skills", () => {
    expect(skillsMd()).toMatch(/review checklist|review.+(skill|new skill)/i);
  });
});

describe(".agents/skills/README.md", () => {
  it("exists and explains the directory's purpose for someone browsing the repo", () => {
    const target = path.join(repoRoot, ".agents/skills/README.md");
    expect(existsSync(target)).toBe(true);
    const content = readFileSync(target, "utf8");
    expect(content).toContain(".agents/skills");
    expect(content).toMatch(/SKILL\.md/);
    expect(content).toMatch(/skills\.md|docs\/skills/i);
  });
});

describe("AGENTS.md", () => {
  it("links to docs/skills.md so future authors can find the convention", () => {
    const content = readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
    expect(content).toContain("docs/skills.md");
  });
});
