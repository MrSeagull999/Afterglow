import sharp from 'sharp'
import { readFile, writeFile } from 'fs/promises'
import { extname } from 'path'

export type ImageFormat = 'png' | 'jpeg' | 'webp'

export interface ImageMetadata {
  width: number
  height: number
  format: string
  size: number
  hasAlpha: boolean
}

export async function readImageAsBuffer(imagePath: string): Promise<Buffer> {
  return readFile(imagePath)
}

export async function readImageAsBase64(imagePath: string): Promise<string> {
  const buffer = await readFile(imagePath)
  return buffer.toString('base64')
}

export async function writeImageFromBase64(
  base64Data: string,
  outputPath: string,
  format: ImageFormat = 'png'
): Promise<void> {
  const buffer = Buffer.from(base64Data, 'base64')
  
  let pipeline = sharp(buffer)
  
  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: 95 })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality: 95 })
      break
    case 'png':
    default:
      pipeline = pipeline.png({ compressionLevel: 6 })
      break
  }
  
  await pipeline.toFile(outputPath)
}

export async function writeImageFromBuffer(
  buffer: Buffer,
  outputPath: string,
  format: ImageFormat = 'png'
): Promise<void> {
  let pipeline = sharp(buffer)
  
  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality: 95 })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality: 95 })
      break
    case 'png':
    default:
      pipeline = pipeline.png({ compressionLevel: 6 })
      break
  }
  
  await pipeline.toFile(outputPath)
}

export async function getImageMetadata(imagePath: string): Promise<ImageMetadata> {
  const buffer = await readFile(imagePath)
  const metadata = await sharp(buffer).metadata()
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || 'unknown',
    size: buffer.length,
    hasAlpha: metadata.hasAlpha || false
  }
}

export async function convertImage(
  inputPath: string,
  outputPath: string,
  format: ImageFormat,
  options?: {
    width?: number
    height?: number
    quality?: number
  }
): Promise<void> {
  let pipeline = sharp(inputPath)
  
  if (options?.width || options?.height) {
    pipeline = pipeline.resize(options.width, options.height, {
      withoutEnlargement: true,
      fit: 'inside'
    })
  }
  
  const quality = options?.quality || 95
  
  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({ quality })
      break
    case 'webp':
      pipeline = pipeline.webp({ quality })
      break
    case 'png':
    default:
      pipeline = pipeline.png({ compressionLevel: 6 })
      break
  }
  
  await pipeline.toFile(outputPath)
}

export function getFormatFromPath(filePath: string): ImageFormat {
  const ext = extname(filePath).toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'jpeg'
    case '.webp':
      return 'webp'
    case '.png':
    default:
      return 'png'
  }
}
