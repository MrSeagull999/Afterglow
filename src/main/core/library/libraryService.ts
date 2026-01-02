import type { Version, ModuleType, VersionStatus } from '../../../shared/types'
import { getJob } from '../store/jobStore'
import { listScenesForJob } from '../store/sceneStore'
import { listAssetsForScene } from '../store/assetStore'
import { listVersionsForAsset } from '../store/versionStore'

export interface LibraryQuery {
  jobId: string
  module?: ModuleType
  status?: VersionStatus | VersionStatus[]
  sceneId?: string
  assetId?: string
  qualityTier?: 'preview' | 'final'
  approvedOnly?: boolean
  finalOnly?: boolean
}

export interface LibraryVersion extends Version {
  sceneName: string
  assetName: string
}

export async function queryLibrary(query: LibraryQuery): Promise<LibraryVersion[]> {
  const job = await getJob(query.jobId)
  if (!job) return []

  const results: LibraryVersion[] = []
  const scenes = await listScenesForJob(query.jobId)

  for (const scene of scenes) {
    if (query.sceneId && scene.id !== query.sceneId) continue

    const assets = await listAssetsForScene(query.jobId, scene.id)

    for (const asset of assets) {
      if (query.assetId && asset.id !== query.assetId) continue

      const versions = await listVersionsForAsset(query.jobId, asset.id)

      for (const version of versions) {
        if (query.module && version.module !== query.module) continue

        if (query.status) {
          const statuses = Array.isArray(query.status) ? query.status : [query.status]
          if (!statuses.includes(version.status)) continue
        }

        if (query.qualityTier && version.qualityTier !== query.qualityTier) continue

        if (query.approvedOnly && version.status !== 'approved' && version.status !== 'final_ready') continue

        if (query.finalOnly && version.status !== 'final_ready') continue

        results.push({
          ...version,
          sceneName: scene.name,
          assetName: asset.name
        })
      }
    }
  }

  return results.sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )
}

export async function getVersionsAvailableForChaining(
  jobId: string,
  targetModule: ModuleType
): Promise<LibraryVersion[]> {
  const validStatuses: VersionStatus[] = ['approved', 'final_ready']

  return queryLibrary({
    jobId,
    status: validStatuses
  })
}

export async function getCleanSlateOutputsForStaging(jobId: string, sceneId?: string): Promise<LibraryVersion[]> {
  return queryLibrary({
    jobId,
    module: 'clean',
    status: ['approved', 'final_ready'],
    sceneId
  })
}

export async function getStagedVersionsForScene(jobId: string, sceneId: string): Promise<LibraryVersion[]> {
  return queryLibrary({
    jobId,
    module: 'stage',
    sceneId
  })
}

export async function getVersionsByModule(jobId: string, module: ModuleType): Promise<LibraryVersion[]> {
  return queryLibrary({
    jobId,
    module
  })
}

export async function getApprovedVersions(jobId: string): Promise<LibraryVersion[]> {
  return queryLibrary({
    jobId,
    approvedOnly: true
  })
}

export async function getFinalVersions(jobId: string): Promise<LibraryVersion[]> {
  return queryLibrary({
    jobId,
    finalOnly: true
  })
}

export async function getJobStats(jobId: string): Promise<{
  totalAssets: number
  totalVersions: number
  versionsByModule: Record<ModuleType, number>
  approvedCount: number
  finalCount: number
}> {
  const allVersions = await queryLibrary({ jobId })

  const versionsByModule: Record<ModuleType, number> = {
    twilight: 0,
    clean: 0,
    stage: 0,
    renovate: 0
  }

  let approvedCount = 0
  let finalCount = 0
  const assetIds = new Set<string>()

  for (const version of allVersions) {
    assetIds.add(version.assetId)
    versionsByModule[version.module]++

    if (version.status === 'approved' || version.status === 'final_ready') {
      approvedCount++
    }
    if (version.status === 'final_ready') {
      finalCount++
    }
  }

  return {
    totalAssets: assetIds.size,
    totalVersions: allVersions.length,
    versionsByModule,
    approvedCount,
    finalCount
  }
}
