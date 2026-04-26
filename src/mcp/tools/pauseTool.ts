/**
 * MCP Tool: pause
 *
 * Pauses the current Spotify playback.
 * Uses: PUT /v1/me/player/pause
 */

import type { MCPTool, MCPResult } from '../types.ts'
import { okJson, errResult } from '../types.ts'
import { pausePlayback } from '../../spotify/api.ts'
import { getDeviceId } from '../../spotify/sdk.ts'

let _getToken: () => Promise<string | null> = async () => null

export function setPauseTokenGetter(fn: () => Promise<string | null>) {
  _getToken = fn
}

export const pauseTool: MCPTool = {
  name: 'pause',
  description: 'Pausa a reprodução atual no Spotify.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },

  async execute(): Promise<MCPResult> {
    const token = await _getToken()
    if (!token) {
      return errResult('Nenhum token Spotify disponível. Conecte-se primeiro.')
    }

    const deviceId = getDeviceId() ?? undefined
    const success = await pausePlayback(token, deviceId)

    if (!success) {
      return errResult('Não foi possível pausar a reprodução. Verifique se há um dispositivo ativo.')
    }

    return okJson(
      {
        action: 'paused',
        deviceId: deviceId ?? null,
        timestamp: new Date().toISOString(),
      },
      'pause',
      {}
    )
  },
}
