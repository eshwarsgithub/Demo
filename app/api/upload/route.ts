import { NextRequest, NextResponse } from 'next/server'
import { parseDocument } from '@/lib/document-parser'
import { ingestDocument } from '@/lib/rag'

export const maxDuration = 60

// All formats markitdown supports
const SUPPORTED_EXTENSIONS = [
  '.pdf', '.docx', '.doc', '.pptx', '.ppt',
  '.xlsx', '.xls', '.csv', '.html', '.htm',
  '.txt', '.md', '.epub',
]

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const lower = file.name.toLowerCase()
    const supported = SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext))
    if (!supported) {
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

    const chunkCount = await ingestDocument(file.name, parsed.text)

    return NextResponse.json({
      success: true,
      filename: file.name,
      chunkCount,
      characterCount: parsed.text.length,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    )
  }
}
