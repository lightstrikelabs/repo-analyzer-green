import { describe, expect, it } from "vitest";

import {
  parseSliceArgs,
  planSlice,
  type SlicePlanInput,
} from "../../.agents/skills/start-slice/scripts/start-slice";

const baseInput = (
  overrides: Partial<SlicePlanInput> = {},
): SlicePlanInput => ({
  issueNumber: 143,
  slug: "workflow-skills",
  projectDir: "/repo/demo",
  currentBranch: "main",
  isWorkingTreeDirty: false,
  ...overrides,
});

describe("parseSliceArgs", () => {
  it("accepts --issue and --slug flags", () => {
    const result = parseSliceArgs([
      "--issue",
      "143",
      "--slug",
      "workflow-skills",
    ]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.args.issueNumber).toBe(143);
      expect(result.args.slug).toBe("workflow-skills");
    }
  });

  it("rejects when --issue is missing", () => {
    const result = parseSliceArgs(["--slug", "workflow-skills"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/--issue/);
    }
  });

  it("rejects when --slug is missing", () => {
    const result = parseSliceArgs(["--issue", "143"]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/--slug/);
    }
  });

  it("rejects a non-numeric issue number", () => {
    const result = parseSliceArgs([
      "--issue",
      "not-a-number",
      "--slug",
      "workflow-skills",
    ]);
    expect(result.ok).toBe(false);
  });

  it("rejects a slug with invalid characters", () => {
    const result = parseSliceArgs([
      "--issue",
      "143",
      "--slug",
      "Workflow Skills",
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/slug/i);
    }
  });

  it("rejects a slug starting or ending with a hyphen", () => {
    const result = parseSliceArgs(["--issue", "143", "--slug", "-bad"]);
    expect(result.ok).toBe(false);
  });
});

describe("planSlice", () => {
  it("refuses to proceed when the working tree is dirty", () => {
    const plan = planSlice(baseInput({ isWorkingTreeDirty: true }));
    expect(plan.canProceed).toBe(false);
    if (!plan.canProceed) {
      expect(plan.reason).toMatch(/working tree|uncommitted/i);
    }
  });

  it("refuses to proceed when the current branch is not main", () => {
    const plan = planSlice(baseInput({ currentBranch: "some-feature-branch" }));
    expect(plan.canProceed).toBe(false);
    if (!plan.canProceed) {
      expect(plan.reason).toMatch(/main/i);
    }
  });

  it("produces a worktree path matching worktrees/<issue#>-<slug>", () => {
    const plan = planSlice(baseInput());
    expect(plan.canProceed).toBe(true);
    if (plan.canProceed) {
      expect(plan.worktreePath).toMatch(/worktrees\/143-workflow-skills$/);
    }
  });

  it("derives a branch name of <issue#>-<slug>", () => {
    const plan = planSlice(baseInput());
    expect(plan.canProceed).toBe(true);
    if (plan.canProceed) {
      expect(plan.branchName).toBe("143-workflow-skills");
    }
  });

  it("includes the canonical setup steps in the plan", () => {
    const plan = planSlice(baseInput());
    expect(plan.canProceed).toBe(true);
    if (plan.canProceed) {
      const stepText = plan.steps.join("\n");
      expect(stepText).toMatch(/git fetch/i);
      expect(stepText).toMatch(/git worktree add/i);
      expect(stepText).toMatch(/pnpm install/i);
      expect(stepText).toMatch(/preflight/i);
    }
  });
});
