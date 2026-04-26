/**
 * MCP Tool: search_and_play
 *
 * Searches Spotify for a query and immediately plays the top result.
 * Uses: GET /v1/search → PUT /v1/me/player/play
 */

import type { MCPTool, MCPResult } from '../types.ts'
import { okJson, errResult } from '../types.ts'
import { searchTrack, playTrack, transferPlayback } from '../../spotify/api.ts'
import { getDeviceId } from '../../spotify/sdk.ts'

interface SearchAndPlayArgs {
  query: string
  deviceId?: string
}

/** Shared token getter — injected at registration time */
let _getToken: () => Promise<string | null> = async () => null

export function setSearchAndPlayTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn
}

export const searchAndPlayTool: MCPTool = {
  name: 'search_and_play',
  description: 'Busca uma música no Spotify e inicia a reprodução do primeiro resultado.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Nome da música, artista ou álbum a buscar',
      },
    },
    required: ['query'],
  },

  async execute(rawArgs): Promise<MCPResult> {
    const args = rawArgs as unknown as SearchAndPlayArgs
    if (!args.query?.trim()) {
      return errResult('Argumento "query" é obrigatório e não pode estar vazio.')
    }

    const token = await _getToken()
    if (!token) {
      return errResult('Nenhum token Spotify disponível. Conecte-se primeiro.')
    }

    // 1. Search
    const tracks = await searchTrack(args.query, token, 5)
    if (tracks.length === 0) {
      return errResult(`Nenhuma música encontrada para: "${args.query}"`)
    }

    const topTrack = tracks[0]
    const deviceId = args.deviceId ?? getDeviceId() ?? undefined

    // 2. Transfer playback to our SDK device if we have one
    if (deviceId) {
      await transferPlayback(deviceId, token, false)
      // Small delay for device activation
      await new Promise(r => setTimeout(r, 500))
    }

    // 3. Play
    const played = await playTrack(token, { uri: topTrack.uri, deviceId })
    if (!played) {
      return errResult(
        `Não foi possível iniciar a reprodução. Certifique-se de que o Spotify está aberto em um dispositivo.`
      )
    }

    return okJson(
      {
        action: 'playing',
        track: {
          id: topTrack.id,
          name: topTrack.name,
          uri: topTrack.uri,
          artist: topTrack.artists.map(a => a.name).join(', '),
          album: topTrack.album.name,
          duration_ms: topTrack.duration_ms,
          albumArt: topTrack.album.images[0]?.url,
          popularity: topTrack.popularity,
        },
        alternatives: tracks.slice(1).map(t => ({
          name: t.name,
          artist: t.artists.map(a => a.name).join(', '),
          uri: t.uri,
        })),
        deviceId: deviceId ?? null,
      },
      'search_and_play',
      args
    )
  },
}
