import { listAssetsForJob } from '../store/assetStore'
import { updateAsset } from '../store/assetStore'
import { basename } from 'path'
import { generateSanitizedFilename, getDisplayName } from '../utils/filenameSanitizer'

/**
 * Migration: Add sanitizedName to existing assets
 * 
 * For existing assets without sanitizedName:
 * - Set sanitizedName to their current stored filename
 * - Mark as legacySanitized=true
 * - Preserve displayName and originalName from current name
 * 
 * This ensures backward compatibility while enabling privacy protection
 * for all future API calls.
 */
export async function migrateAssetFilenames(jobId: string): Promise<{
  migrated: number
  skipped: number
  errors: string[]
}> {
  const results = {
    migrated: 0,
    skipped: 0,
    errors: [] as string[]
  }

  try {
    const assets = await listAssetsForJob(jobId)
    
    for (const asset of assets) {
      try {
        // Skip if already has sanitizedName
        if (asset.sanitizedName) {
          results.skipped++
          continue
        }

        // Get current filename from originalPath
        const currentFilename = basename(asset.originalPath)
        const displayName = asset.displayName || asset.name || getDisplayName(currentFilename)
        
        // For legacy assets, use current filename as sanitizedName
        // and mark as legacy so we know it wasn't generated with privacy rules
        await updateAsset(jobId, asset.id, {
          displayName: displayName,
          originalName: currentFilename,
          sanitizedName: currentFilename, // Keep existing filename
          legacySanitized: true // Mark as legacy migration
        })

        results.migrated++
        console.log(`[Migration] Migrated asset ${asset.id}: ${currentFilename}`)
        
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        results.errors.push(`Asset ${asset.id}: ${message}`)
        console.error(`[Migration] Failed to migrate asset ${asset.id}:`, error)
      }
    }

    console.log(`[Migration] Completed for job ${jobId}: ${results.migrated} migrated, ${results.skipped} skipped, ${results.errors.length} errors`)
    
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    results.errors.push(`Job ${jobId}: ${message}`)
    console.error(`[Migration] Failed to process job ${jobId}:`, error)
  }

  return results
}

/**
 * Run migration for all jobs
 */
export async function migrateAllAssetFilenames(): Promise<{
  totalMigrated: number
  totalSkipped: number
  totalErrors: number
  jobResults: Map<string, { migrated: number; skipped: number; errors: string[] }>
}> {
  const { listJobs } = await import('../store/jobStore')
  
  const summary = {
    totalMigrated: 0,
    totalSkipped: 0,
    totalErrors: 0,
    jobResults: new Map<string, { migrated: number; skipped: number; errors: string[] }>()
  }

  const jobs = await listJobs()
  
  for (const job of jobs) {
    const result = await migrateAssetFilenames(job.id)
    summary.totalMigrated += result.migrated
    summary.totalSkipped += result.skipped
    summary.totalErrors += result.errors.length
    summary.jobResults.set(job.id, result)
  }

  console.log(`[Migration] All jobs completed: ${summary.totalMigrated} migrated, ${summary.totalSkipped} skipped, ${summary.totalErrors} errors`)
  
  return summary
}
