export const SUPPORTED_INPUT_FORMATS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.tiff',
  '.tif'
] as const

export const SUPPORTED_OUTPUT_FORMATS = ['png', 'jpeg'] as const

export type InputFormat = typeof SUPPORTED_INPUT_FORMATS[number]
export type OutputFormat = typeof SUPPORTED_OUTPUT_FORMATS[number]

export function isSupported(extension: string): boolean {
  const ext = extension.toLowerCase()
  return SUPPORTED_INPUT_FORMATS.includes(ext as InputFormat)
}

export function getMimeType(extension: string): string {
  const ext = extension.toLowerCase()
  switch (ext) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.png':
      return 'image/png'
    case '.webp':
      return 'image/webp'
    case '.tiff':
    case '.tif':
      return 'image/tiff'
    default:
      return 'application/octet-stream'
  }
}

export function getExtensionForFormat(format: OutputFormat): string {
  switch (format) {
    case 'jpeg':
      return '.jpg'
    case 'png':
    default:
      return '.png'
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
