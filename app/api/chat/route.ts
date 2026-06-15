import { NextRequest } from 'next/server'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'openai/gpt-4o-mini'

const SYSTEM_PROMPT = `You are a friendly, conversational training assistant — like a knowledgeable colleague who has read all the training materials and is happy to help.

Guidelines:
- Talk naturally, as if explaining to a friend. Avoid robotic or overly formal language.
- Use the content in <training_materials> as your source of truth. Do not make things up beyond what's there.
- If something isn't covered in the materials, say so warmly — e.g. "Hmm, I don't see that covered in the materials — you might want to check with the team directly."
- Cite the source when useful: e.g. "According to ai_overview.docx, ..."
- Keep answers focused and conversational. Use short paragraphs. Bullet points are fine when listing things, but don't over-structure every reply.
- A little warmth goes a long way — it's okay to acknowledge a good question or offer to dig deeper.`

interface ContextChunk {
  filename: string
  content: string
  similarity: number
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, contextChunks = [], history = [] } = body as {
      message: string
      contextChunks: ContextChunk[]
      history: Array<{ role: 'user' | 'assistant'; content: string }>
    }

    if (!message?.trim()) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const contextText =
      contextChunks.length === 0
        ? 'No relevant training materials found.'
        : contextChunks
            .map(c => `--- Source: ${c.filename} ---\n${c.content}`)
            .join('\n\n')

    const contextualMessage = `<training_materials>\n${contextText}\n</training_materials>\n\nUser question: ${message}`

    const messages = [
      ...history.map(h => ({ role: h.role, content: h.content })),
      { role: 'user' as const, content: contextualMessage },
    ]

    const upstream = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        stream: true,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
      }),
    })

    if (!upstream.ok) {
      const err = await upstream.text()
      throw new Error(`OpenRouter error ${upstream.status}: ${err}`)
    }

    const readable = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          const reader = upstream.body!.getReader()
          const decoder = new TextDecoder()
          let buffer = ''

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split('\n')
            buffer = lines.pop() ?? ''

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
                )
                continue
              }
              try {
                const parsed = JSON.parse(data)
                const text = parsed.choices?.[0]?.delta?.content
                if (text) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ type: 'text', text })}\n\n`)
                  )
                }
              } catch {
                // skip malformed SSE chunks
              }
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                error: err instanceof Error ? err.message : 'Stream error',
              })}\n\n`
            )
          )
        } finally {
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Chat failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
