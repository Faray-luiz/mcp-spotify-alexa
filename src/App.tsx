import { useState, useEffect, useRef, useCallback } from 'react'
import { Mic, Settings, Music2, ChevronUp, Zap, Terminal } from 'lucide-react'
import SettingsModal from './components/SettingsModal.tsx'
import CommandLog from './components/CommandLog.tsx'
import NowPlaying from './components/NowPlaying.tsx'
import WaveVisualizer from './components/WaveVisualizer.tsx'
import StatusBadge from './components/StatusBadge.tsx'
import SpotifyConnect from './components/SpotifyConnect.tsx'
import SearchBar from './components/SearchBar.tsx'
import MCPConsole from './components/MCPConsole.tsx'

// Spotify
import { extractCodeFromUrl, exchangeCodeForToken, getValidToken, getStoredToken, clearToken } from './spotify/auth.ts'
import { getUserProfile, getCurrentTrack, playTrack, skipToNext, skipToPrev, setVolume as apiSetVolume, setShuffle, setRepeat as apiSetRepeat, likeTrack, isTrackLiked, transferPlayback } from './spotify/api.ts'
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

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [config, setConfig] = useState<AppConfig>({ spotifyClientId: '', elevenLabsApiKey: '', geminiApiKey: '' })
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [mcpEvents, setMcpEvents] = useState<MCPEvent[]>([])
  const [track, setTrack] = useState<TrackInfo>(DEFAULT_TRACK)
  const [volume, setVolumeState] = useState(72)
  const [isShuffle, setIsShuffle] = useState(false)
  const [isRepeat, setIsRepeat] = useState(false)
  const [mcpStatus, setMcpStatus] = useState<'idle' | 'listening' | 'processing' | 'error'>('idle')
  const [isListening, setIsListening] = useState(false)
  const [currentCommand, setCurrentCommand] = useState('')
  const [showLogs, setShowLogs] = useState(false)
  const [showConsole, setShowConsole] = useState(false)

  // Spotify state
  const [spotifyUser, setSpotifyUser] = useState<SpotifyUser | null>(null)
  const [sdkStatus, setSdkStatus] = useState<SDKState>('idle')
  const [sdkError, setSdkError] = useState<string>()

  const recognitionRef = useRef<any>(null)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isConnected = !!spotifyUser

  // ── Token getter injected into tools ───────────────────────────────────────
  const getToken = useCallback(async () => {
    const cfg = JSON.parse(localStorage.getItem('mcp-spotify-config') || '{}')
    return getValidToken(cfg.spotifyClientId || '')
  }, [])

  // ── MCP event listener ─────────────────────────────────────────────────────
  useEffect(() => {
    return mcpHost.onEvent(evt => {
      setMcpEvents(prev => [evt, ...prev].slice(0, 100))
    })
  }, [])

  // ── Inject token getters into tools ────────────────────────────────────────
  useEffect(() => {
    setSearchAndPlayTokenGetter(getToken)
    setPauseTokenGetter(getToken)
    setCurrentTrackTokenGetter(getToken)
  }, [getToken])

  // ── Load config ────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem('mcp-spotify-config')
    if (saved) setConfig(JSON.parse(saved))
    addLog('mcp', 'MCP Host inicializado com 2 Tools e 1 Resource.')
  }, [])

  // ── Handle OAuth callback (?code=...) ──────────────────────────────────────
  useEffect(() => {
    const code = extractCodeFromUrl()
    if (!code) {
      // Check if already have a token
      const stored = getStoredToken()
      if (stored) initSpotify()
      return
    }

    const cfg = JSON.parse(localStorage.getItem('mcp-spotify-config') || '{}')
    if (!cfg.spotifyClientId) {
      addLog('error', 'Client ID não configurado. Abra as configurações.')
      return
    }

    addLog('spotify', '🔑 Trocando código por token...')
    exchangeCodeForToken(code, cfg.spotifyClientId, REDIRECT_URI).then(token => {
      if (token) {
        addLog('spotify', '✅ Token obtido com sucesso!')
        initSpotify()
      } else {
        addLog('error', 'Falha na troca do token OAuth.')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Initialize Spotify (user + SDK) ───────────────────────────────────────
  const initSpotify = async () => {
    const token = await getToken()
    if (!token) return

    // Load user profile
    const user = await getUserProfile(token)
    if (user) {
      setSpotifyUser(user)
      addLog('spotify', `👤 Conectado como ${user.display_name} (${user.product})`)
    }

    // Load current track
    await pollCurrentTrack()

    // Init SDK
    if (user) {
      setSdkStatus('loading')
      addLog('spotify', '🎛️ Inicializando Spotify Web Playback SDK...')

      const deviceId = await initSpotifySDK({
        token,
        onReady: (id) => {
          setSdkStatus('ready')
          addLog('spotify', `🎵 SDK pronto. Device ID: ${id.slice(0, 8)}...`)
          // Transfer playback to our device
          getToken().then(t => { if (t) transferPlayback(id, t, false) })
        },
        onStateChange: (state) => { if (state) updateTrackFromSDK(state) },
        onError: (e) => {
          setSdkStatus('error')
          setSdkError(e.message)
          addLog('error', `SDK: ${e.message}`)
        },
        onDisconnect: () => {
          setSdkStatus('idle')
          addLog('spotify', '⚡ SDK desconectado')
        },
      })

      if (!deviceId) {
        setSdkStatus('error')
        setSdkError('Falha ao inicializar (Premium necessário)')
      }
    }

    // Poll current track every 5s
    pollRef.current = setInterval(pollCurrentTrack, 5000)
  }

  const pollCurrentTrack = async () => {
    const token = await getToken()
    if (!token) return
    const state = await getCurrentTrack(token)
    if (!state?.item) return

    const t = state.item
    const liked = t.id ? await isTrackLiked(t.id, token).catch(() => false) : false

    setTrack({
      title: t.name,
      artist: t.artists.map(a => a.name).join(', '),
      album: t.album.name,
      albumArt: t.album.images[0]?.url,
      duration: Math.floor(t.duration_ms / 1000),
      progress: Math.floor(state.progress_ms / 1000),
      isPlaying: state.is_playing,
      isLiked: liked,
      trackId: t.id,
      trackUri: t.uri,
    })
    setIsShuffle(state.shuffle_state)
    setIsRepeat(state.repeat_state !== 'off')
    if (state.device?.volume_percent != null) setVolumeState(state.device.volume_percent)
  }

  const updateTrackFromSDK = (state: SDKPlayerState) => {
    const ct = state.track_window?.current_track
    if (!ct) return
    setTrack(prev => ({
      ...prev,
      title: ct.name,
      artist: ct.artists.map(a => a.name).join(', '),
      album: ct.album.name,
      albumArt: ct.album.images[0]?.url,
      duration: Math.floor(ct.duration_ms / 1000),
      progress: Math.floor(state.position / 1000),
      isPlaying: !state.paused,
      trackUri: ct.uri,
    }))
    setIsShuffle(state.shuffle)
    setIsRepeat(state.repeat_mode !== 0)
  }

  // ── Local progress tick ────────────────────────────────────────────────────
  useEffect(() => {
    if (track.isPlaying) {
      progressRef.current = setInterval(() => {
        setTrack(t => {
          const next = t.progress + 1
          return next >= t.duration ? { ...t, progress: t.duration } : { ...t, progress: next }
        })
      }, 1000)
    } else {
      if (progressRef.current) clearInterval(progressRef.current)
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [track.isPlaying])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      disconnectPlayer()
    }
  }, [])

  // ── Log helpers ────────────────────────────────────────────────────────────
  const addLog = (type: LogEntry['type'], message: string, command?: string) => {
    setLogs(prev => [{
      id: Math.random().toString(36).slice(2),
      type, message, timestamp: new Date(), command,
    }, ...prev].slice(0, 50))
  }

  // ── MCP command dispatcher ─────────────────────────────────────────────────
  const dispatchMCP = async (text: string) => {
    if (!text.trim()) return

    setCurrentCommand(text)
    addLog('user', `🎤 "${text}"`)
    setMcpStatus('processing')

    // 1. Ask Gemini what to do
    const aiResponse = await processWithGemini(text, config.geminiApiKey)
    
    if (aiResponse.thought) {
      console.log('AI Thought:', aiResponse.thought)
    }

    const { tool, args, explanation } = aiResponse

    if (!tool && !explanation) {
      addLog('mcp', '💡 Não entendi o comando.')
      setMcpStatus('idle')
      setCurrentCommand('')
      return
    }

    // 2. Execute local or MCP action
    let toolResult: any = null

    try {
      if (tool === '__next') {
        const token = await getToken()
        if (token) { await skipToNext(token, getDeviceId() ?? undefined); await pollCurrentTrack() }
        addLog('spotify', '⏭ Próxima faixa')
      } 
      else if (tool === '__prev') {
        const token = await getToken()
        if (token) { await skipToPrev(token, getDeviceId() ?? undefined); await pollCurrentTrack() }
        addLog('spotify', '⏮ Faixa anterior')
      }
      else if (tool === '__volume') {
        const delta = (args?.delta as number) ?? 15
        const newVol = Math.max(0, Math.min(100, volume + delta))
        setVolumeState(newVol)
        const token = await getToken()
        if (token) await apiSetVolume(newVol, token, getDeviceId() ?? undefined)
        addLog('spotify', `🔊 Volume: ${newVol}%`)
      }
      else if (tool === 'get_current_track') {
        toolResult = await mcpHost.readResource('spotify://current_track')
      }
      else if (tool) {
        toolResult = await mcpHost.callTool(tool, args || {})
      }

      // Handle MCP result logs
      if (toolResult) {
        if (toolResult.isError) {
          addLog('error', toolResult.content[0]?.type === 'error' ? toolResult.content[0].text : 'Erro na execução')
        } else {
          const content = toolResult.content[0]
          if (content?.type === 'json') {
            const d = content.data as any
            if (d?.track) {
              addLog('spotify', `▶ Tocando: ${d.track.name} — ${d.track.artist}`)
              await pollCurrentTrack()
            } else if (d?.action === 'paused') {
              addLog('spotify', '⏸ Pausado')
              setTrack(t => ({ ...t, isPlaying: false }))
            }
          }
        }
      }

      // 3. Speak the feedback via ElevenLabs
      if (explanation) {
        addLog('mcp', `🤖 AI: ${explanation}`)
        await speak(explanation, config.elevenLabsApiKey)
      }

    } catch (err) {
      console.error('Dispatch Error:', err)
      addLog('error', 'Erro ao processar ação.')
    }

    setMcpStatus('idle')
    setCurrentCommand('')
  }

  // ── Voice recognition ──────────────────────────────────────────────────────
  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      setMcpStatus('idle')
      addLog('mcp', 'Microfone desativado')
      return
    }

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { addLog('error', 'Reconhecimento de voz não suportado neste navegador.'); return }

    const recognition = new SR()
    recognition.lang = 'pt-BR'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onstart = () => { setIsListening(true); setMcpStatus('listening'); addLog('mcp', '🎤 Ouvindo...') }
    recognition.onresult = (e: any) => {
      const text = e.results[e.results.length - 1][0].transcript
      dispatchMCP(text)
    }
    recognition.onerror = () => {
      setMcpStatus('error')
      addLog('error', 'Erro no reconhecimento de voz.')
      setTimeout(() => setMcpStatus('idle'), 2000)
    }
    recognition.onend = () => { if (recognitionRef.current === recognition) recognition.start() }

    recognitionRef.current = recognition
    recognition.start()
  }

  // ── Player controls (local fallback + API) ────────────────────────────────
  const handlePlay = async () => {
    if (track.isPlaying) {
      await dispatchMCP('pausa')
    } else {
      const token = await getToken()
      if (token) {
        await playTrack(token, { deviceId: getDeviceId() ?? undefined })
        setTrack(t => ({ ...t, isPlaying: true }))
        addLog('spotify', '▶ Reprodução retomada')
      }
    }
  }

  const handleVolume = async (v: number) => {
    setVolumeState(v)
    const token = await getToken()
    if (token) apiSetVolume(v, token, getDeviceId() ?? undefined)
  }

  const handleShuffle = async () => {
    const next = !isShuffle; setIsShuffle(next)
    const token = await getToken()
    if (token) { await setShuffle(next, token, getDeviceId() ?? undefined); addLog('spotify', `🔀 Aleatório ${next ? 'ativado' : 'desativado'}`) }
  }

  const handleRepeat = async () => {
    const next = !isRepeat; setIsRepeat(next)
    const token = await getToken()
    if (token) { await apiSetRepeat(next ? 'context' : 'off', token, getDeviceId() ?? undefined); addLog('spotify', `🔁 Repetição ${next ? 'ativada' : 'desativada'}`) }
  }

  const handleLike = async () => {
    if (!track.trackId) return
    const token = await getToken()
    if (token) { await likeTrack(track.trackId, token); setTrack(t => ({ ...t, isLiked: !t.isLiked })); addLog('spotify', '❤️ Curtido!') }
  }

  const handleNext = async () => {
    const token = await getToken()
    if (token) { await skipToNext(token, getDeviceId() ?? undefined); setTimeout(pollCurrentTrack, 600) }
    addLog('spotify', '⏭ Próxima')
  }

  const handlePrev = async () => {
    const token = await getToken()
    if (token) { await skipToPrev(token, getDeviceId() ?? undefined); setTimeout(pollCurrentTrack, 600) }
    addLog('spotify', '⏮ Anterior')
  }

  const handleSaveConfig = (newConfig: AppConfig) => {
    setConfig(newConfig)
    localStorage.setItem('mcp-spotify-config', JSON.stringify(newConfig))
    addLog('mcp', '⚙️ Configurações salvas')
  }

  const handleDisconnect = () => {
    clearToken()
    setSpotifyUser(null)
    setSdkStatus('idle')
    setTrack(DEFAULT_TRACK)
    if (pollRef.current) clearInterval(pollRef.current)
    disconnectPlayer()
    addLog('mcp', 'Desconectado do Spotify')
  }

  // ── Quick commands (button shortcuts) ─────────────────────────────────────
  const QUICK_COMMANDS = [
    { label: 'O que toca?', cmd: 'o que está tocando' },
    { label: '⏸ Pausa', cmd: 'pausa' },
    { label: '⏭ Próxima', cmd: 'próxima' },
    { label: '⏮ Anterior', cmd: 'anterior' },
    { label: '🔊 +Vol', cmd: 'mais alto' },
    { label: '🔉 -Vol', cmd: 'mais baixo' },
  ]

  return (
    <div className="min-h-screen spotify-gradient text-white overflow-hidden">
      {/* Background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-green-500/5 blur-3xl animate-glow-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-3xl animate-glow-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/20">
            <Music2 className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">MCP Spotify Alexa</h1>
            <p className="text-xs text-white/40">Model Context Protocol · Real Integration</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={mcpStatus} />
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-xl glass-card hover:bg-white/10 transition-all group" title="Configurações">
            <Settings className="w-4 h-4 text-white/50 group-hover:text-white/90 group-hover:rotate-45 transition-all duration-300" />
          </button>
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center px-6 py-6 gap-5 max-w-2xl mx-auto pb-10">

        {/* Spotify Connect banner */}
        <div className="w-full">
          <SpotifyConnect
            clientId={config.spotifyClientId}
            redirectUri={REDIRECT_URI}
            user={spotifyUser}
            sdkStatus={sdkStatus}
            sdkError={sdkError}
            onDisconnect={handleDisconnect}
          />
        </div>

        {/* Search bar */}
        {isConnected && (
          <SearchBar
            isConnected={isConnected}
            getToken={getToken}
            onSearch={query => dispatchMCP(`toca ${query}`)}
            disabled={mcpStatus === 'processing'}
          />
        )}

        {/* Now Playing */}
        <NowPlaying
          track={track}
          volume={volume}
          isShuffle={isShuffle}
          isRepeat={isRepeat}
          onPlay={handlePlay}
          onNext={handleNext}
          onPrev={handlePrev}
          onLike={handleLike}
          onShuffle={handleShuffle}
          onRepeat={handleRepeat}
          onVolume={handleVolume}
        />

        {/* Mic button */}
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 flex items-center">
            {isListening
              ? <WaveVisualizer active={mcpStatus === 'listening'} />
              : <p className="text-sm text-white/30 italic">{currentCommand ? `"${currentCommand}"` : 'Pressione o microfone para falar'}</p>
            }
          </div>

          <button
            id="mic-button"
            onClick={toggleListening}
            className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer select-none ${
              isListening
                ? 'bg-green-500 mic-glow-active animate-pulse-ring-active'
                : 'bg-white/10 border-2 border-white/20 hover:border-green-500/50 hover:bg-green-500/10 mic-glow-idle animate-pulse-ring'
            }`}
          >
            <div className={`absolute inset-0 rounded-full border-2 transition-all duration-500 ${isListening ? 'border-green-400/40 scale-110' : 'border-transparent'}`} />
            <Mic className={`w-9 h-9 transition-all duration-300 ${isListening ? 'text-white scale-110' : 'text-white/70'}`} />
          </button>

          <p className={`text-xs font-medium transition-all duration-300 ${isListening ? 'text-green-400' : 'text-white/30'}`}>
            {isListening ? (mcpStatus === 'processing' ? '⚡ Processando...' : '🎤 Ouvindo...') : 'Clique para falar'}
          </p>
        </div>

        {/* Quick commands */}
        <div className="w-full">
          <p className="text-xs text-white/25 mb-2.5 text-center uppercase tracking-widest">Comandos Rápidos</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {QUICK_COMMANDS.map(({ label, cmd }) => (
              <button key={cmd} onClick={() => dispatchMCP(cmd)}
                className="px-3 py-1.5 rounded-full glass-card text-xs text-white/60 hover:text-white hover:bg-green-500/20 hover:border-green-500/40 transition-all duration-200">
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Panel toggles */}
        <div className="flex items-center gap-6">
          <button onClick={() => setShowLogs(s => !s)}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
            <Zap className="w-3.5 h-3.5" />
            Log ({logs.length})
            <ChevronUp className={`w-3 h-3 transition-transform ${showLogs ? 'rotate-0' : 'rotate-180'}`} />
          </button>
          <button onClick={() => setShowConsole(s => !s)}
            className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors">
            <Terminal className="w-3.5 h-3.5" />
            MCP Console ({mcpEvents.filter(e => e.kind !== 'host_info').length})
            <ChevronUp className={`w-3 h-3 transition-transform ${showConsole ? 'rotate-0' : 'rotate-180'}`} />
          </button>
        </div>

        {showLogs && <div className="w-full animate-slide-up"><CommandLog logs={logs} /></div>}
        {showConsole && <div className="w-full animate-slide-up"><MCPConsole events={mcpEvents} /></div>}
      </main>

      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          config={config}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  )
}
