import type { GenerationStatus, Version } from './types'

export function resolveGenerationStatus(version: Version | null | undefined): GenerationStatus {
  if (!version) return 'idle'

  const gs = version.generationStatus
  if (gs) return gs

  const legacy = version.status

  if (legacy === 'generating' || legacy === 'hq_generating' || legacy === 'final_generating') {
    return 'pending'
  }

  if (legacy === 'error') {
    return 'failed'
  }

  if (legacy === 'preview_ready' || legacy === 'hq_ready' || legacy === 'final_ready' || legacy === 'approved') {
    return 'completed'
  }

  return 'idle'
}
