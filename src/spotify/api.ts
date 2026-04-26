/**
 * Spotify Web API wrapper
 * All calls go directly to api.spotify.com from the browser.
 * Reference: https://developer.spotify.com/documentation/web-api
 */

const BASE = 'https://api.spotify.com/v1'

async function apiFetch<T = unknown>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<{ ok: boolean; data?: T; status: number; error?: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (res.status === 204) return { ok: true, status: 204 }

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error')
    return { ok: false, status: res.status, error: text }
  }

  const data = await res.json().catch(() => null) as T
  return { ok: true, data, status: res.status }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SpotifyTrack {
  id: string
  name: string
  uri: string
  duration_ms: number
  artists: Array<{ id: string; name: string }>
  album: {
    id: string
    name: string
    images: Array<{ url: string; width: number; height: number }>
  }
  explicit: boolean
  popularity: number
}

export interface SpotifySearchResult {
  tracks: {
    items: SpotifyTrack[]
    total: number
  }
}

export interface SpotifyCurrentTrack {
  is_playing: boolean
  progress_ms: number
  item: SpotifyTrack | null
  device: {
    id: string
    name: string
    type: string
    volume_percent: number
  } | null
  repeat_state: 'off' | 'track' | 'context'
  shuffle_state: boolean
  timestamp: number
}

export interface SpotifyUser {
  id: string
  display_name: string
  email: string
  images: Array<{ url: string }>
  product: 'premium' | 'free' | 'open'
}

// ─── Endpoints ─────────────────────────────────────────────────────────────────

/** Search for tracks */
export async function searchTrack(
  query: string,
  token: string,
  limit = 5
): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q: query, type: 'track', limit: String(limit) })
  const res = await apiFetch<SpotifySearchResult>(`/search?${params}`, token)
  return res.data?.tracks?.items ?? []
}

/** Start/Resume playback, optionally with a specific track URI and device */
export async function playTrack(
  token: string,
  options?: { uri?: string; deviceId?: string; positionMs?: number }
): Promise<boolean> {
  const path = `/me/player/play${options?.deviceId ? `?device_id=${options.deviceId}` : ''}`
  const body = options?.uri
    ? JSON.stringify({ uris: [options.uri], position_ms: options?.positionMs ?? 0 })
    : undefined

  const res = await apiFetch(path, token, { method: 'PUT', body })
  return res.ok || res.status === 204
}

/** Pause playback */
export async function pausePlayback(token: string, deviceId?: string): Promise<boolean> {
  const path = `/me/player/pause${deviceId ? `?device_id=${deviceId}` : ''}`
  const res = await apiFetch(path, token, { method: 'PUT' })
  return res.ok || res.status === 204
}

/** Get currently playing track */
export async function getCurrentTrack(token: string): Promise<SpotifyCurrentTrack | null> {
  const res = await apiFetch<SpotifyCurrentTrack>('/me/player/currently-playing', token)
  if (!res.ok || !res.data) return null
  return res.data
}

/** Get full player state */
export async function getPlayerState(token: string): Promise<SpotifyCurrentTrack | null> {
  const res = await apiFetch<SpotifyCurrentTrack>('/me/player', token)
  if (!res.ok || !res.data) return null
  return res.data
}

/** Skip to next track */
export async function skipToNext(token: string, deviceId?: string): Promise<boolean> {
  const path = `/me/player/next${deviceId ? `?device_id=${deviceId}` : ''}`
  const res = await apiFetch(path, token, { method: 'POST' })
  return res.ok || res.status === 204
}

/** Skip to previous track */
export async function skipToPrev(token: string, deviceId?: string): Promise<boolean> {
  const path = `/me/player/previous${deviceId ? `?device_id=${deviceId}` : ''}`
  const res = await apiFetch(path, token, { method: 'POST' })
  return res.ok || res.status === 204
}

/** Set volume (0–100) */
export async function setVolume(
  volumePercent: number,
  token: string,
  deviceId?: string
): Promise<boolean> {
  const params = new URLSearchParams({
    volume_percent: String(Math.round(Math.max(0, Math.min(100, volumePercent)))),
    ...(deviceId ? { device_id: deviceId } : {}),
  })
  const res = await apiFetch(`/me/player/volume?${params}`, token, { method: 'PUT' })
  return res.ok || res.status === 204
}

/** Toggle shuffle */
export async function setShuffle(state: boolean, token: string, deviceId?: string): Promise<boolean> {
  const params = new URLSearchParams({
    state: String(state),
    ...(deviceId ? { device_id: deviceId } : {}),
  })
  const res = await apiFetch(`/me/player/shuffle?${params}`, token, { method: 'PUT' })
  return res.ok || res.status === 204
}

/** Set repeat mode */
export async function setRepeat(
  state: 'off' | 'track' | 'context',
  token: string,
  deviceId?: string
): Promise<boolean> {
  const params = new URLSearchParams({
    state,
    ...(deviceId ? { device_id: deviceId } : {}),
  })
  const res = await apiFetch(`/me/player/repeat?${params}`, token, { method: 'PUT' })
  return res.ok || res.status === 204
}

/** Transfer playback to a device */
export async function transferPlayback(deviceId: string, token: string, play = true): Promise<boolean> {
  const res = await apiFetch('/me/player', token, {
    method: 'PUT',
    body: JSON.stringify({ device_ids: [deviceId], play }),
  })
  return res.ok || res.status === 204
}

/** Get current user profile */
export async function getUserProfile(token: string): Promise<SpotifyUser | null> {
  const res = await apiFetch<SpotifyUser>('/me', token)
  return res.data ?? null
}

/** Add track to liked songs */
export async function likeTrack(trackId: string, token: string): Promise<boolean> {
  const res = await apiFetch('/me/tracks', token, {
    method: 'PUT',
    body: JSON.stringify({ ids: [trackId] }),
  })
  return res.ok || res.status === 200
}

/** Check if track is liked */
export async function isTrackLiked(trackId: string, token: string): Promise<boolean> {
  const res = await apiFetch<boolean[]>(`/me/tracks/contains?ids=${trackId}`, token)
  return res.data?.[0] ?? false
}
