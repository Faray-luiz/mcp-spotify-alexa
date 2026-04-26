import type { LogEntry } from '../App'
import { Music2, Mic, Zap, AlertCircle } from 'lucide-react'

interface Props {
  logs: LogEntry[]
}

const typeConfig: Record<LogEntry['type'], { icon: React.ReactNode; color: string; label: string }> = {
  user: {
    icon: <Mic className="w-3 h-3" />,
    color: 'text-blue-400',
    label: 'VOZ',
  },
  mcp: {
    icon: <Zap className="w-3 h-3" />,
    color: 'text-yellow-400',
    label: 'MCP',
  },
  spotify: {
    icon: <Music2 className="w-3 h-3" />,
    color: 'text-green-400',
    label: 'SPOTIFY',
  },
  error: {
    icon: <AlertCircle className="w-3 h-3" />,
    color: 'text-red-400',
    label: 'ERRO',
  },
}

function formatTime(date: Date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function CommandLog({ logs }: Props) {
  return (
    <div className="w-full glass-card rounded-2xl border border-white/8 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">MCP Event Log</span>
        </div>
        <span className="text-xs text-white/30">{logs.length} eventos</span>
      </div>

      <div className="overflow-y-auto max-h-48 scrollbar-thin">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-white/20 text-sm">
            Nenhum evento registrado
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map(log => {
              const cfg = typeConfig[log.type]
              return (
                <div
                  key={log.id}
                  className="flex items-start gap-3 px-4 py-2.5 hover:bg-white/3 transition-colors animate-fade-in"
                >
                  <span className={`mt-0.5 flex-shrink-0 ${cfg.color}`}>{cfg.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className={`text-xs font-bold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-xs text-white/20">{formatTime(log.timestamp)}</span>
                    </div>
                    <p className="text-xs text-white/60 leading-relaxed">{log.message}</p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
