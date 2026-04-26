#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import process from "node:process";

const allowedTypes = new Set([
  "feat",
  "fix",
  "docs",
  "test",
  "refactor",
  "perf",
  "build",
  "ci",
  "chore",
  "revert",
]);

const vagueSummaries = new Set([
  "change",
  "changes",
  "fix",
  "misc",
  "stuff",
  "update",
  "updates",
  "wip",
]);

const subjectPattern =
  /^(?<type>[a-z]+)(?:\((?<scope>[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*)\))?(?<breaking>!)?: (?<summary>.+)$/u;
const maxSubjectLength = 72;

type MessageSource = {
  readonly message: string;
};

type ValidationResult = {
  readonly valid: boolean;
  readonly errors: readonly string[];
};

const result = await readMessage();
const validation = validateCommitMessage(result.message);

if (!validation.valid) {
  console.error("Invalid commit message subject:");
  for (const error of validation.errors) {
    console.error(`- ${error}`);
  }
  console.error("");
  console.error("Expected: <type>(optional-scope): <imperative summary>");
  console.error("Example: feat(chat): model targeted follow-up conversations");
  console.error(
    `Accepted types: ${Array.from(allowedTypes).sort().join(", ")}`,
  );
  process.exitCode = 1;
}

async function readMessage(): Promise<MessageSource> {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    return {
      message: await readFromStdin(),
    };
  }

  const fileFlagIndex = args.indexOf("--file");
  if (fileFlagIndex !== -1) {
    const filePath = args[fileFlagIndex + 1];
    if (filePath === undefined || filePath === "") {
      failUsage("--file requires a path");
    }

    return {
      message: await readFile(filePath, "utf8"),
    };
  }

  const messageFlagIndex = args.indexOf("--message");
  if (messageFlagIndex !== -1) {
    const message = args[messageFlagIndex + 1];
    if (message === undefined || message === "") {
      failUsage("--message requires a value");
    }

    return { message };
  }

  failUsage("expected --file <path>, --message <text>, or stdin");
}

async function readFromStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    failUsage("no commit message provided");
  }

  let message = "";
  for await (const chunk of process.stdin) {
    message += String(chunk);
  }

  return message;
}

function validateCommitMessage(message: string): ValidationResult {
  const subject = firstSubjectLine(message);
  const errors: string[] = [];

  if (subject === "") {
    errors.push("subject is empty");
    return { valid: false, errors };
  }

  if (subject.length > maxSubjectLength) {
    errors.push(`subject must be ${maxSubjectLength} characters or fewer`);
  }

  const match = subject.match(subjectPattern);
  if (match === null || match.groups === undefined) {
    errors.push("subject must match Conventional Commits format");
    return { valid: false, errors };
  }

  const type = match.groups.type ?? "";
  const summary = match.groups.summary ?? "";
  if (!allowedTypes.has(type)) {
    errors.push(`type '${type}' is not accepted`);
  }

  if (summary.trim() !== summary) {
    errors.push("summary must not start or end with whitespace");
  }

  if (summary.endsWith(".")) {
    errors.push("summary must not end with a period");
  }

  if (vagueSummaries.has(normalizeSummary(summary))) {
    errors.push("summary is too vague to support useful git blame");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function firstSubjectLine(message: string): string {
  return (
    message
      .replace(/\r\n/gu, "\n")
      .split("\n")
      .find((line) => line.trim() !== "" && !line.startsWith("#"))
      ?.trimEnd() ?? ""
  );
}

function normalizeSummary(summary: string): string {
  return summary
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/u, "");
}

function failUsage(message: string): never {
  console.error(`Usage error: ${message}`);
  process.exit(2);
}
