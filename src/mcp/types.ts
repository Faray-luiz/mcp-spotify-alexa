/**
 * MCP Types — Model Context Protocol interfaces
 * Defines the contract for Tools and Resources in the MCP architecture.
 */

/** JSON Schema subset for tool input validation */
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description?: string
  enum?: unknown[]
  items?: JSONSchemaProperty
}

export interface JSONSchema {
  type: 'object'
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
}

/** A single content block in an MCP result */
export type MCPContent =
  | { type: 'text'; text: string }
  | { type: 'json'; data: unknown }
  | { type: 'error'; text: string }

/** Result returned by a Tool execution or Resource read */
export interface MCPResult {
  content: MCPContent[]
  isError: boolean
  toolCall?: {
    name: string
    args: unknown
    durationMs: number
  }
}

/** An MCP Tool — callable with arguments */
export interface MCPTool {
  name: string
  description: string
  inputSchema: JSONSchema
  execute(args: Record<string, unknown>): Promise<MCPResult>
}

/** An MCP Resource — readable data source with a URI */
export interface MCPResource {
  uri: string
  name: string
  description: string
  mimeType?: string
  read(): Promise<MCPResult>
}

/** Event emitted to the log when an MCP action occurs */
export interface MCPEvent {
  id: string
  timestamp: Date
  kind: 'tool_call' | 'resource_read' | 'tool_error' | 'resource_error' | 'host_info'
  name: string
  args?: unknown
  result?: MCPResult
  durationMs?: number
}

/** Helper to build a successful text result */
export function okText(text: string, toolName?: string, args?: unknown, ms?: number): MCPResult {
  return {
    content: [{ type: 'text', text }],
    isError: false,
    toolCall: toolName ? { name: toolName, args: args ?? {}, durationMs: ms ?? 0 } : undefined,
  }
}

/** Helper to build a successful JSON result */
export function okJson(data: unknown, toolName?: string, args?: unknown, ms?: number): MCPResult {
  return {
    content: [{ type: 'json', data }],
    isError: false,
    toolCall: toolName ? { name: toolName, args: args ?? {}, durationMs: ms ?? 0 } : undefined,
  }
}

/** Helper to build an error result */
export function errResult(message: string, toolName?: string, args?: unknown, ms?: number): MCPResult {
  return {
    content: [{ type: 'error', text: message }],
    isError: true,
    toolCall: toolName ? { name: toolName, args: args ?? {}, durationMs: ms ?? 0 } : undefined,
  }
}
