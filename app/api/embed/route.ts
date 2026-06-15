import { NextRequest, NextResponse } from 'next/server'
import { embedQuery } from '@/lib/voyage'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()
    if (!text?.trim()) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 })
    }
    const embedding = await embedQuery(text)
    return NextResponse.json({ embedding })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Embed failed' },
      { status: 500 }
    )
  }
}
