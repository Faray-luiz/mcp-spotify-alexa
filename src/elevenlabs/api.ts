/**
 * ElevenLabs API — Converts text response to speech.
 */

const DEFAULT_VOICE_ID = 'EXAVITQu4vr4PUHQRZtL' // "Bella" - Clear and professional

export async function speak(text: string, apiKey: string): Promise<void> {
  if (!apiKey || !text) return

  // Use Turbo v2.5 for low latency as requested
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
      console.error('ElevenLabs API Error:', await response.text())
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
