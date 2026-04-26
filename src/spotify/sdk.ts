/**
 * Spotify Web Playback SDK integration
 * Loads the SDK script dynamically and initializes a Player instance.
 * Reference: https://developer.spotify.com/documentation/web-playback-sdk
 *
 * NOTE: Requires a Spotify Premium account to use.
 */

export type SDKState = 'idle' | 'loading' | 'ready' | 'error'

export interface SDKPlayerState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: {
      id: string
      uri: string
      name: string
      duration_ms: number
      artists: Array<{ name: string; uri: string }>
      album: {
        name: string
        uri: string
        images: Array<{ url: string }>
      }
    }
    next_tracks: Array<{ name: string; artists: Array<{ name: string }> }>
    previous_tracks: Array<{ name: string; artists: Array<{ name: string }> }>
  }
  shuffle: boolean
  repeat_mode: 0 | 1 | 2
  restrictions: { disallow_pausing_reasons?: string[]; disallow_resuming_reasons?: string[] }
}

type PlayerCallback = (state: SDKPlayerState | null) => void
type ReadyCallback = (deviceId: string) => void
type ErrorCallback = (error: { message: string }) => void

let playerInstance: any = null
let currentDeviceId: string | null = null

/** Load the Spotify Web Playback SDK script (idempotent) */
function loadSDKScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Spotify) {
      resolve()
      return
    }

    const existing = document.getElementById('spotify-sdk')
    if (existing) {
      // Script tag exists, wait for SDK to be ready
      const waitForSDK = () => {
        if ((window as any).Spotify) {
          resolve()
        } else {
          setTimeout(waitForSDK, 100)
        }
      }
      waitForSDK()
      return
    }

    const script = document.createElement('script')
    script.id = 'spotify-sdk'
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    script.onerror = () => reject(new Error('Failed to load Spotify SDK'))
    document.head.appendChild(script)

    // Spotify SDK calls this global when ready
    ;(window as any).onSpotifyWebPlaybackSDKReady = resolve
  })
}

interface InitSDKOptions {
  token: string
  playerName?: string
  volume?: number
  onReady?: ReadyCallback
  onStateChange?: PlayerCallback
  onError?: ErrorCallback
  onDisconnect?: () => void
}

/** Initialize (or re-initialize) the Spotify SDK Player */
export async function initSpotifySDK(options: InitSDKOptions): Promise<string | null> {
  const {
    token,
    playerName = 'MCP Spotify Alexa',
    volume = 0.7,
    onReady,
    onStateChange,
    onError,
    onDisconnect,
  } = options

  // Disconnect existing player before re-init
  if (playerInstance) {
    try {
      await playerInstance.disconnect()
    } catch {}
    playerInstance = null
    currentDeviceId = null
  }

  try {
    await loadSDKScript()
  } catch (e) {
    onError?.({ message: 'Falha ao carregar Spotify SDK' })
    return null
  }

  return new Promise((resolve) => {
    const Spotify = (window as any).Spotify

    const player = new Spotify.Player({
      name: playerName,
      getOAuthToken: (cb: (t: string) => void) => cb(token),
      volume,
    })

    // Ready event
    player.addListener('ready', ({ device_id }: { device_id: string }) => {
      currentDeviceId = device_id
      playerInstance = player
      console.log('[SDK] Player ready. Device ID:', device_id)
      onReady?.(device_id)
      resolve(device_id)
    })

    // Not ready
    player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
      console.warn('[SDK] Device went offline:', device_id)
      onDisconnect?.()
    })

    // State changes
    player.addListener('player_state_changed', (state: SDKPlayerState | null) => {
      onStateChange?.(state)
    })

    // Errors
    player.addListener('initialization_error', (e: { message: string }) => {
      console.error('[SDK] Init error:', e.message)
      onError?.(e)
      resolve(null)
    })

    player.addListener('authentication_error', (e: { message: string }) => {
      console.error('[SDK] Auth error:', e.message)
      onError?.({ message: 'Erro de autenticação. Token inválido ou expirado.' })
      resolve(null)
    })

    player.addListener('account_error', (e: { message: string }) => {
      console.error('[SDK] Account error:', e.message)
      onError?.({ message: 'Conta Spotify Premium necessária para usar o SDK.' })
      resolve(null)
    })

    player.addListener('playback_error', (e: { message: string }) => {
      console.error('[SDK] Playback error:', e.message)
      onError?.(e)
    })

    player.connect().then((success: boolean) => {
      if (!success) {
        console.error('[SDK] Connection failed')
        onError?.({ message: 'Falha ao conectar o player Spotify.' })
        resolve(null)
      }
    })
  })
}

/** Get the current device ID */
export function getDeviceId(): string | null {
  return currentDeviceId
}

/** Disconnect the player */
export async function disconnectPlayer(): Promise<void> {
  if (playerInstance) {
    await playerInstance.disconnect().catch(() => {})
    playerInstance = null
    currentDeviceId = null
  }
}

/** Get current player state via SDK (synchronous) */
export async function getSDKCurrentState(): Promise<SDKPlayerState | null> {
  if (!playerInstance) return null
  return playerInstance.getCurrentState()
}

/** Toggle play/pause via SDK */
export async function sdkTogglePlay(): Promise<void> {
  playerInstance?.togglePlay()
}
