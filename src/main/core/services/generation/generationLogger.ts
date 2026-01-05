export interface GenerationLogEntry {
  timestamp: string
  jobId: string
  versionId: string
  provider: 'google' | 'openrouter'
  model: string
  endpoint: string
  promptHash: string
  module: string
  success: boolean
  error?: string
  tokenUsage?: {
    prompt?: number
    completion?: number
    total?: number
  }
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
