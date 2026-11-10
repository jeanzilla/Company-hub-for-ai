// Shape of a hub MCP tool. The core tools are in lib/mcp/core.ts and the company's own tools in tools/.
// They all go through the same place: the permission is checked, the tool runs and the call is written to the log.
import type { z } from "zod";
import type { Person } from "../people.ts";

export type ToolContext = { person: Person; via: "mcp" | "web" };

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Tool = {
  /** Technical name, lowercase, words joined with "_": "orders_search". */
  name: string;
  /** Name for people: "Search orders". It is the title of the log line. */
  title: string;
  /** What it does, when to use it and what not to do with it. The AI decides from this text. */
  description: string;
  input: z.ZodObject<any>;
  /** Permission needed to see it and use it. */
  permission: string;
  /** If the permission depends on the arguments (one connector or another), the list of valid permissions: one is enough. */
  permissionFor?: (args: any) => string[];
  /** If showing it in the list depends on more than `permission`. */
  visible?: (permissions: string[]) => boolean;
  readOnly?: boolean;
  /** true if the tool writes to the log itself (so the call is not logged twice). */
  skipLog?: boolean;
  area?: string;
  run: (args: any, ctx: ToolContext) => Promise<unknown>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Defines a tool with its arguments typed from its schema. */
export function defineTool<E extends z.ZodObject>(t: Omit<Tool, "input" | "run" | "permissionFor"> & {
  input: E;
  permissionFor?: (args: z.infer<E>) => string[];
  run: (args: z.infer<E>, ctx: ToolContext) => Promise<unknown>;
}): Tool {
  return t as unknown as Tool;
}
