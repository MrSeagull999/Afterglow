import { JsonlResponse, extractImageFromResponse } from './jsonl'

export interface ParsedBatchResult {
  customId: string
  originalFileName: string
  runId: string
  success: boolean
  imageData?: string
  mimeType?: string
  error?: string
}

export function parseCustomId(customId: string): { runId: string; fileName: string } {
  const parts = customId.split('__')
  const runId = parts[0]
  const fileName = parts.slice(1).join('__')
  return { runId, fileName }
}

export function parseBatchResponses(responses: JsonlResponse[]): ParsedBatchResult[] {
  return responses.map(response => {
    const { runId, fileName } = parseCustomId(response.customId)
    const extracted = extractImageFromResponse(response)
    
    return {
      customId: response.customId,
      originalFileName: fileName,
      runId,
      success: extracted.success,
      imageData: extracted.imageData,
      mimeType: extracted.mimeType,
      error: extracted.error
    }
  })
}

export function groupResultsByRun(results: ParsedBatchResult[]): Map<string, ParsedBatchResult[]> {
  const grouped = new Map<string, ParsedBatchResult[]>()
  
  for (const result of results) {
    const existing = grouped.get(result.runId) || []
    existing.push(result)
    grouped.set(result.runId, existing)
  }
  
  return grouped
}

export function summarizeBatchResults(results: ParsedBatchResult[]): {
  total: number
  succeeded: number
  failed: number
  errors: string[]
} {
  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const errors = results
    .filter(r => r.error)
    .map(r => `${r.originalFileName}: ${r.error}`)
  
  return {
    total: results.length,
    succeeded,
    failed,
    errors
  }
}
