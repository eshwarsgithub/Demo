'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageBubble } from './MessageBubble'
import { Send, Loader2 } from 'lucide-react'
import { cosineSimilarity } from '@/lib/utils'
import type { StoredChunk } from './UploadZone'

const STORE_KEY = 'ta_store'
const TOP_K = 5

interface Source {
  filename: string
  similarity: number
}

interface ContextChunk {
  filename: string
  content: string
  similarity: number
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}

function searchChunks(queryEmbedding: number[]): ContextChunk[] {
  try {
    const stored: Record<string, StoredChunk[]> = JSON.parse(
      localStorage.getItem(STORE_KEY) || '{}'
    )
    const all: StoredChunk[] = Object.values(stored).flat()
    if (all.length === 0) return []

    return all
      .map(chunk => ({
        filename: chunk.filename,
        content: chunk.content,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, TOP_K)
  } catch {
    return []
  }
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingId, setStreamingId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const userMsg: Message = { id: `u-${Date.now()}`, role: 'user', content: input.trim() }
    const assistantId = `a-${Date.now()}`

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }])
    setInput('')
    setIsLoading(true)
    setStreamingId(assistantId)

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      // 1. Embed the query server-side (keeps API key off the client)
      const embedRes = await fetch('/api/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: userMsg.content }),
      })
      const { embedding } = await embedRes.json()

      // 2. Search locally against stored chunks
      const contextChunks = searchChunks(embedding)

      // 3. Show sources immediately in the UI
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? {
                ...m,
                sources: contextChunks.map(c => ({
                  filename: c.filename,
                  similarity: Math.round(c.similarity * 100),
                })),
              }
            : m
        )
      )

      // 4. Stream the answer
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.content, contextChunks, history }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value).split('\n')
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'text') {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantId ? { ...m, content: m.content + event.text } : m
                )
              )
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    } catch {
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
            : m
        )
      )
    } finally {
      setIsLoading(false)
      setStreamingId(null)
      textareaRef.current?.focus()
    }
  }, [input, isLoading, messages])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <div className="text-center space-y-2">
              <p className="text-muted-foreground text-sm">
                Ask any question about the uploaded training materials.
              </p>
              <p className="text-muted-foreground text-xs">
                Upload a document in the sidebar first.
              </p>
            </div>
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            sources={msg.sources}
            isStreaming={msg.id === streamingId}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="border-t bg-background px-4 py-4 shrink-0">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="resize-none flex-1"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="self-end h-10 w-10 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
