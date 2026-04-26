/**
 * MCP Host — Central registry and dispatcher for Tools and Resources.
 *
 * Architecture inspired by the Model Context Protocol spec:
 * - Tools are callable functions (like API actions)
 * - Resources are readable data sources identified by URI
 */

import type { MCPTool, MCPResource, MCPResult, MCPEvent } from './types.ts'
import { errResult } from './types.ts'

type EventListener = (event: MCPEvent) => void

export class MCPHost {
  private tools = new Map<string, MCPTool>()
  private resources = new Map<string, MCPResource>()
  private listeners: EventListener[] = []

  /** Register a Tool */
  registerTool(tool: MCPTool): this {
    this.tools.set(tool.name, tool)
    this.emit({
      id: this.uid(),
      timestamp: new Date(),
      kind: 'host_info',
      name: 'register_tool',
      args: { tool: tool.name, description: tool.description },
    })
    return this
  }

  /** Register a Resource */
  registerResource(resource: MCPResource): this {
    this.resources.set(resource.uri, resource)
    this.emit({
      id: this.uid(),
      timestamp: new Date(),
      kind: 'host_info',
      name: 'register_resource',
      args: { uri: resource.uri, name: resource.name },
    })
    return this
  }

  /** Call a Tool by name with arguments */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPResult> {
    const tool = this.tools.get(name)
    const start = Date.now()

    if (!tool) {
      const result = errResult(`Tool not found: "${name}"`)
      this.emit({
        id: this.uid(),
        timestamp: new Date(),
        kind: 'tool_error',
        name,
        args,
        result,
        durationMs: 0,
      })
      return result
    }

    try {
      const result = await tool.execute(args)
      const durationMs = Date.now() - start
      result.toolCall = { name, args, durationMs }

      this.emit({
        id: this.uid(),
        timestamp: new Date(),
        kind: result.isError ? 'tool_error' : 'tool_call',
        name,
        args,
        result,
        durationMs,
      })

      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const result = errResult(`Tool "${name}" threw an exception: ${msg}`, name, args, Date.now() - start)
      this.emit({
        id: this.uid(),
        timestamp: new Date(),
        kind: 'tool_error',
        name,
        args,
        result,
        durationMs: Date.now() - start,
      })
      return result
    }
  }

  /** Read a Resource by URI */
  async readResource(uri: string): Promise<MCPResult> {
    const resource = this.resources.get(uri)
    const start = Date.now()

    if (!resource) {
      const result = errResult(`Resource not found: "${uri}"`)
      this.emit({
        id: this.uid(),
        timestamp: new Date(),
        kind: 'resource_error',
        name: uri,
        result,
        durationMs: 0,
      })
      return result
    }

    try {
      const result = await resource.read()
      const durationMs = Date.now() - start
      result.toolCall = { name: `resource:${uri}`, args: {}, durationMs }

      this.emit({
        id: this.uid(),
        timestamp: new Date(),
        kind: result.isError ? 'resource_error' : 'resource_read',
        name: resource.name,
        args: { uri },
        result,
        durationMs,
      })

      return result
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      const result = errResult(`Resource "${uri}" read error: ${msg}`, uri, {}, Date.now() - start)
      this.emit({
        id: this.uid(),
        timestamp: new Date(),
        kind: 'resource_error',
        name: uri,
        result,
        durationMs: Date.now() - start,
      })
      return result
    }
  }

  /** List all registered tools */
  listTools(): MCPTool[] {
    return Array.from(this.tools.values())
  }

  /** List all registered resources */
  listResources(): MCPResource[] {
    return Array.from(this.resources.values())
  }

  /** Subscribe to MCP events (tool calls, resource reads, errors) */
  onEvent(listener: EventListener): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private emit(event: MCPEvent) {
    this.listeners.forEach(l => l(event))
  }

  private uid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }
}

/** Singleton MCP host instance */
export const mcpHost = new MCPHost()
