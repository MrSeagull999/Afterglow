import { copyFile, readdir, rm } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname, basename, extname } from 'path'

// Mirrored copies land next to the imported original as {base}-AG{NN}{ext}
// so a Lightroom folder sync picks them up alongside the source photo.
const MIRROR_SUFFIX = /-AG(\d+)\.[^.]+$/i

export function isMirroredOutputFilename(filename: string): boolean {
  return MIRROR_SUFFIX.test(filename)
}

/**
 * Copy a generated output next to the source photo it came from.
 * Returns the mirror path, or null when the source folder is gone.
 * Passing existingMirrorPath reuses that slot (a later, higher-quality render
 * of the same version replaces its earlier mirror instead of adding a file).
 */
export async function mirrorOutputToSource(params: {
  sourceOriginPath: string
  outputPath: string
  existingMirrorPath?: string
}): Promise<string | null> {
  const { sourceOriginPath, outputPath, existingMirrorPath } = params
  const dir = dirname(sourceOriginPath)
  if (!existsSync(dir) || !existsSync(outputPath)) return null

  const ext = extname(outputPath) || '.png'
  let target: string | null = null

  if (existingMirrorPath && isMirroredOutputFilename(basename(existingMirrorPath))) {
    // The extension can change between renders (e.g. png preview, jpeg final)
    target = join(dirname(existingMirrorPath), basename(existingMirrorPath).replace(/\.[^.]+$/, ext))
    if (existingMirrorPath !== target && existsSync(existingMirrorPath)) {
      await rm(existingMirrorPath, { force: true })
    }
  }

  if (!target) {
    const base = basename(sourceOriginPath, extname(sourceOriginPath))
    let maxSeq = 0
    for (const entry of await readdir(dir)) {
      if (!entry.startsWith(`${base}-AG`)) continue
      const match = entry.match(MIRROR_SUFFIX)
      if (match) maxSeq = Math.max(maxSeq, parseInt(match[1], 10))
    }
    target = join(dir, `${base}-AG${String(maxSeq + 1).padStart(2, '0')}${ext}`)
  }

  await copyFile(outputPath, target)
  return target
}

export async function removeMirroredOutput(mirrorPath: string): Promise<void> {
  // Only ever delete files that follow our own naming pattern
  if (!isMirroredOutputFilename(basename(mirrorPath))) return
  await rm(mirrorPath, { force: true })
}
