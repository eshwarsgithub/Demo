'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface Source {
  filename: string
  similarity: number
}

interface MessageBubbleProps {
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  isStreaming?: boolean
}

export function MessageBubble({ role, content, sources, isStreaming }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex w-full mb-5', isUser ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[80%] space-y-1.5">
        <div
          className={cn(
            'text-xs font-medium',
            isUser ? 'text-right text-muted-foreground' : 'text-left text-primary'
          )}
        >
          {isUser ? 'You' : 'Training Assistant'}
        </div>

        <div
          className={cn(
            'rounded-2xl px-4 py-3 text-sm leading-relaxed',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-sm'
              : 'bg-muted text-foreground rounded-tl-sm'
          )}
        >
          {content.split('\n').map((line, i) => (
            <p key={i} className={i > 0 ? 'mt-2' : ''}>
              {line || ' '}
            </p>
          ))}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-current ml-0.5 animate-pulse" />
          )}
        </div>

        {sources && sources.length > 0 && !isUser && (
          <div className="flex flex-wrap items-center gap-1 px-1">
            <span className="text-xs text-muted-foreground">Sources:</span>
            {sources.map((source, i) => (
              <Badge key={i} variant="secondary" className="text-xs font-normal">
                {source.filename}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
