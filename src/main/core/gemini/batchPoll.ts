import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getApiKey } from './geminiClient'
import { getRun, updateRun } from '../runStore'
import { sleep } from '../utils'

const RUNS_DIR = process.env.RUNS_DIR || './runs'

export interface BatchStatus {
  state: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'UNKNOWN'
  progress?: number
  outputFileUri?: string
  error?: string
  completedAt?: string
}

export interface PollResult {
  success: boolean
  status: BatchStatus
  error?: string
}

export async function pollBatch(
  runId: string,
  batchId: string,
  onStatusChange?: (status: BatchStatus) => void
): Promise<PollResult> {
  const apiKey = getApiKey()
  if (!apiKey) {
    return { 
      success: false, 
      status: { state: 'UNKNOWN' },
      error: 'GEMINI_API_KEY not configured' 
    }
  }
  
  try {
    const status = await getBatchStatus(batchId, apiKey)
    onStatusChange?.(status)
    
    const batchDir = join(RUNS_DIR, runId, 'batch')
    const statusPath = join(batchDir, 'status.json')
    await writeFile(statusPath, JSON.stringify({
      ...status,
      checkedAt: new Date().toISOString()
    }, null, 2))
    
    if (status.state === 'SUCCEEDED') {
      await updateRun(runId, { batchStatus: 'completed' })
    } else if (status.state === 'FAILED' || status.state === 'CANCELLED') {
      await updateRun(runId, { batchStatus: 'failed' })
    }
    
    return { success: true, status }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { 
      success: false, 
      status: { state: 'UNKNOWN' },
      error: message 
    }
  }
}

export async function pollBatchUntilComplete(
  runId: string,
  batchId: string,
  onStatusChange?: (status: BatchStatus) => void,
  pollIntervalMs: number = 30000,
  maxAttempts: number = 120
): Promise<PollResult> {
  let attempts = 0
  
  while (attempts < maxAttempts) {
    const result = await pollBatch(runId, batchId, onStatusChange)
    
    if (!result.success) {
      return result
    }
    
    if (result.status.state === 'SUCCEEDED' || 
        result.status.state === 'FAILED' || 
        result.status.state === 'CANCELLED') {
      return result
    }
    
    attempts++
    await sleep(pollIntervalMs)
  }
  
  return {
    success: false,
    status: { state: 'UNKNOWN' },
    error: 'Polling timeout exceeded'
  }
}

async function getBatchStatus(batchId: string, apiKey: string): Promise<BatchStatus> {
  const url = `https://generativelanguage.googleapis.com/v1beta/batchJobs/${batchId}?key=${apiKey}`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to get batch status: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  
  let state: BatchStatus['state'] = 'UNKNOWN'
  if (data.state) {
    state = data.state as BatchStatus['state']
  } else if (data.metadata?.state) {
    state = data.metadata.state as BatchStatus['state']
  }
  
  return {
    state,
    progress: data.metadata?.progress || data.progress,
    outputFileUri: data.outputConfig?.destination?.fileUri || data.outputUri,
    completedAt: data.metadata?.endTime || data.endTime,
    error: data.error?.message
  }
}

export async function getStoredBatchInfo(runId: string): Promise<{
  batchId?: string
  fileUri?: string
  submittedAt?: string
  imageCount?: number
} | null> {
  const batchInfoPath = join(RUNS_DIR, runId, 'batch', 'batch_info.json')
  
  if (!existsSync(batchInfoPath)) {
    return null
  }
  
  const content = await readFile(batchInfoPath, 'utf-8')
  return JSON.parse(content)
}
