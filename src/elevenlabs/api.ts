/**
 * ElevenLabs API — Converts text response to speech.
 */

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4PUHQRZtL' // "Bella" - Clear and professional

export async function speak(text: string, apiKey: string): Promise<void> {
  if (!text) return

  // FALLBACK: Se não tiver API Key, usa a voz do sistema (Grátis)
  if (!apiKey) {
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      utterance.rate = 1.1 // Um pouco mais rápido para parecer natural
      utterance.onend = () => resolve()
      window.speechSynthesis.speak(utterance)
    })
  }

  // Se tiver API Key, usa a ElevenLabs (Alta Qualidade)
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}?output_format=mp3_44100_128`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    })

    if (!response.ok) {
      console.warn('ElevenLabs Error, falling back to system voice...')
      // Fallback para voz do sistema se a API der erro (ex: crédito acabou)
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'pt-BR'
      window.speechSynthesis.speak(utterance)
      return
    }

    const blob = await response.blob()
    const audioUrl = URL.createObjectURL(blob)
    const audio = new Audio(audioUrl)
    
    return new Promise((resolve) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        resolve()
      }
      audio.play().catch(err => {
        console.error('Playback Error:', err)
        resolve()
      })
    })
  } catch (err) {
    console.error('ElevenLabs Error:', err)
  }
}
