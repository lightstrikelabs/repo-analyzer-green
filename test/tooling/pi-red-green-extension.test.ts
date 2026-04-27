import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  translateToolEvent,
  type GateInvocation,
  type PiToolCallEvent,
} from "../../.pi/extensions/red-green-gate/translator";
import setupExtension from "../../.pi/extensions/red-green-gate/index";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

type ToolCallHandler = (
  event: PiToolCallEvent,
  ctx: { readonly cwd: string },
) =>
  | Promise<{ readonly block: true; readonly reason: string } | undefined>
  | { readonly block: true; readonly reason: string }
  | undefined;

function captureToolCallHandler(): {
  readonly pi: { on: (event: string, handler: unknown) => void };
  readonly handlers: { tool_call?: ToolCallHandler };
} {
  const handlers: { tool_call?: ToolCallHandler } = {};
  const pi = {
    on(event: string, handler: unknown): void {
      if (event === "tool_call") {
        handlers.tool_call = handler as ToolCallHandler;
      }
    },
  };
  return { pi, handlers };
}

function makeFixtureProject(): {
  readonly dir: string;
  readonly cleanup: () => void;
} {
  const dir = mkdtempSync(path.join(tmpdir(), "green-pi-rg-"));
  spawnSync("git", ["-C", dir, "init", "--quiet"]);
  mkdirSync(path.join(dir, "src/components"), { recursive: true });
  mkdirSync(path.join(dir, "scripts"), { recursive: true });
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "pi-rg-fixture", type: "module" }),
  );
  copyFileSync(
    path.join(repoRoot, "scripts/red-green-gate.ts"),
    path.join(dir, "scripts/red-green-gate.ts"),
  );
  return {
    dir,
    cleanup: () => rmSync(dir, { force: true, recursive: true }),
  };
}

describe("translateToolEvent", () => {
  it("translates a pi `write` event into a Write hook payload with an absolute path", () => {
    const event: PiToolCallEvent = {
      toolName: "write",
      input: {
        path: "src/foo.tsx",
        content: "export const a = 1;\n",
      },
    };
    const result = translateToolEvent(event, "/repo");
    expect(result).not.toBeNull();
    if (result !== null) {
      expect(result.tool_name).toBe("Write");
      expect(result.tool_input).toEqual({
        file_path: "/repo/src/foo.tsx",
        content: "export const a = 1;\n",
      });
    }
  });

  it("passes through absolute paths unchanged", () => {
    const event: PiToolCallEvent = {
      toolName: "write",
      input: { path: "/abs/path/foo.tsx", content: "x" },
    };
    const result = translateToolEvent(event, "/repo");
    expect(result?.tool_input.file_path).toBe("/abs/path/foo.tsx");
  });

  it("translates a pi `edit` event with multiple edits into a MultiEdit payload", () => {
    const event: PiToolCallEvent = {
      toolName: "edit",
      input: {
        path: "src/foo.tsx",
        edits: [
          { oldText: "a", newText: "b" },
          { oldText: "c", newText: "d" },
        ],
      },
    };
    const result = translateToolEvent(event, "/repo");
    expect(result).not.toBeNull();
    if (result !== null) {
      expect(result.tool_name).toBe("MultiEdit");
      expect(result.tool_input).toEqual({
        file_path: "/repo/src/foo.tsx",
        edits: [
          { old_string: "a", new_string: "b" },
          { old_string: "c", new_string: "d" },
        ],
      });
    }
  });

  it("returns null for non-edit/write tools", () => {
    const result = translateToolEvent(
      { toolName: "bash", input: { command: "ls" } },
      "/repo",
    );
    expect(result).toBeNull();
  });

  it("returns null when input is malformed (missing path)", () => {
    const result = translateToolEvent(
      { toolName: "write", input: { content: "x" } },
      "/repo",
    );
    expect(result).toBeNull();
  });
});

describe("red-green-gate pi extension wiring", () => {
  it("subscribes to the tool_call event when loaded", () => {
    const { pi, handlers } = captureToolCallHandler();
    setupExtension(pi);
    expect(handlers.tool_call).toBeDefined();
  });

  it("returns undefined for tool calls that are neither edit nor write", async () => {
    const { pi, handlers } = captureToolCallHandler();
    setupExtension(pi);
    const result = await handlers.tool_call!(
      { toolName: "read", input: { path: "/abs/foo.tsx" } },
      { cwd: repoRoot },
    );
    expect(result).toBeUndefined();
  });

  it("blocks an edit to a non-test source file when no colocated test was edited recently", async () => {
    const { pi, handlers } = captureToolCallHandler();
    setupExtension(pi);
    const fx = makeFixtureProject();
    try {
      const result = await handlers.tool_call!(
        {
          toolName: "write",
          input: {
            path: path.join(fx.dir, "src/components/foo.tsx"),
            content: "export const a = 1;\n",
          },
        },
        { cwd: fx.dir },
      );
      expect(result).toBeDefined();
      expect(result?.block).toBe(true);
      expect(result?.reason).toMatch(/colocated test/i);
    } finally {
      fx.cleanup();
    }
  });

  it("allows an edit to an allowlisted path without a colocated test", async () => {
    const { pi, handlers } = captureToolCallHandler();
    setupExtension(pi);
    const result = await handlers.tool_call!(
      {
        toolName: "write",
        input: {
          path: path.join(repoRoot, "docs/agent-compat.md"),
          content: "# notes\n",
        },
      },
      { cwd: repoRoot },
    );
    expect(result).toBeUndefined();
  });

  it("allows a write whose new content carries the red-green:exempt marker", async () => {
    const { pi, handlers } = captureToolCallHandler();
    setupExtension(pi);
    const result = await handlers.tool_call!(
      {
        toolName: "write",
        input: {
          path: path.join(repoRoot, "src/components/whatever.tsx"),
          content:
            "// red-green:exempt — trivial rename, no behavior change\nexport const x = 1;\n",
        },
      },
      { cwd: repoRoot },
    );
    expect(result).toBeUndefined();
  });
});

// Type-export reference so editor tooling pulls the type module in.
type _GateInvocationRef = GateInvocation;
