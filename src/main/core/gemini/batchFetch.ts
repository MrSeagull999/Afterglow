import { writeFile, mkdir } from 'fs/promises'
import { join, basename } from 'path'
import { existsSync } from 'fs'
import { getApiKey } from './geminiClient'
import { readJsonlFile, extractImageFromResponse, JsonlResponse } from './jsonl'
import { getRun, updateImageStatus, setImageFinalPath, updateRun } from '../runStore'
import { saveImageWithExifHandling } from '../exif'
import { getSettings } from '../settings'
import { pollBatch } from './batchPoll'

const RUNS_DIR = process.env.RUNS_DIR || './runs'

export interface FetchResult {
  success: boolean
  processedCount: number
  failedCount: number
  results: Array<{
    imagePath: string
    success: boolean
    finalPath?: string
    error?: string
  }>
  error?: string
}

export async function fetchBatchResults(
  runId: string,
  batchId: string,
  onProgress?: (imagePath: string, progress: number) => void
): Promise<FetchResult> {
  try {
    const run = await getRun(runId)
    if (!run) {
      return { success: false, processedCount: 0, failedCount: 0, results: [], error: `Run not found: ${runId}` }
    }
    
    const apiKey = getApiKey()
    if (!apiKey) {
      return { success: false, processedCount: 0, failedCount: 0, results: [], error: 'GEMINI_API_KEY not configured' }
    }
    
    const statusResult = await pollBatch(runId, batchId)
    if (!statusResult.success || statusResult.status.state !== 'SUCCEEDED') {
      return { 
        success: false, 
        processedCount: 0, 
        failedCount: 0, 
        results: [], 
        error: `Batch not ready: ${statusResult.status.state}` 
      }
    }
    
    const outputFileUri = statusResult.status.outputFileUri
    if (!outputFileUri) {
      return { success: false, processedCount: 0, failedCount: 0, results: [], error: 'No output file URI' }
    }
    
    const batchDir = join(RUNS_DIR, runId, 'batch')
    const outputJsonlPath = join(batchDir, 'output.jsonl')
    
    await downloadOutputFile(outputFileUri, outputJsonlPath, apiKey)
    
    const responses = await readJsonlFile(outputJsonlPath)
    const settings = await getSettings()
    const results: FetchResult['results'] = []
    let processedCount = 0
    let failedCount = 0
    
    for (let i = 0; i < responses.length; i++) {
      const response = responses[i]
      const customIdParts = response.customId.split('__')
      const originalFileName = customIdParts.slice(1).join('__')
      
      const imageEntry = run.images.find(img => basename(img.path) === originalFileName)
      if (!imageEntry) {
        console.warn(`Could not find image entry for: ${originalFileName}`)
        failedCount++
        results.push({
          imagePath: originalFileName,
          success: false,
          error: 'Image entry not found'
        })
        continue
      }
      
      onProgress?.(imageEntry.path, (i / responses.length) * 100)
      
      const extracted = extractImageFromResponse(response)
      
      if (!extracted.success || !extracted.imageData) {
        await updateImageStatus(runId, imageEntry.path, 'error', extracted.error)
        failedCount++
        results.push({
          imagePath: imageEntry.path,
          success: false,
          error: extracted.error
        })
        continue
      }
      
      const outputBuffer = Buffer.from(extracted.imageData, 'base64')
      const outputFormat = settings.outputFormat === 'jpeg' ? 'jpeg' : 'png'
      const ext = outputFormat === 'jpeg' ? '.jpg' : '.png'
      
      const finalFileName = `${basename(imageEntry.path, getExtension(imageEntry.path))}_afterglow${ext}`
      const finalPath = join(run.outputDir, finalFileName)
      
      if (!existsSync(run.outputDir)) {
        await mkdir(run.outputDir, { recursive: true })
      }
      
      await saveImageWithExifHandling(
        outputBuffer,
        finalPath,
        settings.keepExif,
        outputFormat
      )
      
      await setImageFinalPath(runId, imageEntry.path, finalPath)
      await updateImageStatus(runId, imageEntry.path, 'final_ready')
      
      processedCount++
      results.push({
        imagePath: imageEntry.path,
        success: true,
        finalPath
      })
      
      onProgress?.(imageEntry.path, 100)
    }
    
    await updateRun(runId, { mode: 'idle', batchStatus: 'completed' })
    
    return {
      success: true,
      processedCount,
      failedCount,
      results
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, processedCount: 0, failedCount: 0, results: [], error: message }
  }
}

async function downloadOutputFile(
  fileUri: string,
  outputPath: string,
  apiKey: string
): Promise<void> {
  const fileId = fileUri.split('/').pop()
  const url = `https://generativelanguage.googleapis.com/v1beta/files/${fileId}:download?key=${apiKey}&alt=media`
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' }
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to download output file: ${response.status} - ${errorText}`)
  }
  
  const content = await response.text()
  await writeFile(outputPath, content, 'utf-8')
}

function getExtension(filePath: string): string {
  const lastDot = filePath.lastIndexOf('.')
  return lastDot >= 0 ? filePath.slice(lastDot) : ''
}
