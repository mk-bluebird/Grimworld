/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

export type WorkMode =
  | "artwork"
  | "storytelling"
  | "lua_authoring"
  | "lua_execution";

export interface TrustedContext {
  mode: WorkMode;
  execution: {
    explicitlyRequested: boolean;
    authorized: boolean;
    sandboxAvailable: boolean;
  };
}

export interface ToolCall {
  name: string;
  arguments: unknown;
}

export interface LuaSandboxArguments {
  code: string;
}

export type SandboxHandler = (
  args: LuaSandboxArguments
) => Promise<string>;

function executionAllowed(context: TrustedContext): boolean {
  return (
    context.mode === "lua_execution" &&
    context.execution.explicitlyRequested === true &&
    context.execution.authorized === true &&
    context.execution.sandboxAvailable === true
  );
}

/**
 * Construct context in trusted application code.
 * Never deserialize authorization from model output, OCR, or documents.
 */
export function allowedTools(context: TrustedContext): string[] {
  return executionAllowed(context) ? ["lua_sandbox"] : [];
}

export async function dispatchTool(
  call: ToolCall,
  context: TrustedContext,
  sandbox?: SandboxHandler
): Promise<string> {
  if (
    call.name !== "lua_sandbox" ||
    !executionAllowed(context)
  ) {
    throw new Error(`Tool denied: ${call.name}`);
  }

  if (!sandbox) throw new Error("Authorized sandbox handler is missing");

  const args = call.arguments;
  if (
    args === null ||
    typeof args !== "object" ||
    Array.isArray(args)
  ) {
    throw new TypeError("Invalid Lua sandbox arguments");
  }

  const record = args as Record<string, unknown>;
  if (
    Object.keys(record).length !== 1 ||
    typeof record.code !== "string" ||
    record.code.length === 0 ||
    Buffer.byteLength(record.code, "utf8") > 64 * 1024
  ) {
    throw new TypeError("Expected only a bounded, nonempty code field");
  }

  return sandbox({ code: record.code });
}

export interface HostResponse {
  blocks: Array<{
    type: string;
    text?: string;
  }>;
  toolCalls: ToolCall[];
}

export interface ResponseDecision {
  decision: "allow" | "review" | "block";
  reasons: string[];
}

/**
 * The host adapter must preserve every block and tool call.
 * Do not discard image/artifact blocks before invoking this check.
 */
export function inspectResponse(
  response: HostResponse,
  context: TrustedContext
): ResponseDecision {
  const reasons: string[] = [];

  if (
    response.blocks.some(
      block => block.type !== "text" || typeof block.text !== "string"
    )
  ) {
    reasons.push("NON_TEXT_RESPONSE");
  }

  const permitted = new Set(allowedTools(context));
  if (response.toolCalls.some(call => !permitted.has(call.name))) {
    reasons.push("UNAUTHORIZED_TOOL_CALL");
  }

  if (reasons.length > 0) {
    return { decision: "block", reasons };
  }

  const text = response.blocks.map(block => block.text ?? "").join("\n");

  // Heuristics for review, not a complete semantic safety classifier.
  if (
    /\b(?:i(?:'ve| have)?|we(?:'ve| have)?)\s+(?:created|generated|rendered|edited)\s+(?:an?\s+|the\s+)?(?:image|painting|picture)\b/iu
      .test(text)
  ) {
    reasons.push("POSSIBLE_IMAGE_EXECUTION_CLAIM");
  }

  if (
    /data:image\/|!\[[^\]]*\]\(/iu.test(text)
  ) {
    reasons.push("POSSIBLE_EMBEDDED_IMAGE");
  }

  return {
    decision: reasons.length > 0 ? "review" : "allow",
    reasons
  };
}
