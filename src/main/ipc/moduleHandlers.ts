import { ipcMain, BrowserWindow } from 'electron'
import { loadInjectorsForModule, reloadInjectors } from '../core/modules/shared/injectorRegistry'
import { getGuardrailsForModule, ARCHITECTURAL_GUARDRAILS, buildGuardrailPrompt } from '../core/modules/shared/guardrails'
import { generateVersionPreview, generateVersionHQPreview, generateVersionFinal, generateVersionNative4K } from '../core/modules/shared/generateService'
import type { ModuleType } from '../../shared/types'
import { generationLogger } from '../core/services/generation/generationLogger'
import { estimateExtendedCost, getCostPerImage } from '../core/costEstimate'
import { getSettings } from '../core/settings'
import { getResolvedProviderConfig } from '../../shared/services/provider/resolvedProviderConfig'
import { getPresets, getPreset, getRelightPreset } from '../core/promptBank'
import { createFinalFromApprovedVersion, createNative4KFromApprovedVersion, updateVersion } from '../core/store/versionStore'
import { setWorkingSource } from '../core/store/assetStore'

import {
  generateCleanSlatePreview,
  CleanSlateParams
} from '../core/modules/interior/cleanSlate/cleanSlateModule'

import {
  generateStagingPreview,
  generateSecondaryAnglePreview,
  StagingParams,
  MultiAngleStagingParams
} from '../core/modules/interior/staging/stagingModule'

import {
  generateRenovatePreview,
  RenovateParams
} from '../core/modules/interior/renovate/renovateModule'

import {
  generateTwilightPreview,
  TwilightParams
} from '../core/modules/twilight/twilightModule'

import {
  generateRelightPreview,
  RelightParams
} from '../core/modules/relight/relightModule'

import {
  generateFreeformPreview,
  FreeformParams
} from '../core/modules/freeform/freeformModule'

import {
  generateImageFromPrompt,
  ImageGenParams
} from '../core/modules/imagegen/imagegenService'

import {
  generateSkyImage,
  SkyParams
} from '../core/modules/sky/skyModule'

import {
  createSkyChatSession,
  sendSkyChatMessage,
  clearSkyChatSession
} from '../core/modules/sky/skyChatService'

import {
  createImageGenChatSession,
  sendImageGenChatMessage,
  getImageGenChatSession,
  getImageGenChatReferenceImages,
  clearImageGenChatSession
} from '../core/modules/imagegen/imagegenChatService'

import {
  createChatSession,
  sendChatMessage,
  getChatSession,
  clearChatSession,
  getChatReferenceImagesForAsset,
  ChatImageAttachment
} from '../core/services/chat/chatService'

import { analyzeBatch, analyzeReferenceImage, interpretUserFeedback } from '../core/services/batch/batchAnalysisService'
import { runAgentBatch, stopAgentBatch } from '../core/services/batch/agentBatchService'
import { buildStyleTransferPrompt, buildCorrectivePrompt, ANCHOR_ROLE } from '../core/services/batch/promptBuilders'
import { getJobDirectory } from '../core/store/jobStore'

import {
  createFurnitureSpec,
  getFurnitureSpec,
  getFurnitureSpecForScene,
  updateFurnitureSpec,
  deleteFurnitureSpec
} from '../core/modules/interior/staging/furnitureSpec'

import { ROOM_TYPES, STAGING_STYLES } from '../core/modules/interior/staging/stagingPrompts'
import { FLOOR_MATERIALS, FLOOR_COLORS, WALL_COLORS, CURTAIN_STYLES } from '../core/modules/interior/renovate/renovatePrompts'

function sendProgress(versionId: string, progress: number) {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach(win => {
    win.webContents.send('version:progress', { versionId, progress })
  })
}

