import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

const execAsync = promisify(execFile)

export interface ParsedDocument {
  text: string
}

export async function parseDocument(
  buffer: Buffer,
  filename: string
): Promise<ParsedDocument> {
  const tempDir = join(tmpdir(), `markitdown-${Date.now()}`)
  const tempPath = join(tempDir, filename)

  await mkdir(tempDir, { recursive: true })

  try {
    await writeFile(tempPath, buffer)

    const { stdout } = await execAsync('python', ['-m', 'markitdown', tempPath], {
      maxBuffer: 50 * 1024 * 1024, // 50 MB output cap
    })

    const text = stdout.trim()
    if (!text) throw new Error('markitdown returned empty output')

    return { text }
  } finally {
    await unlink(tempPath).catch(() => {})
    await unlink(tempDir).catch(() => {})
  }
}
