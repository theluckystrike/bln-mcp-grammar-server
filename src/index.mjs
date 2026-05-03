#!/usr/bin/env node

/**
 * BeLikeNative MCP Server -- Main Entry Point
 *
 * Registers 4 language tools via the Model Context Protocol (stdio transport).
 * No external API keys required -- grammar/style checks are rule-based,
 * and translate/tone tools return structured prompts for the host AI.
 * Logs to stderr (stdout is reserved for MCP protocol messages).
 * Complies with NASA Power of 10 rules.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { TOOL_DEFINITIONS, TOOL_HANDLERS } from "./tools.mjs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVER_NAME = "bln-mcp-server";
const SERVER_VERSION = "1.0.0";
const MAX_TOOL_NAME_LENGTH = 64;

// ---------------------------------------------------------------------------
// Logging (stderr only — stdout is MCP protocol)
// ---------------------------------------------------------------------------

/**
 * Log an informational message to stderr.
 * @param {string} message
 */
function logInfo(message) {
  console.assert(typeof message === "string", "Log message must be a string");
  console.assert(message.length > 0, "Log message must not be empty");
  process.stderr.write(`[BLN-MCP] INFO: ${message}\n`);
}

/**
 * Log an error message to stderr.
 * @param {string} message
 * @param {Error|null} [err]
 */
function logError(message, err) {
  console.assert(typeof message === "string", "Log message must be a string");
  console.assert(message.length > 0, "Log message must not be empty");

  const detail = err instanceof Error ? ` — ${err.message}` : "";
  process.stderr.write(`[BLN-MCP] ERROR: ${message}${detail}\n`);
}

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

/**
 * Create and configure the MCP server instance.
 * @returns {Server}
 */
function createServer() {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  console.assert(server !== null, "Server must be created successfully");
  console.assert(typeof server.setRequestHandler === "function",
    "Server must have setRequestHandler method");

  registerListToolsHandler(server);
  registerCallToolHandler(server);

  return server;
}

/**
 * Register the ListTools request handler.
 * @param {Server} server
 */
function registerListToolsHandler(server) {
  console.assert(server !== null, "Server must not be null");
  console.assert(typeof server.setRequestHandler === "function",
    "Server must support setRequestHandler");

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logInfo("Listing tools — returning " + TOOL_DEFINITIONS.length + " tools");
    return { tools: TOOL_DEFINITIONS };
  });
}

/**
 * Register the CallTool request handler.
 * @param {Server} server
 */
function registerCallToolHandler(server) {
  console.assert(server !== null, "Server must not be null");
  console.assert(typeof server.setRequestHandler === "function",
    "Server must support setRequestHandler");

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    return await dispatchToolCall(request);
  });
}

// ---------------------------------------------------------------------------
// Tool dispatch
// ---------------------------------------------------------------------------

/**
 * Dispatch an incoming tool call to the correct handler.
 * @param {object} request - MCP CallTool request
 * @returns {Promise<object>} MCP tool result
 */
async function dispatchToolCall(request) {
  console.assert(request !== null && typeof request === "object",
    "Request must be an object");
  console.assert(typeof request.params === "object",
    "Request must have params");

  const { name, arguments: args } = request.params;

  if (typeof name !== "string" || name.length === 0 || name.length > MAX_TOOL_NAME_LENGTH) {
    logError(`Invalid tool name: "${name}"`);
    return buildFatalError(`Unknown tool: "${name}"`);
  }

  const handler = TOOL_HANDLERS[name];
  if (typeof handler !== "function") {
    logError(`No handler for tool: "${name}"`);
    return buildFatalError(
      `Unknown tool: "${name}". Available: ${Object.keys(TOOL_HANDLERS).join(", ")}`
    );
  }

  logInfo(`Calling tool: ${name}`);

  try {
    const result = await handler(args || {});
    console.assert(result !== null && typeof result === "object",
      "Handler must return a result object");
    logInfo(`Tool ${name} completed successfully`);
    return result;
  } catch (err) {
    logError(`Tool ${name} failed`, err);
    return buildFatalError(`Internal error in ${name}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Build a fatal error response for MCP.
 * @param {string} message
 * @returns {object}
 */
function buildFatalError(message) {
  console.assert(typeof message === "string", "Error message must be a string");
  console.assert(message.length > 0, "Error message must not be empty");

  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Start the MCP server on stdio transport.
 */
async function main() {
  logInfo("Starting BeLikeNative MCP Server v" + SERVER_VERSION);
  logInfo("Rule-based engine -- no API key required");

  const server = createServer();
  const transport = new StdioServerTransport();

  console.assert(server !== null, "Server must be initialized");
  console.assert(transport !== null, "Transport must be initialized");

  await server.connect(transport);
  logInfo("Server connected via stdio. Waiting for requests...");
}

// Run — catch top-level errors so the process never crashes silently
main().catch((err) => {
  logError("Fatal startup error", err);
  process.exit(1);
});
