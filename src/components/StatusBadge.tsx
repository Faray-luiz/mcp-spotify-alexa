import { Wifi, Loader2, AlertCircle, CheckCircle } from 'lucide-react'

type Status = 'idle' | 'listening' | 'processing' | 'error'

interface Props {
  status: Status
}

const statusConfig: Record<Status, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  idle: {
    label: 'MCP Pronto',
    color: 'text-white/40',
    bg: 'bg-white/5',
    border: 'border-white/10',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  listening: {
    label: 'Ouvindo',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    icon: <Wifi className="w-3 h-3 animate-pulse" />,
  },
  processing: {
    label: 'Processando',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  error: {
    label: 'Erro',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: <AlertCircle className="w-3 h-3" />,
  },
}

export default function StatusBadge({ status }: Props) {
  const cfg = statusConfig[status]
  return (
    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.color} transition-all duration-300`}>
      {cfg.icon}
      {cfg.label}
    </div>
  )
}
