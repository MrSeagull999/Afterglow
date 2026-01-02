import { readFile, writeFile } from 'fs/promises'
import { join, basename } from 'path'
import sharp from 'sharp'
import { getApiKey, generateSeed, ImageModel } from './geminiClient'
import { createJsonlRequest, writeJsonlFile, JsonlRequest } from './jsonl'
import { getRun, updateRun, getApprovedImages } from '../runStore'
import { getPreset } from '../promptBank'
import { getSettings } from '../settings'
import { assembleTwilightPrompt } from '../lightingModifiers'

const RUNS_DIR = process.env.RUNS_DIR || './runs'

export interface BatchSubmitResult {
  success: boolean
  batchId?: string
  jsonlPath?: string
  error?: string
  imageCount?: number
}

export async function submitBatch(
  runId: string,
  onProgress?: (progress: { stage: string; current: number; total: number }) => void
): Promise<BatchSubmitResult> {
  try {
    const run = await getRun(runId)
    if (!run) {
      return { success: false, error: `Run not found: ${runId}` }
    }
    
    const approved = await getApprovedImages(runId)
    if (approved.length === 0) {
      return { success: false, error: 'No approved images to process' }
    }
    
    const settings = await getSettings()
    const requests: JsonlRequest[] = []
    const finalModel = settings.finalModel as ImageModel
    
    console.log('[BatchSubmit] Using final model:', finalModel)
    console.log('[BatchSubmit] Seed settings - useSeed:', settings.useSeed, 'reusePreviewSeed:', settings.reusePreviewSeedForFinal)
    
    onProgress?.({ stage: 'Preparing images', current: 0, total: approved.length })
    
    for (let i = 0; i < approved.length; i++) {
      const img = approved[i]
      const preset = await getPreset(img.presetId)
      if (!preset) {
        console.warn(`Preset not found: ${img.presetId}, skipping ${img.path}`)
        continue
      }
      
      // Find the image entry to get preview seed
      const imageEntry = run.images.find(entry => entry.path === img.path)
      
      // Determine seed for final generation
      let finalSeed: number | null = null
      if (settings.useSeed) {
        if (settings.reusePreviewSeedForFinal && imageEntry?.previewSeed) {
          finalSeed = imageEntry.previewSeed
          console.log('[BatchSubmit] Reusing preview seed for', basename(img.path), ':', finalSeed)
        } else if (settings.seedStrategy === 'fixedPerRun' && settings.fixedRunSeed !== null) {
          finalSeed = settings.fixedRunSeed
        } else {
          finalSeed = generateSeed()
        }
      }
      
      const imageBuffer = await readFile(img.path)
      const targetWidth = settings.finalWidth || 4000
      
      const resizedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, null, { withoutEnlargement: true })
        .toBuffer()
      
      const base64Image = resizedBuffer.toString('base64')
      const mimeType = getMimeType(img.path)
      
      // Assemble prompt with lighting modifier
      const lightingCondition = run.lightingCondition || settings.defaultLightingCondition
      const finalPrompt = assembleTwilightPrompt(
        preset.promptTemplate,
        lightingCondition
      )
      
      const customId = `${runId}__${basename(img.path)}`
      const request = createJsonlRequest(
        customId,
        finalPrompt,
        base64Image,
        mimeType,
        finalModel,
        finalSeed
      )
      
      requests.push(request)
      onProgress?.({ stage: 'Preparing images', current: i + 1, total: approved.length })
    }
    
    if (requests.length === 0) {
      return { success: false, error: 'No valid images to process' }
    }
    
    const batchDir = join(RUNS_DIR, runId, 'batch')
    const jsonlPath = join(batchDir, 'input.jsonl')
    await writeJsonlFile(jsonlPath, requests)
    
    onProgress?.({ stage: 'Uploading batch', current: 0, total: 1 })
    
    const apiKey = getApiKey()
    if (!apiKey) {
      return { success: false, error: 'GEMINI_API_KEY not configured' }
    }
    
    const fileUploadResult = await uploadFileToGemini(jsonlPath, apiKey)
    if (!fileUploadResult.success) {
      return { success: false, error: fileUploadResult.error }
    }
    
    onProgress?.({ stage: 'Starting batch job', current: 0, total: 1 })
    
    const batchResult = await startBatchJob(fileUploadResult.fileUri!, apiKey)
    if (!batchResult.success) {
      return { success: false, error: batchResult.error }
    }
    
    await updateRun(runId, {
      batchId: batchResult.batchId,
      batchStatus: 'processing',
      mode: 'final'
    })
    
    const batchInfoPath = join(batchDir, 'batch_info.json')
    await writeFile(batchInfoPath, JSON.stringify({
      batchId: batchResult.batchId,
      fileUri: fileUploadResult.fileUri,
      submittedAt: new Date().toISOString(),
      imageCount: requests.length
    }, null, 2))
    
    onProgress?.({ stage: 'Batch submitted', current: 1, total: 1 })
    
    return {
      success: true,
      batchId: batchResult.batchId,
      jsonlPath,
      imageCount: requests.length
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

async function uploadFileToGemini(
  filePath: string,
  apiKey: string
): Promise<{ success: boolean; fileUri?: string; error?: string }> {
  try {
    const fileContent = await readFile(filePath)
    
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/jsonl',
        'X-Goog-Upload-Protocol': 'raw'
      },
      body: fileContent
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Upload failed: ${response.status} - ${errorText}` }
    }
    
    const data = await response.json()
    return { success: true, fileUri: data.file?.uri || data.uri }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

async function startBatchJob(
  fileUri: string,
  apiKey: string
): Promise<{ success: boolean; batchId?: string; error?: string }> {
  try {
    const batchUrl = `https://generativelanguage.googleapis.com/v1beta/batchJobs?key=${apiKey}`
    
    const response = await fetch(batchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputConfig: {
          requests: {
            fileUri
          }
        },
        outputConfig: {
          destination: {}
        }
      })
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Batch start failed: ${response.status} - ${errorText}` }
    }
    
    const data = await response.json()
    const batchId = data.name?.split('/').pop() || data.name
    return { success: true, batchId }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return { success: false, error: message }
  }
}

function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop()
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'png':
      return 'image/png'
    case 'webp':
      return 'image/webp'
    default:
      return 'image/jpeg'
  }
}
