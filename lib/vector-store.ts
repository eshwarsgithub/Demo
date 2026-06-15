import fs from 'fs'
import path from 'path'

export interface Chunk {
  id: string
  filename: string
  content: string
  embedding: number[]
  chunkIndex: number
}

interface VectorStore {
  chunks: Chunk[]
}

const DATA_DIR = path.join(process.cwd(), '.data')
const STORE_PATH = path.join(DATA_DIR, 'store.json')

export function loadStore(): VectorStore {
  try {
    if (!fs.existsSync(STORE_PATH)) return { chunks: [] }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8')
    return JSON.parse(raw) as VectorStore
  } catch {
    return { chunks: [] }
  }
}

export function saveStore(store: VectorStore): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(STORE_PATH, JSON.stringify(store), 'utf-8')
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    magA += a[i] * a[i]
    magB += b[i] * b[i]
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB)
  return denom === 0 ? 0 : dot / denom
}

export interface ScoredChunk extends Chunk {
  similarity: number
}

export function searchChunks(
  queryEmbedding: number[],
  topK = 5,
  threshold = 0.35
): ScoredChunk[] {
  const store = loadStore()
  const scored = store.chunks
    .map(chunk => ({ ...chunk, similarity: cosineSimilarity(queryEmbedding, chunk.embedding) }))
    .filter(c => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK)
  return scored
}
