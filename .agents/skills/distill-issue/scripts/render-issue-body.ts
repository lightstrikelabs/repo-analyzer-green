import { pathToFileURL } from "node:url";
import process from "node:process";

export type IssueDraft = {
  readonly title: string;
  readonly labels: readonly string[];
  readonly milestone?: string;
  readonly problem: string;
  readonly intendedOutcome: string;
  readonly nonGoals: readonly string[];
  readonly acceptanceCriteria: readonly string[];
  readonly testExpectations: string;
  readonly architectureImpact: string;
  readonly blockers: string;
};

export function renderIssueBody(draft: IssueDraft): string {
  const sections: string[] = [
    `## Problem`,
    "",
    draft.problem.trim(),
    "",
    `## Intended Outcome`,
    "",
    draft.intendedOutcome.trim(),
    "",
    `## Non-Goals`,
    "",
    renderBulletList(draft.nonGoals),
    "",
    `## Acceptance Criteria`,
    "",
    renderTaskList(draft.acceptanceCriteria),
    "",
    `## Test Expectations`,
    "",
    draft.testExpectations.trim(),
    "",
    `## Architecture Impact`,
    "",
    draft.architectureImpact.trim(),
    "",
    `## Blockers Or Dependencies`,
    "",
    draft.blockers.trim() === "" ? "_None_" : draft.blockers.trim(),
    "",
  ];

  return sections.join("\n");
}

function renderBulletList(items: readonly string[]): string {
  if (items.length === 0) {
    return "_None_";
  }
  return items.map((item) => `- ${item.trim()}`).join("\n");
}

function renderTaskList(items: readonly string[]): string {
  if (items.length === 0) {
    return "- [ ] _no acceptance criteria yet — fill in before this issue can be picked up_";
  }
  return items.map((item) => `- [ ] ${item.trim()}`).join("\n");
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });
}

async function main(): Promise<void> {
  const stdin = await readStdin();
  if (stdin.trim() === "") {
    process.stderr.write(
      "Usage: pipe a JSON IssueDraft to this script's stdin to render an issue body to stdout.\n",
    );
    process.exit(2);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdin);
  } catch (error) {
    process.stderr.write(
      `Invalid JSON on stdin: ${(error as Error).message}\n`,
    );
    process.exit(2);
  }
  if (!isIssueDraft(parsed)) {
    process.stderr.write(
      "Stdin JSON does not match IssueDraft shape (title, labels[], problem, intendedOutcome, nonGoals[], acceptanceCriteria[], testExpectations, architectureImpact, blockers).\n",
    );
    process.exit(2);
  }
  process.stdout.write(renderIssueBody(parsed));
  process.stdout.write("\n");
}

function isIssueDraft(value: unknown): value is IssueDraft {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  const stringFields = [
    "title",
    "problem",
    "intendedOutcome",
    "testExpectations",
    "architectureImpact",
    "blockers",
  ] as const;
  for (const field of stringFields) {
    if (typeof obj[field] !== "string") {
      return false;
    }
  }
  if (!isStringArray(obj.labels)) {
    return false;
  }
  if (!isStringArray(obj.nonGoals)) {
    return false;
  }
  if (!isStringArray(obj.acceptanceCriteria)) {
    return false;
  }
  return true;
}

function isStringArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
