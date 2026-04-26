import React from 'react'

interface Props {
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'error'
  isWakeWordDetected: boolean
}

export default function VoiceAura({ status, isWakeWordDetected }: Props) {
  const getStatusClass = () => {
    switch (status) {
      case 'listening': return 'aura-status-listening'
      case 'processing': return 'aura-status-processing'
      case 'speaking': return 'aura-status-speaking'
      case 'error': return 'opacity-50 grayscale'
      default: return isWakeWordDetected ? 'aura-status-listening' : ''
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-12 py-12">
      <div className="aura-container">
        {/* Glow de fundo */}
        <div className="aura-glow" />
        
        {/* Anéis orbitais */}
        <div className="aura-ring w-[260px] h-[260px]" style={{ animationDuration: '15s' }} />
        <div className="aura-ring w-[220px] h-[220px]" style={{ animationDirection: 'reverse', animationDuration: '12s' }} />
        <div className="aura-ring w-[180px] h-[180px]" style={{ animationDuration: '20s' }} />

        {/* Núcleo central */}
        <div className={`aura-core transition-all duration-500 ${getStatusClass()}`} />
      </div>

      <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="text-5xl font-black tracking-tighter text-white">
          {status === 'idle' ? (isWakeWordDetected ? 'Ouvindo...' : 'VASCO') : status.toUpperCase()}
        </h1>
        <p className="text-white/40 font-medium tracking-[0.2em] uppercase text-xs">
          {status === 'idle' ? 'Diga "Oi Vasco" para começar' : 'Assistente Ativo'}
        </p>
      </div>
    </div>
  )
}
