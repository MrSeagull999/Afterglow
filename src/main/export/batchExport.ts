import sharp from 'sharp'
import { readFile, writeFile, copyFile } from 'fs/promises'
import { extname, basename, join } from 'path'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import { getVersion } from '../core/store/versionStore'
import { getAsset } from '../core/store/assetStore'

export type BatchExportFormat = 'original' | 'tiff_16bit' | 'jpeg'

export interface BatchExportParams {
  jobId: string
  versionIds: string[]
  outputFolder: string
  format: BatchExportFormat
  maxWidth?: number       // default 4000
  jpegQuality?: number    // default 95
}

export interface BatchExportResult {
  exported: number
  failed: Array<{ versionId: string; error: string }>
  outputFolder: string
}

export async function batchExport(params: BatchExportParams): Promise<BatchExportResult> {
  const {
    jobId,
    versionIds,
    outputFolder,
    format,
    maxWidth = 4000,
    jpegQuality = 95
  } = params

  if (!existsSync(outputFolder)) {
    await mkdir(outputFolder, { recursive: true })
  }

  const result: BatchExportResult = {
    exported: 0,
    failed: [],
    outputFolder
  }

  for (const versionId of versionIds) {
    try {
      const version = await getVersion(jobId, versionId)
      if (!version?.outputPath) {
        result.failed.push({ versionId, error: 'No output file found' })
        continue
      }

      const asset = await getAsset(jobId, version.assetId)
      const baseName = asset?.originalName
        ? basename(asset.originalName, extname(asset.originalName))
        : `afterglow_${versionId}`

      const outputName = `${baseName}_afterglow`

      if (format === 'tiff_16bit') {
        const outputPath = join(outputFolder, `${outputName}.tiff`)
        await sharp(version.outputPath)
          .resize({ width: maxWidth, withoutEnlargement: true })
          .tiff({ bitdepth: 16 as any })
          .toFile(outputPath)
        result.exported++
      } else if (format === 'jpeg') {
        const outputPath = join(outputFolder, `${outputName}.jpg`)
        await sharp(version.outputPath)
          .resize({ width: maxWidth, withoutEnlargement: true })
          .jpeg({ quality: jpegQuality })
          .toFile(outputPath)
        result.exported++
      } else {
        // original — copy as-is
        const ext = extname(version.outputPath) || '.png'
        const outputPath = join(outputFolder, `${outputName}${ext}`)
        await copyFile(version.outputPath, outputPath)
        result.exported++
      }
    } catch (error) {
      result.failed.push({
        versionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return result
}
