import { isAbsolute, resolve } from "node:path";

export type PiToolCallEvent = {
  readonly toolName: string;
  readonly input: Record<string, unknown>;
};

export type GateInvocation =
  | {
      readonly hook_event_name: "PreToolUse";
      readonly tool_name: "Write";
      readonly tool_input: {
        readonly file_path: string;
        readonly content: string;
      };
    }
  | {
      readonly hook_event_name: "PreToolUse";
      readonly tool_name: "MultiEdit";
      readonly tool_input: {
        readonly file_path: string;
        readonly edits: ReadonlyArray<{
          readonly old_string: string;
          readonly new_string: string;
        }>;
      };
    };

export function translateToolEvent(
  event: PiToolCallEvent,
  projectDir: string,
): GateInvocation | null {
  if (event.toolName !== "write" && event.toolName !== "edit") {
    return null;
  }
  const filePath = readPath(event.input);
  if (filePath === null) {
    return null;
  }
  const absolutePath = isAbsolute(filePath)
    ? filePath
    : resolve(projectDir, filePath);

  if (event.toolName === "write") {
    const content = readString(event.input, "content");
    if (content === null) {
      return null;
    }
    return {
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: absolutePath, content },
    };
  }

  const edits = readEdits(event.input);
  if (edits === null) {
    return null;
  }
  return {
    hook_event_name: "PreToolUse",
    tool_name: "MultiEdit",
    tool_input: { file_path: absolutePath, edits },
  };
}

function readPath(input: Record<string, unknown>): string | null {
  const value = input["path"];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readString(
  input: Record<string, unknown>,
  key: string,
): string | null {
  const value = input[key];
  return typeof value === "string" ? value : null;
}

function readEdits(input: Record<string, unknown>): ReadonlyArray<{
  readonly old_string: string;
  readonly new_string: string;
}> | null {
  const raw = input["edits"];
  if (!Array.isArray(raw)) {
    return null;
  }
  const edits: Array<{
    readonly old_string: string;
    readonly new_string: string;
  }> = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) {
      return null;
    }
    const obj = entry as Record<string, unknown>;
    const oldText = obj["oldText"];
    const newText = obj["newText"];
    if (typeof oldText !== "string" || typeof newText !== "string") {
      return null;
    }
    edits.push({ old_string: oldText, new_string: newText });
  }
  return edits;
}
