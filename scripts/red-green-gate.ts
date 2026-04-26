import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import process from "node:process";

export type LedgerEntry = {
  readonly path: string;
  readonly editedAtIso: string;
};

export type Ledger = {
  readonly testEdits: readonly LedgerEntry[];
};

export type GateInput = {
  readonly filesTouched: readonly string[];
  readonly recentTestEdits: readonly string[];
  readonly allowlist: readonly string[];
  readonly overrideMarkers: ReadonlyMap<string, string>;
};

export type GateDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: string;
      readonly blockedFiles: readonly string[];
    };

export function decide(input: GateInput): GateDecision {
  const blocked: string[] = [];

  for (const file of input.filesTouched) {
    if (isAllowlisted(file, input.allowlist)) {
      continue;
    }
    if (isTestFile(file)) {
      continue;
    }
    if (input.overrideMarkers.has(file)) {
      continue;
    }
    const colocated = colocatedTestFor(file);
    if (colocated !== undefined && input.recentTestEdits.includes(colocated)) {
      continue;
    }
    blocked.push(file);
  }

  if (blocked.length === 0) {
    return { allowed: true };
  }

  return {
    allowed: false,
    blockedFiles: blocked,
    reason:
      "Cannot edit non-test source file(s) without a recent edit to the colocated test file. " +
      "Edit the colocated *.test.ts(x) first and observe it fail, " +
      "or add a `// red-green:exempt — <reason>` marker for genuinely test-irrelevant changes.",
  };
}

function isTestFile(filePath: string): boolean {
  return /\.test\.(?:ts|tsx)$/.test(filePath);
}

function colocatedTestFor(sourcePath: string): string | undefined {
  if (sourcePath.endsWith(".tsx")) {
    return `${sourcePath.slice(0, -".tsx".length)}.test.tsx`;
  }
  if (sourcePath.endsWith(".ts")) {
    return `${sourcePath.slice(0, -".ts".length)}.test.ts`;
  }
  return undefined;
}

function isAllowlisted(filePath: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchesPattern(filePath, pattern));
}

export function recentTestEditsFromLedger(
  ledger: Ledger,
  windowMs: number,
  nowMs: number,
): readonly string[] {
  return ledger.testEdits
    .filter((entry) => {
      const editedMs = Date.parse(entry.editedAtIso);
      if (!Number.isFinite(editedMs)) {
        return false;
      }
      return nowMs - editedMs <= windowMs;
    })
    .map((entry) => entry.path);
}

function matchesPattern(filePath: string, pattern: string): boolean {
  if (pattern.endsWith("/**")) {
    const prefix = pattern.slice(0, -"/**".length);
    return filePath === prefix || filePath.startsWith(`${prefix}/`);
  }
  if (pattern.startsWith("**/*.")) {
    const suffix = pattern.slice("**/".length);
    const extension = suffix.slice("*".length);
    return filePath.endsWith(extension);
  }
  if (pattern.startsWith("**/")) {
    const tail = pattern.slice("**/".length);
    return filePath === tail || filePath.endsWith(`/${tail}`);
  }
  return filePath === pattern;
}

const DEFAULT_ALLOWLIST: readonly string[] = [
  "docs/**",
  "**/*.md",
  "**/*.css",
  "**/*.json",
  "scripts/**",
  "test/**",
  "e2e/**",
  ".github/**",
  ".claude/**",
  "AGENTS.md",
  "CLAUDE.md",
  "README.md",
];

const RECENCY_WINDOW_MS = 30 * 60 * 1000;
const EXEMPT_MARKER_REGEX = /\/\/\s*red-green:exempt\b/i;
const HANDLED_TOOLS = new Set(["Edit", "Write", "MultiEdit"]);

