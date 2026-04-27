import {
  existsSync,
  lstatSync,
  readFileSync,
  readlinkSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe("cross-agent compatibility scaffold", () => {
  describe(".agents/skills canonical store", () => {
    it("exists as a directory", () => {
      const target = path.join(repoRoot, ".agents/skills");
      expect(existsSync(target)).toBe(true);
      expect(statSync(target).isDirectory()).toBe(true);
    });
  });

  describe.each([[".claude/skills"], [".codex/skills"], [".pi/skills"]])(
    "symlink %s",
    (link) => {
      it("is a symlink", () => {
        const linkPath = path.join(repoRoot, link);
        const stat = lstatSync(linkPath);
        expect(stat.isSymbolicLink()).toBe(true);
      });

      it("uses a relative target so the repo is portable", () => {
        const linkPath = path.join(repoRoot, link);
        const target = readlinkSync(linkPath);
        expect(path.isAbsolute(target)).toBe(false);
      });

      it("resolves to the canonical .agents/skills directory", () => {
        const linkPath = path.join(repoRoot, link);
        const target = readlinkSync(linkPath);
        const resolved = path.resolve(path.dirname(linkPath), target);
        expect(resolved).toBe(path.join(repoRoot, ".agents/skills"));
      });
    },
  );

  describe(".codex/config.toml red-green PreToolUse hook", () => {
    it("exists as a regular file", () => {
      const target = path.join(repoRoot, ".codex/config.toml");
      expect(existsSync(target)).toBe(true);
      expect(statSync(target).isFile()).toBe(true);
    });

    it("declares a PreToolUse hook that invokes scripts/red-green-gate.ts", () => {
      const content = readFileSync(
        path.join(repoRoot, ".codex/config.toml"),
        "utf8",
      );
      expect(content).toMatch(/PreToolUse/);
      expect(content).toContain("scripts/red-green-gate.ts");
      expect(content).toMatch(/Edit\|Write\|MultiEdit/);
    });
  });

  describe("docs/agent-compat.md", () => {
    it("exists and references all three agents and the canonical .agents/skills path", () => {
      const target = path.join(repoRoot, "docs/agent-compat.md");
      expect(existsSync(target)).toBe(true);
      const content = readFileSync(target, "utf8");
      expect(content).toContain("Claude Code");
      expect(content).toContain("Codex");
      expect(content).toContain("pi");
      expect(content).toContain(".agents/skills");
    });
  });

  describe("AGENTS.md", () => {
    it("links to docs/agent-compat.md so future agents read the cross-compat reference", () => {
      const content = readFileSync(path.join(repoRoot, "AGENTS.md"), "utf8");
      expect(content).toContain("docs/agent-compat.md");
    });
  });
});
