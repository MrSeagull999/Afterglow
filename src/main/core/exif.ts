import sharp from 'sharp'
import { readFile, writeFile } from 'fs/promises'
import ExifReader from 'exifreader'

export interface ExifData {
  make?: string
  model?: string
  dateTime?: string
  exposureTime?: string
  fNumber?: string
  iso?: number
  focalLength?: string
  gpsLatitude?: number
  gpsLongitude?: number
  [key: string]: unknown
}

export async function readExif(imagePath: string): Promise<ExifData | null> {
  try {
    const buffer = await readFile(imagePath)
    const tags = ExifReader.load(buffer)
    
    return {
      make: tags.Make?.description,
      model: tags.Model?.description,
      dateTime: tags.DateTime?.description,
      exposureTime: tags.ExposureTime?.description,
      fNumber: tags.FNumber?.description,
      iso: tags.ISOSpeedRatings?.value as number | undefined,
      focalLength: tags.FocalLength?.description,
      gpsLatitude: tags.GPSLatitude?.description as number | undefined,
      gpsLongitude: tags.GPSLongitude?.description as number | undefined
    }
  } catch (error) {
    console.error('Failed to read EXIF:', error)
    return null
  }
}

export async function stripExif(inputPath: string, outputPath: string): Promise<void> {
  await sharp(inputPath)
    .withMetadata({ 
      exif: {},
      icc: undefined,
      iptc: undefined,
      xmp: undefined
    })
    .toFile(outputPath)
}

export async function copyWithoutExif(
  inputBuffer: Buffer, 
  outputPath: string,
  format: 'png' | 'jpeg' = 'png'
): Promise<void> {
  let pipeline = sharp(inputBuffer)
  
  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: 95 })
  } else {
    pipeline = pipeline.png({ compressionLevel: 6 })
  }
  
  await pipeline
    .withMetadata({
      exif: {},
      icc: undefined,
      iptc: undefined,
      xmp: undefined
    })
    .toFile(outputPath)
}

export async function saveImageWithExifHandling(
  inputBuffer: Buffer,
  outputPath: string,
  keepExif: boolean,
  format: 'png' | 'jpeg' = 'png'
): Promise<void> {
  let pipeline = sharp(inputBuffer)
  
  if (format === 'jpeg') {
    pipeline = pipeline.jpeg({ quality: 95 })
  } else {
    pipeline = pipeline.png({ compressionLevel: 6 })
  }
  
  if (!keepExif) {
    pipeline = pipeline.withMetadata({
      exif: {},
      icc: undefined,
      iptc: undefined,
      xmp: undefined
    })
  }
  
  await pipeline.toFile(outputPath)
}
