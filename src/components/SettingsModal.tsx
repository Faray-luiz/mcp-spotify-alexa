import { useState, useEffect } from 'react'
import { X, Key, Music2, Zap, Eye, EyeOff, CheckCircle, ExternalLink, Settings } from 'lucide-react'
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
  const [showGemini, setShowGemini] = useState(false)
  const [saved, setSaved] = useState(false)

  // Sincroniza o formulário se as props mudarem
  useEffect(() => {
    if (isOpen) {
      setForm(config)
      setSaved(false)
    }
  }, [config, isOpen])

  if (!isOpen) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(form)
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onClose()
    }, 1500)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md glass-card border border-white/10 rounded-3xl p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10">
              <Settings className="w-5 h-5 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white">Configurações</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full transition-colors">
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Spotify */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider ml-1 flex items-center gap-2">
              <Music2 className="w-3 h-3" /> Spotify Client ID
            </label>
            <div className="relative">
              <input
                type={showSpotify ? "text" : "password"}
                value={form.spotifyClientId}
                onChange={e => setForm({ ...form, spotifyClientId: e.target.value })}
                placeholder="Cole seu Client ID"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowSpotify(!showSpotify)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors"
              >
                {showSpotify ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Gemini */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider ml-1 flex items-center gap-2">
              <Zap className="w-3 h-3" /> Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showGemini ? "text" : "password"}
                value={form.geminiApiKey}
                onChange={e => setForm({ ...form, geminiApiKey: e.target.value })}
                placeholder="Google AI Studio Key"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all pr-12"
              />
              <button
                type="button"
                onClick={() => setShowGemini(!showGemini)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/40 transition-colors"
              >
                {showGemini ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Modelo Gemini */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider ml-1 flex items-center gap-2">
              <Key className="w-3 h-3" /> Modelo Gemini
            </label>
            <select
              value={form.geminiModel}
              onChange={e => setForm({ ...form, geminiModel: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all appearance-none"
            >
              <option value="gemini-3.1-flash" className="bg-[#1a1a2e]">Gemini 3.1 Flash (Novo/Rápido)</option>
              <option value="gemini-2.5-flash" className="bg-[#1a1a2e]">Gemini 2.5 Flash</option>
              <option value="gemini-1.5-flash" className="bg-[#1a1a2e]">Gemini 1.5 Flash (Clássico)</option>
              <option value="gemini-1.5-pro" className="bg-[#1a1a2e]">Gemini 1.5 Pro (Poderoso)</option>
            </select>
          </div>

          {/* ElevenLabs (Optional / Hidden for now to simplify) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider ml-1 flex items-center gap-2">
              <ExternalLink className="w-3 h-3" /> ElevenLabs API Key (Opcional)
            </label>
            <input
              type="password"
              value={form.elevenLabsApiKey}
              onChange={e => setForm({ ...form, elevenLabsApiKey: e.target.value })}
              placeholder="Voz da IA (opcional)"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              className={`flex-1 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 ${
                saved ? 'bg-green-500 text-white' : 'bg-white text-black hover:bg-white/90 active:scale-95'
              }`}
            >
              {saved ? (
                <><CheckCircle className="w-5 h-5" /> Salvo!</>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
