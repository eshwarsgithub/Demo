import { NextRequest, NextResponse } from 'next/server'
import { parseDocument } from '@/lib/document-parser'
import { chunkText } from '@/lib/rag'
import { embedBatch } from '@/lib/voyage'

export const maxDuration = 60

const SUPPORTED_EXTENSIONS = [
  '.docx', '.doc',
  '.txt', '.md', '.csv',
  '.html', '.htm',
]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const lower = file.name.toLowerCase()
    if (!SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      return NextResponse.json(
        { error: `Unsupported file type. Supported: ${SUPPORTED_EXTENSIONS.join(', ')}` },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseDocument(buffer, file.name)

    if (!parsed.text || parsed.text.trim().length < 50) {
      return NextResponse.json(
        { error: 'Could not extract meaningful text from this document' },
        { status: 422 }
      )
    }

    const textChunks = chunkText(parsed.text)
    if (textChunks.length === 0) {
      return NextResponse.json({ error: 'Document too short to index' }, { status: 422 })
    }

    const embeddings = await embedBatch(textChunks.map(c => c.content))

    const chunks = textChunks.map((chunk, i) => ({
      id: `${file.name}-${chunk.chunkIndex}`,
      filename: file.name,
      content: chunk.content,
      embedding: embeddings[i],
      chunkIndex: chunk.chunkIndex,
    }))

    return NextResponse.json({
      success: true,
      filename: file.name,
      chunkCount: chunks.length,
      chunks,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
