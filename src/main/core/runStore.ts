import { readFile, writeFile, mkdir, readdir } from 'fs/promises'
import { join, basename } from 'path'
import { existsSync } from 'fs'

const RUNS_DIR = process.env.RUNS_DIR || './runs'

export type ImageStatus = 
  | 'pending'
  | 'preview_generating'
  | 'preview_ready'
  | 'approved'
  | 'rejected'
  | 'final_generating'
  | 'final_ready'
  | 'error'

export interface ImageEntry {
  path: string
  name: string
  status: ImageStatus
  presetId: string
  previewPath?: string
  finalPath?: string
  thumbnailPath?: string
  error?: string
  previewGeneratedAt?: string
  finalGeneratedAt?: string
  previewSeed?: number | null
  finalSeed?: number | null
  previewModel?: string
  finalModel?: string
}

export interface Run {
  id: string
  inputDir: string
  listingName: string
  outputDir: string
  defaultPresetId: string
  images: ImageEntry[]
  mode: 'preview' | 'final' | 'idle'
  createdAt: string
  updatedAt: string
  batchId?: string
  batchStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  previewModel?: string
  finalModel?: string
  useSeed?: boolean
  reusePreviewSeedForFinal?: boolean
  seedStrategy?: 'randomPerImage' | 'fixedPerRun'
  fixedRunSeed?: number | null
  seedSupported?: boolean | 'unknown'
  lightingCondition?: 'overcast' | 'sunny'
}

export interface ApprovedImage {
  path: string
  presetId: string
  previewSeed?: number | null
  previewModel?: string
  finalSeed?: number | null
}

function generateRunId(listingName: string, mode: string): string {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15)
  const safeName = listingName.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
  return `${timestamp}_${safeName}_${mode}`
}

async function ensureRunsDir(): Promise<void> {
  if (!existsSync(RUNS_DIR)) {
    await mkdir(RUNS_DIR, { recursive: true })
  }
}

async function getRunDir(runId: string): Promise<string> {
  const runDir = join(RUNS_DIR, runId)
  if (!existsSync(runDir)) {
    await mkdir(runDir, { recursive: true })
    await mkdir(join(runDir, 'preview'), { recursive: true })
    await mkdir(join(runDir, 'batch'), { recursive: true })
  }
  return runDir
}

export async function createRun(params: {
  inputDir: string
  listingName: string
  images: ImageEntry[]
  defaultPresetId: string
}): Promise<Run> {
  await ensureRunsDir()
  
  const runId = generateRunId(params.listingName, 'preview')
  const runDir = await getRunDir(runId)
  const outputDir = process.env.OUTPUT_DIR || './afterglow-output'
  const listingOutputDir = join(outputDir, params.listingName)
  
  if (!existsSync(listingOutputDir)) {
    await mkdir(listingOutputDir, { recursive: true })
    await mkdir(join(listingOutputDir, '_previews'), { recursive: true })
  }
  
  const run: Run = {
    id: runId,
    inputDir: params.inputDir,
    listingName: params.listingName,
    outputDir: listingOutputDir,
    defaultPresetId: params.defaultPresetId,
    images: params.images.map(img => ({
      ...img,
      status: 'pending' as ImageStatus,
      presetId: img.presetId || params.defaultPresetId
    })),
    mode: 'idle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
  
  await writeFile(join(runDir, 'run.json'), JSON.stringify(run, null, 2))
  return run
}

export async function getRun(runId: string): Promise<Run | null> {
  const runPath = join(RUNS_DIR, runId, 'run.json')
  if (!existsSync(runPath)) {
    return null
  }
  const data = await readFile(runPath, 'utf-8')
  return JSON.parse(data)
}

export async function updateRun(runId: string, updates: Partial<Run>): Promise<Run | null> {
  const run = await getRun(runId)
  if (!run) return null
  
  const updatedRun: Run = {
    ...run,
    ...updates,
    updatedAt: new Date().toISOString()
  }
  
  const runPath = join(RUNS_DIR, runId, 'run.json')
  await writeFile(runPath, JSON.stringify(updatedRun, null, 2))
  return updatedRun
}

export async function listRuns(): Promise<Run[]> {
  await ensureRunsDir()
  
  const entries = await readdir(RUNS_DIR, { withFileTypes: true })
  const runs: Run[] = []
  
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const run = await getRun(entry.name)
      if (run) {
        runs.push(run)
      }
    }
  }
  
  return runs.sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function approveImages(
  runId: string, 
  imagePaths: string[], 
  presetOverrides?: Record<string, string>
): Promise<void> {
  const run = await getRun(runId)
  if (!run) throw new Error(`Run not found: ${runId}`)
  
  const approved: ApprovedImage[] = imagePaths.map(path => ({
    path,
    presetId: presetOverrides?.[path] || 
      run.images.find(img => img.path === path)?.presetId || 
      run.defaultPresetId
  }))
  
  const approvedPath = join(RUNS_DIR, runId, 'approved.json')
  await writeFile(approvedPath, JSON.stringify(approved, null, 2))
  
  const updatedImages = run.images.map(img => ({
    ...img,
    status: imagePaths.includes(img.path) ? 'approved' as ImageStatus : 
            img.status === 'approved' ? 'preview_ready' as ImageStatus : img.status,
    presetId: presetOverrides?.[img.path] || img.presetId
  }))
  
  await updateRun(runId, { images: updatedImages })
}

