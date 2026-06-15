import { embedBatch } from './voyage'
import { loadStore, saveStore, type Chunk } from './vector-store'

const CHUNK_SIZE = 1800
const OVERLAP = 150
const MIN_CHUNK = 100

export interface TextChunk {
  content: string
  chunkIndex: number
}

export function chunkText(text: string): TextChunk[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  const chunks: TextChunk[] = []
  let position = 0
  let chunkIndex = 0

  while (position < normalized.length) {
    const end = Math.min(position + CHUNK_SIZE, normalized.length)
    let chunkEnd = end

    if (end < normalized.length) {
      const paragraphBreak = normalized.lastIndexOf('\n\n', end)
      if (paragraphBreak > position + CHUNK_SIZE * 0.5) {
        chunkEnd = paragraphBreak + 2
      } else {
        const slice = normalized.slice(position, end)
        const sentenceEnd = slice.search(/[.!?]\s+[A-Z]/)
        if (sentenceEnd > CHUNK_SIZE * 0.5) {
          chunkEnd = position + sentenceEnd + 2
        }
      }
    }

    const content = normalized.slice(position, chunkEnd).trim()
    if (content.length >= MIN_CHUNK) {
      chunks.push({ content, chunkIndex: chunkIndex++ })
    }

    const next = chunkEnd - OVERLAP
    position = next > position ? next : chunkEnd
  }

  return chunks
}

export async function ingestDocument(filename: string, text: string): Promise<number> {
  const chunks = chunkText(text)
  if (chunks.length === 0) return 0

  const texts = chunks.map(c => c.content)
  const embeddings = await embedBatch(texts)

  const newChunks: Chunk[] = chunks.map((chunk, i) => ({
    id: `${filename}-${chunk.chunkIndex}-${Date.now()}`,
    filename,
    content: chunk.content,
    embedding: embeddings[i],
    chunkIndex: chunk.chunkIndex,
  }))

  const store = loadStore()
  // Remove any existing chunks for this filename (re-upload)
  store.chunks = store.chunks.filter(c => c.filename !== filename)
  store.chunks.push(...newChunks)
  saveStore(store)

  return newChunks.length
}
