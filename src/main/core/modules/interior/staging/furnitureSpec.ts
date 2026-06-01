import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { FurnitureSpec } from '../../../../../shared/types'
import { getJobDirectory } from '../../../store/jobStore'

function generateFurnitureSpecId(): string {
  const random = Math.random().toString(36).slice(2, 10)
  return `fspec_${random}`
}

function getFurnitureSpecPath(jobId: string, specId: string): string {
  return join(getJobDirectory(jobId), 'furniture_specs', `${specId}.json`)
}

function getFurnitureSpecsDir(jobId: string): string {
  return join(getJobDirectory(jobId), 'furniture_specs')
}

export async function createFurnitureSpec(params: {
  jobId: string
  sceneId: string
  masterVersionId: string
  description: string
}): Promise<FurnitureSpec> {
  const specId = generateFurnitureSpecId()

  const spec: FurnitureSpec = {
    id: specId,
    sceneId: params.sceneId,
    masterVersionId: params.masterVersionId,
    description: params.description,
    createdAt: new Date().toISOString()
  }

  const specsDir = getFurnitureSpecsDir(params.jobId)
  if (!existsSync(specsDir)) {
    const { mkdir } = await import('fs/promises')
    await mkdir(specsDir, { recursive: true })
  }

  const specPath = getFurnitureSpecPath(params.jobId, specId)
  await writeFile(specPath, JSON.stringify(spec, null, 2))

  return spec
}

export async function getFurnitureSpec(jobId: string, specId: string): Promise<FurnitureSpec | null> {
  const specPath = getFurnitureSpecPath(jobId, specId)
  if (!existsSync(specPath)) {
    return null
  }
  const data = await readFile(specPath, 'utf-8')
  return JSON.parse(data)
}

export async function getFurnitureSpecForScene(jobId: string, sceneId: string): Promise<FurnitureSpec | null> {
  const specsDir = getFurnitureSpecsDir(jobId)
  if (!existsSync(specsDir)) {
    return null
  }

  const { readdir } = await import('fs/promises')
  const files = await readdir(specsDir)

  for (const file of files) {
    if (file.endsWith('.json')) {
      const specPath = join(specsDir, file)
      const data = await readFile(specPath, 'utf-8')
      const spec: FurnitureSpec = JSON.parse(data)
      if (spec.sceneId === sceneId) {
        return spec
      }
    }
  }

  return null
}

export async function updateFurnitureSpec(
  jobId: string,
  specId: string,
  description: string
): Promise<FurnitureSpec | null> {
  const spec = await getFurnitureSpec(jobId, specId)
  if (!spec) return null

  spec.description = description

  const specPath = getFurnitureSpecPath(jobId, specId)
  await writeFile(specPath, JSON.stringify(spec, null, 2))

  return spec
}

export async function deleteFurnitureSpec(jobId: string, specId: string): Promise<boolean> {
  const specPath = getFurnitureSpecPath(jobId, specId)
  if (!existsSync(specPath)) {
    return false
  }

  const { rm } = await import('fs/promises')
  await rm(specPath, { force: true })
  return true
}

export function buildFurnitureSpecDescription(items: FurnitureItem[]): string {
  return items.map(item => {
    let desc = `- ${item.name}`
    if (item.position) desc += ` (${item.position})`
    if (item.color) desc += `, ${item.color}`
    if (item.material) desc += `, ${item.material}`
    if (item.notes) desc += ` - ${item.notes}`
    return desc
  }).join('\n')
}

export interface FurnitureItem {
  name: string
  position?: string
  color?: string
  material?: string
  notes?: string
}
