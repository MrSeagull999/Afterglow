import sharp from 'sharp'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { existsSync } from 'fs'

const THUMBNAIL_SIZE = 300
const THUMBNAIL_QUALITY = 80

export async function generateThumbnail(
  imagePath: string,
  outputPath?: string
): Promise<string> {
  const thumbPath = outputPath || getThumbnailPath(imagePath)
  
  const thumbDir = dirname(thumbPath)
  if (!existsSync(thumbDir)) {
    await mkdir(thumbDir, { recursive: true })
  }
  
  await sharp(imagePath)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toFile(thumbPath)
  
  return thumbPath
}

export async function generateThumbnailBase64(imagePath: string): Promise<string> {
  const buffer = await sharp(imagePath)
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
      fit: 'cover',
      position: 'center'
    })
    .jpeg({ quality: THUMBNAIL_QUALITY })
    .toBuffer()
  
  return `data:image/jpeg;base64,${buffer.toString('base64')}`
}

export function getThumbnailPath(imagePath: string): string {
  const dir = dirname(imagePath)
  const name = imagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'thumb'
  return join(dir, '.thumbs', `${name}_thumb.jpg`)
}

export async function getImageDimensions(imagePath: string): Promise<{
  width: number
  height: number
}> {
  const metadata = await sharp(imagePath).metadata()
  return {
    width: metadata.width || 0,
    height: metadata.height || 0
  }
}

export async function resizeImage(
  inputPath: string,
  outputPath: string,
  width: number,
  height?: number
): Promise<void> {
  await sharp(inputPath)
    .resize(width, height, { withoutEnlargement: true })
    .toFile(outputPath)
}

export async function resizeImageBuffer(
  inputBuffer: Buffer,
  width: number,
  height?: number
): Promise<Buffer> {
  return sharp(inputBuffer)
    .resize(width, height, { withoutEnlargement: true })
    .toBuffer()
}
