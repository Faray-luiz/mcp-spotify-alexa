import { useState, useEffect } from 'react'
import { X, Key, Music2, Zap, Eye, EyeOff, CheckCircle, ExternalLink } from 'lucide-react'
import type { AppConfig } from '../App'

interface Props {
  isOpen: boolean
  config: AppConfig
  onClose: () => void
  onSave: (config: AppConfig) => void
}

export default function SettingsModal({ isOpen, config, onClose, onSave }: Props) {
  const [form, setForm] = useState<AppConfig>(config)
  const [showSpotify, setShowSpotify] = useState(false)
  const [showEleven, setShowEleven] = useState(false)
  const [showGemini, setShowGemini] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sincroniza o formulário se as props mudarem
  useEffect(() => {
    setForm(config)
  }, [config])

  if (!isOpen) return null

  const handleSave = () => {
    onSave(form)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 1200)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="glass-card rounded-2xl p-6 border border-white/10 shadow-2xl shadow-black/50">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/20">
                <Key className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <h2 className="text-base font-bold">Configurações</h2>
                <p className="text-xs text-white/40">Credenciais de API</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4 text-white/50" />
            </button>
          </div>

          {/* Spotify Config */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Music2 className="w-4 h-4 text-green-400" />
              <label className="text-sm font-semibold text-green-400">Spotify</label>
              <a
                href="https://developer.spotify.com/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                Dashboard <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1.5 block">Client ID</label>
                <div className="relative">
                  <input
                    type={showSpotify ? 'text' : 'password'}
                    value={form.spotifyClientId}
                    onChange={e => setForm(f => ({ ...f, spotifyClientId: e.target.value }))}
                    placeholder="Insira seu Spotify Client ID..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-green-500/50 focus:bg-white/8 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSpotify(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                  >
                    {showSpotify ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/5 mb-5" />

          {/* Gemini Config */}
          <div className="mb-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-blue-400" />
              <label className="text-sm font-semibold text-blue-400">Gemini (AI)</label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                API Key <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">API Key</label>
              <div className="relative">
                <input
                  type={showGemini ? 'text' : 'password'}
                  value={form.geminiApiKey}
                  onChange={e => setForm(f => ({ ...f, geminiApiKey: e.target.value }))}
                  placeholder="Insira sua Gemini API Key..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 focus:bg-white/8 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowGemini(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showGemini ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-white/5 mb-5" />

          {/* ElevenLabs Config */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-purple-400" />
              <label className="text-sm font-semibold text-purple-400">ElevenLabs</label>
              <a
                href="https://elevenlabs.io/app/settings/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                API Keys <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-1.5 block">API Key</label>
              <div className="relative">
                <input
                  type={showEleven ? 'text' : 'password'}
                  value={form.elevenLabsApiKey}
                  onChange={e => setForm(f => ({ ...f, elevenLabsApiKey: e.target.value }))}
                  placeholder="Insira sua ElevenLabs API Key..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-sm text-white placeholder-white/20 focus:outline-none focus:border-purple-500/50 focus:bg-white/8 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowEleven(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
                >
                  {showEleven ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Info Banner */}
          <div className="bg-white/3 border border-white/8 rounded-xl p-3 mb-5">
            <p className="text-xs text-white/40 leading-relaxed">
              🔒 Suas credenciais são armazenadas localmente no navegador e nunca são enviadas para servidores externos.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:bg-white/5 transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              className={`
                flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 flex items-center justify-center gap-2
                ${saved
                  ? 'bg-green-600 text-white'
                  : 'bg-green-500 hover:bg-green-400 text-black'
                }
              `}
            >
              {saved ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Salvo!
                </>
              ) : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
