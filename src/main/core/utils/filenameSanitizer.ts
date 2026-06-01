import { extname } from 'path'

/**
 * Generate a sanitized filename for an asset
 * Format: {jobId}_{assetId}_source.{ext}
 * Example: J-2026-01-03-7H2K_A-0007_source.jpg
 * 
 * This ensures no sensitive information (addresses, names) is included in filenames
 * that may be uploaded to external AI providers.
 */
export function generateSanitizedFilename(jobId: string, assetId: string, originalFilename: string): string {
  const ext = extname(originalFilename).toLowerCase()
  return `${jobId}_${assetId}_source${ext}`
}

/**
 * Extract display name from original filename (without extension)
 */
export function getDisplayName(filename: string): string {
  const ext = extname(filename)
  return filename.slice(0, -ext.length)
}

/**
 * Validate that a filename does not contain sensitive information
 * Returns true if filename appears safe (only contains jobId/assetId pattern)
 */
export function isSafeFilename(filename: string, jobId: string, assetId: string): boolean {
  // Safe pattern: {jobId}_{assetId}_source.{ext}
  const safePattern = new RegExp(`^${escapeRegex(jobId)}_${escapeRegex(assetId)}_source\\.[a-z0-9]+$`, 'i')
  return safePattern.test(filename)
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Generate sequential asset ID for a job
 * Format: A-{number} (e.g., A-0001, A-0002)
 */
export function generateAssetId(existingAssetCount: number): string {
  const num = (existingAssetCount + 1).toString().padStart(4, '0')
  return `A-${num}`
}
