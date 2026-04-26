import { SkipBack, SkipForward, Play, Pause, Heart, Shuffle, Repeat, Volume2, VolumeX } from 'lucide-react'
import type { TrackInfo } from '../App'

interface Props {
  track: TrackInfo
  volume: number
  isShuffle: boolean
  isRepeat: boolean
  onPlay: () => void
  onNext: () => void
  onPrev: () => void
  onLike: () => void
  onShuffle: () => void
  onRepeat: () => void
  onVolume: (v: number) => void
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function NowPlaying({
  track, volume, isShuffle, isRepeat,
  onPlay, onNext, onPrev, onLike, onShuffle, onRepeat, onVolume
}: Props) {
  const progressPct = (track.progress / track.duration) * 100

  return (
    <div className="w-full glass-card rounded-2xl p-5 border border-white/8 shadow-xl">
      {/* Track info */}
      <div className="flex items-center gap-4 mb-5">
        {/* Album art */}
        <div className="relative flex-shrink-0">
          <div className={`
            w-16 h-16 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center
            ${track.isPlaying ? 'animate-spin-slow' : ''}
            shadow-lg shadow-purple-500/30
          `}>
            <span className="text-2xl">🎵</span>
          </div>
          {track.isPlaying && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#121212] flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-white rounded-full" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-white truncate">{track.title}</h3>
          <p className="text-sm text-white/50 truncate">{track.artist}</p>
          <p className="text-xs text-white/30 truncate">{track.album}</p>
        </div>

        <button onClick={onLike} className="flex-shrink-0 transition-transform duration-200 hover:scale-110">
          <Heart className={`w-5 h-5 ${track.isLiked ? 'text-green-500 fill-green-500' : 'text-white/30'}`} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="relative w-full h-1 bg-white/10 rounded-full overflow-hidden group cursor-pointer">
          <div
            className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-1000"
            style={{ width: `${progressPct}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2"
            style={{ left: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-white/30">{formatTime(track.progress)}</span>
          <span className="text-xs text-white/30">{formatTime(track.duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={onShuffle}
          className={`p-2 rounded-lg transition-all ${isShuffle ? 'text-green-400' : 'text-white/40 hover:text-white/70'}`}
        >
          <Shuffle className="w-4 h-4" />
        </button>

        <button onClick={onPrev} className="p-2 rounded-lg text-white/70 hover:text-white transition-colors">
          <SkipBack className="w-5 h-5" />
        </button>

        <button
          onClick={onPlay}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200
            ${track.isPlaying
              ? 'bg-white text-black hover:bg-white/90 hover:scale-105'
              : 'bg-green-500 text-black hover:bg-green-400 hover:scale-105'
            }
            shadow-lg shadow-green-500/30
          `}
        >
          {track.isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>

        <button onClick={onNext} className="p-2 rounded-lg text-white/70 hover:text-white transition-colors">
          <SkipForward className="w-5 h-5" />
        </button>

        <button
          onClick={onRepeat}
          className={`p-2 rounded-lg transition-all ${isRepeat ? 'text-green-400' : 'text-white/40 hover:text-white/70'}`}
        >
          <Repeat className="w-4 h-4" />
        </button>
      </div>

      {/* Volume */}
      <div className="flex items-center gap-3">
        {volume === 0 ? (
          <VolumeX className="w-4 h-4 text-white/30 flex-shrink-0" />
        ) : (
          <Volume2 className="w-4 h-4 text-white/30 flex-shrink-0" />
        )}
        <div className="relative flex-1 h-1 bg-white/10 rounded-full group cursor-pointer">
          <div
            className="h-full bg-white/50 rounded-full group-hover:bg-green-400 transition-colors"
            style={{ width: `${volume}%` }}
          />
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={e => onVolume(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
        <span className="text-xs text-white/30 w-6 text-right">{volume}</span>
      </div>
    </div>
  )
}
