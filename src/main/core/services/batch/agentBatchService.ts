import { BrowserWindow } from 'electron'
import { generateFreeformPreview } from '../../modules/freeform/freeformModule'
import { generateVersionNative4K } from '../../modules/shared/generateService'
import { evaluateGeneration } from '../evaluation/evaluationService'
import { getVersion, updateVersion } from '../../store/versionStore'
import { buildStyleTransferPrompt, buildCorrectivePrompt, ANCHOR_ROLE } from './promptBuilders'

export interface AgentBatchParams {
  batchId: string
  jobId: string
  assetIds: string[]
  anchorImagePath: string
  promptByAssetId: Record<string, string>
  sourceVersionIdByAssetId?: Record<string, string>
  injectorIds?: string[]
  guardrailIds?: string[]
  referenceBrief?: string
  maxRefinements?: number           // default 2 (3 total attempts per asset)
  referenceMatchThreshold?: number  // default 7
}

export interface AgentBatchAssetStatus {
  batchId: string
  assetId: string
  status: 'queued' | 'generating' | 'evaluating' | 'refining' | 'done' | 'flagged' | 'error'
  attempt: number
  versionId?: string
  score?: number
  referenceMatch?: number
  issues?: string[]
  error?: string
}

/** Active batch stop requests. Set a batchId here to halt after the current asset. */
const stopRequested = new Set<string>()

export function stopAgentBatch(batchId: string): void {
  stopRequested.add(batchId)
}

function sendAgentStatus(status: AgentBatchAssetStatus): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('agentBatch:status', status)
  })
}

function sendVersionProgress(versionId: string, progress: number): void {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('version:progress', { versionId, progress })
  })
}

export async function runAgentBatch(params: AgentBatchParams): Promise<AgentBatchAssetStatus[]> {
  const {
    batchId,
    jobId,
    assetIds,
    anchorImagePath,
    promptByAssetId,
    sourceVersionIdByAssetId,
    injectorIds = [],
    guardrailIds = [],
    referenceBrief,
    maxRefinements = 2,
    referenceMatchThreshold = 7
  } = params

  // Emit queued status for all assets up front
  for (const assetId of assetIds) {
    sendAgentStatus({ batchId, assetId, status: 'queued', attempt: 0 })
  }

  const finalStatuses: AgentBatchAssetStatus[] = []

  for (const assetId of assetIds) {
    // Check if batch was stopped between assets
    if (stopRequested.has(batchId)) {
      console.log(`[AgentBatch] ${batchId} stop requested — halting after ${finalStatuses.length} assets`)
      break
    }

    const basePromptRaw = promptByAssetId[assetId]
    if (!basePromptRaw) {
      const errorStatus: AgentBatchAssetStatus = {
        batchId, assetId, status: 'error', attempt: 0, error: 'No prompt for asset'
      }
      sendAgentStatus(errorStatus)
      finalStatuses.push(errorStatus)
      continue
    }

    const sourceVersionId = sourceVersionIdByAssetId?.[assetId]

    let currentBasePrompt = buildStyleTransferPrompt(basePromptRaw, referenceBrief)
    let finalStatus: AgentBatchAssetStatus | null = null
    let lastVersionId: string | undefined

    for (let attempt = 1; attempt <= 1 + maxRefinements; attempt++) {
      const isRefinement = attempt > 1
      console.log(
        `[AgentBatch] ${batchId} asset:${assetId} attempt ${attempt}/${1 + maxRefinements}` +
        (isRefinement ? ' (refinement)' : '')
      )

      // Emit generating status
      sendAgentStatus({
        batchId, assetId,
        status: isRefinement ? 'refining' : 'generating',
        attempt,
        versionId: lastVersionId
      })

      try {
        // 1. Create version record with anchor as reference
        const version = await generateFreeformPreview({
          jobId,
          assetId,
          craftedPrompt: currentBasePrompt,
          sourceVersionId,
          injectorIds,
          customGuardrails: guardrailIds,
          referenceImagePaths: [{
            path: anchorImagePath,
            role: ANCHOR_ROLE
          }]
        })

        // 2. Mark as native_4K so the output goes to the right path
        const updatedVersion = await updateVersion(jobId, version.id, { qualityTier: 'native_4k' })
        if (!updatedVersion) throw new Error('Failed to update version quality tier')

        lastVersionId = updatedVersion.id

        // 3. Generate 4K — BLOCKING (not fire-and-forget) so we can evaluate after
        const genResult = await generateVersionNative4K(jobId, updatedVersion.id, (progress) => {
          sendVersionProgress(updatedVersion.id, progress)
        })

        if (!genResult.success || !genResult.outputPath) {
          throw new Error(genResult.error || '4K generation failed')
        }

        // 4. Evaluate against anchor
        sendAgentStatus({
          batchId, assetId, status: 'evaluating', attempt, versionId: updatedVersion.id
        })

        const evaluation = await evaluateGeneration(
          genResult.outputPath,
          'freeform',
          undefined,
          attempt,
          anchorImagePath
        )

        if (evaluation) {
          // Store evaluation in version
          await updateVersion(jobId, updatedVersion.id, { evaluation })
        }

        const referenceMatch = evaluation?.scores?.referenceMatch
        const overallScore = evaluation?.overallScore ?? 0
        const issues = evaluation?.issues ?? []
        const matchScore = referenceMatch ?? overallScore

        console.log(
          `[AgentBatch] asset:${assetId} attempt ${attempt} — ` +
          `overall:${overallScore} referenceMatch:${referenceMatch ?? 'n/a'} ` +
          `issues:${issues.length}`
        )

        const passed = matchScore >= referenceMatchThreshold
        const isLastAttempt = attempt === 1 + maxRefinements

        if (passed || isLastAttempt) {
          // Done or flagged
          const status = passed ? 'done' : 'flagged'
          if (!passed) {
            await updateVersion(jobId, updatedVersion.id, { evaluationFlag: 'needs_review' })
          }
          finalStatus = {
            batchId, assetId, status, attempt,
            versionId: updatedVersion.id,
            score: overallScore,
            referenceMatch,
            issues: passed ? undefined : issues
          }
          sendAgentStatus(finalStatus)
          break
        }

        // Build corrective prompt for next attempt
        console.log(`[AgentBatch] asset:${assetId} score ${matchScore} < threshold ${referenceMatchThreshold} — refining with issues: ${issues.join('; ')}`)
        currentBasePrompt = buildCorrectivePrompt(currentBasePrompt, issues)

      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[AgentBatch] asset:${assetId} attempt ${attempt} error: ${msg}`)
        finalStatus = {
          batchId, assetId, status: 'error', attempt,
          versionId: lastVersionId,
          error: msg
        }
        sendAgentStatus(finalStatus)
        break
      }
    }

    if (finalStatus) {
      finalStatuses.push(finalStatus)
    }
  }

  stopRequested.delete(batchId)

  // Send batch complete event
  const done = finalStatuses.filter(s => s.status === 'done').length
  const flagged = finalStatuses.filter(s => s.status === 'flagged').length
  const errors = finalStatuses.filter(s => s.status === 'error').length
  console.log(`[AgentBatch] ${batchId} complete — done:${done} flagged:${flagged} errors:${errors}`)

  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('agentBatch:complete', { batchId, done, flagged, errors })
  })

  return finalStatuses
}