export function registerModuleHandlers(): void {
  // Injector handlers
  ipcMain.handle('injectors:getForModule', async (_event, module: ModuleType) => {
    return loadInjectorsForModule(module)
  })

  ipcMain.handle('injectors:reload', async (_event, module: ModuleType) => {
    return reloadInjectors(module)
  })

  // Guardrail handlers
  ipcMain.handle('guardrails:getForModule', async (_event, module: ModuleType) => {
    return getGuardrailsForModule(module)
  })

  ipcMain.handle('guardrails:getAll', async () => {
    return ARCHITECTURAL_GUARDRAILS
  })

  // Clean Slate module
  ipcMain.handle('module:cleanSlate:generatePreview', async (_event, params: CleanSlateParams) => {
    const version = await generateCleanSlatePreview(params)
    // Start actual generation in background
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[CleanSlate] Generation error:', err))
    return version
  })

  // Staging module
  ipcMain.handle('module:staging:generatePreview', async (_event, params: StagingParams) => {
    const version = await generateStagingPreview(params)
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Staging] Generation error:', err))
    return version
  })

  ipcMain.handle('module:staging:generateSecondaryAngle', async (_event, params: MultiAngleStagingParams) => {
    const version = await generateSecondaryAnglePreview(params)
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Staging] Secondary angle error:', err))
    return version
  })

  // Renovate module
  ipcMain.handle('module:renovate:generatePreview', async (_event, params: RenovateParams) => {
    const version = await generateRenovatePreview(params)
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Renovate] Generation error:', err))
    return version
  })

  // Twilight module
  ipcMain.handle('module:twilight:generatePreview', async (_event, params: TwilightParams) => {
    const version = await generateTwilightPreview(params)
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Twilight] Generation error:', err))
    return version
  })

  // ReLight module
  ipcMain.handle('module:relight:generatePreview', async (_event, params: RelightParams) => {
    const version = await generateRelightPreview(params)
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[ReLight] Generation error:', err))
    return version
  })

  // Freeform module
  ipcMain.handle('module:freeform:generatePreview', async (_event, params: FreeformParams) => {
    const referenceImagePaths = getChatReferenceImagesForAsset(params.assetId)
    const version = await generateFreeformPreview({ ...params, referenceImagePaths })
    generateVersionPreview(params.jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Freeform] Generation error:', err))
    return version
  })

  // Image Gen module (text-to-image, no source photo needed)
  ipcMain.handle('module:imagegen:generate', async (_event, params: ImageGenParams) => {
    return generateImageFromPrompt(params)
  })

  // Sky module (standalone sky image generation, no source photo needed)
  ipcMain.handle('module:sky:generate', async (_event, params: SkyParams) => {
    return generateSkyImage(params)
  })

  // Sky chat (natural language sky description → generation prompt)
  ipcMain.handle('sky:chat:start', async () => {
    return createSkyChatSession()
  })

  ipcMain.handle('sky:chat:sendMessage', async (_event, sessionId: string, message: string) => {
    return sendSkyChatMessage(sessionId, message)
  })

  ipcMain.handle('sky:chat:clear', async (_event, sessionId: string) => {
    clearSkyChatSession(sessionId)
    return { success: true }
  })

  // Image Gen chat (for composing from reference images)
  ipcMain.handle('imagegen:chat:start', async () => {
    return createImageGenChatSession()
  })

  ipcMain.handle('imagegen:chat:sendMessage', async (
    _event,
    sessionId: string,
    message: string,
    attachedImages?: Array<{ base64: string; mimeType: string; name?: string }>
  ) => {
    return sendImageGenChatMessage(sessionId, message, attachedImages)
  })

  ipcMain.handle('imagegen:chat:getSession', async (_event, sessionId: string) => {
    return getImageGenChatSession(sessionId)
  })

  ipcMain.handle('imagegen:chat:getReferenceImages', async (_event, sessionId: string) => {
    return getImageGenChatReferenceImages(sessionId)
  })

  ipcMain.handle('imagegen:chat:clear', async (_event, sessionId: string) => {
    clearImageGenChatSession(sessionId)
    return { success: true }
  })

  // Chat handlers for freeform module
  ipcMain.handle('chat:startSession', async (_event, jobId: string, assetId: string) => {
    return createChatSession(jobId, assetId)
  })

  ipcMain.handle('chat:sendMessage', async (_event, sessionId: string, userMessage: string, referenceImages?: ChatImageAttachment[]) => {
    return sendChatMessage(sessionId, userMessage, referenceImages)
  })

  ipcMain.handle('chat:getSession', async (_event, sessionId: string) => {
    return getChatSession(sessionId)
  })

  ipcMain.handle('chat:clearSession', async (_event, sessionId: string) => {
    clearChatSession(sessionId)
    return { success: true }
  })

  // Generate HQ Preview for approved versions (for chaining)
  ipcMain.handle('version:generateHQPreview', async (_event, jobId: string, versionId: string) => {
    generateVersionHQPreview(jobId, versionId, (progress) => {
      sendProgress(versionId, progress)
    }).catch(err => console.error('[HQ Preview] Generation error:', err))
    return { started: true }
  })

  // Generate final for any module
  ipcMain.handle('version:generateFinal', async (_event, ...args: any[]) => {
    const jobId = typeof args[0] === 'string' ? (args[0] as string) : (args[0]?.jobId as string)
    const approvedVersionId = typeof args[0] === 'string' ? (args[1] as string) : (args[0]?.versionId as string)

    const version = await createFinalFromApprovedVersion({
      jobId,
      approvedVersionId
    })

    generateVersionFinal(jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Final] Generation error:', err))

    return version
  })

  // Generate Native 4K version from approved version
  ipcMain.handle('version:generateNative4K', async (_event, jobId: string, approvedVersionId: string) => {
    const version = await createNative4KFromApprovedVersion({
      jobId,
      approvedVersionId
    })

    generateVersionNative4K(jobId, version.id, (progress) => {
      sendProgress(version.id, progress)
    }).catch(err => console.error('[Native 4K] Generation error:', err))

    return version
  })

  // Furniture Spec handlers
  ipcMain.handle('furnitureSpec:create', async (_event, params: {
    jobId: string
    sceneId: string
    masterVersionId: string
    description: string
  }) => {
    return createFurnitureSpec(params)
  })

  ipcMain.handle('furnitureSpec:get', async (_event, jobId: string, specId: string) => {
    return getFurnitureSpec(jobId, specId)
  })

  ipcMain.handle('furnitureSpec:getForScene', async (_event, jobId: string, sceneId: string) => {
    return getFurnitureSpecForScene(jobId, sceneId)
  })

  ipcMain.handle('furnitureSpec:update', async (_event, jobId: string, specId: string, description: string) => {
    return updateFurnitureSpec(jobId, specId, description)
  })

  ipcMain.handle('furnitureSpec:delete', async (_event, jobId: string, specId: string) => {
    return deleteFurnitureSpec(jobId, specId)
  })

  // ─────────────────────────────────────────────────────────────
  // BATCH GENERATION HANDLERS (for grid-first workflow)
  // ─────────────────────────────────────────────────────────────

  // Batch Clean Slate generation
  ipcMain.handle('module:clean:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetIds, sourceVersionIdByAssetId, injectorIds, guardrailIds } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    for (const assetId of assetIds) {
      try {
        const version = await generateCleanSlatePreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })
        
        // Start generation in background
        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[CleanSlate Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Batch Staging generation
  ipcMain.handle('module:stage:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    roomType?: string
    style?: string
    roomDimensions?: { enabled: boolean; width: string; length: string; unit: 'feet' | 'meters'; backWall?: string; leftWall?: string; rightWall?: string; ceilingHeight?: string }
    sourceVersionId?: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetIds, roomType, style, roomDimensions, sourceVersionId, sourceVersionIdByAssetId, injectorIds, guardrailIds } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    for (const assetId of assetIds) {
      try {
        // Use provided sourceVersionId or default to original image
        const source = sourceVersionIdByAssetId?.[assetId] || sourceVersionId || `original:${assetId}`
        
        const version = await generateStagingPreview({
          jobId,
          assetId,
          sourceVersionId: source,
          roomType: roomType || 'living room',
          style: style || 'modern contemporary',
          roomDimensions,
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })
        
        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Staging Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Batch Renovate generation
  ipcMain.handle('module:renovate:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    changes?: any
    sourceVersionId?: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetIds, changes, sourceVersionId, sourceVersionIdByAssetId, injectorIds, guardrailIds } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    for (const assetId of assetIds) {
      try {
        // Use provided sourceVersionId or default to original image
        const source = sourceVersionIdByAssetId?.[assetId] || sourceVersionId || `original:${assetId}`
        
        const version = await generateRenovatePreview({
          jobId,
          assetId,
          sourceVersionId: source,
          changes: changes || { floor: { enabled: false, material: 'hardwood' } },
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })
        
        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Renovate Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Batch Twilight generation
  ipcMain.handle('module:twilight:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    presetId?: string
    promptTemplate?: string
    lightingCondition?: 'overcast' | 'sunny'
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    customInstructions?: string
    referenceImagePath?: string
  }) => {
    const {
      jobId,
      assetIds,
      presetId,
      promptTemplate,
      lightingCondition,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds,
      customInstructions,
      referenceImagePath
    } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    const effectivePresetId = presetId || 'twilight_exterior_classic'
    const preset = await getPreset(effectivePresetId)
    const template = promptTemplate || preset?.promptTemplate || ''

    if (!template || template.trim().length === 0) {
      throw new Error(`Twilight batchGenerate missing promptTemplate and preset not found/empty: ${effectivePresetId}`)
    }

    for (const assetId of assetIds) {
      try {
        const version = await generateTwilightPreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          presetId: effectivePresetId,
          promptTemplate: template,
          lightingCondition: lightingCondition || 'overcast',
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || '',
          referenceImagePath
        })
        
        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Twilight Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Batch ReLight generation
  ipcMain.handle('module:relight:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    presetId?: string
    promptTemplate?: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    customInstructions?: string
    referenceImagePath?: string
  }) => {
    const {
      jobId,
      assetIds,
      presetId,
      promptTemplate,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds,
      customInstructions,
      referenceImagePath
    } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    const effectivePresetId = presetId || 'relight_blue_hour'
    const preset = await getRelightPreset(effectivePresetId)
    const template = promptTemplate || preset?.promptTemplate || ''

    if (!template || template.trim().length === 0) {
      throw new Error(`ReLight batchGenerate missing promptTemplate and preset not found/empty: ${effectivePresetId}`)
    }

    for (const assetId of assetIds) {
      try {
        const version = await generateRelightPreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          presetId: effectivePresetId,
          promptTemplate: template,
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || '',
          referenceImagePath
        })
        
        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[ReLight Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Batch Freeform generation
  ipcMain.handle('module:freeform:batchGenerate', async (_event, params: {
    jobId: string
    assetIds: string[]
    craftedPrompt: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    customInstructions?: string
    seed?: number | null
  }) => {
    const {
      jobId,
      assetIds,
      craftedPrompt,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds,
      customInstructions,
      seed
    } = params

    const results: Array<{ assetId: string; versionId?: string; error?: string }> = []

    for (const assetId of assetIds) {
      try {
        const sourceVersionId = sourceVersionIdByAssetId?.[assetId]
        const referenceImagePaths = getChatReferenceImagesForAsset(assetId)
        const version = await generateFreeformPreview({
          jobId,
          assetId,
          craftedPrompt,
          sourceVersionId,
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || '',
          seed,
          referenceImagePaths
        })

        generateVersionPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Freeform Batch] Generation error:', err))

        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Batch freeform: AI analysis of all images to produce consistency brief + per-image prompts
  ipcMain.handle('module:freeform:batchAnalyze', async (_event, params: {
    jobId: string
    assetIds: string[]
    instruction: string
    referenceVisualBrief?: string
  }) => {
    return analyzeBatch(params)
  })

  // Analyze a reference image and extract a concrete visual brief for consistency enforcement
  ipcMain.handle('module:freeform:analyzeReferenceImage', async (_event, imagePath: string) => {
    return analyzeReferenceImage(imagePath)
  })

  // Agent batch: run sequential anchor-based generation with evaluation + corrective refinement
  ipcMain.handle('module:freeform:runAgentBatch', async (_event, params: {
    batchId: string
    jobId: string
    assetIds: string[]
    anchorImagePath: string
    promptByAssetId: Record<string, string>
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    referenceBrief?: string
    maxRefinements?: number
    referenceMatchThreshold?: number
  }) => {
    console.log(`[AgentBatch] Starting batch ${params.batchId} — ${params.assetIds.length} assets, anchor: ${params.anchorImagePath}`)
    // Fire-and-forget: returns immediately, status events come via agentBatch:status channel
    runAgentBatch(params).catch(err =>
      console.error('[AgentBatch] Unhandled error:', err)
    )
    return { started: true }
  })

  // Agent batch: stop after current asset completes
  ipcMain.handle('module:freeform:stopAgentBatch', async (_event, batchId: string) => {
    stopAgentBatch(batchId)
    return { ok: true }
  })

  // Anchor pilot: generate a 4K image for anchor selection (no reference — this IS the anchor)
  ipcMain.handle('module:freeform:anchorPilot', async (_event, params: {
    jobId: string
    assetId: string
    prompt: string
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetId, prompt, injectorIds, guardrailIds } = params
    console.log(`[AnchorPilot] Starting 4K pilot: job=${jobId} asset=${assetId} promptLen=${prompt?.length ?? 0}`)
    if (!prompt?.trim()) {
      console.error('[AnchorPilot] Empty prompt — cannot generate')
      throw new Error('Prompt is required for anchor pilot generation')
    }
    try {
      const referenceImagePaths = getChatReferenceImagesForAsset(assetId)
      const version = await generateFreeformPreview({
        jobId,
        assetId,
        craftedPrompt: prompt,
        injectorIds: injectorIds || [],
        customGuardrails: guardrailIds || [],
        referenceImagePaths
      })
      // Upgrade to native_4k immediately so the pilot is full quality
      const upgraded = await updateVersion(jobId, version.id, { qualityTier: 'native_4k' })
      if (!upgraded) throw new Error('Failed to upgrade pilot to 4K')
      console.log(`[AnchorPilot] Version created: ${upgraded.id} — starting 4K generation...`)
      // Native 4K — fire-and-forget, progress events come via version:progress
      generateVersionNative4K(jobId, upgraded.id, (progress) => {
        sendProgress(upgraded.id, progress)
      }).catch(err => console.error('[AnchorPilot] 4K generation error:', err))
      return { versionId: upgraded.id }
    } catch (err) {
      console.error('[AnchorPilot] Failed:', err instanceof Error ? err.message : err)
      throw err
    }
  })

  // Batch freeform: save a dropped reference image to job directory for use in batch
  ipcMain.handle('module:freeform:saveBatchRefImage', async (_event, params: {
    jobId: string
    base64: string
    mimeType: string
  }) => {
    const { jobId, base64, mimeType } = params
    const { mkdir, writeFile } = await import('fs/promises')
    const { join } = await import('path')
    const { randomBytes } = await import('crypto')
    const jobDir = getJobDirectory(jobId)
    const refDir = join(jobDir, 'chat-refs', 'batch')
    await mkdir(refDir, { recursive: true })
    const ext = mimeType === 'image/png' ? '.png' : '.jpg'
    const fileName = `batch-ref-${Date.now()}-${randomBytes(4).toString('hex')}${ext}`
    const filePath = join(refDir, fileName)
    await writeFile(filePath, Buffer.from(base64, 'base64'))
    return { filePath }
  })

  // ─────────────────────────────────────────────────────────────
  // HUMAN REVIEW MODE
  // ─────────────────────────────────────────────────────────────

  // Generate a single image for human review (4K — full quality for each iteration)
  // anchorImagePath is optional — omitted for the first image (which becomes the anchor)
  ipcMain.handle('module:freeform:humanGenerate', async (_event, params: {
    jobId: string
    assetId: string
    craftedPrompt: string
    anchorImagePath?: string
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetId, craftedPrompt, anchorImagePath, injectorIds, guardrailIds } = params
    const referenceImagePaths = [
      ...(anchorImagePath ? [{ path: anchorImagePath, role: ANCHOR_ROLE }] : []),
      ...getChatReferenceImagesForAsset(assetId)
    ]
    const version = await generateFreeformPreview({
      jobId, assetId, craftedPrompt,
      injectorIds: injectorIds || [],
      customGuardrails: guardrailIds || [],
      referenceImagePaths
    })
    // Upgrade to native_4k so the review image is full quality
    const upgraded = await updateVersion(jobId, version.id, { qualityTier: 'native_4k' })
    if (!upgraded) throw new Error('Failed to upgrade human review version to 4K')
    generateVersionNative4K(jobId, upgraded.id, (progress) => {
      sendProgress(upgraded.id, progress)
    }).catch(err => console.error('[HumanReview] generate error:', err))
    return { versionId: upgraded.id }
  })

  // Interpret casual user feedback and regenerate with corrective prompt
  // anchorImagePath is optional — omitted when refining the first image before an anchor exists
  ipcMain.handle('module:freeform:humanRefine', async (_event, params: {
    jobId: string
    assetId: string
    currentPrompt: string
    anchorImagePath?: string
    userFeedback: string
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetId, currentPrompt, anchorImagePath, userFeedback, injectorIds, guardrailIds } = params

    // Interpret casual feedback into precise correction instruction
    let refinedInstruction = userFeedback
    try {
      refinedInstruction = await interpretUserFeedback(userFeedback, currentPrompt)
      console.log(`[HumanReview] Interpreted "${userFeedback}" → "${refinedInstruction}"`)
    } catch (err) {
      console.warn('[HumanReview] Feedback interpretation failed, using raw feedback:', err)
    }

    const correctedPrompt = buildCorrectivePrompt(currentPrompt, [refinedInstruction])

    const referenceImagePaths = [
      ...(anchorImagePath ? [{ path: anchorImagePath, role: ANCHOR_ROLE }] : []),
      ...getChatReferenceImagesForAsset(assetId)
    ]
    const version = await generateFreeformPreview({
      jobId, assetId, craftedPrompt: correctedPrompt,
      injectorIds: injectorIds || [],
      customGuardrails: guardrailIds || [],
      referenceImagePaths
    })
    // Upgrade to native_4k so every refinement iteration is full quality
    const upgraded = await updateVersion(jobId, version.id, { qualityTier: 'native_4k' })
    if (!upgraded) throw new Error('Failed to upgrade refined version to 4K')
    generateVersionNative4K(jobId, upgraded.id, (progress) => {
      sendProgress(upgraded.id, progress)
    }).catch(err => console.error('[HumanReview] refine error:', err))
    return { versionId: upgraded.id, refinedInstruction, correctedPrompt }
  })

  // Approve current version — already 4K from humanGenerate/humanRefine, just mark as approved
  ipcMain.handle('module:freeform:humanApprove', async (_event, params: {
    jobId: string
    versionId: string
  }) => {
    const { jobId, versionId } = params
    // Version is already native_4k quality from the review generation step — just confirm
    const version = await updateVersion(jobId, versionId, { evaluationFlag: undefined })
    if (!version) return { ok: false, error: 'Version not found' }
    console.log(`[HumanReview] Approved 4K version: ${versionId}`)
    return { ok: true }
  })

  // ─────────────────────────────────────────────────────────────
  // HQ BATCH GENERATION HANDLERS (2K Nano Banana Pro quality)
  // ─────────────────────────────────────────────────────────────

  // HQ Batch Clean Slate generation
  ipcMain.handle('module:clean:batchGenerateHQ', async (_event, params: {
    jobId: string
    assetIds: string[]
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetIds, sourceVersionIdByAssetId, injectorIds, guardrailIds } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    for (const assetId of assetIds) {
      try {
        const version = await generateCleanSlatePreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })
        
        // Use HQ Preview generation instead of regular preview
        generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[CleanSlate HQ Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // HQ Batch Staging generation
  ipcMain.handle('module:stage:batchGenerateHQ', async (_event, params: {
    jobId: string
    assetIds: string[]
    roomType?: string
    style?: string
    roomDimensions?: { enabled: boolean; width: string; length: string; unit: 'feet' | 'meters'; backWall?: string; leftWall?: string; rightWall?: string; ceilingHeight?: string }
    sourceVersionId?: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    enableSceneMode?: boolean
    isMasterView?: boolean
  }) => {
    const { jobId, assetIds, roomType, style, roomDimensions, sourceVersionId, sourceVersionIdByAssetId, injectorIds, guardrailIds, enableSceneMode, isMasterView } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    if (enableSceneMode && isMasterView && assetIds.length > 1) {
      // Multi-angle mode: first asset is master, rest are secondary
      console.log(`[Staging HQ Batch] 🎬 Multi-angle mode: ${assetIds[0]} is master, ${assetIds.length - 1} secondary angles`)

      // Step 1: Generate master view and WAIT for HQ to complete
      const masterAssetId = assetIds[0]
      const masterSource = sourceVersionIdByAssetId?.[masterAssetId] || sourceVersionId || `original:${masterAssetId}`

      const masterVersion = await generateStagingPreview({
        jobId,
        assetId: masterAssetId,
        sourceVersionId: masterSource,
        roomType: roomType || 'living room',
        style: style || 'modern contemporary',
        roomDimensions,
        injectorIds: injectorIds || [],
        customGuardrails: guardrailIds || []
      })

      results.push({ assetId: masterAssetId, versionId: masterVersion.id })

      // Await master HQ generation so we have the output image for reference
      console.log(`[Staging HQ Batch] ⏳ Waiting for master view HQ generation to complete...`)
      const masterResult = await generateVersionHQPreview(jobId, masterVersion.id, (progress) => {
        sendProgress(masterVersion.id, progress)
      })

      if (!masterResult.success || !masterResult.outputPath) {
        console.error(`[Staging HQ Batch] ❌ Master view HQ generation failed: ${masterResult.error}`)
        // Still try the rest without reference
        for (const assetId of assetIds.slice(1)) {
          try {
            const source = sourceVersionIdByAssetId?.[assetId] || sourceVersionId || `original:${assetId}`
            const version = await generateStagingPreview({
              jobId, assetId, sourceVersionId: source,
              roomType: roomType || 'living room', style: style || 'modern contemporary',
              roomDimensions, injectorIds: injectorIds || [], customGuardrails: guardrailIds || []
            })
            generateVersionHQPreview(jobId, version.id, (progress) => {
              sendProgress(version.id, progress)
            }).catch(err => console.error('[Staging HQ Batch] Generation error:', err))
            results.push({ assetId, versionId: version.id })
          } catch (error) {
            results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
          }
        }
        return results
      }

      console.log(`[Staging HQ Batch] ✅ Master view HQ complete: ${masterResult.outputPath}`)

      // Step 2: Generate secondary angles with master's output as visual reference
      for (const assetId of assetIds.slice(1)) {
        try {
          const source = sourceVersionIdByAssetId?.[assetId] || sourceVersionId || `original:${assetId}`

          // Create version with reference to master's output
          const version = await generateSecondaryAnglePreview({
            jobId,
            assetId,
            sourceVersionId: source,
            roomType: roomType || 'living room',
            style: style || 'modern contemporary',
            roomDimensions,
            injectorIds: injectorIds || [],
            customGuardrails: guardrailIds || [],
            masterVersionId: masterVersion.id,
            furnitureSpec: {
              id: 'visual_ref',
              sceneId: '',
              masterVersionId: masterVersion.id,
              description: 'Visual reference from master view output image',
              createdAt: new Date().toISOString()
            }
          })

          generateVersionHQPreview(jobId, version.id, (progress) => {
            sendProgress(version.id, progress)
          }).catch(err => console.error('[Staging HQ Batch] Secondary angle error:', err))

          results.push({ assetId, versionId: version.id })
        } catch (error) {
          console.error(`[Staging HQ Batch] ❌ Failed to create secondary angle version for ${assetId}:`, error)
          results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }
    } else {
      // Standard mode: all assets generated independently
      for (const assetId of assetIds) {
        try {
          const source = sourceVersionIdByAssetId?.[assetId] || sourceVersionId || `original:${assetId}`

          const version = await generateStagingPreview({
            jobId,
            assetId,
            sourceVersionId: source,
            roomType: roomType || 'living room',
            style: style || 'modern contemporary',
            roomDimensions,
            injectorIds: injectorIds || [],
            customGuardrails: guardrailIds || []
          })

          generateVersionHQPreview(jobId, version.id, (progress) => {
            sendProgress(version.id, progress)
          }).catch(err => console.error('[Staging HQ Batch] Generation error:', err))

          results.push({ assetId, versionId: version.id })
        } catch (error) {
          results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
        }
      }
    }

    return results
  })

  // HQ Batch Renovate generation
  ipcMain.handle('module:renovate:batchGenerateHQ', async (_event, params: {
    jobId: string
    assetIds: string[]
    changes?: any
    sourceVersionId?: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetIds, changes, sourceVersionId, sourceVersionIdByAssetId, injectorIds, guardrailIds } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    for (const assetId of assetIds) {
      try {
        const source = sourceVersionIdByAssetId?.[assetId] || sourceVersionId || `original:${assetId}`
        
        const version = await generateRenovatePreview({
          jobId,
          assetId,
          sourceVersionId: source,
          changes: changes || {},
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })
        
        generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Renovate HQ Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // HQ Batch Twilight generation
  ipcMain.handle('module:twilight:batchGenerateHQ', async (_event, params: {
    jobId: string
    assetIds: string[]
    presetId?: string
    promptTemplate?: string
    lightingCondition?: 'overcast' | 'sunny'
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    customInstructions?: string
    referenceImagePath?: string
  }) => {
    const {
      jobId,
      assetIds,
      presetId,
      promptTemplate,
      lightingCondition,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds,
      customInstructions,
      referenceImagePath
    } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    const effectivePresetId = presetId || 'twilight_exterior_classic'
    const preset = await getPreset(effectivePresetId)
    const template = promptTemplate || preset?.promptTemplate || ''

    if (!template || template.trim().length === 0) {
      throw new Error(`Twilight HQ batchGenerate missing promptTemplate and preset not found/empty: ${effectivePresetId}`)
    }

    for (const assetId of assetIds) {
      try {
        const version = await generateTwilightPreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          presetId: effectivePresetId,
          promptTemplate: template,
          lightingCondition: lightingCondition || 'overcast',
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || '',
          referenceImagePath
        })
        
        generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Twilight HQ Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // HQ Batch ReLight generation
  ipcMain.handle('module:relight:batchGenerateHQ', async (_event, params: {
    jobId: string
    assetIds: string[]
    presetId?: string
    promptTemplate?: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    customInstructions?: string
    referenceImagePath?: string
  }) => {
    const {
      jobId,
      assetIds,
      presetId,
      promptTemplate,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds,
      customInstructions,
      referenceImagePath
    } = params
    const results: { assetId: string; versionId?: string; error?: string }[] = []

    const effectivePresetId = presetId || 'relight_blue_hour'
    const preset = await getRelightPreset(effectivePresetId)
    const template = promptTemplate || preset?.promptTemplate || ''

    if (!template || template.trim().length === 0) {
      throw new Error(`ReLight HQ batchGenerate missing promptTemplate and preset not found/empty: ${effectivePresetId}`)
    }

    for (const assetId of assetIds) {
      try {
        const version = await generateRelightPreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          presetId: effectivePresetId,
          promptTemplate: template,
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || '',
          referenceImagePath
        })
        
        generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[ReLight HQ Batch] Generation error:', err))
        
        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // HQ Batch Freeform generation
  ipcMain.handle('module:freeform:batchGenerateHQ', async (_event, params: {
    jobId: string
    assetIds: string[]
    craftedPrompt: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    customInstructions?: string
    seed?: number | null
  }) => {
    const {
      jobId,
      assetIds,
      craftedPrompt,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds,
      customInstructions,
      seed
    } = params

    const results: Array<{ assetId: string; versionId?: string; error?: string }> = []

    for (const assetId of assetIds) {
      try {
        const sourceVersionId = sourceVersionIdByAssetId?.[assetId]
        const referenceImagePaths = getChatReferenceImagesForAsset(assetId)
        const version = await generateFreeformPreview({
          jobId,
          assetId,
          craftedPrompt,
          sourceVersionId,
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || '',
          seed,
          referenceImagePaths
        })

        generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        }).catch(err => console.error('[Freeform HQ Batch] Generation error:', err))

        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // ─────────────────────────────────────────────────────────────
  // NATIVE 4K BATCH GENERATION HANDLERS (3840×2160 direct generation)
  // ─────────────────────────────────────────────────────────────

  // Native 4K Batch Clean Slate generation
  ipcMain.handle('module:clean:batchGenerateNative4K', async (_event, params: {
    jobId: string
    assetIds: string[]
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const { jobId, assetIds, sourceVersionIdByAssetId, injectorIds, guardrailIds } = params
    const results: Array<{ assetId: string; versionId?: string; error?: string }> = []

    for (const assetId of assetIds) {
      try {
        const version = await generateCleanSlatePreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })

        // Generate HQ Preview first (creates the 2K image and sets status to hq_ready)
        await generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        })

        // Create Native 4K version record and generate
        const native4KVersion = await createNative4KFromApprovedVersion({
          jobId,
          approvedVersionId: version.id
        })

        generateVersionNative4K(jobId, native4KVersion.id, (progress) => {
          sendProgress(native4KVersion.id, progress)
        }).catch(err => console.error('[Clean Slate Native 4K] Native 4K generation error:', err))

        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Native 4K Batch Twilight generation
  ipcMain.handle('module:twilight:batchGenerateNative4K', async (_event, params: {
    jobId: string
    assetIds: string[]
    sourceVersionIdByAssetId?: Record<string, string>
    presetId?: string
    promptTemplate?: string
    lightingCondition?: string
    customInstructions?: string
    injectorIds?: string[]
    guardrailIds?: string[]
    referenceImagePath?: string
  }) => {
    const {
      jobId,
      assetIds,
      sourceVersionIdByAssetId,
      presetId,
      promptTemplate,
      lightingCondition,
      customInstructions,
      injectorIds,
      guardrailIds,
      referenceImagePath
    } = params

    const effectivePresetId = presetId || 'golden-hour'
    let template = promptTemplate

    if (!template) {
      const presets = await getPresetsFromDisk()
      const preset = presets.find((p: any) => p.id === effectivePresetId)
      template = preset?.promptTemplate || DEFAULT_TWILIGHT_TEMPLATE
    }

    const results: Array<{ assetId: string; versionId?: string; error?: string }> = []

    for (const assetId of assetIds) {
      try {
        const version = await generateTwilightPreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          presetId: effectivePresetId,
          promptTemplate: template,
          lightingCondition: lightingCondition || 'twilight',
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || '',
          referenceImagePath
        })

        // Generate HQ Preview first (creates the 2K image and sets status to hq_ready)
        await generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        })

        // Create Native 4K version record and generate
        const native4KVersion = await createNative4KFromApprovedVersion({
          jobId,
          approvedVersionId: version.id
        })

        generateVersionNative4K(jobId, native4KVersion.id, (progress) => {
          sendProgress(native4KVersion.id, progress)
        }).catch(err => console.error('[Twilight Native 4K] Native 4K generation error:', err))

        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Native 4K Batch Staging generation
  ipcMain.handle('module:stage:batchGenerateNative4K', async (_event, params: {
    jobId: string
    assetIds: string[]
    roomType: string
    style: string
    roomDimensions?: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    enableSceneMode?: boolean
    isMasterView?: boolean
  }) => {
    const {
      jobId,
      assetIds,
      roomType,
      style,
      roomDimensions,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds,
      enableSceneMode,
      isMasterView
    } = params

    const results: Array<{ assetId: string; versionId?: string; error?: string }> = []

    for (const assetId of assetIds) {
      try {
        const version = await generateStagingPreview({
          jobId,
          assetId,
          roomType,
          style,
          roomDimensions,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          enableSceneMode,
          isMasterView
        })

        // Generate HQ Preview first (creates the 2K image and sets status to hq_ready)
        await generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        })

        // Create Native 4K version record and generate
        const native4KVersion = await createNative4KFromApprovedVersion({
          jobId,
          approvedVersionId: version.id
        })

        generateVersionNative4K(jobId, native4KVersion.id, (progress) => {
          sendProgress(native4KVersion.id, progress)
        }).catch(err => console.error('[Staging Native 4K] Native 4K generation error:', err))

        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Native 4K Batch Renovate generation
  ipcMain.handle('module:renovate:batchGenerateNative4K', async (_event, params: {
    jobId: string
    assetIds: string[]
    changes: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
  }) => {
    const {
      jobId,
      assetIds,
      changes,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds
    } = params

    const results: Array<{ assetId: string; versionId?: string; error?: string }> = []

    for (const assetId of assetIds) {
      try {
        const version = await generateRenovatePreview({
          jobId,
          assetId,
          changes,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || []
        })

        // Generate HQ Preview first (creates the 2K image and sets status to hq_ready)
        await generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        })

        // Create Native 4K version record and generate
        const native4KVersion = await createNative4KFromApprovedVersion({
          jobId,
          approvedVersionId: version.id
        })

        generateVersionNative4K(jobId, native4KVersion.id, (progress) => {
          sendProgress(native4KVersion.id, progress)
        }).catch(err => console.error('[Renovate Native 4K] Native 4K generation error:', err))

        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Native 4K Batch ReLight generation
  ipcMain.handle('module:relight:batchGenerateNative4K', async (_event, params: {
    jobId: string
    assetIds: string[]
    sourceVersionIdByAssetId?: Record<string, string>
    presetId?: string
    promptTemplate?: string
    customInstructions?: string
    injectorIds?: string[]
    guardrailIds?: string[]
    referenceImagePath?: string
  }) => {
    const {
      jobId,
      assetIds,
      sourceVersionIdByAssetId,
      presetId,
      promptTemplate,
      customInstructions,
      injectorIds,
      guardrailIds,
      referenceImagePath
    } = params

    const effectivePresetId = presetId || 'warm-interior'
    let template = promptTemplate

    if (!template) {
      const presets = await getRelightPresetsFromDisk()
      const preset = presets.find((p: any) => p.id === effectivePresetId)
      template = preset?.promptTemplate || DEFAULT_RELIGHT_TEMPLATE
    }

    const results: Array<{ assetId: string; versionId?: string; error?: string }> = []

    for (const assetId of assetIds) {
      try {
        const version = await generateRelightPreview({
          jobId,
          assetId,
          sourceVersionId: sourceVersionIdByAssetId?.[assetId],
          presetId: effectivePresetId,
          promptTemplate: template,
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || '',
          referenceImagePath
        })

        // Generate HQ Preview first (creates the 2K image and sets status to hq_ready)
        await generateVersionHQPreview(jobId, version.id, (progress) => {
          sendProgress(version.id, progress)
        })

        // Create Native 4K version record and generate
        const native4KVersion = await createNative4KFromApprovedVersion({
          jobId,
          approvedVersionId: version.id
        })

        generateVersionNative4K(jobId, native4KVersion.id, (progress) => {
          sendProgress(native4KVersion.id, progress)
        }).catch(err => console.error('[ReLight Native 4K] Native 4K generation error:', err))

        results.push({ assetId, versionId: version.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Native 4K Batch Freeform generation
  ipcMain.handle('module:freeform:batchGenerateNative4K', async (_event, params: {
    jobId: string
    assetIds: string[]
    craftedPrompt: string
    sourceVersionIdByAssetId?: Record<string, string>
    injectorIds?: string[]
    guardrailIds?: string[]
    customInstructions?: string
    seed?: number | null
  }) => {
    const {
      jobId,
      assetIds,
      craftedPrompt,
      sourceVersionIdByAssetId,
      injectorIds,
      guardrailIds,
      customInstructions,
      seed
    } = params

    const results: Array<{ assetId: string; versionId?: string; error?: string }> = []

    for (const assetId of assetIds) {
      try {
        const sourceVersionId = sourceVersionIdByAssetId?.[assetId]
        const referenceImagePaths = getChatReferenceImagesForAsset(assetId)
        const version = await generateFreeformPreview({
          jobId,
          assetId,
          craftedPrompt,
          sourceVersionId,
          injectorIds: injectorIds || [],
          customGuardrails: guardrailIds || [],
          customInstructions: customInstructions || '',
          seed: seed ?? undefined,
          referenceImagePaths
        })

        // Direct native 4K path for freeform: skip paid 2K/HQ generation entirely.
        // Reuse the created freeform version by switching it to native_4k tier.
        const updatedVersion = await updateVersion(jobId, version.id, {
          qualityTier: 'native_4k'
        })

        if (!updatedVersion) {
          throw new Error(`Failed to update freeform version for native 4K generation: ${version.id}`)
        }

        generateVersionNative4K(jobId, updatedVersion.id, (progress) => {
          sendProgress(updatedVersion.id, progress)
        }).catch(err => console.error('[Freeform Native 4K] Native 4K generation error:', err))

        results.push({ assetId, versionId: updatedVersion.id })
      } catch (error) {
        results.push({ assetId, error: error instanceof Error ? error.message : 'Unknown error' })
      }
    }

    return results
  })

  // Constants for UI
  ipcMain.handle('constants:getRoomTypes', async () => {
    return ROOM_TYPES
  })

  ipcMain.handle('constants:getStagingStyles', async () => {
    return STAGING_STYLES
  })

  ipcMain.handle('constants:getFloorMaterials', async () => {
    return FLOOR_MATERIALS
  })

  ipcMain.handle('constants:getFloorColors', async () => {
    return FLOOR_COLORS
  })

  ipcMain.handle('constants:getWallColors', async () => {
    return WALL_COLORS
  })

  ipcMain.handle('constants:getCurtainStyles', async () => {
    return CURTAIN_STYLES
  })

  // Debug handlers
  ipcMain.handle('debug:getLastLog', async () => {
    return generationLogger.getLastLog()
  })

  ipcMain.handle('debug:getRecentLogs', async (_event, count: number = 10) => {
    return generationLogger.getRecentLogs(count)
  })

  ipcMain.handle('provider:getResolvedProviderConfig', async (_event, params: {
    uiProvider?: 'google' | 'openrouter'
    intendedModel: string
  }) => {
    const settings = await getSettings()
    return getResolvedProviderConfig({
      uiProvider: params.uiProvider || settings.imageProvider,
      intendedModel: params.intendedModel,
      env: process.env
    })
  })

  // Cost estimation handlers
  ipcMain.handle('cost:estimateExtended', async (_event, params: {
    previewCount?: number
    hqPreviewCount?: number
    native4KCount?: number
    finalCount?: number
  }) => {
    return estimateExtendedCost(params)
  })

  ipcMain.handle('cost:getCostPerImage', async () => {
    return getCostPerImage()
  })

  // Asset working source handlers
  ipcMain.handle('asset:setWorkingSource', async (_event, params: {
    jobId: string
    assetId: string
    versionId: string | null
  }) => {
    return setWorkingSource(params)
  })
}
