import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { mkdir, readdir, rename, cp } from 'fs/promises'

// Base path for all job data - stored in userData, outside the git repo
let USER_DATA_PATH: string | null = null

export function getDataBasePath(): string {
  if (!USER_DATA_PATH) {
    // app.getPath('userData') returns:
    // - macOS: ~/Library/Application Support/Afterglow
    // - Windows: %APPDATA%/Afterglow
    // - Linux: ~/.config/Afterglow
    USER_DATA_PATH = app.getPath('userData')
  }
  return USER_DATA_PATH
}

export function getJobsBasePath(): string {
  return join(getDataBasePath(), 'jobs')
}

export function getJobPath(jobId: string): string {
  return join(getJobsBasePath(), jobId)
}

export function getJobAssetsPath(jobId: string): string {
  return join(getJobPath(jobId), 'assets')
}

export function getJobScenesPath(jobId: string): string {
  return join(getJobPath(jobId), 'scenes')
}

export function getJobVersionsPath(jobId: string): string {
  return join(getJobPath(jobId), 'versions')
}

export function getJobOriginalsPath(jobId: string): string {
  return join(getJobPath(jobId), 'originals')
}

export function getJobOutputsPath(jobId: string): string {
  return join(getJobPath(jobId), 'outputs')
}

export function getJobPreviewsPath(jobId: string): string {
  return join(getJobOutputsPath(jobId), 'previews')
}

export function getJobThumbnailsPath(jobId: string): string {
  return join(getJobOutputsPath(jobId), 'thumbnails')
}

export function getJobFinalsPath(jobId: string): string {
  return join(getJobOutputsPath(jobId), 'finals')
}

// Legacy path detection (inside the project repo)
const LEGACY_JOBS_DIR = './jobs'

export function getLegacyJobsPath(): string {
  return LEGACY_JOBS_DIR
}

export function hasLegacyJobs(): boolean {
  return existsSync(LEGACY_JOBS_DIR)
}

export async function listLegacyJobIds(): Promise<string[]> {
  if (!hasLegacyJobs()) return []
  
  try {
    const entries = await readdir(LEGACY_JOBS_DIR, { withFileTypes: true })
    return entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('job_'))
      .map(entry => entry.name)
  } catch {
    return []
  }
}

// Migration: move legacy jobs to userData
export async function migrateJobsToUserData(): Promise<{ migrated: string[]; errors: string[] }> {
  const migrated: string[] = []
  const errors: string[] = []
  
  const legacyJobIds = await listLegacyJobIds()
  if (legacyJobIds.length === 0) {
    return { migrated, errors }
  }
  
  // Ensure new jobs directory exists
  const newJobsPath = getJobsBasePath()
  if (!existsSync(newJobsPath)) {
    await mkdir(newJobsPath, { recursive: true })
  }
  
  for (const jobId of legacyJobIds) {
    const legacyPath = join(LEGACY_JOBS_DIR, jobId)
    const newPath = getJobPath(jobId)
    
    // Skip if already exists in new location
    if (existsSync(newPath)) {
      console.log(`[Migration] Job ${jobId} already exists in new location, skipping`)
      continue
    }
    
    try {
      // Copy instead of move to be safe - user can delete legacy folder manually
      await cp(legacyPath, newPath, { recursive: true })
      migrated.push(jobId)
      console.log(`[Migration] Migrated job ${jobId} to ${newPath}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      errors.push(`${jobId}: ${message}`)
      console.error(`[Migration] Failed to migrate job ${jobId}:`, error)
    }
  }
  
  return { migrated, errors }
}

// Ensure job directory structure exists
export async function ensureJobDirectories(jobId: string): Promise<string> {
  const jobDir = getJobPath(jobId)
  
  if (!existsSync(jobDir)) {
    await mkdir(jobDir, { recursive: true })
    await mkdir(getJobScenesPath(jobId), { recursive: true })
    await mkdir(getJobAssetsPath(jobId), { recursive: true })
    await mkdir(getJobVersionsPath(jobId), { recursive: true })
    await mkdir(getJobOriginalsPath(jobId), { recursive: true })
    await mkdir(getJobOutputsPath(jobId), { recursive: true })
    await mkdir(getJobPreviewsPath(jobId), { recursive: true })
    await mkdir(getJobThumbnailsPath(jobId), { recursive: true })
    await mkdir(getJobFinalsPath(jobId), { recursive: true })
  }
  
  return jobDir
}

// Ensure base jobs directory exists
export async function ensureJobsBasePath(): Promise<void> {
  const jobsPath = getJobsBasePath()
  if (!existsSync(jobsPath)) {
    await mkdir(jobsPath, { recursive: true })
  }
}
