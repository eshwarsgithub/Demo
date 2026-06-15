const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings'
const VOYAGE_MODEL = 'voyage-3'

interface VoyageResponse {
  data: Array<{ embedding: number[]; index: number }>
}

async function callVoyage(input: string | string[], inputType: 'query' | 'document'): Promise<number[][]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ input, model: VOYAGE_MODEL, input_type: inputType }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Voyage API error ${res.status}: ${err}`)
  }

  const data: VoyageResponse = await res.json()
  return data.data.sort((a, b) => a.index - b.index).map(d => d.embedding)
}

export async function embedQuery(text: string): Promise<number[]> {
  const results = await callVoyage(text, 'query')
  return results[0]
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  const BATCH_SIZE = 64
  const all: number[][] = []
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const results = await callVoyage(batch, 'document')
    all.push(...results)
  }
  return all
}
