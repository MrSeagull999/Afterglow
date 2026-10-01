import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, readdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import {
  mirrorOutputToSource,
  removeMirroredOutput,
  isMirroredOutputFilename
} from '../src/main/core/services/sourceMirror'

async function makeDirs() {
  const sourceDir = await mkdtemp(join(tmpdir(), 'ag-source-'))
  const outputDir = await mkdtemp(join(tmpdir(), 'ag-output-'))
  const sourceOriginPath = join(sourceDir, 'IMG_1234.jpg')
  await writeFile(sourceOriginPath, 'original')
  return { sourceDir, outputDir, sourceOriginPath }
}

test('isMirroredOutputFilename matches only the -AG{NN} pattern', () => {
  assert.equal(isMirroredOutputFilename('IMG_1234-AG01.png'), true)
  assert.equal(isMirroredOutputFilename('IMG_1234-AG12.jpg'), true)
  assert.equal(isMirroredOutputFilename('IMG_1234.jpg'), false)
  assert.equal(isMirroredOutputFilename('IMG_1234-Edit.jpg'), false)
  assert.equal(isMirroredOutputFilename('IMG_1234-AG.png'), false)
})

test('mirrorOutputToSource copies output next to the source with sequential names', async () => {
  const { sourceDir, outputDir, sourceOriginPath } = await makeDirs()

  const output1 = join(outputDir, 'ver_1.png')
  await writeFile(output1, 'render-one')
  const mirror1 = await mirrorOutputToSource({ sourceOriginPath, outputPath: output1 })
  assert.equal(mirror1, join(sourceDir, 'IMG_1234-AG01.png'))
  assert.equal(await readFile(mirror1!, 'utf-8'), 'render-one')

  const output2 = join(outputDir, 'ver_2.png')
  await writeFile(output2, 'render-two')
  const mirror2 = await mirrorOutputToSource({ sourceOriginPath, outputPath: output2 })
  assert.equal(mirror2, join(sourceDir, 'IMG_1234-AG02.png'))
})

test('mirrorOutputToSource reuses the slot for a later render of the same version', async () => {
  const { sourceDir, outputDir, sourceOriginPath } = await makeDirs()

  const preview = join(outputDir, 'ver_1.png')
  await writeFile(preview, 'preview')
  const mirror = await mirrorOutputToSource({ sourceOriginPath, outputPath: preview })

  // Final render of the same version, different format, replaces the mirror in place
  const final = join(outputDir, 'ver_1_final.jpeg')
  await writeFile(final, 'final')
  const mirrorAfterFinal = await mirrorOutputToSource({
    sourceOriginPath,
    outputPath: final,
    existingMirrorPath: mirror!
  })

  assert.equal(mirrorAfterFinal, join(sourceDir, 'IMG_1234-AG01.jpeg'))
  assert.equal(existsSync(mirror!), false) // old .png mirror removed
  assert.equal(await readFile(mirrorAfterFinal!, 'utf-8'), 'final')

  const mirrors = (await readdir(sourceDir)).filter(isMirroredOutputFilename)
  assert.deepEqual(mirrors, ['IMG_1234-AG01.jpeg'])
})

test('mirrorOutputToSource returns null when the source folder is gone', async () => {
  const { outputDir } = await makeDirs()
  const output = join(outputDir, 'ver_1.png')
  await writeFile(output, 'render')

  const result = await mirrorOutputToSource({
    sourceOriginPath: join(tmpdir(), 'ag-does-not-exist', 'IMG_1234.jpg'),
    outputPath: output
  })
  assert.equal(result, null)
})

test('removeMirroredOutput deletes mirrors but refuses non-mirror paths', async () => {
  const { sourceDir, sourceOriginPath } = await makeDirs()

  const mirror = join(sourceDir, 'IMG_1234-AG01.png')
  await writeFile(mirror, 'render')
  await removeMirroredOutput(mirror)
  assert.equal(existsSync(mirror), false)

  // The original never matches the mirror pattern, so it is never deleted
  await removeMirroredOutput(sourceOriginPath)
  assert.equal(existsSync(sourceOriginPath), true)
})