export function loadLedger(ledgerPath: string): Ledger {
  if (!existsSync(ledgerPath)) {
    return { testEdits: [] };
  }
  try {
    const raw = readFileSync(ledgerPath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "testEdits" in parsed &&
      Array.isArray((parsed as { testEdits: unknown }).testEdits)
    ) {
      return parsed as Ledger;
    }
  } catch {
    // ignore malformed ledgers; treat as empty
  }
  return { testEdits: [] };
}

export function appendTestEditToLedger(
  ledger: Ledger,
  testFilePath: string,
  nowIso: string,
): Ledger {
  return {
    testEdits: [
      ...ledger.testEdits.filter((entry) => entry.path !== testFilePath),
      { path: testFilePath, editedAtIso: nowIso },
    ],
  };
}

export function saveLedger(ledger: Ledger, ledgerPath: string): void {
  mkdirSync(dirname(ledgerPath), { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2), "utf8");
}

async function readStdin(): Promise<string> {
  let data = "";
  for await (const chunk of process.stdin) {
    data +=
      typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  }
  return data;
}

function extractFilePath(toolInput: unknown): string | undefined {
  if (typeof toolInput !== "object" || toolInput === null) {
    return undefined;
  }
  const filePath = (toolInput as { file_path?: unknown }).file_path;
  return typeof filePath === "string" ? filePath : undefined;
}

function extractNewContent(toolName: string, toolInput: unknown): string {
  if (typeof toolInput !== "object" || toolInput === null) {
    return "";
  }
  const obj = toolInput as Record<string, unknown>;
  if (toolName === "Write" && typeof obj.content === "string") {
    return obj.content;
  }
  if (toolName === "Edit" && typeof obj.new_string === "string") {
    return obj.new_string;
  }
  if (toolName === "MultiEdit" && Array.isArray(obj.edits)) {
    return obj.edits
      .map((edit) => {
        if (typeof edit === "object" && edit !== null) {
          const next = (edit as { new_string?: unknown }).new_string;
          return typeof next === "string" ? next : "";
        }
        return "";
      })
      .join("\n");
  }
  return "";
}

async function main(): Promise<void> {
  const stdin = await readStdin();
  if (stdin.trim() === "") {
    process.exit(0);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(stdin);
  } catch {
    process.exit(0);
  }

  if (typeof payload !== "object" || payload === null) {
    process.exit(0);
  }
  const obj = payload as Record<string, unknown>;
  const toolName = obj.tool_name;
  if (typeof toolName !== "string" || !HANDLED_TOOLS.has(toolName)) {
    process.exit(0);
  }

  const absoluteFilePath = extractFilePath(obj.tool_input);
  if (absoluteFilePath === undefined) {
    process.exit(0);
  }

  const projectDir = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
  const relativeFilePath = relative(projectDir, absoluteFilePath);
  if (relativeFilePath.startsWith("..") || relativeFilePath === "") {
    process.exit(0);
  }

  const ledgerPath = join(projectDir, ".claude/state/red-green-ledger.json");
  const ledger = loadLedger(ledgerPath);
  const recentEdits = recentTestEditsFromLedger(
    ledger,
    RECENCY_WINDOW_MS,
    Date.now(),
  );

  const newContent = extractNewContent(toolName, obj.tool_input);
  const overrideMarkers = new Map<string, string>();
  if (EXEMPT_MARKER_REGEX.test(newContent)) {
    overrideMarkers.set(relativeFilePath, "inline marker");
  }

  const decision = decide({
    filesTouched: [relativeFilePath],
    recentTestEdits: recentEdits,
    allowlist: DEFAULT_ALLOWLIST,
    overrideMarkers,
  });

  if (isTestFile(relativeFilePath)) {
    const updated = appendTestEditToLedger(
      ledger,
      relativeFilePath,
      new Date().toISOString(),
    );
    saveLedger(updated, ledgerPath);
  }

  if (decision.allowed) {
    process.exit(0);
  }

  process.stderr.write(`${decision.reason}\n`);
  process.stderr.write(`Blocked: ${decision.blockedFiles.join(", ")}\n`);
  process.exit(2);
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main();
}
