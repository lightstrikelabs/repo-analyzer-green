#!/usr/bin/env node

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const sourceExtensions = new Set([".cts", ".mts", ".ts", ".tsx"]);
const ignoredDirectoryNames = new Set([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "test-results",
]);
const ignoredFileNames = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const defaultIgnoredRelativePaths = new Set([
  "test/fixtures/type-escapes/rejected",
]);
const marker = "type-escape:";
const markerLookbackLineCount = 3;
const anyKeyword = "any";
const patternLabel = (parts) => parts.join(" ");

const forbiddenPatterns = [
  {
    name: patternLabel(["as", anyKeyword]),
    regex: /\bas\s+any\b/g,
  },
  {
    name: patternLabel([":", anyKeyword]),
    regex: new RegExp(`:\\s*${anyKeyword}\\b`, "g"),
  },
  {
    name: `<${anyKeyword}>`,
    regex: new RegExp(`<\\s*${anyKeyword}\\s*>`, "g"),
  },
  {
    name: patternLabel(["as", "unknown", "as"]),
    regex: /\bas\s+unknown\s+as\b/g,
  },
];

const args = process.argv.slice(2);
const root = process.cwd();
const explicitTargets = args.length > 0;
const targets = explicitTargets ? args : ["."];
const files = [];

for (const target of targets) {
  await collectFiles(path.resolve(root, target), explicitTargets);
}

const violations = [];

for (const filePath of files) {
  const text = await readFile(filePath, "utf8");
  violations.push(...findViolations(filePath, text));
}

if (violations.length > 0) {
  console.error("Unsafe TypeScript type escapes found:");
  for (const violation of violations) {
    const relativePath = path.relative(root, violation.filePath);
    console.error(
      `- ${relativePath}:${violation.line}:${violation.column} ${violation.pattern}`,
    );
  }
  console.error(
    `Add a nearby '${marker}' comment only for validated boundary-adapter exceptions.`,
  );
  process.exitCode = 1;
}

async function collectFiles(targetPath, includeDefaultFixtureExamples) {
  const targetStat = await stat(targetPath);

  if (targetStat.isDirectory()) {
    const entries = await readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(targetPath, entry.name);
      if (shouldIgnorePath(entryPath, entry, includeDefaultFixtureExamples)) {
        continue;
      }
      await collectFiles(entryPath, includeDefaultFixtureExamples);
    }
    return;
  }

  if (targetStat.isFile() && shouldScanFile(targetPath)) {
    files.push(targetPath);
  }
}

function shouldIgnorePath(entryPath, entry, includeDefaultFixtureExamples) {
  if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
    return true;
  }

  if (entry.isFile() && ignoredFileNames.has(entry.name)) {
    return true;
  }

  if (includeDefaultFixtureExamples) {
    return false;
  }

  return defaultIgnoredRelativePaths.has(toRelativePath(entryPath));
}

function shouldScanFile(filePath) {
  return sourceExtensions.has(path.extname(filePath));
}

function findViolations(filePath, text) {
  const maskedText = maskCommentsAndStrings(text);
  const rawLines = text.split(/\r?\n/);
  const found = [];

  for (const pattern of forbiddenPatterns) {
    for (const match of maskedText.matchAll(pattern.regex)) {
      if (typeof match.index !== "number") {
        continue;
      }

      const location = locationForIndex(maskedText, match.index);
      if (hasNearbyMarker(rawLines, location.line)) {
        continue;
      }

      found.push({
        filePath,
        line: location.line,
        column: location.column,
        pattern: pattern.name,
      });
    }
  }

  return found.sort((first, second) => {
    if (first.line !== second.line) {
      return first.line - second.line;
    }
    return first.column - second.column;
  });
}

function maskCommentsAndStrings(text) {
  let masked = "";
  let index = 0;
  let state = "code";
  let quote = "";

  while (index < text.length) {
    const current = text[index] ?? "";
    const next = text[index + 1] ?? "";

    if (state === "lineComment") {
      if (current === "\n") {
        state = "code";
        masked += current;
      } else {
        masked += " ";
      }
      index += 1;
      continue;
    }

    if (state === "blockComment") {
      if (current === "*" && next === "/") {
        masked += "  ";
        index += 2;
        state = "code";
      } else {
        masked += current === "\n" ? "\n" : " ";
        index += 1;
      }
      continue;
    }

    if (state === "string") {
      if (current === "\\") {
        masked += current === "\n" ? "\n" : " ";
        if (next !== "") {
          masked += next === "\n" ? "\n" : " ";
        }
        index += 2;
        continue;
      }

      if (current === quote) {
        masked += " ";
        index += 1;
        state = "code";
        quote = "";
        continue;
      }

      masked += current === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }

    if (current === "/" && next === "/") {
      masked += "  ";
      index += 2;
      state = "lineComment";
      continue;
    }

    if (current === "/" && next === "*") {
      masked += "  ";
      index += 2;
      state = "blockComment";
      continue;
    }

    if (current === "'" || current === '"' || current === "`") {
      masked += " ";
      index += 1;
      state = "string";
      quote = current;
      continue;
    }

    masked += current;
    index += 1;
  }

  return masked;
}

function locationForIndex(text, matchIndex) {
  let line = 1;
  let lastLineStart = 0;

  for (let index = 0; index < matchIndex; index += 1) {
    if (text[index] === "\n") {
      line += 1;
      lastLineStart = index + 1;
    }
  }

  return {
    line,
    column: matchIndex - lastLineStart + 1,
  };
}

function hasNearbyMarker(lines, oneBasedLineNumber) {
  const lineIndex = oneBasedLineNumber - 1;
  const firstLineIndex = Math.max(0, lineIndex - markerLookbackLineCount);
  const candidateLines = lines.slice(firstLineIndex, lineIndex + 1);
  return candidateLines.some((line) => isMarkerComment(line));
}

function isMarkerComment(line) {
  const markerIndex = line.indexOf(marker);
  if (markerIndex === -1) {
    return false;
  }

  const beforeMarker = line.slice(0, markerIndex);
  return (
    beforeMarker.includes("//") ||
    beforeMarker.includes("/*") ||
    beforeMarker.includes("*")
  );
}

function toRelativePath(filePath) {
  return path.relative(root, filePath).split(path.sep).join("/");
}
