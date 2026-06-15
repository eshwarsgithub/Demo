import mammoth from 'mammoth'

export interface ParsedDocument {
  text: string
}

export async function parseDocument(
  buffer: Buffer,
  filename: string
): Promise<ParsedDocument> {
  const lower = filename.toLowerCase()

  if (lower.endsWith('.docx') || lower.endsWith('.doc')) {
    const result = await mammoth.extractRawText({ buffer })
    if (!result.value) throw new Error('mammoth returned empty text')
    return { text: result.value }
  }

  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    const html = buffer.toString('utf-8')
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    return { text }
  }

  // txt, md, csv — plain UTF-8
  return { text: buffer.toString('utf-8') }
}
