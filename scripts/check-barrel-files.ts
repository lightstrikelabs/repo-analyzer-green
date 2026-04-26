#!/usr/bin/env node

import { readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ignoredDirectoryNames = new Set<string>([
  ".git",
  ".next",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "test-results",
]);
const defaultTargets = ["src", "test", "scripts"];

const root = process.cwd();
const targets =
  process.argv.length > 2 ? process.argv.slice(2) : defaultTargets;
const violations: string[] = [];

for (const target of targets) {
  const targetPath = path.resolve(root, target);
  await collectViolations(targetPath);
}

if (violations.length > 0) {
  console.error("Internal barrel files are not allowed:");
  for (const violation of violations.sort()) {
    console.error(`- ${violation}`);
  }
  console.error("");
  console.error(
    "Import directly from the source module instead of an index.ts re-export.",
  );
  process.exitCode = 1;
}

async function collectViolations(targetPath: string): Promise<void> {
  const targetStat = await stat(targetPath).catch(() => undefined);
  if (targetStat === undefined) {
    return;
  }

  if (targetStat.isDirectory()) {
    const entries = await readdir(targetPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && ignoredDirectoryNames.has(entry.name)) {
        continue;
      }
      await collectViolations(path.join(targetPath, entry.name));
    }
    return;
  }

  if (!targetStat.isFile() || path.basename(targetPath) !== "index.ts") {
    return;
  }

  violations.push(toRelativePath(targetPath));
}

function toRelativePath(filePath: string): string {
  return path.relative(root, filePath).split(path.sep).join("/");
}
