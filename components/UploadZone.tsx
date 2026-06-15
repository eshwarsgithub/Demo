'use client'

import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UploadResult {
  filename: string
  chunkCount: number
  status: 'success' | 'error'
  error?: string
}

export function UploadZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [currentFile, setCurrentFile] = useState<string | null>(null)
  const [results, setResults] = useState<UploadResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File): Promise<UploadResult> => {
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/upload', { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) return { filename: file.name, chunkCount: 0, status: 'error', error: data.error }
    return { filename: file.name, chunkCount: data.chunkCount, status: 'success' }
  }, [])

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const SUPPORTED = ['.pdf','.docx','.doc','.pptx','.ppt','.xlsx','.xls','.csv','.html','.htm','.txt','.md','.epub']
      const fileArray = Array.from(files).filter(
        f => SUPPORTED.some(ext => f.name.toLowerCase().endsWith(ext))
      )
      if (fileArray.length === 0) return

      setIsUploading(true)
      const newResults: UploadResult[] = []
      for (const file of fileArray) {
        setCurrentFile(file.name)
        newResults.push(await processFile(file))
      }
      setResults(prev => [...newResults, ...prev])
      setCurrentFile(null)
      setIsUploading(false)
    },
    [processFile]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles]
  )

  return (
    <div className="space-y-4">
      <Card
        className={cn(
          'border-2 border-dashed cursor-pointer transition-colors',
          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
          isUploading && 'pointer-events-none opacity-60'
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <CardContent className="flex flex-col items-center justify-center py-6 text-center">
          <Upload className="h-6 w-6 text-muted-foreground mb-2" />
          <p className="text-xs font-medium mb-1">
            {isUploading ? `Processing: ${currentFile}` : 'Drop PDF or Word files here'}
          </p>
          <p className="text-xs text-muted-foreground mb-3">PDF, Word, PPT, Excel, CSV, HTML…</p>
          {isUploading ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Embedding…
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
            >
              <Upload className="h-3 w-3 mr-1" />
              Choose Files
            </Button>
          )}
        </CardContent>
      </Card>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.html,.htm,.txt,.md,.epub"
        multiple
        onChange={e => e.target.files && handleFiles(e.target.files)}
      />

      {results.length > 0 && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">
            Indexed
          </h3>
          {results.map((result, i) => (
            <div key={i} className="flex items-center justify-between rounded-md border px-2.5 py-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                {result.status === 'success' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                )}
                <span className="truncate">{result.filename}</span>
              </div>
              {result.status === 'success' ? (
                <Badge variant="secondary" className="text-xs ml-1 shrink-0">{result.chunkCount}</Badge>
              ) : (
                <span className="text-xs text-destructive ml-1 shrink-0">failed</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
