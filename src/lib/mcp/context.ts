import type { CallToolResult, ServerContext } from "@modelcontextprotocol/server";
import { ApiTokenScope, hasScope } from "@/lib/server/api-token-core";
import { BookNotFoundError } from "@/lib/server/finance-data";

export interface Caller {
  uid: string;
  scopes: string[];
}

export class ToolError extends Error {}

/** The only source of uid for MCP tools: the verified bearer token, never tool input. */
export function getCaller(ctx: ServerContext, needed: ApiTokenScope): Caller {
  const auth = ctx.http?.authInfo;
  const uid = auth?.extra?.uid;
  if (!auth || typeof uid !== "string" || !uid) {
    throw new ToolError("Not authenticated");
  }
  if (!hasScope(auth.scopes, needed)) {
    throw new ToolError(
      needed === "write"
        ? "This token is read-only. Create a Read + Write token in Settings to make changes."
        : "Token is missing the read scope."
    );
  }
  return { uid, scopes: auth.scopes };
}

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data) }] };
}

function errorResult(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Wraps a tool body so expected failures come back as tool errors the model can read. */
export async function runTool(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return jsonResult(await fn());
  } catch (err) {
    if (err instanceof ToolError || err instanceof BookNotFoundError) {
      return errorResult(err.message);
    }
    console.error("MCP tool failed:", err);
    return errorResult("Internal error");
  }
}
