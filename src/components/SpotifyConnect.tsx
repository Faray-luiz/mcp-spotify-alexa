/**
 * SpotifyConnect — OAuth connection banner & user info.
 * Shows a "Connect" button when not authenticated.
 * Shows user avatar + name when connected.
 */

import { useState } from 'react'
import { LogIn, LogOut, User, Crown, AlertTriangle } from 'lucide-react'
import { buildAuthUrl, clearToken } from '../spotify/auth.ts'
import type { SpotifyUser } from '../spotify/api.ts'

interface Props {
  clientId: string
  redirectUri: string
  user: SpotifyUser | null
  sdkStatus: 'idle' | 'loading' | 'ready' | 'error'
  sdkError?: string
  onDisconnect: () => void
}

export default function SpotifyConnect({
  clientId,
  redirectUri,
  user,
  sdkStatus,
  sdkError,
  onDisconnect,
}: Props) {
  const [isConnecting, setIsConnecting] = useState(false)

  const handleConnect = async () => {
    if (!clientId.trim()) {
      alert('Insira o Spotify Client ID nas Configurações primeiro.')
      return
    }
    setIsConnecting(true)
    try {
      const url = await buildAuthUrl(clientId, redirectUri)
      window.location.href = url
    } catch (e) {
      console.error(e)
      setIsConnecting(false)
    }
  }

  const handleDisconnect = () => {
    clearToken()
    onDisconnect()
  }

  // ── Not connected ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="w-full glass-card rounded-2xl p-5 border border-white/8 text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mx-auto mb-3">
          <svg viewBox="0 0 24 24" className="w-6 h-6 text-green-400" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>
        <h3 className="text-sm font-bold mb-1">Conectar ao Spotify</h3>
        <p className="text-xs text-white/40 mb-4 leading-relaxed">
          Faça login com sua conta Spotify para ativar os MCP Tools reais.
          {!clientId && (
            <span className="block mt-1 text-yellow-400/70">
              ⚠️ Configure o Client ID nas configurações primeiro.
            </span>
          )}
        </p>
        <button
          id="spotify-connect-btn"
          onClick={handleConnect}
          disabled={isConnecting || !clientId}
          className="w-full py-2.5 rounded-xl bg-green-500 hover:bg-green-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2"
        >
          <LogIn className="w-4 h-4" />
          {isConnecting ? 'Redirecionando...' : 'Conectar com Spotify'}
        </button>

        {/* Redirect URI hint */}
        <p className="mt-3 text-xs text-white/20">
          Redirect URI: <code className="text-white/40">{redirectUri}</code>
        </p>
      </div>
    )
  }

  // ── Connected ──────────────────────────────────────────────────────────────
  return (
    <div className="w-full glass-card rounded-2xl px-4 py-3 border border-green-500/15 flex items-center gap-3">
      {/* Avatar */}
      {user.images?.[0]?.url ? (
        <img
          src={user.images[0].url}
          alt={user.display_name}
          className="w-9 h-9 rounded-full object-cover ring-2 ring-green-500/30 flex-shrink-0"
        />
      ) : (
        <div className="w-9 h-9 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-green-400" />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate">{user.display_name}</span>
          {user.product === 'premium' && (
            <span title="Spotify Premium"><Crown className="w-3 h-3 text-yellow-400 flex-shrink-0" /></span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {/* SDK status dot */}
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            sdkStatus === 'ready' ? 'bg-green-400 animate-pulse' :
            sdkStatus === 'loading' ? 'bg-yellow-400 animate-pulse' :
            sdkStatus === 'error' ? 'bg-red-400' : 'bg-white/20'
          }`} />
          <span className="text-xs text-white/40">
            {sdkStatus === 'ready' ? 'SDK Pronto' :
             sdkStatus === 'loading' ? 'Carregando SDK...' :
             sdkStatus === 'error' ? (sdkError ?? 'Erro no SDK') : 'SDK inativo'}
          </span>
        </div>
      </div>

      {/* SDK error warning */}
      {sdkStatus === 'error' && (
        <div title={sdkError} className="flex-shrink-0">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
        </div>
      )}

      {/* Disconnect */}
      <button
        id="spotify-disconnect-btn"
        onClick={handleDisconnect}
        className="flex-shrink-0 p-2 rounded-xl hover:bg-white/10 transition-colors group"
        title="Desconectar"
      >
        <LogOut className="w-3.5 h-3.5 text-white/30 group-hover:text-white/70 transition-colors" />
      </button>
    </div>
  )
}
