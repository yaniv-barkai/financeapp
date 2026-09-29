import type { McpServer } from "@modelcontextprotocol/server";
import { registerReadTools } from "./tools-read";
import { registerWriteTools } from "./tools-write";

export const MCP_INSTRUCTIONS =
  "Personal finance data for the signed-in user: books (ledgers), categories, transactions, monthly budgets, recurring items, debts with a snowball payoff plan, and money-saving tasks. " +
  "Amounts are in the book's currency (see list_books). Dates are YYYY-MM-DD, months YYYY-MM. " +
  "Use month_summary for overviews and search_transactions for details. " +
  "Write tools need a Read + Write token; confirm with the user before adding or changing data.";

export function registerFinanceTools(server: McpServer): void {
  registerReadTools(server);
  registerWriteTools(server);
}
