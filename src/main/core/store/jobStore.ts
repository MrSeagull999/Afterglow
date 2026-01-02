import { readFile, writeFile, mkdir, readdir, rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import type { Job, JobMetadata } from '../../../shared/types'

const JOBS_DIR = process.env.JOBS_DIR || './jobs'

function generateJobId(): string {
  const now = new Date()
  const timestamp = now.toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '-')
    .slice(0, 15)
  const random = Math.random().toString(36).slice(2, 8)
  return `job_${timestamp}_${random}`
}

async function ensureJobsDir(): Promise<void> {
  if (!existsSync(JOBS_DIR)) {
    await mkdir(JOBS_DIR, { recursive: true })
  }
}

async function getJobDir(jobId: string): Promise<string> {
  const jobDir = join(JOBS_DIR, jobId)
  if (!existsSync(jobDir)) {
    await mkdir(jobDir, { recursive: true })
    await mkdir(join(jobDir, 'scenes'), { recursive: true })
    await mkdir(join(jobDir, 'assets'), { recursive: true })
    await mkdir(join(jobDir, 'versions'), { recursive: true })
    await mkdir(join(jobDir, 'originals'), { recursive: true })
    await mkdir(join(jobDir, 'outputs'), { recursive: true })
  }
  return jobDir
}

export async function createJob(params: {
  name: string
  metadata?: JobMetadata
}): Promise<Job> {
  await ensureJobsDir()

  const jobId = generateJobId()
  const jobDir = await getJobDir(jobId)

  const job: Job = {
    id: jobId,
    name: params.name,
    metadata: params.metadata || {},
    sceneIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  await writeFile(join(jobDir, 'job.json'), JSON.stringify(job, null, 2))
  return job
}

export async function getJob(jobId: string): Promise<Job | null> {
  const jobPath = join(JOBS_DIR, jobId, 'job.json')
  if (!existsSync(jobPath)) {
    return null
  }
  const data = await readFile(jobPath, 'utf-8')
  return JSON.parse(data)
}

export async function updateJob(jobId: string, updates: Partial<Omit<Job, 'id' | 'createdAt'>>): Promise<Job | null> {
  const job = await getJob(jobId)
  if (!job) return null

  const updatedJob: Job = {
    ...job,
    ...updates,
    updatedAt: new Date().toISOString()
  }

  const jobPath = join(JOBS_DIR, jobId, 'job.json')
  await writeFile(jobPath, JSON.stringify(updatedJob, null, 2))
  return updatedJob
}

export async function deleteJob(jobId: string): Promise<boolean> {
  const jobDir = join(JOBS_DIR, jobId)
  if (!existsSync(jobDir)) {
    return false
  }
  await rm(jobDir, { recursive: true, force: true })
  return true
}

export async function listJobs(): Promise<Job[]> {
  await ensureJobsDir()

  const entries = await readdir(JOBS_DIR, { withFileTypes: true })
  const jobs: Job[] = []

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const job = await getJob(entry.name)
      if (job) {
        jobs.push(job)
      }
    }
  }

  return jobs.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function addSceneToJob(jobId: string, sceneId: string): Promise<Job | null> {
  const job = await getJob(jobId)
  if (!job) return null

  if (!job.sceneIds.includes(sceneId)) {
    job.sceneIds.push(sceneId)
    return updateJob(jobId, { sceneIds: job.sceneIds })
  }
  return job
}

export async function removeSceneFromJob(jobId: string, sceneId: string): Promise<Job | null> {
  const job = await getJob(jobId)
  if (!job) return null

  const index = job.sceneIds.indexOf(sceneId)
  if (index > -1) {
    job.sceneIds.splice(index, 1)
    return updateJob(jobId, { sceneIds: job.sceneIds })
  }
  return job
}

export function getJobDirectory(jobId: string): string {
  return join(JOBS_DIR, jobId)
}
