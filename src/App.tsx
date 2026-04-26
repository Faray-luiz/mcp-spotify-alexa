import { useState, useEffect, useRef, useCallback } from 'react'
import { Settings, Music2, Terminal, Info } from 'lucide-react'
import SettingsModal from './components/SettingsModal.tsx'
import CommandLog from './components/CommandLog.tsx'
import VoiceAura from './components/VoiceAura.tsx'
import SpotifyConnect from './components/SpotifyConnect.tsx'
import MCPConsole from './components/MCPConsole.tsx'

// Spotify
import { extractCodeFromUrl, exchangeCodeForToken, getValidToken, getStoredToken, clearToken } from './spotify/auth.ts'
import { getUserProfile, getCurrentTrack, setVolume as apiSetVolume, transferPlayback } from './spotify/api.ts'
import type { SpotifyUser } from './spotify/api.ts'
import { initSpotifySDK, getDeviceId, disconnectPlayer } from './spotify/sdk.ts'
import type { SDKPlayerState, SDKState } from './spotify/sdk.ts'

// MCP
import { mcpHost } from './mcp/MCPHost.ts'
import type { MCPEvent } from './mcp/types.ts'
import { searchAndPlayTool, setSearchAndPlayTokenGetter } from './mcp/tools/searchAndPlay.ts'
import { pauseTool, setPauseTokenGetter } from './mcp/tools/pauseTool.ts'
import { currentTrackResource, setCurrentTrackTokenGetter } from './mcp/tools/currentTrack.ts'

// AI
import { processWithGemini } from './gemini/api.ts'
import { speak } from './elevenlabs/api.ts'

export interface AppConfig {
  spotifyClientId: string
  elevenLabsApiKey: string
  geminiApiKey: string
  geminiModel: string
}

export interface LogEntry {
  id: string
  type: 'user' | 'mcp' | 'spotify' | 'error'
  message: string
  timestamp: Date
  command?: string
}

export interface TrackInfo {
  title: string
  artist: string
  album: string
  albumArt?: string
  duration: number
  progress: number
  isPlaying: boolean
  isLiked: boolean
  trackId?: string
  trackUri?: string
}

const REDIRECT_URI = window.location.origin.replace('http://', 'https://') + '/'

const DEFAULT_TRACK: TrackInfo = {
  title: 'Nenhuma música',
  artist: 'Conecte ao Spotify',
  album: '',
  duration: 0,
  progress: 0,
  isPlaying: false,
  isLiked: false,
}

// ─── Register MCP Tools/Resources ────────────────────────────────────────────
mcpHost
  .registerTool(searchAndPlayTool)
  .registerTool(pauseTool)
  .registerResource(currentTrackResource)

