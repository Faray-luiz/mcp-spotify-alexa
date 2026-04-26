/**
 * MCPConsole — Real-time panel showing MCP Tool calls and Resource reads
 * in a terminal/IDE style with JSON payload expansion.
 */

import { useState } from 'react'
import { ChevronRight, ChevronDown, Zap, Database, AlertCircle, Info } from 'lucide-react'
import type { MCPEvent } from '../mcp/types.ts'

interface Props {
  events: MCPEvent[]
}

const kindConfig: Record<MCPEvent['kind'], { icon: React.ReactNode; color: string; label: string }> = {
  tool_call: {
    icon: <Zap className="w-3 h-3" />,
    color: 'text-green-400',
    label: 'TOOL',
  },
  resource_read: {
    icon: <Database className="w-3 h-3" />,
    color: 'text-blue-400',
    label: 'RESOURCE',
  },
  tool_error: {
    icon: <AlertCircle className="w-3 h-3" />,
    color: 'text-red-400',
    label: 'TOOL ERR',
  },
  resource_error: {
    icon: <AlertCircle className="w-3 h-3" />,
    color: 'text-red-400',
    label: 'RES ERR',
  },
  host_info: {
    icon: <Info className="w-3 h-3" />,
    color: 'text-white/30',
    label: 'HOST',
  },
}

function JSONViewer({ data }: { data: unknown }) {
  const str = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return (
    <pre className="text-xs text-white/60 font-mono bg-black/30 rounded-lg p-3 overflow-x-auto mt-2 leading-relaxed">
      {str}
    </pre>
  )
}

function EventRow({ event }: { event: MCPEvent }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = kindConfig[event.kind]
  const hasPayload = event.args || event.result
  const isHostInfo = event.kind === 'host_info'

  const timeStr = event.timestamp.toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })

  const primaryContent = event.result?.content[0]

  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        className={`w-full flex items-start gap-2.5 px-4 py-2.5 text-left transition-colors ${
          hasPayload && !isHostInfo ? 'hover:bg-white/3 cursor-pointer' : 'cursor-default'
        }`}
        onClick={() => hasPayload && !isHostInfo && setExpanded(e => !e)}
      >
        {/* Expand icon */}
        <div className="mt-0.5 flex-shrink-0 text-white/20 w-3">
          {hasPayload && !isHostInfo
            ? (expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />)
            : null
          }
        </div>

        {/* Kind badge */}
        <span className={`flex items-center gap-1 text-xs font-mono font-bold flex-shrink-0 mt-0.5 ${cfg.color}`}>
          {cfg.icon}
          <span className="text-xs">{cfg.label}</span>
        </span>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-mono ${isHostInfo ? 'text-white/30' : 'text-white/80'}`}>
            {event.name}
          </span>

          {/* Inline result summary */}
          {primaryContent && !expanded && (
            <span className="ml-2 text-xs text-white/30 truncate">
              {primaryContent.type === 'text' && `→ ${primaryContent.text.slice(0, 60)}`}
              {primaryContent.type === 'json' && `→ ${JSON.stringify(primaryContent.data).slice(0, 60)}...`}
              {primaryContent.type === 'error' && `✗ ${primaryContent.text.slice(0, 60)}`}
            </span>
          )}
        </div>

        {/* Duration */}
        {event.durationMs !== undefined && event.durationMs > 0 && (
          <span className="text-xs text-white/20 font-mono flex-shrink-0">{event.durationMs}ms</span>
        )}

        {/* Time */}
        <span className="text-xs text-white/20 font-mono flex-shrink-0">{timeStr}</span>
      </button>

      {/* Expanded payload */}
      {expanded && hasPayload && (
        <div className="px-4 pb-3 space-y-2">
          {event.args != null && Object.keys(event.args as object).length > 0 ? (
            <div>
              <p className="text-xs text-white/30 font-mono mb-1">Input:</p>
              <JSONViewer data={event.args} />
            </div>
          ) : null}
          {event.result && (
            <div>
              <p className="text-xs text-white/30 font-mono mb-1">
                Output{event.result.isError ? ' (error)' : ''}:
              </p>
              <JSONViewer data={
                event.result.content[0]?.type === 'json'
                  ? (event.result.content[0] as any).data
                  : event.result.content[0]
              } />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function MCPConsole({ events }: Props) {
  const toolEvents = events.filter(e => e.kind !== 'host_info')
  const regEvents = events.filter(e => e.kind === 'host_info')

  return (
    <div className="w-full glass-card rounded-2xl border border-white/8 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black/20">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <span className="text-xs font-mono text-white/40">MCP Console</span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs font-mono text-white/20">{toolEvents.length} calls</span>
          <span className="text-xs font-mono text-white/20">•</span>
          <span className="text-xs font-mono text-white/20">{regEvents.length} registered</span>
        </div>
      </div>

      {/* Registered tools/resources line */}
      {regEvents.length > 0 && (
        <div className="px-4 py-2 bg-white/2 border-b border-white/5 flex flex-wrap gap-2">
          {regEvents.map(e => (
            <span key={e.id} className="text-xs font-mono text-white/25">
              {(e.args as any)?.tool ?? (e.args as any)?.uri ?? (e.args as any)?.name}
            </span>
          ))}
        </div>
      )}

      {/* Events */}
      <div className="overflow-y-auto max-h-64 scrollbar-thin">
        {toolEvents.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-white/20 text-xs font-mono">
            Aguardando chamadas MCP...
          </div>
        ) : (
          toolEvents.map(event => <EventRow key={event.id} event={event} />)
        )}
      </div>
    </div>
  )
}
