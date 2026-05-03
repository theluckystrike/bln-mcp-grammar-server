# BeLikeNative MCP Server

A Model Context Protocol (MCP) server that provides grammar checking, writing improvement, translation, and tone adjustment tools to AI clients like Claude Desktop, ChatGPT, Cursor, and others.

**No API key required.** Grammar and style checks use a local rule-based engine. Translation and tone adjustment return structured prompts for the host AI to process.

## Tools

| Tool | Description | Processing |
|------|-------------|------------|
| `check_grammar` | Check grammar, spelling, and punctuation with L1-aware explanations | Local rule-based (50+ regex rules) |
| `improve_writing` | Analyze text for style, wordiness, passive voice, sentence length | Local rule-based + style guidelines |
| `translate` | Translate text between languages with natural, fluent output | Returns prompt for host AI |
| `adjust_tone` | Adjust text tone (formal, casual, professional, diplomatic, etc.) | Returns prompt for host AI |

## Prerequisites

- Node.js 18+

That's it. No API keys, no environment variables, no external services.

## Installation

```bash
cd mcp-server
pnpm install
```

## Running Standalone

```bash
pnpm start
```

The server communicates via stdio (stdin/stdout). It is designed to be launched by an MCP client, not run interactively.

## MCP Client Configuration

### Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "belikenative": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/src/index.mjs"]
    }
  }
}
```

### Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "belikenative": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/src/index.mjs"]
    }
  }
}
```

### Cursor

Add to your Cursor MCP config (`.cursor/mcp.json` in your project or `~/.cursor/mcp.json` globally):

```json
{
  "mcpServers": {
    "belikenative": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/src/index.mjs"]
    }
  }
}
```

### Windsurf / Other MCP Clients

Any MCP client that supports stdio transport can use this server. Point it at `node src/index.mjs`. No environment variables needed.

## Tool Schemas

### check_grammar

```json
{
  "text": "string (required, max 6000 chars)",
  "language": "string (optional, default 'en') -- writer's native language for L1-tailored explanations"
}
```

### improve_writing

```json
{
  "text": "string (required, max 6000 chars)",
  "style": "enum: academic | business | creative | technical | simple | concise (optional, default 'business')"
}
```

### translate

```json
{
  "text": "string (required, max 6000 chars)",
  "source_language": "string (required) -- e.g. 'en', 'English', 'fr'",
  "target_language": "string (required) -- e.g. 'es', 'Spanish', 'de'"
}
```

### adjust_tone

```json
{
  "text": "string (required, max 6000 chars)",
  "tone": "enum: formal | casual | friendly | professional | persuasive | confident | empathetic | diplomatic (required)"
}
```

## Architecture

```
src/
  index.mjs    -- MCP server entry point (stdio transport, tool registration)
  tools.mjs    -- Tool definitions (JSON schemas) and handler functions
  rules.mjs    -- Local grammar rules engine (50+ regex patterns, style analyzer)
```

- **Transport**: stdio (standard for MCP)
- **Grammar/Style**: Local rule-based engine (no external API calls)
- **Translate/Tone**: Returns structured prompts for the host AI client to process
- **Logging**: All logs go to stderr (stdout is reserved for MCP protocol)
- **Error handling**: Never crashes -- all errors return structured MCP error responses

## How It Works

The key insight: MCP tools are called by AI clients (Claude Desktop, Cursor, etc.) that already have AI built in. There is no need for the MCP server to make its own API calls.

- **check_grammar** and **improve_writing** use 50+ regex-based rules to detect grammar errors, spelling mistakes, style issues, passive voice, and sentence length problems. Results are deterministic and instant.
- **translate** and **adjust_tone** genuinely require AI intelligence, so they return structured prompts with guidelines that the host AI processes directly. This is faster, cheaper, and more reliable than a double API call.

## Code Quality

This server follows NASA Power of 10 rules:

- All functions under 60 lines
- Minimum 2 assertions per function
- All loops have fixed upper bounds
- No global mutable state (constants are frozen)
- Every return value is checked
- Zero warnings

## License

MIT
