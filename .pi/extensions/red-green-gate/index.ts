import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { translateToolEvent, type PiToolCallEvent } from "./translator";

type ToolCallResult =
  | { readonly block: true; readonly reason: string }
  | undefined;

type ExtensionContext = {
  readonly cwd: string;
};

type ToolCallHandler = (
  event: PiToolCallEvent,
  ctx: ExtensionContext,
) => Promise<ToolCallResult> | ToolCallResult;

export type ExtensionAPI = {
  readonly on: (event: "tool_call", handler: ToolCallHandler) => void;
};

export default function setupRedGreenExtension(pi: ExtensionAPI): void {
  pi.on("tool_call", async (event, ctx) => {
    const invocation = translateToolEvent(event, ctx.cwd);
    if (invocation === null) {
      return undefined;
    }

    const scriptPath = join(ctx.cwd, "scripts/red-green-gate.ts");
    const result = spawnSync(process.execPath, [scriptPath], {
      input: JSON.stringify(invocation),
      encoding: "utf8",
      cwd: ctx.cwd,
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: ctx.cwd,
      },
    });

    if (result.status === 2) {
      const stderr = (result.stderr ?? "").trim();
      const reason =
        stderr === ""
          ? "blocked by red-green gate (no reason provided)"
          : stderr;
      return { block: true, reason };
    }
    return undefined;
  });
}
