import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { MCP_INSTRUCTIONS, registerFinanceTools } from "@/lib/mcp/server";
import { scopesFor } from "@/lib/server/api-token-core";
import { verifyApiToken } from "@/lib/server/api-tokens";
import { APP_VERSION } from "@/lib/version";

export const maxDuration = 60;

const handler = createMcpHandler(registerFinanceTools, {
  serverInfo: { name: "finance-app", version: APP_VERSION },
  instructions: MCP_INSTRUCTIONS,
});

const authHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    const verified = await verifyApiToken(bearerToken);
    if (!verified) return undefined;
    return {
      token: bearerToken!,
      clientId: verified.id,
      scopes: scopesFor(verified.scope),
      extra: { uid: verified.uid },
    };
  },
  { required: true }
);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
