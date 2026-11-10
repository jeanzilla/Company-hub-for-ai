// The company's own tools for the hub MCP. The "new-tool" skill adds its tools here:
//
//   import { ORDERS } from "./orders.ts";
//   export const COMPANY_TOOLS: Tool[] = [...ORDERS];
//
// Each one declares its permission ("tool:orders"), which is then given to roles in Team → Roles.
import type { Tool } from "../lib/mcp/types.ts";

export const COMPANY_TOOLS: Tool[] = [];
