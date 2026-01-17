import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('Twilight batchGenerate should not fall back to the old hardcoded default prompt template', async () => {
  const src = await readFile(
    new URL('../src/main/ipc/moduleHandlers.ts', import.meta.url),
    'utf-8'
  )

  assert.ok(
    !src.includes('Exterior landscape lighting should be on'),
    'Found legacy hardcoded twilight batch prompt; this would break prompt integrity.'
  )
})
