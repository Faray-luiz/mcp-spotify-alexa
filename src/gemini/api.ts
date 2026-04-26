/**
 * Gemini API — Orchestrates LLM calls to decide which MCP tool to use.
 */

export interface GeminiResponse {
  tool?: string
  args?: Record<string, any>
  explanation?: string
  thought?: string
}

const SYSTEM_PROMPT = `
Você é o "MCP Spotify Alexa", um assistente de música inteligente.
Sua tarefa é converter comandos de voz do usuário em chamadas de ferramentas MCP.

Ferramentas Disponíveis:
1. "search_and_play": Busca e toca uma música. Argumento: { "query": string }
2. "pause": Pausa a reprodução atual. Argumento: {}
3. "get_current_track": Obtém informações da música atual. Argumento: {}

Outras Ações (não MCP, use se o usuário pedir especificamente):
- "__next": Pular para a próxima música.
- "__prev": Voltar para a música anterior.
- "__volume": Alterar volume. Argumento: { "delta": number } (ex: +15 ou -15)

Regras:
- Sempre responda APENAS com um objeto JSON válido.
- Se o usuário pedir algo como "Toca Queen", use search_and_play com query "Queen".
- Se o usuário perguntar "Quem está cantando?", use get_current_track.
- Tente ser conciso na "explanation" (máximo 15 palavras) pois ela será falada pela IA.

Exemplo de Saída:
{
  "tool": "search_and_play",
  "args": { "query": "Bohemian Rhapsody" },
  "explanation": "Certo, vou tocar Bohemian Rhapsody para você."
}
`

export async function processWithGemini(text: string, apiKey: string): Promise<GeminiResponse> {
  if (!apiKey) {
    return { explanation: "API Key do Gemini não configurada." }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: SYSTEM_PROMPT },
            { text: `Comando do Usuário: "${text}"` }
          ]
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    })

    const data = await response.json()

    if (!response.ok) {
      const errorMsg = data.error?.message || response.statusText
      throw new Error(`Gemini API Error (${response.status}): ${errorMsg}`)
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      throw new Error("Gemini não retornou nenhum conteúdo.")
    }

    return JSON.parse(content) as GeminiResponse
  } catch (err: any) {
    console.error('Gemini Error:', err)
    throw err
  }
}
