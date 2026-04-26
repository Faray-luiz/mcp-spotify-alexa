/**
 * MCP Resource: spotify://current_track
 *
 * Reads the currently playing track from Spotify.
 * Uses: GET /v1/me/player/currently-playing
 */

import type { MCPResource, MCPResult } from '../types.ts'
import { okJson, errResult } from '../types.ts'
import { getCurrentTrack } from '../../spotify/api.ts'

let _getToken: () => Promise<string | null> = async () => null

export function setCurrentTrackTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn
}

export const currentTrackResource: MCPResource = {
  uri: 'spotify://current_track',
  name: 'get_current_track',
  description: 'Retorna informações sobre a música que está tocando agora no Spotify.',
  mimeType: 'application/json',

  async read(): Promise<MCPResult> {
    const token = await _getToken()
    if (!token) {
      return errResult('Nenhum token Spotify disponível. Conecte-se primeiro.')
    }

    const state = await getCurrentTrack(token)
    if (!state) {
      return okJson(
        {
          status: 'nothing_playing',
          message: 'Nenhuma música tocando no momento.',
        },
        'get_current_track',
        {}
      )
    }

    const track = state.item
    if (!track) {
      return okJson(
        {
          status: 'no_track_info',
          is_playing: state.is_playing,
        },
        'get_current_track',
        {}
      )
    }

    const progressSec = Math.floor(state.progress_ms / 1000)
    const durationSec = Math.floor(track.duration_ms / 1000)

    return okJson(
      {
        status: state.is_playing ? 'playing' : 'paused',
        track: {
          id: track.id,
          name: track.name,
          uri: track.uri,
          artist: track.artists.map(a => a.name).join(', '),
          album: track.album.name,
          albumArt: track.album.images[0]?.url ?? null,
          duration_ms: track.duration_ms,
          duration_formatted: `${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, '0')}`,
          progress_ms: state.progress_ms,
          progress_formatted: `${Math.floor(progressSec / 60)}:${(progressSec % 60).toString().padStart(2, '0')}`,
          progress_percent: Math.round((state.progress_ms / track.duration_ms) * 100),
          explicit: track.explicit,
          popularity: track.popularity,
        },
        device: state.device
          ? {
              id: state.device.id,
              name: state.device.name,
              type: state.device.type,
              volume: state.device.volume_percent,
            }
          : null,
        shuffle: state.shuffle_state,
        repeat: state.repeat_state,
        timestamp: new Date().toISOString(),
      },
      'get_current_track',
      {}
    )
  },
}
