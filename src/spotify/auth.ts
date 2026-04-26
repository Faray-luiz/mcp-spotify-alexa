/**
 * Spotify OAuth 2.0 PKCE Flow
 * No backend required — runs entirely in the browser.
 * Reference: https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow
 */

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
].join(' ')

const TOKEN_KEY = 'mcp-spotify-token'
const VERIFIER_KEY = 'mcp-spotify-verifier'

export interface SpotifyToken {
  access_token: string
  refresh_token: string
  expires_at: number // unix ms
  token_type: string
  scope: string
}

// ─── PKCE Helpers ────────────────────────────────────────────────────────────

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(values).map(x => possible[x % possible.length]).join('')
}

async function sha256(plain: string): Promise<ArrayBuffer> {
  const encoder = new TextEncoder()
  const data = encoder.encode(plain)
  return crypto.subtle.digest('SHA-256', data)
}

function base64UrlEncode(input: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const hashed = await sha256(verifier)
  return base64UrlEncode(hashed)
}

// ─── Auth URL Builder ─────────────────────────────────────────────────────────

export async function buildAuthUrl(clientId: string, redirectUri: string): Promise<string> {
  const verifier = generateRandomString(64)
  const challenge = await generateCodeChallenge(verifier)

  // Store verifier for exchange step
  localStorage.setItem(VERIFIER_KEY, verifier)

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: SCOPES,
  })

  const authUrl = `https://accounts.spotify.com/authorize?${params.toString()}`
  
  const cfg = JSON.parse(localStorage.getItem('mcp-spotify-config') || '{}')
  console.log('[Spotify Auth] Auth flow initiated for client:', cfg.spotifyClientId || 'unknown')
  console.log('[Spotify Auth] Redirecting to:', authUrl)
  
  return authUrl
}

// ─── Token Exchange ───────────────────────────────────────────────────────────

export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  redirectUri: string
): Promise<SpotifyToken | null> {
  const verifier = localStorage.getItem(VERIFIER_KEY)
  if (!verifier) {
    console.error('[Spotify Auth] Code verifier not found in localStorage')
    return null
  }

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }),
  })

  if (!res.ok) {
    console.error('[Spotify Auth] Token exchange failed:', await res.text())
    return null
  }

  const data = await res.json()
  const token: SpotifyToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope,
  }

  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  localStorage.removeItem(VERIFIER_KEY)
  return token
}

// ─── Token Refresh ────────────────────────────────────────────────────────────

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string
): Promise<SpotifyToken | null> {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!res.ok) {
    console.error('[Spotify Auth] Refresh failed:', await res.text())
    return null
  }

  const data = await res.json()
  const token: SpotifyToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_at: Date.now() + data.expires_in * 1000,
    token_type: data.token_type,
    scope: data.scope,
  }

  localStorage.setItem(TOKEN_KEY, JSON.stringify(token))
  return token
}

// ─── Token Storage Helpers ────────────────────────────────────────────────────

export function getStoredToken(): SpotifyToken | null {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as SpotifyToken
  } catch {
    return null
  }
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(VERIFIER_KEY)
}

/** Returns a valid access token, refreshing automatically if near expiry */
export async function getValidToken(clientId: string): Promise<string | null> {
  const token = getStoredToken()
  if (!token) return null

  // Refresh if expires in < 5 minutes
  if (Date.now() >= token.expires_at - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(token.refresh_token, clientId)
    return refreshed?.access_token ?? null
  }

  return token.access_token
}

/** Extracts ?code= from the current URL and cleans it up */
export function extractCodeFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const error = params.get('error')

  if (error) {
    console.error('[Spotify Auth] OAuth error:', error)
    return null
  }

  if (code) {
    // Clean URL — remove code from address bar
    const clean = window.location.origin + window.location.pathname
    window.history.replaceState({}, '', clean)
  }

  return code
}
