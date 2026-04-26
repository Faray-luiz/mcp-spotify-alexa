/**
 * SearchBar — Music search input that calls the search_and_play MCP Tool.
 */

import { useState, useRef, useCallback } from 'react'
import { Search, Play, Loader2, X } from 'lucide-react'
import { searchTrack } from '../spotify/api.ts'
import type { SpotifyTrack } from '../spotify/api.ts'

interface Props {
  isConnected: boolean
  getToken: () => Promise<string | null>
  onSearch: (query: string) => Promise<void>
  disabled?: boolean
}

function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

export default function SearchBar({ isConnected, getToken, onSearch, disabled }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SpotifyTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced preview search
  const doPreviewSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim() || q.length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      const token = await getToken()
      if (!token) return

      setIsSearching(true)
      try {
        const tracks = await searchTrack(q, token, 5)
        setResults(tracks)
        setOpen(tracks.length > 0)
      } finally {
        setIsSearching(false)
      }
    }, 350),
    [getToken]
  )

  const handleInput = (val: string) => {
    setQuery(val)
    if (isConnected) doPreviewSearch(val)
  }

  const handlePlay = async (track?: SpotifyTrack) => {
    const q = track ? `${track.name} ${track.artists[0]?.name}` : query
    if (!q.trim()) return
    setIsPlaying(true)
    setOpen(false)
    try {
      await onSearch(track ? track.name + ' ' + track.artists[0]?.name : q)
      setQuery('')
      setResults([])
    } finally {
      setIsPlaying(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handlePlay()
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  const clear = () => {
    setQuery('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  return (
    <div className="w-full relative">
      {/* Input row */}
      <div className={`flex items-center gap-2 glass-card rounded-xl px-4 py-2.5 border transition-all duration-200 ${
        open ? 'border-green-500/40 rounded-b-none border-b-transparent' : 'border-white/10'
      } ${disabled ? 'opacity-40' : ''}`}>
        {isSearching
          ? <Loader2 className="w-4 h-4 text-white/30 animate-spin flex-shrink-0" />
          : <Search className="w-4 h-4 text-white/30 flex-shrink-0" />
        }
        <input
          ref={inputRef}
          id="search-track-input"
          type="text"
          value={query}
          onChange={e => handleInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          placeholder={isConnected ? 'Buscar música, artista...' : 'Conecte ao Spotify para buscar'}
          disabled={disabled || !isConnected}
          className="flex-1 bg-transparent text-sm text-white placeholder-white/25 focus:outline-none"
        />
        {query && (
          <button onClick={clear} className="flex-shrink-0 text-white/20 hover:text-white/60 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          id="search-play-btn"
          onClick={() => handlePlay()}
          disabled={!query.trim() || isPlaying || disabled || !isConnected}
          className="flex-shrink-0 px-3 py-1 rounded-lg bg-green-500/20 hover:bg-green-500/40 disabled:opacity-30 disabled:cursor-not-allowed text-green-400 text-xs font-semibold transition-all flex items-center gap-1.5"
        >
          {isPlaying ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
          Tocar
        </button>
      </div>

      {/* Results dropdown */}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-40 glass-card border border-green-500/20 border-t-0 rounded-b-xl overflow-hidden shadow-xl shadow-black/40">
          {results.map(track => (
            <button
              key={track.id}
              onMouseDown={() => handlePlay(track)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left group"
            >
              {/* Album art */}
              {track.album.images[0]?.url ? (
                <img
                  src={track.album.images[0].url}
                  alt={track.album.name}
                  className="w-8 h-8 rounded object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded bg-white/10 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{track.name}</p>
                <p className="text-xs text-white/40 truncate">{track.artists.map(a => a.name).join(', ')}</p>
              </div>
              <Play className="w-3.5 h-3.5 text-green-400 opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