export default function App() {
  const [config, setConfig] = useState<AppConfig>({ 
    spotifyClientId: '', 
    elevenLabsApiKey: '', 
    geminiApiKey: '',
    geminiModel: 'gemini-3.1-flash' 
  })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [mcpEvents, setMcpEvents] = useState<MCPEvent[]>([])
  const [track, setTrack] = useState<TrackInfo>(DEFAULT_TRACK)
  const [volume, setVolumeState] = useState(72)
  const [mcpStatus, setMcpStatus] = useState<'idle' | 'listening' | 'processing' | 'speaking' | 'error'>('idle')
  const [isVascoReady, setIsVascoReady] = useState(false)
  const [isWakeWordDetected, setIsWakeWordDetected] = useState(false)
  const [originalVolume, setOriginalVolume] = useState(72)
  const [showConsole, setShowConsole] = useState(false)

  // Spotify state
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null)
  const [sdkStatus, setSdkStatus] = useState<SDKState>('idle')
  const [sdkError, setSdkError] = useState<string>()

  const recognitionRef = useRef<any>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isConnected = !!spotifyUser
  const isWakeWordDetectedRef = useRef(false)
  const audioContextRef = useRef<AudioContext | null>(null)

  const startVasco = async () => {
    // 1. Desbloqueia Áudio (Fundamental para bipe e voz)
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    if (ctx.state === 'suspended') await ctx.resume()
    audioContextRef.current = ctx
    
    // 2. Toca um bipe de teste para confirmar o som (Mais nítido - Nota Lá)
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.setValueAtTime(880, ctx.currentTime) 
    gain.gain.setValueAtTime(0.1, ctx.currentTime)
    osc.start(); osc.stop(ctx.currentTime + 0.15)

    // 3. Ativa o App e a Escuta
    setIsVascoReady(true)
    setTimeout(() => { startVigilance() }, 500)
    addLog('mcp', '⚓ Vasco Ativado!')
  }

  const getToken = useCallback(async () => {
    const cfg = JSON.parse(localStorage.getItem('mcp-spotify-config-v2') || '{}')
    return getValidToken(cfg.spotifyClientId || '')
  }, [])

  useEffect(() => {
    setSearchAndPlayTokenGetter(getToken)
    setPauseTokenGetter(getToken)
    setCurrentTrackTokenGetter(getToken)
  }, [getToken])

  // ── Wake Word Logic ────────────────────────────────────────────────────────
  const duckVolume = async () => {
    setOriginalVolume(volume)
    const token = await getToken()
    if (token) await apiSetVolume(15, token, getDeviceId() ?? undefined)
  }

  const restoreVolume = async () => {
    const token = await getToken()
    if (token) await apiSetVolume(originalVolume, token, getDeviceId() ?? undefined)
  }

  const commandTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const startVigilance = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR || recognitionRef.current) return

    const recognition = new SR()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = true

    recognition.onstart = () => { console.log('🎤 Vasco Listening...') }
    
    recognition.onresult = async (e: any) => {
      const transcript = e.results[e.results.length - 1][0].transcript.toLowerCase()
      console.log('👂 Vasco ouviu:', transcript)
      
      // 1. Gatilho (Vasco)
      if (!isWakeWordDetectedRef.current && transcript.includes('vasco')) {
        isWakeWordDetectedRef.current = true
        setIsWakeWordDetected(true)
        setMcpStatus('listening')
        await duckVolume()
        
        // Bipe de Ativação (Nota Lá 1000Hz)
        if (audioContextRef.current) {
          const osc = audioContextRef.current.createOscillator()
          const gain = audioContextRef.current.createGain()
          osc.connect(gain); gain.connect(audioContextRef.current.destination)
          osc.frequency.setValueAtTime(1000, audioContextRef.current.currentTime)
          gain.gain.setValueAtTime(0.1, audioContextRef.current.currentTime)
          osc.start(); osc.stop(audioContextRef.current.currentTime + 0.1)
        }

        // Reset de Segurança (7 segundos) - Agora funciona com Ref!
        if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current)
        commandTimeoutRef.current = setTimeout(() => {
          if (isWakeWordDetectedRef.current) {
            console.log('⏰ Resetando Vasco por inatividade...')
            isWakeWordDetectedRef.current = false
            setIsWakeWordDetected(false)
            setMcpStatus('idle')
            restoreVolume()
          }
        }, 7000)
        return
      } 
      
      // 2. Comando
      if (isWakeWordDetectedRef.current) {
        if (commandTimeoutRef.current) clearTimeout(commandTimeoutRef.current)
        
        const process = () => {
          const command = transcript.replace(/.*vasco\s*/, '').trim()
          if (command && isWakeWordDetectedRef.current) {
            console.log('🚀 Disparando comando:', command)
            dispatchMCP(command)
            isWakeWordDetectedRef.current = false
            setIsWakeWordDetected(false)
          }
        }

        if (e.results[e.results.length - 1].isFinal) {
          process()
        } else {
          // Time-out de silêncio para confirmar comando (2s)
          commandTimeoutRef.current = setTimeout(process, 2000)
        }
      }
    }

    recognition.onend = () => {
      recognitionRef.current = null
      if (mcpStatus === 'idle' && isVascoReady) setTimeout(startVigilance, 100)
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [isWakeWordDetected, mcpStatus, volume, getToken, isVascoReady])

  useEffect(() => {
    if (isConnected && sdkStatus === 'ready' && mcpStatus === 'idle' && isVascoReady) {
      startVigilance()
    }
  }, [isConnected, sdkStatus, mcpStatus, startVigilance])

  // ── Load Config ────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('mcp-spotify-config-v2')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setConfig(prev => ({ ...prev, ...parsed }))
      } catch (e) { console.error(e) }
    }
  }, [])

  // ── Initialize Spotify ─────────────────────────────────────────────────────
  const initSpotify = async () => {
    const token = await getToken()
    if (!token) return
    const user = await getUserProfile(token)
    if (user) {
      setSpotifyUser(user)
      addLog('spotify', `👤 Conectado como ${user.display_name}`)
      await pollCurrentTrack()
      
      setSdkStatus('loading')
      await initSpotifySDK({
        token,
        onReady: (id) => {
          setSdkStatus('ready')
          addLog('spotify', `🎵 Vasco pronto no dispositivo: ${id.slice(0, 8)}`)
          transferPlayback(id, token, false)
        },
        onStateChange: (state) => { if (state) updateTrackFromSDK(state) },
        onError: (e) => { setSdkStatus('error'); setSdkError(e.message) },
        onDisconnect: () => setSdkStatus('idle'),
      })
    }
    pollRef.current = setInterval(pollCurrentTrack, 5000)
  }

  useEffect(() => {
    const code = extractCodeFromUrl()
    if (code) {
      const cfg = JSON.parse(localStorage.getItem('mcp-spotify-config-v2') || '{}')
      exchangeCodeForToken(code, cfg.spotifyClientId, REDIRECT_URI).then(t => { if (t) initSpotify() })
    } else if (getStoredToken()) {
      initSpotify()
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); disconnectPlayer() }
  }, [])

  const pollCurrentTrack = async () => {
    const token = await getToken()
    if (!token) return
    const state = await getCurrentTrack(token)
    if (!state?.item) return
    if (state.device?.volume_percent != null) setVolumeState(state.device.volume_percent)
  }

  const updateTrackFromSDK = (state: SDKPlayerState) => {
    const ct = state.track_window?.current_track
    if (!ct) return
    setTrack(prev => ({
      ...prev,
      title: ct.name,
      artist: ct.artists.map(a => a.name).join(', '),
      isPlaying: !state.paused,
    }))
  }

  const addLog = (type: LogEntry['type'], message: string) => {
    setLogs(prev => [{ id: Math.random().toString(36).slice(2), type, message, timestamp: new Date() }, ...prev].slice(0, 3))
  }

  const dispatchMCP = async (text: string) => {
    if (!text.trim()) return
    addLog('user', `🎤 "${text}"`)
    setMcpStatus('processing')
    
    try {
      const aiResponse = await processWithGemini(text, config.geminiApiKey, config.geminiModel)
      const { tool, args, explanation } = aiResponse

      if (tool) {
        await mcpHost.callTool(tool, args || {})
      }

      if (explanation) {
        setMcpStatus('speaking')
        addLog('mcp', `🤖 AI: ${explanation}`)
        await speak(explanation, config.elevenLabsApiKey)
      }
    } catch (err: any) {
      addLog('error', `❌ Erro: ${err.message}`)
    }

    await restoreVolume()
    setMcpStatus('idle')
    // A vigília reinicia pelo useEffect
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col font-sans selection:bg-blue-500/30 overflow-hidden">
      
      {/* Tela de Ativação / Splash */}
      {!isVascoReady && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-12 text-center space-y-8">
           <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center animate-pulse shadow-[0_0_50px_rgba(255,255,255,0.2)]">
              <Music2 className="w-16 h-16 text-black" />
           </div>
           <div className="space-y-4">
              <h1 className="text-6xl font-black italic tracking-tighter">VASCO</h1>
              <p className="text-white/40 font-bold tracking-[0.3em] uppercase text-sm">Pronto para assumir o leme</p>
           </div>
           <button 
             onClick={startVasco}
             className="px-12 py-6 bg-white text-black font-black italic text-2xl rounded-full hover:scale-110 active:scale-95 transition-all shadow-2xl"
           >
             ATIVAR ASSISTENTE ⚓
           </button>
        </div>
      )}

      {/* Header Minimalista */}
      <header className="p-8 flex justify-between items-start z-20">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-2xl shadow-white/10">
              <Music2 className="w-6 h-6 text-black" />
            </div>
            <span className="font-black tracking-tighter text-3xl italic">VASCO</span>
          </div>
          {track.isPlaying && (
            <p className="mt-2 text-white/30 text-xs font-bold tracking-widest uppercase">
              Tocando: {track.title} — {track.artist}
            </p>
          )}
        </div>
        
        <div className="flex gap-2">
           <button onClick={() => setShowConsole(!showConsole)} className="p-4 hover:bg-white/5 rounded-3xl transition-all">
            <Terminal className="w-6 h-6 text-white/20" />
          </button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-4 hover:bg-white/5 rounded-3xl transition-all">
            <Settings className="w-6 h-6 text-white/20" />
          </button>
        </div>
      </header>

      {/* Centro: A Aura do Vasco */}
      <main className="flex-1 flex flex-col items-center justify-center relative p-12">
        {(!isConnected || sdkStatus !== 'ready') ? (
          <div className="w-full max-w-sm space-y-8 animate-in fade-in duration-1000">
            <div className="text-center space-y-2 mb-8">
               <h2 className="text-2xl font-black italic tracking-tighter">CONECTANDO AO NAVIO...</h2>
               <p className="text-white/40 text-xs font-bold tracking-widest">O VASCO PRECISA DE ACESSO AO SPOTIFY PREMIUM</p>
            </div>
            <SpotifyConnect 
              clientId={config.spotifyClientId} 
              redirectUri={REDIRECT_URI} 
              user={spotifyUser} 
              sdkStatus={sdkStatus} 
              sdkError={sdkError}
              onDisconnect={() => setSpotifyUser(null)} 
            />
            {sdkStatus === 'ready' && isConnected && (
               <button 
                 onClick={() => setMcpStatus('idle')}
                 className="w-full py-4 bg-white text-black font-black italic rounded-2xl hover:scale-105 transition-all shadow-2xl shadow-white/10"
               >
                 ASSUMIR O LEME ⚓
               </button>
            )}
          </div>
        ) : (
          <>
            <VoiceAura status={mcpStatus} isWakeWordDetected={isWakeWordDetected} />
            
            <div className="mt-12 text-center space-y-2">
               <p className="text-3xl font-black italic tracking-tighter uppercase">
                 {mcpStatus === 'listening' ? 'OUVINDO...' : 
                  mcpStatus === 'processing' ? 'PENSANDO...' : 
                  mcpStatus === 'speaking' ? 'FALANDO...' : 
                  isWakeWordDetected ? 'VASCO?' : 'Diga "VASCO"'}
               </p>
               <p className="text-white/20 text-xs font-bold tracking-[0.2em] uppercase">
                 Assistente de Voz Ativo
               </p>
            </div>
          </>
        )}

        {/* Logs Discretos */}
        <div className="absolute bottom-12 w-full max-w-lg px-8 pointer-events-none">
          <div className="opacity-30 hover:opacity-100 transition-opacity duration-500 pointer-events-auto">
            {logs.map(log => (
              <div key={log.id} className="text-[10px] uppercase tracking-[0.2em] mb-1 font-bold">
                <span className="text-white/20 mr-2">{log.timestamp.toLocaleTimeString()}</span>
                <span className={log.type === 'error' ? 'text-red-500' : 'text-blue-400'}>{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {showConsole && (
        <div className="fixed inset-0 z-50 bg-black/90 p-12 overflow-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black italic">MCP CONSOLE</h2>
            <button onClick={() => setShowConsole(false)} className="p-2 bg-white/10 rounded-full">Fechar</button>
          </div>
          <MCPConsole events={mcpEvents} />
        </div>
      )}

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          config={config}
          onClose={() => setIsSettingsOpen(false)}
          onSave={(c) => { setConfig(c); localStorage.setItem('mcp-spotify-config-v2', JSON.stringify(c)) }}
          addLog={addLog}
        />
      )}
    </div>
  )
}
