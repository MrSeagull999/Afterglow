export interface GenerationLogEntry {
  timestamp: string
  requestId?: string
  jobId: string
  versionId: string
  provider: 'google' | 'openrouter'
  model: string
  endpoint: string
  endpointBaseUrl?: string
  resolvedBy?: 'ui' | 'env_override'
  envOverride?: { key: string; value: string }
  promptHash: string
  module: string
  selectionCount?: number
  success: boolean
  error?: string
  tokenUsage?: {
    prompt?: number
    completion?: number
    total?: number
  }
  qualityTier?: string
  requestedImageSize?: string
  requestedAspectRatio?: string
}

class GenerationLogger {
  private logs: GenerationLogEntry[] = []
  private maxLogs = 100

  log(entry: GenerationLogEntry): void {
    this.logs.unshift(entry)
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    console.log(`[GenerationLogger] ${entry.provider}/${entry.model} - ${entry.module} - ${entry.success ? 'SUCCESS' : 'FAILED'}`)
    console.log(`[GenerationLogger] Endpoint: ${entry.endpoint}`)
    if (entry.endpointBaseUrl) {
      console.log(`[GenerationLogger] Endpoint base: ${entry.endpointBaseUrl}`)
    }
    if (entry.requestId) {
      console.log(`[GenerationLogger] requestId: ${entry.requestId}`)
    }
    if (entry.resolvedBy) {
      console.log(`[GenerationLogger] resolvedBy: ${entry.resolvedBy}`)
    }
    if (entry.envOverride) {
      console.log(`[GenerationLogger] envOverride: ${entry.envOverride.key}=${entry.envOverride.value}`)
    }
    console.log(`[GenerationLogger] Prompt Hash: ${entry.promptHash}`)
    if (entry.error) {
      console.log(`[GenerationLogger] Error: ${entry.error}`)
    }
  }

  getRecentLogs(count: number = 10): GenerationLogEntry[] {
    return this.logs.slice(0, count)
  }

  getLastLog(): GenerationLogEntry | null {
    return this.logs[0] || null
  }

  clear(): void {
    this.logs = []
  }
}

export const generationLogger = new GenerationLogger()
