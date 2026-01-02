import { readdir, stat } from 'fs/promises'
import { join, extname, basename } from 'path'

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.tif']

export interface ScannedImage {
  path: string
  name: string
  extension: string
  size: number
  modifiedAt: Date
}

export async function scanDirectory(dirPath: string): Promise<ScannedImage[]> {
  const images: ScannedImage[] = []
  
  async function scan(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name)
      
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scan(fullPath)
        }
      } else if (entry.isFile()) {
        const ext = extname(entry.name).toLowerCase()
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          const stats = await stat(fullPath)
          images.push({
            path: fullPath,
            name: basename(entry.name, ext),
            extension: ext,
            size: stats.size,
            modifiedAt: stats.mtime
          })
        }
      }
    }
  }
  
  await scan(dirPath)
  return images.sort((a, b) => a.name.localeCompare(b.name))
}

export function getSupportedExtensions(): string[] {
  return [...SUPPORTED_EXTENSIONS]
}