export async function getApprovedImages(runId: string): Promise<ApprovedImage[]> {
  const approvedPath = join(RUNS_DIR, runId, 'approved.json')
  if (!existsSync(approvedPath)) {
    return []
  }
  const data = await readFile(approvedPath, 'utf-8')
  return JSON.parse(data)
}

export async function updateImageStatus(
  runId: string, 
  imagePath: string, 
  status: ImageStatus,
  error?: string
): Promise<void> {
  const run = await getRun(runId)
  if (!run) throw new Error(`Run not found: ${runId}`)
  
  const updatedImages = run.images.map(img => {
    if (img.path === imagePath) {
      return { 
        ...img, 
        status,
        error: error || undefined,
        ...(status === 'preview_ready' ? { previewGeneratedAt: new Date().toISOString() } : {}),
        ...(status === 'final_ready' ? { finalGeneratedAt: new Date().toISOString() } : {})
      }
    }
    return img
  })
  
  await updateRun(runId, { images: updatedImages })
}

export async function setImagePreviewPath(
  runId: string,
  imagePath: string,
  previewPath: string
): Promise<void> {
  const run = await getRun(runId)
  if (!run) throw new Error(`Run not found: ${runId}`)
  
  const updatedImages = run.images.map(img => {
    if (img.path === imagePath) {
      return { ...img, previewPath }
    }
    return img
  })
  
  await updateRun(runId, { images: updatedImages })
}

export async function setImageFinalPath(
  runId: string,
  imagePath: string,
  finalPath: string
): Promise<void> {
  const run = await getRun(runId)
  if (!run) throw new Error(`Run not found: ${runId}`)
  
  const updatedImages = run.images.map(img => {
    if (img.path === imagePath) {
      return { ...img, finalPath }
    }
    return img
  })
  
  await updateRun(runId, { images: updatedImages })
}

export async function writeSummaryCSV(runId: string): Promise<string> {
  const run = await getRun(runId)
  if (!run) throw new Error(`Run not found: ${runId}`)
  
  const headers = ['filename', 'status', 'preset', 'preview_path', 'preview_seed', 'final_path', 'final_seed', 'error']
  const rows = run.images.map(img => [
    basename(img.path),
    img.status,
    img.presetId,
    img.previewPath || '',
    img.previewSeed?.toString() || '',
    img.finalPath || '',
    img.finalSeed?.toString() || '',
    img.error || ''
  ])
  
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const csvPath = join(RUNS_DIR, runId, 'summary.csv')
  await writeFile(csvPath, csv)
  return csvPath
}
