import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir, copyFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import type { ReferenceImage, ReferenceImageMetadata, ModuleType } from '../../../shared/types'
import { nanoid } from 'nanoid'

const REFERENCE_IMAGES_DIR = join(app.getPath('userData'), 'reference-images')

async function ensureReferenceDir(module: ModuleType): Promise<string> {
  const moduleDir = join(REFERENCE_IMAGES_DIR, module)
  if (!existsSync(moduleDir)) {
    await mkdir(moduleDir, { recursive: true })
  }
  return moduleDir
}

function getMetadataPath(module: ModuleType): string {
  return join(REFERENCE_IMAGES_DIR, module, 'references.json')
}

async function loadMetadata(module: ModuleType): Promise<ReferenceImageMetadata> {
  const metadataPath = getMetadataPath(module)
  
  if (!existsSync(metadataPath)) {
    return {
      module,
      references: []
    }
  }
  
  try {
    const data = await readFile(metadataPath, 'utf-8')
    return JSON.parse(data)
  } catch (error) {
    console.error(`Failed to load reference metadata for ${module}:`, error)
    return {
      module,
      references: []
    }
  }
}

async function saveMetadata(metadata: ReferenceImageMetadata): Promise<void> {
  await ensureReferenceDir(metadata.module)
  const metadataPath = getMetadataPath(metadata.module)
  await writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
}

export async function getReferenceImages(module: ModuleType): Promise<ReferenceImage[]> {
  const metadata = await loadMetadata(module)
  return metadata.references
}

export async function getReferenceImage(module: ModuleType, id: string): Promise<ReferenceImage | null> {
  const references = await getReferenceImages(module)
  return references.find(ref => ref.id === id) || null
}

export async function addReferenceImage(
  module: ModuleType,
  name: string,
  sourceImagePath: string,
  description?: string
): Promise<ReferenceImage> {
  const moduleDir = await ensureReferenceDir(module)
  const id = nanoid()
  const ext = sourceImagePath.split('.').pop() || 'jpg'
  const imagePath = join(moduleDir, `${id}.${ext}`)
  
  // Copy the image to the reference directory
  await copyFile(sourceImagePath, imagePath)
  
  const reference: ReferenceImage = {
    id,
    module,
    name,
    description,
    imagePath,
    createdAt: new Date().toISOString()
  }
  
  const metadata = await loadMetadata(module)
  metadata.references.push(reference)
  await saveMetadata(metadata)
  
  return reference
}

export async function deleteReferenceImage(module: ModuleType, id: string): Promise<void> {
  const metadata = await loadMetadata(module)
  const reference = metadata.references.find(ref => ref.id === id)
  
  if (!reference) {
    throw new Error(`Reference image not found: ${id}`)
  }
  
  // Delete the image file
  if (existsSync(reference.imagePath)) {
    await unlink(reference.imagePath)
  }
  
  // Delete thumbnail if it exists
  if (reference.thumbnailPath && existsSync(reference.thumbnailPath)) {
    await unlink(reference.thumbnailPath)
  }
  
  // Remove from metadata
  metadata.references = metadata.references.filter(ref => ref.id !== id)
  await saveMetadata(metadata)
}

export async function updateReferenceImage(
  module: ModuleType,
  id: string,
  updates: { name?: string; description?: string }
): Promise<ReferenceImage> {
  const metadata = await loadMetadata(module)
  const reference = metadata.references.find(ref => ref.id === id)
  
  if (!reference) {
    throw new Error(`Reference image not found: ${id}`)
  }
  
  if (updates.name !== undefined) {
    reference.name = updates.name
  }
  if (updates.description !== undefined) {
    reference.description = updates.description
  }
  
  await saveMetadata(metadata)
  return reference
}
